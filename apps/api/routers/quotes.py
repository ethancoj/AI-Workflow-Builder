"""
Module 2: Vision Quoting Engine — FastAPI Router
=================================================
Supports multiple VLM backends:
  - gemini   : Google Gemini 1.5 Flash (free tier, default for PoC)
  - gpt4o    : OpenAI GPT-4o Mini
  - claude   : Anthropic Claude Haiku

This model-agnostic design directly supports FYP Objective 2:
benchmarking VLM accuracy across models using the same rubric prompt.

Required env vars (apps/api/.env):
    GEMINI_API_KEY=...
    OPENAI_API_KEY=sk-...        (optional, for benchmarking)
    ANTHROPIC_API_KEY=sk-ant-... (optional, for benchmarking)
"""

from __future__ import annotations

import base64
import json
import os
import uuid
from typing import Literal, Optional

import google.generativeai as genai
from google import genai
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile

from merchant_auth import current_merchant_id
from pydantic import BaseModel, field_validator
from supabase import Client, create_client

# ── Router setup ──────────────────────────────────────────────────────────────

router = APIRouter(prefix="/api/quotes", tags=["Vision Quoting"])

ModelChoice = Literal["gemini", "gpt4o", "claude"]

# ── Pydantic schemas ──────────────────────────────────────────────────────────

class RubricLevel(BaseModel):
    level: int
    name: str
    description: str
    price: float
    visual_cues: list[str] = []

    @field_validator("price")
    @classmethod
    def price_must_be_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Price must be positive")
        return v


class Rubric(BaseModel):
    id: Optional[str] = None
    name: str
    service_type: str = "aircon"
    levels: list[RubricLevel]
    escalation_threshold: float = 0.75  # report: initialised at 0.75, tuned empirically

    @field_validator("levels")
    @classmethod
    def at_least_one_level(cls, v: list) -> list:
        if not v:
            raise ValueError("Rubric must have at least one level")
        return v


class AssessmentResult(BaseModel):
    assessment_id: str
    condition_level: int
    level_name: str
    price_estimate: float
    confidence: float
    reasoning: str
    key_observations: list[str]
    escalated: bool
    escalation_reason: Optional[str] = None
    model_used: str  # tracks which model produced this result


# ── Supabase ──────────────────────────────────────────────────────────────────

def _supabase() -> Client:
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_KEY"],
    )


# ── Prompt engineering (shared across all models) ─────────────────────────────

def _build_prompt(rubric: Rubric) -> str:
    """
    Same prompt is used regardless of which model is selected.
    This is intentional — it ensures benchmarking is fair since
    all models receive identical instructions and rubric context.
    """
    levels_block = ""
    for lvl in sorted(rubric.levels, key=lambda x: x.level):
        cues = "\n    - ".join(lvl.visual_cues) if lvl.visual_cues else "Use your best judgment"
        levels_block += f"""
**Level {lvl.level} — {lvl.name}** → RM{lvl.price:.0f}
  Condition: {lvl.description}
  Visual indicators:
    - {cues}
"""

    return f"""You are a professional {rubric.service_type} condition assessor helping a Malaysian small-business merchant generate accurate job quotations.

The merchant has defined the following pricing rubric:
{levels_block}

INSTRUCTIONS:
Examine the submitted photo carefully and determine which condition level it most closely matches.

REASONING CHECKLIST (think through these before answering):
1. What is the overall cleanliness and condition of the unit?
2. Are the components (fins, filters, surfaces) clearly visible or obscured?
3. Which specific visual cues from the rubric can you identify in the photo?
4. If the condition sits between two levels, which is the closer match and why?
5. How confident are you? Consider: image clarity, angle, lighting, partial visibility.

OUTPUT FORMAT:
Return ONLY a valid JSON object — no markdown fences, no preamble, no explanation outside the JSON.

{{
  "condition_level": <integer — must be one of the rubric level numbers>,
  "level_name": "<exact level name string from the rubric>",
  "price_estimate": <number — the price from the matched rubric level>,
  "confidence": <float 0.0–1.0, see calibration below>,
  "reasoning": "<2–3 sentences: what you observed and why you chose this level>",
  "key_observations": [
    "<specific visual detail you spotted>",
    "<another specific detail>"
  ]
}}

CONFIDENCE CALIBRATION:
  0.90 – 1.00 : Crystal-clear photo, condition unmistakable, perfect rubric match
  0.70 – 0.89 : Good image, condition evident, minor ambiguity between adjacent levels
  0.50 – 0.69 : Partial view, poor lighting, or condition sits between two levels
  0.30 – 0.49 : Very unclear image or hard to assess
  Below 0.30  : Photo unusable or unrelated object shown

Be conservative — it is safer to escalate an uncertain case than to give a wrong quote."""


