"""
Translation layer / workflow runtime (FYP Objective 5)
=====================================================
Executes a saved builder workflow (the `WorkflowJson` contract from
apps/web/src/lib/workflow/types.ts, version 1) one customer message at a time.

`run_turn(flow, state, message, services)` is a pure step function:
  - flow:     the workflow JSON {version, nodes, edges}
  - state:    where this conversation is (from the previous turn, or None for a new one)
  - message:  the customer's new message (text and/or a photo)
  - services: the AI calls (reply generation, intent classification, photo quoting),
              injected so the same engine runs behind the builder's test chat, the
              WhatsApp webhook, and the automated tests (with fakes).
It returns the bot's replies, the new state, and a trace of the steps that ran.

Execution rules (one message = one turn):
  start      checks the trigger (any message / keyword); passes straight through.
  llm        writes one reply in the merchant's persona, then WAITS for the customer's
             next message if the following step needs fresh input (llm, condition, quote).
  condition  routes on the current message: keyword branches match words directly,
             intent branches are classified by the AI; no match -> the "else" exit.
  quote      needs a photo: without one it asks for it and waits here; with one it runs
             the vision assessment and leaves through "quoted" or "escalated". An unusable
             photo (wrong object, too unclear) gets a request for a clearer one instead,
             up to MAX_PHOTO_RETRIES times, then goes to "escalated" for a human. A following
             llm step replies straight away; a condition/quote waits for the next message.
  end        sends its closing message (if any) and finishes the conversation.
A missing edge also finishes the conversation. The next message after a finished
conversation starts the workflow again from Start.

Safety net: workflows are built by non-technical merchants, so mistakes are expected.
If a turn would leave the customer with no reply at all (e.g. a path that ends at an
End step without a message), the engine sends SAFETY_NET_REPLY and marks the turn
`needs_follow_up` so a human can pick the conversation up. Customers are never ignored.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Optional, Protocol

SUPPORTED_VERSION = 1
MAX_STEPS_PER_TURN = 25  # guards against loops drawn on the canvas
MAX_HISTORY = 20  # messages kept as context for LLM replies
MAX_PHOTO_RETRIES = 2  # unusable photos re-requested before a human takes over

CONDITION_ELSE = "else"
QUOTE_QUOTED = "quoted"
QUOTE_ESCALATED = "escalated"

# Steps that need a new customer message before they can run, so an LLM reply
# pauses the conversation before them instead of running them on the same message.
NEEDS_FRESH_INPUT = {"llm", "condition", "quote"}

SAFETY_NET_REPLY = "Thanks for your message! Someone from our team will get back to you shortly."
ASK_FOR_PHOTO = "Could you send a clear photo of the unit? I'll use it to estimate the price."
ASK_FOR_CLEARER_PHOTO = (
    "Sorry, I couldn't make out the unit in that photo. Could you send another one, "
    "taken closer and in good light?"
)


class WorkflowError(Exception):
    """The workflow can't run as drawn (e.g. no Start step, unknown version)."""


# ── Data passed in and out ────────────────────────────────────────────────────

@dataclass
class Message:
    text: str = ""
    image: Optional[bytes] = None
    image_type: Optional[str] = None

    @property
    def has_photo(self) -> bool:
        return self.image is not None


@dataclass
class QuoteOutcome:
    level_name: str
    price: float
    confidence: float
    escalated: bool
    reasoning: str = ""
    unusable: bool = False  # the photo couldn't be assessed at all (wrong object, too unclear)


@dataclass
class Reply:
    text: str
    kind: str = "text"  # "text" | "quote" | "escalation" | "fallback" (the safety net)
    quote: Optional[QuoteOutcome] = None


@dataclass
class TraceStep:
    node_id: str
    node_type: str
    note: str


@dataclass
class TurnResult:
    replies: list[Reply]
    state: dict[str, Any]
    trace: list[TraceStep] = field(default_factory=list)
    finished: bool = False  # the conversation reached its end on this turn
    started: bool = True  # False when a new conversation didn't match the Start trigger
    needs_follow_up: bool = False  # the safety net replied; a human should take over


class Services(Protocol):
    async def reply(self, persona: str, instructions: str, history: list[dict[str, str]]) -> str: ...

    async def classify_intent(self, text: str, intents: list[str]) -> Optional[str]: ...

    async def quote_photo(self, rubric_id: str, image: bytes, image_type: str) -> QuoteOutcome: ...


# ── Graph helpers ─────────────────────────────────────────────────────────────

