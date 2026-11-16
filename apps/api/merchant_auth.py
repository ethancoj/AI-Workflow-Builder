"""
Identify the calling merchant from their Supabase login token.

The browser sends `Authorization: Bearer <access_token>` (see apps/web/src/lib/api.ts).
We ask Supabase who that token belongs to; the user's id is the merchant id.
Never trust a merchant_id sent in the request body or URL.
"""

from __future__ import annotations

import os
from functools import lru_cache

from fastapi import Header, HTTPException
from supabase import Client, create_client


@lru_cache(maxsize=1)
def _admin_client() -> Client:
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])


def current_merchant_id(authorization: str | None = Header(default=None)) -> str:
    """FastAPI dependency: returns the logged-in merchant's id, or responds 401."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not logged in.")
    token = authorization.split(" ", 1)[1].strip()

    try:
        result = _admin_client().auth.get_user(token)
    except Exception:
        result = None
    if not result or not result.user:
        raise HTTPException(status_code=401, detail="Your session has expired. Please log in again.")
    return result.user.id