# ── Model backends ────────────────────────────────────────────────────────────

def _parse_json(raw: str) -> dict:
    """Shared JSON parser — strips markdown fences if model ignores instructions."""
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        cleaned = raw.replace("```json", "").replace("```", "").strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Vision model returned non-JSON output: {raw[:300]}",
            ) from exc


async def _call_gemini(image_bytes: bytes, media_type: str, rubric: Rubric) -> dict:
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    
    import PIL.Image
    import io
    image = PIL.Image.open(io.BytesIO(image_bytes))
    
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[image, _build_prompt(rubric)],
        )
        return _parse_json(response.text.strip())
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Gemini API error: {exc}") from exc


async def _call_gpt4o(image_bytes: bytes, media_type: str, rubric: Rubric) -> dict:
    """OpenAI GPT-4o Mini — requires OPENAI_API_KEY and billing."""
    try:
        import openai
        client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    except KeyError:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not set in .env")

    image_b64 = base64.standard_b64encode(image_bytes).decode("utf-8")
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{media_type};base64,{image_b64}",
                            "detail": "high",
                        },
                    },
                    {"type": "text", "text": _build_prompt(rubric)},
                ],
            }],
        )
        return _parse_json(response.choices[0].message.content.strip())
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI API error: {exc}") from exc


async def _call_claude(image_bytes: bytes, media_type: str, rubric: Rubric) -> dict:
    """Anthropic Claude Haiku — requires ANTHROPIC_API_KEY and credits."""
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    except KeyError:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not set in .env")

    image_b64 = base64.standard_b64encode(image_bytes).decode("utf-8")
    try:
        response = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_b64,
                        },
                    },
                    {"type": "text", "text": _build_prompt(rubric)},
                ],
            }],
        )
        return _parse_json(response.content[0].text.strip())
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Claude API error: {exc}") from exc


# ── Endpoint ──────────────────────────────────────────────────────────────────

MODEL_LABELS = {
    "gemini": "Gemini 2.0 Flash",
    "gpt4o": "GPT-4o Mini",
    "claude": "Claude Haiku 4.5",
}


class InvalidLevelError(HTTPException):
    """The model's answer doesn't match any rubric level (often: the photo is unusable)."""


async def assess_image(rubric: Rubric, image_bytes: bytes, content_type: str, model: ModelChoice) -> tuple[dict, float, bool]:
    """
    The quoting pipeline minus HTTP: one VLM call with the shared prompt, a check that the
    level exists in the rubric, and confidence gating. Used by /assess and the workflow runtime.
    Returns (model output, confidence, escalated).
    """
    if model == "gemini":
        vlm = await _call_gemini(image_bytes, content_type, rubric)
    elif model == "gpt4o":
        vlm = await _call_gpt4o(image_bytes, content_type, rubric)
    else:
        vlm = await _call_claude(image_bytes, content_type, rubric)

    valid_levels = {lvl.level for lvl in rubric.levels}
    if vlm.get("condition_level") not in valid_levels:
        raise InvalidLevelError(
            status_code=502,
            detail=f"Model returned invalid level {vlm.get('condition_level')}. Expected one of {sorted(valid_levels)}",
        )

    confidence = float(vlm.get("confidence", 0.0))
    return vlm, confidence, confidence < rubric.escalation_threshold


def load_rubric(rubric_id: str, merchant_id: str) -> Optional[Rubric]:
    """A saved rubric, only if it belongs to this merchant."""
    rows = (
        _supabase().table("rubrics").select("*")
        .eq("id", rubric_id).eq("merchant_id", merchant_id)
        .limit(1).execute().data
    )
    if not rows:
        return None
    r = rows[0]
    return Rubric(
        id=r["id"], name=r["name"], service_type=r.get("service_type") or "aircon",
        levels=r["levels"], escalation_threshold=r.get("escalation_threshold") or 0.75,
    )


ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024


