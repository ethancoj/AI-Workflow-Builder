"""
Workflow runtime endpoints.

POST /api/runtime/test runs one customer message through a workflow, for the builder's
test chat. It takes the canvas as it is now (saved or not); the caller keeps the returned
`state` and sends it back with the next message. Nothing is sent to real customers.
The WhatsApp webhook will call the same engine with state stored per customer.
"""

from __future__ import annotations

import json
from dataclasses import asdict
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from merchant_auth import current_merchant_id
from routers.quotes import ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES
from runtime.engine import Message, WorkflowError, run_turn
from runtime.services import LiveServices

router = APIRouter(prefix="/api/runtime", tags=["Workflow runtime"])

MAX_FLOW_CHARS = 500_000
MAX_TEXT_CHARS = 2_000


def _json_field(raw: Optional[str], name: str):
    if not raw:
        return None
    if len(raw) > MAX_FLOW_CHARS:
        raise HTTPException(status_code=413, detail=f"{name} is too large")
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail=f"{name} is not valid JSON") from exc


@router.post("/test")
async def test_message(
    flow_json: str = Form(...),
    state_json: Optional[str] = Form(None),
    text: str = Form(""),
    image: Optional[UploadFile] = File(None),
    merchant_id: str = Depends(current_merchant_id),
) -> dict:
    flow = _json_field(flow_json, "flow_json")
    state = _json_field(state_json, "state_json")
    text = text[:MAX_TEXT_CHARS]

    image_bytes = image_type = None
    if image is not None:
        if image.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=415, detail=f"Unsupported image type: {image.content_type}")
        image_bytes = await image.read()
        if len(image_bytes) > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail="Image too large — max 10 MB")
        image_type = image.content_type

    if not text.strip() and image_bytes is None:
        raise HTTPException(status_code=422, detail="Send a message or a photo.")

    try:
        result = await run_turn(flow, state, Message(text, image_bytes, image_type), LiveServices(merchant_id))
    except WorkflowError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return {
        "replies": [asdict(r) for r in result.replies],
        "state": result.state,
        "trace": [asdict(t) for t in result.trace],
        "finished": result.finished,
        "started": result.started,
        "needs_follow_up": result.needs_follow_up,
    }
