"""
Real AI services behind the workflow runtime (see runtime/engine.py for the Services contract).

- Replies and intent classification: OpenAI GPT-4o Mini (RUNTIME_LLM_MODEL to override).
  Intent classification is a stand-in until Wang Ruoxu's Manglish NLU module is integrated.
- Photo quotes: the same pipeline as /api/quotes/assess (shared prompt, level check,
  confidence gating), with the model chosen by RUNTIME_VISION_MODEL (default gpt4o).
  A photo is "unusable" when no rubric level fits or confidence is below UNUSABLE_BELOW,
  the band the shared prompt defines as "photo unusable or unrelated object shown".
"""

from __future__ import annotations

import os
from typing import Optional

from fastapi import HTTPException

from routers.quotes import InvalidLevelError, assess_image, load_rubric
from runtime.engine import QuoteOutcome, WorkflowError

REPLY_RULES = """You are replying to a customer on WhatsApp on behalf of a Malaysian small business.
- Keep it short: 1–3 sentences, friendly, natural, no markdown.
- Match the customer's language and tone: if they write in Malay, reply in Malay; in Manglish, reply in
  casual Manglish; in English, reply in English.
- Read the whole conversation first. Use what the customer has already told you and NEVER ask again
  for something they already said (e.g. if they said the aircon is dirty, don't ask what the problem is).
  Briefly acknowledge it, then ask only for what is still missing.
- Only ask for things the business owner's instructions mention. If the customer already gave all of
  them, don't invent new questions: confirm what you understood in one short sentence.
- Never invent prices or promise times; quotes and bookings are handled by other steps.
- If asked something you can't answer, say a staff member will follow up."""


UNUSABLE_BELOW = 0.30


def _openai():
    try:
        import openai

        return openai.AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
    except KeyError:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not set in apps/api/.env")


def _llm_model() -> str:
    return os.getenv("RUNTIME_LLM_MODEL", "gpt-4o-mini")


class LiveServices:
    def __init__(self, merchant_id: str):
        self.merchant_id = merchant_id

    async def reply(self, persona: str, instructions: str, history: list[dict[str, str]]) -> str:
        system = f"{REPLY_RULES}\n\nWho you are: {persona or 'a helpful assistant for the business'}\n"
        if instructions.strip():
            system += f"What to do in this step (from the business owner): {instructions}\n"
        messages = [{"role": "system", "content": system}] + [
            {"role": "user" if h["role"] == "customer" else "assistant", "content": h["text"] or "…"}
            for h in history
        ]
        try:
            res = await _openai().chat.completions.create(
                model=_llm_model(), messages=messages, max_tokens=200, temperature=0.4
            )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"AI reply failed: {exc}") from exc
        return res.choices[0].message.content or ""

    async def classify_intent(self, text: str, intents: list[str]) -> Optional[str]:
        options = "\n".join(f"- {i}" for i in intents)
        prompt = (
            "Classify the customer's WhatsApp message (English, Malay or Manglish) into one of these intents:\n"
            f"{options}\n- none (if none of them clearly fits)\n\n"
            f"Message: {text}\n\nAnswer with the intent name only."
        )
        try:
            res = await _openai().chat.completions.create(
                model=_llm_model(), messages=[{"role": "user", "content": prompt}], max_tokens=20, temperature=0
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Intent check failed: {exc}") from exc
        answer = (res.choices[0].message.content or "").strip().strip(".\"'`").lower()
        return next((i for i in intents if i.lower() == answer), None)

    async def quote_photo(self, rubric_id: str, image: bytes, image_type: str) -> QuoteOutcome:
        rubric = load_rubric(rubric_id, self.merchant_id)
        if rubric is None:
            raise WorkflowError("The Photo Quote step’s pricing rubric no longer exists. Pick another one in the step’s settings.")
        model = os.getenv("RUNTIME_VISION_MODEL", "gpt4o")
        try:
            vlm, confidence, escalated = await assess_image(rubric, image, image_type, model)  # type: ignore[arg-type]
        except InvalidLevelError:
            # The model couldn't place the photo on the rubric (blurry, wrong object, ...): a human decides.
            return QuoteOutcome(level_name="Unclear photo", price=0, confidence=0, escalated=True,
                                reasoning="The photo didn't match any rubric level.", unusable=True)
        return QuoteOutcome(
            level_name=str(vlm.get("level_name", "")),
            price=float(vlm.get("price_estimate", 0)),
            confidence=confidence,
            escalated=escalated,
            reasoning=str(vlm.get("reasoning", "")),
            unusable=confidence < UNUSABLE_BELOW,
        )