@router.post("/assess", response_model=AssessmentResult)
async def assess_photo(
    image: UploadFile = File(...),
    rubric_json: str = Form(...),
    model: ModelChoice = Form("gpt4o"),
    save: bool = Form(False),  # persist photo + result for this merchant
    merchant_id: str = Depends(current_merchant_id),
) -> AssessmentResult:
    # 1. Parse rubric
    try:
        rubric = Rubric(**json.loads(rubric_json))
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Invalid rubric: {exc}") from exc

    # 2. Validate image
    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail=f"Unsupported image type: {image.content_type}")

    image_bytes = await image.read()
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image too large — max 10 MB")

    # 3–5. Call the model, validate its answer, apply confidence gating
    vlm, confidence, escalated = await assess_image(rubric, image_bytes, image.content_type, model)
    escalation_reason = None
    if escalated:
        escalation_reason = (
            f"The AI is {confidence:.0%} sure, below your {rubric.escalation_threshold:.0%} confidence level, "
            "so this quote needs your review before it goes to the customer."
        )

    # 6. Persist (optional)
    assessment_id = str(uuid.uuid4())
    if save:
        _persist_assessment(
            assessment_id=assessment_id,
            merchant_id=merchant_id,
            rubric=rubric,
            image_bytes=image_bytes,
            content_type=image.content_type,
            filename=image.filename or "photo.jpg",
            vlm=vlm,
            confidence=confidence,
            escalated=escalated,
        )

    return AssessmentResult(
        assessment_id=assessment_id,
        condition_level=vlm["condition_level"],
        level_name=vlm["level_name"],
        price_estimate=float(vlm["price_estimate"]),
        confidence=confidence,
        reasoning=vlm.get("reasoning", ""),
        key_observations=vlm.get("key_observations", []),
        escalated=escalated,
        escalation_reason=escalation_reason,
        model_used=MODEL_LABELS[model],
    )


def _persist_assessment(*, assessment_id, merchant_id, rubric, image_bytes,
                         content_type, filename, vlm, confidence, escalated):
    try:
        sb = _supabase()
        # rubric.id comes from the browser: only keep it if this merchant owns that rubric.
        rubric_id = None
        if rubric.id:
            owned = sb.table("rubrics").select("id").eq("id", rubric.id).eq("merchant_id", merchant_id).execute().data
            rubric_id = rubric.id if owned else None
        image_path = f"{merchant_id}/{assessment_id}/{filename}"
        sb.storage.from_("quote-images").upload(
            path=image_path, file=image_bytes,
            file_options={"content-type": content_type},
        )
        # The bucket is private (NFR4), so store the object path, not a public URL.
        # Use sb.storage.from_("quote-images").create_signed_url(path, expires_in) to view it later.
        sb.table("quote_assessments").insert({
            "id": assessment_id,
            "merchant_id": merchant_id,
            "rubric_id": rubric_id,
            "image_path": image_path,
            "condition_level": vlm["condition_level"],
            "level_name": vlm["level_name"],
            "price_estimate": float(vlm["price_estimate"]),
            "confidence": confidence,
            "reasoning": vlm.get("reasoning", ""),
            "key_observations": vlm.get("key_observations", []),
            "escalated": escalated,
        }).execute()
    except Exception as exc:
        print(f"[WARN] Failed to persist assessment {assessment_id}: {exc}")


# ── Rubric CRUD ───────────────────────────────────────────────────────────────

@router.post("/rubrics")
async def create_rubric(rubric: Rubric, merchant_id: str = Depends(current_merchant_id)) -> dict:
    sb = _supabase()
    result = sb.table("rubrics").insert({
        "merchant_id": merchant_id,
        "name": rubric.name,
        "service_type": rubric.service_type,
        "levels": [lvl.model_dump() for lvl in rubric.levels],
        "escalation_threshold": rubric.escalation_threshold,
    }).execute()
    return {"id": result.data[0]["id"], "message": "Rubric saved"}


@router.get("/rubrics")
async def get_rubrics(merchant_id: str = Depends(current_merchant_id)) -> list[dict]:
    sb = _supabase()
    return sb.table("rubrics").select("*").eq("merchant_id", merchant_id).execute().data


@router.get("/assessments")
async def get_assessments(limit: int = Query(20, ge=1, le=200), merchant_id: str = Depends(current_merchant_id)) -> list[dict]:
    sb = _supabase()
    return (
        sb.table("quote_assessments")
        .select("*").eq("merchant_id", merchant_id)
        .order("created_at", desc=True).limit(limit)
        .execute().data
    )