class Graph:
    def __init__(self, flow: dict[str, Any]):
        if not isinstance(flow, dict) or flow.get("version") != SUPPORTED_VERSION:
            raise WorkflowError("This workflow was saved in an unsupported format.")
        self.nodes: dict[str, dict[str, Any]] = {}
        for n in flow.get("nodes") or []:
            if isinstance(n, dict) and isinstance(n.get("id"), str):
                self.nodes[n["id"]] = n
        self.edges = [e for e in flow.get("edges") or [] if isinstance(e, dict)]

    def start_node(self) -> dict[str, Any]:
        starts = [n for n in self.nodes.values() if n.get("type") == "start"]
        if not starts:
            raise WorkflowError("The workflow has no Start step.")
        return starts[0]

    def next_id(self, node_id: str, handle: Optional[str] = None) -> Optional[str]:
        """Target of the edge leaving `node_id` through `handle` (None = the plain exit)."""
        for e in self.edges:
            if e.get("source") == node_id and (e.get("sourceHandle") or None) == handle:
                target = e.get("target")
                return target if target in self.nodes else None
        return None


def quote_message(outcome: QuoteOutcome) -> str:
    """Customer-facing quote: natural wording, clearly an estimate, and an obvious next step."""
    return (
        f"Thanks for the photo! From what I can see, it matches our “{outcome.level_name}” level. "
        f"The estimated price is RM{outcome.price:.0f}. Our technician will confirm the final price on site. "
        "Would you like to book a visit?"
    )


def _words(text: str) -> list[str]:
    return [w.strip().lower() for w in re.split(r"[,\n]", text or "") if w.strip()]


def _contains_keyword(text: str, keywords: list[str]) -> Optional[str]:
    """Case-insensitive whole-word/phrase match. Returns the keyword that matched."""
    lowered = (text or "").lower()
    for kw in keywords:
        kw = kw.strip().lower()
        if kw and re.search(rf"(?<!\w){re.escape(kw)}(?!\w)", lowered):
            return kw
    return None


def _new_state() -> dict[str, Any]:
    return {"node": None, "history": [], "photo_attempts": 0}


def _clean_state(state: Optional[dict[str, Any]], graph: Graph) -> dict[str, Any]:
    """Accepts state from a previous turn; anything malformed or stale starts over."""
    if not isinstance(state, dict):
        return _new_state()
    node = state.get("node")
    history = state.get("history")
    if node is not None and node not in graph.nodes:
        return _new_state()  # the step was deleted from the canvas since the last turn
    if not isinstance(history, list):
        history = []
    history = [
        {"role": h["role"], "text": str(h.get("text", ""))[:2000]}
        for h in history
        if isinstance(h, dict) and h.get("role") in ("customer", "bot")
    ][-MAX_HISTORY:]
    attempts = state.get("photo_attempts")
    attempts = attempts if isinstance(attempts, int) and 0 <= attempts <= MAX_PHOTO_RETRIES else 0
    return {"node": node, "history": history, "photo_attempts": attempts}


# ── The step function ─────────────────────────────────────────────────────────

