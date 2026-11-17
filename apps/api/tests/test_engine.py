"""
Unit tests for the workflow runtime (runtime/engine.py).

The AI is replaced by a fake, so these run offline, cost nothing and always give
the same result. Run from apps/api:  venv\\Scripts\\python -m pytest -v
"""

import asyncio

import pytest

from runtime.engine import Message, QuoteOutcome, WorkflowError, run_turn


class FakeServices:
    def __init__(self, intent=None, confidence=0.9, unusable=False):
        self.intent = intent
        self.confidence = confidence
        self.unusable = unusable
        self.calls = []

    async def reply(self, persona, instructions, history):
        self.calls.append(("reply", persona, history[-1]["text"]))
        return f"[{persona}] reply"

    async def classify_intent(self, text, intents):
        self.calls.append(("intent", text, intents))
        return self.intent

    async def quote_photo(self, rubric_id, image, image_type):
        self.calls.append(("quote", rubric_id))
        return QuoteOutcome(
            level_name="Dirty",
            price=150,
            confidence=self.confidence,
            escalated=self.confidence < 0.6,
            unusable=self.unusable,
        )


def node(id, type, **data):
    return {"id": id, "type": type, "position": {"x": 0, "y": 0}, "data": data}


def edge(source, target, handle=None):
    return {"id": f"{source}-{target}-{handle}", "source": source, "target": target, "sourceHandle": handle}


def aircon_flow(trigger="any_message", keywords=()):
    """Start → greet (LLM) → Condition: keyword 'quote' / intent 'booking' / else
    quote branch → Quote → quoted: thanks (End), escalated: review (End)."""
    return {
        "version": 1,
        "nodes": [
            node("s", "start", trigger=trigger, keywords=list(keywords)),
            node("greet", "llm", persona="Aircon Ali", instructions="Greet and ask what they need"),
            node("cond", "condition", branches=[
                {"id": "b-quote", "match": "keyword", "value": "quote, price"},
                {"id": "b-book", "match": "intent", "value": "booking"},
            ]),
            node("q", "quote", rubricId="rubric-1", rubricName="Aircon"),
            node("thanks", "end", message="Thanks! Reply BOOK to schedule."),
            node("review", "end", message=""),
            node("booking", "end", message="Booking coming soon."),
            node("other", "end", message="A staff member will reply."),
        ],
        "edges": [
            edge("s", "greet"),
            edge("greet", "cond"),
            edge("cond", "q", "b-quote"),
            edge("cond", "booking", "b-book"),
            edge("cond", "other", "else"),
            edge("q", "thanks", "quoted"),
            edge("q", "review", "escalated"),
        ],
    }


def run(flow, state, msg, services):
    return asyncio.run(run_turn(flow, state, msg, services))


PHOTO = Message(text="", image=b"fake-jpeg", image_type="image/jpeg")


def test_full_quote_conversation_happy_path():
    svc = FakeServices(confidence=0.9)
    flow = aircon_flow()

    t1 = run(flow, None, Message("hi"), svc)
    assert [r.text for r in t1.replies] == ["[Aircon Ali] reply"]
    assert t1.state["node"] == "cond"  # waits for the customer's answer before routing

    t2 = run(flow, t1.state, Message("can I get a quote?"), svc)
    assert t2.replies[0].text.startswith("Could you send a clear photo")
    assert t2.state["node"] == "q"  # waits at the Quote step for a photo

    t3 = run(flow, t2.state, PHOTO, svc)
    assert t3.replies[0].kind == "quote"
    assert "RM150" in t3.replies[0].text
    assert t3.replies[1].text == "Thanks! Reply BOOK to schedule."
    assert t3.finished and t3.state["node"] is None


def test_low_confidence_photo_goes_down_escalated_exit():
    svc = FakeServices(confidence=0.4)
    flow = aircon_flow()
    state = {"node": "q", "history": []}
    t = run(flow, state, PHOTO, svc)
    assert t.replies[0].kind == "escalation"
    assert [s.node_id for s in t.trace][-1] == "review"
    assert t.finished


def test_quote_step_keeps_asking_until_a_photo_arrives():
    svc = FakeServices()
    t = run(aircon_flow(), {"node": "q", "history": []}, Message("here you go"), svc)
    assert t.state["node"] == "q"
    assert ("quote", "rubric-1") not in svc.calls


def test_keyword_trigger_ignores_unrelated_messages():
    flow = aircon_flow(trigger="keyword", keywords=["aircon", "servis"])
    t = run(flow, None, Message("hello there"), FakeServices())
    assert t.replies == [] and t.started is False

    t = run(flow, None, Message("Nak SERVIS aircon"), FakeServices())
    assert t.started and t.replies


def test_keywords_match_whole_words_only():
    flow = aircon_flow(trigger="keyword", keywords=["ac"])
    assert run(flow, None, Message("I need a backup"), FakeServices()).started is False
    assert run(flow, None, Message("my AC is broken"), FakeServices()).started is True


