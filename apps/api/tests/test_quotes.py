"""Quote pipeline rules that don't need a real AI model: price ranges (FR2.2),
prices always coming from the merchant's rubric, and confidence gating (FR2.4)."""

import asyncio

import pytest

from routers import quotes
from routers.quotes import InvalidLevelError, Rubric, assess_image


def rubric(threshold: float = 0.75) -> Rubric:
    return Rubric(
        name="Aircon",
        escalation_threshold=threshold,
        levels=[
            {"level": 1, "name": "Clean", "description": "d", "price": 80},
            {"level": 2, "name": "Moderate", "description": "d", "price": 120, "price_max": 180},
        ],
    )


def run(monkeypatch, answer: dict, r: Rubric | None = None):
    async def fake_model(image_bytes, content_type, rub):
        return dict(answer)

    monkeypatch.setattr(quotes, "_call_gpt4o", fake_model)
    return asyncio.run(assess_image(r or rubric(), b"img", "image/jpeg", "gpt4o"))


def test_price_inside_range_is_kept(monkeypatch):
    vlm, _, _ = run(monkeypatch, {"condition_level": 2, "price_estimate": 150, "confidence": 0.9})
    assert vlm["price_estimate"] == 150
    assert (vlm["price_min"], vlm["price_max"]) == (120, 180)


@pytest.mark.parametrize("model_price, expected", [(999, 180), (10, 120), ("not a number", 120)])
def test_price_outside_range_is_clamped_to_the_rubric(monkeypatch, model_price, expected):
    vlm, _, _ = run(monkeypatch, {"condition_level": 2, "price_estimate": model_price, "confidence": 0.9})
    assert vlm["price_estimate"] == expected


def test_single_price_level_always_uses_the_merchants_price(monkeypatch):
    vlm, _, _ = run(monkeypatch, {"condition_level": 1, "price_estimate": 95, "confidence": 0.9})
    assert vlm["price_estimate"] == 80
    assert vlm["price_max"] is None


def test_low_confidence_is_escalated(monkeypatch):
    _, confidence, escalated = run(monkeypatch, {"condition_level": 1, "price_estimate": 80, "confidence": 0.6})
    assert confidence == 0.6 and escalated


def test_confidence_at_threshold_is_quoted(monkeypatch):
    _, _, escalated = run(monkeypatch, {"condition_level": 1, "price_estimate": 80, "confidence": 0.75})
    assert not escalated


def test_level_not_in_rubric_is_rejected(monkeypatch):
    with pytest.raises(InvalidLevelError):
        run(monkeypatch, {"condition_level": 7, "price_estimate": 80, "confidence": 0.9})


def test_reversed_or_equal_range_becomes_a_single_price():
    r = Rubric(name="x", levels=[{"level": 1, "name": "A", "description": "d", "price": 120, "price_max": 100}])
    assert r.levels[0].price_max is None
    assert r.levels[0].price_text() == "RM120"