async def run_turn(
    flow: dict[str, Any],
    state: Optional[dict[str, Any]],
    message: Message,
    services: Services,
) -> TurnResult:
    graph = Graph(flow)
    st = _clean_state(state, graph)
    replies: list[Reply] = []
    trace: list[TraceStep] = []

    def say(reply: Reply) -> None:
        replies.append(reply)
        st["history"].append({"role": "bot", "text": reply.text})

    def finish() -> TurnResult:
        if not replies:
            # Never leave a customer without an answer, whatever the merchant drew.
            say(Reply(SAFETY_NET_REPLY, kind="fallback"))
            trace.append(TraceStep(
                trace[-1].node_id if trace else "", trace[-1].node_type if trace else "",
                "The workflow had no reply here, so the safety-net message was sent and the chat flagged for follow-up",
            ))
            return TurnResult(replies, _new_state(), trace, finished=True, needs_follow_up=True)
        return TurnResult(replies, _new_state(), trace, finished=True)

    def wait_at(node_id: str) -> TurnResult:
        st["node"] = node_id
        st["history"] = st["history"][-MAX_HISTORY:]
        return TurnResult(replies, st, trace)

    st["history"].append({"role": "customer", "text": message.text or ("[photo]" if message.has_photo else "")})

    # A new conversation has to pass the Start trigger.
    if st["node"] is None:
        start = graph.start_node()
        data = start.get("data") or {}
        if data.get("trigger") == "keyword":
            keywords = [k for k in data.get("keywords") or [] if isinstance(k, str)]
            matched = _contains_keyword(message.text, keywords)
            if not matched:
                trace.append(TraceStep(start["id"], "start", "Message didn't contain a start keyword, so the workflow didn't start"))
                return TurnResult([], _new_state(), trace, started=False)
            trace.append(TraceStep(start["id"], "start", f"Started: matched keyword “{matched}”"))
        else:
            trace.append(TraceStep(start["id"], "start", "Started: any message"))
        current = graph.next_id(start["id"])
    else:
        current = st["node"]

    for _ in range(MAX_STEPS_PER_TURN):
        if current is None:
            if trace:
                trace.append(TraceStep(trace[-1].node_id, trace[-1].node_type, "No next step connected, so the conversation ended"))
            return finish()

        node = graph.nodes[current]
        ntype = node.get("type")
        data = node.get("data") or {}

        if ntype == "start":  # an edge looped back to Start: just pass through
            current = graph.next_id(current)

        elif ntype == "llm":
            text = (await services.reply(data.get("persona", ""), data.get("instructions", ""), list(st["history"]))).strip()
            say(Reply(text or "…"))
            trace.append(TraceStep(current, "llm", "Replied to the customer"))
            nxt = graph.next_id(current)
            if nxt is not None and graph.nodes[nxt].get("type") in NEEDS_FRESH_INPUT:
                trace.append(TraceStep(current, "llm", "Waiting for the customer’s next message"))
                return wait_at(nxt)
            current = nxt

        elif ntype == "condition":
            branches = [b for b in data.get("branches") or [] if isinstance(b, dict) and b.get("id")]
            chosen: Optional[str] = None
            note = ""
            for b in branches:
                if b.get("match") == "keyword":
                    kw = _contains_keyword(message.text, _words(b.get("value", "")))
                    if kw:
                        chosen, note = b["id"], f"Keyword “{kw}” matched"
                        break
            if chosen is None:
                intent_branches = [b for b in branches if b.get("match") == "intent" and str(b.get("value", "")).strip()]
                if intent_branches and message.text.strip():
                    intents = [str(b["value"]).strip() for b in intent_branches]
                    found = await services.classify_intent(message.text, intents)
                    for b in intent_branches:
                        if found and str(b["value"]).strip().lower() == found.lower():
                            chosen, note = b["id"], f"Intent “{b['value']}” detected"
                            break
            if chosen is None:
                chosen, note = CONDITION_ELSE, "No branch matched, took “Otherwise”"
            trace.append(TraceStep(current, "condition", note))
            current = graph.next_id(current, chosen)

        elif ntype == "quote":
            rubric_id = data.get("rubricId")
            if not rubric_id:
                raise WorkflowError("A Quote step has no pricing rubric selected.")
            if not message.has_photo:
                say(Reply(ASK_FOR_PHOTO))
                trace.append(TraceStep(current, "quote", "No photo yet, asked the customer for one"))
                return wait_at(current)
            outcome = await services.quote_photo(rubric_id, message.image or b"", message.image_type or "image/jpeg")
            if outcome.unusable and st["photo_attempts"] < MAX_PHOTO_RETRIES:
                st["photo_attempts"] += 1
                say(Reply(ASK_FOR_CLEARER_PHOTO))
                trace.append(TraceStep(
                    current, "quote",
                    f"Photo couldn’t be assessed, asked for a clearer one (try {st['photo_attempts']} of {MAX_PHOTO_RETRIES})",
                ))
                return wait_at(current)
            st["photo_attempts"] = 0
            if outcome.escalated:
                say(Reply(
                    "Thanks for the photo! Our team will check it and confirm your quote shortly.",
                    kind="escalation",
                    quote=outcome,
                ))
                why = "Still no usable photo" if outcome.unusable else f"Low confidence ({outcome.confidence:.0%})"
                trace.append(TraceStep(current, "quote", f"{why}, sent for human review"))
                current = graph.next_id(current, QUOTE_ESCALATED)
            else:
                say(Reply(quote_message(outcome), kind="quote", quote=outcome))
                trace.append(TraceStep(current, "quote", f"Quoted {outcome.level_name}, RM{outcome.price:.0f} ({outcome.confidence:.0%} confident)"))
                current = graph.next_id(current, QUOTE_QUOTED)
            # The photo message is used up: a Condition or another Quote waits for a new message.
            # An LLM step runs straight away so it can follow up on the quote (e.g. offer a booking).
            if current is not None and graph.nodes[current].get("type") in ("condition", "quote"):
                return wait_at(current)

        elif ntype == "end":
            closing = str(data.get("message") or "").strip()
            if closing:
                say(Reply(closing))
            if replies:
                trace.append(TraceStep(current, "end", "Conversation finished"))
            else:
                trace.append(TraceStep(current, "end", "Reached an End step with no message: add one so customers get a proper reply"))
            return finish()

        else:
            raise WorkflowError(f"Unknown step type: {ntype!r}")

    raise WorkflowError("The workflow kept looping without waiting for the customer. Check for a loop on the canvas.")