def test_intent_branch_uses_the_classifier():
    svc = FakeServices(intent="booking")
    t = run(aircon_flow(), {"node": "cond", "history": []}, Message("bila boleh datang?"), svc)
    assert t.replies[-1].text == "Booking coming soon."
    assert svc.calls[0] == ("intent", "bila boleh datang?", ["booking"])


def test_unmatched_message_takes_otherwise_exit():
    t = run(aircon_flow(), {"node": "cond", "history": []}, Message("random"), FakeServices(intent=None))
    assert t.replies[-1].text == "A staff member will reply."


def test_keyword_branch_is_checked_before_calling_the_classifier():
    svc = FakeServices(intent="booking")
    run(aircon_flow(), {"node": "cond", "history": []}, Message("what's the price"), svc)
    assert not any(c[0] == "intent" for c in svc.calls)


def test_missing_edge_ends_the_conversation():
    flow = {"version": 1, "nodes": [node("s", "start", trigger="any_message", keywords=[])], "edges": []}
    t = run(flow, None, Message("hi"), FakeServices())
    assert t.finished


def test_finished_conversation_restarts_from_start():
    svc = FakeServices()
    flow = aircon_flow()
    done = run(flow, {"node": "cond", "history": []}, Message("random"), svc)
    assert done.finished
    again = run(flow, done.state, Message("hi again"), svc)
    assert again.state["node"] == "cond"


def test_deleted_step_in_saved_state_starts_over():
    t = run(aircon_flow(), {"node": "no-longer-exists", "history": []}, Message("hi"), FakeServices())
    assert t.state["node"] == "cond"


def test_loops_without_waiting_are_stopped():
    flow = {
        "version": 1,
        "nodes": [
            node("s", "start", trigger="any_message", keywords=[]),
            node("c1", "condition", branches=[]),
            node("c2", "condition", branches=[]),
        ],
        "edges": [edge("s", "c1"), edge("c1", "c2", "else"), edge("c2", "c1", "else")],
    }
    with pytest.raises(WorkflowError, match="looping"):
        run(flow, None, Message("hi"), FakeServices())


def test_quote_without_rubric_is_a_workflow_error():
    flow = aircon_flow()
    next(n for n in flow["nodes"] if n["id"] == "q")["data"]["rubricId"] = None
    with pytest.raises(WorkflowError, match="rubric"):
        run(flow, {"node": "q", "history": []}, PHOTO, FakeServices())


def test_rejects_unknown_format_and_missing_start():
    with pytest.raises(WorkflowError, match="format"):
        run({"version": 2, "nodes": [], "edges": []}, None, Message("hi"), FakeServices())
    with pytest.raises(WorkflowError, match="Start"):
        run({"version": 1, "nodes": [], "edges": []}, None, Message("hi"), FakeServices())


def test_llm_gets_the_conversation_history():
    svc = FakeServices()
    run(aircon_flow(), None, Message("hello"), svc)
    assert svc.calls[0] == ("reply", "Aircon Ali", "hello")


def test_unusable_photo_gets_a_retry_instead_of_ending():
    svc = FakeServices(confidence=0.1, unusable=True)
    t = run(aircon_flow(), {"node": "q", "history": []}, PHOTO, svc)
    assert t.replies[0].text.startswith("Sorry, I couldn't make it out")
    assert t.state["node"] == "q" and not t.finished
    assert t.state["photo_attempts"] == 1


def test_after_two_unusable_photos_a_human_takes_over():
    svc = FakeServices(confidence=0.1, unusable=True)
    flow = aircon_flow()
    state = {"node": "q", "history": []}
    for _ in range(2):
        state = run(flow, state, PHOTO, svc).state
    final = run(flow, state, PHOTO, svc)
    assert final.replies[0].kind == "escalation"
    assert final.finished  # this flow's escalated exit leads to an End step


def test_good_photo_after_a_retry_is_quoted():
    flow = aircon_flow()
    bad = run(flow, {"node": "q", "history": []}, PHOTO, FakeServices(confidence=0.1, unusable=True))
    good = run(flow, bad.state, PHOTO, FakeServices(confidence=0.9))
    assert good.replies[0].kind == "quote"


def test_silent_ending_sends_the_safety_net_and_flags_follow_up():
    flow = aircon_flow()
    next(n for n in flow["nodes"] if n["id"] == "other")["data"]["message"] = ""
    t = run(flow, {"node": "cond", "history": []}, Message("random"), FakeServices())
    assert [r.kind for r in t.replies] == ["fallback"]
    assert t.needs_follow_up and t.finished


def test_dead_end_without_any_step_also_gets_the_safety_net():
    flow = {"version": 1, "nodes": [node("s", "start", trigger="any_message", keywords=[])], "edges": []}
    t = run(flow, None, Message("hi"), FakeServices())
    assert t.replies[0].kind == "fallback" and t.needs_follow_up


def test_normal_replies_do_not_trigger_the_safety_net():
    t = run(aircon_flow(), None, Message("hi"), FakeServices())
    assert all(r.kind != "fallback" for r in t.replies) and not t.needs_follow_up
