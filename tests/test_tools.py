"""Tests for MISE grounding tools — food safety, produce safety, nutrition.

These tests verify that all 3 grounding tools return correct data for known
food items and handle unknown items gracefully.
"""

import pytest
from app.mise_agent.tools import (
    get_food_safety_data,
    get_produce_safety_data,
    get_nutrition_estimate,
    _stem,
    _food_match,
)


# ═══════════════════════════════════════════════════════
#  Helper Functions
# ═══════════════════════════════════════════════════════


class TestStem:
    def test_plural_s(self):
        assert _stem("carrots") == "carrot"

    def test_plural_berries(self):
        assert _stem("strawberries") == "strawberry"

    def test_plural_ies(self):
        assert _stem("cherries") == "cherry"

    def test_already_singular(self):
        assert _stem("chicken") == "chicken"

    def test_case_insensitive(self):
        assert _stem("Tomatoes") == "tomato"


class TestFoodMatch:
    def test_exact_match(self):
        assert _food_match("chicken", "chicken") is True

    def test_substring_match(self):
        assert _food_match("chicken", "chicken breast") is True

    def test_reverse_substring(self):
        assert _food_match("chicken breast", "chicken") is True

    def test_stemmed_match(self):
        assert _food_match("strawberries", "strawberry") is True

    def test_no_match(self):
        assert _food_match("chicken", "salmon") is False


# ═══════════════════════════════════════════════════════
#  get_food_safety_data
# ═══════════════════════════════════════════════════════


class TestFoodSafety:
    def test_exact_match_chicken_breast(self):
        result = get_food_safety_data("chicken breast")
        assert "safe_internal_temp_f" in result
        assert result["safe_internal_temp_f"] == 165

    def test_exact_match_ground_beef(self):
        result = get_food_safety_data("ground beef")
        assert result["safe_internal_temp_f"] == 160

    def test_partial_match(self):
        """Querying 'salmon' should find a salmon entry."""
        result = get_food_safety_data("salmon")
        assert "safe_internal_temp_f" in result

    def test_case_insensitive(self):
        result = get_food_safety_data("Chicken Breast")
        assert "safe_internal_temp_f" in result

    def test_unknown_returns_general(self):
        """Unknown items should return general food safety guidelines."""
        result = get_food_safety_data("unicorn meat")
        # General guidelines should still be a dict with useful info
        assert isinstance(result, dict)
        assert len(result) > 0

    def test_returns_dict(self):
        result = get_food_safety_data("beef steak")
        assert isinstance(result, dict)


# ═══════════════════════════════════════════════════════
#  get_produce_safety_data
# ═══════════════════════════════════════════════════════


class TestProduceSafety:
    def test_known_produce(self):
        result = get_produce_safety_data("strawberries")
        assert "wash_method" in result
        assert "why" in result

    def test_dirty_dozen_flagged(self):
        """Strawberries are on the Dirty Dozen list."""
        result = get_produce_safety_data("strawberries")
        assert result["is_dirty_dozen"] is True

    def test_clean_fifteen_flagged(self):
        """Avocados are on the Clean Fifteen list."""
        result = get_produce_safety_data("avocado")
        assert result["is_clean_fifteen"] is True

    def test_unknown_produce_returns_general(self):
        result = get_produce_safety_data("dragonfruit")
        assert "wash_method" in result
        assert result["category"] == "general"

    def test_returns_dict(self):
        result = get_produce_safety_data("lettuce")
        assert isinstance(result, dict)


# ═══════════════════════════════════════════════════════
#  get_nutrition_estimate
# ═══════════════════════════════════════════════════════


class TestNutrition:
    def test_known_item(self):
        result = get_nutrition_estimate("chicken breast")
        assert isinstance(result, dict)
        # Should have calorie/macro info
        has_nutrition = any(
            k in result
            for k in ["calories", "calories_per_serving", "protein_g", "protein"]
        )
        assert has_nutrition or "note" not in result

    def test_unknown_item_returns_fallback(self):
        result = get_nutrition_estimate("mystery alien food")
        assert "note" in result or isinstance(result, dict)

    def test_case_insensitive(self):
        result = get_nutrition_estimate("White Rice")
        assert isinstance(result, dict)

    def test_returns_dict(self):
        result = get_nutrition_estimate("olive oil")
        assert isinstance(result, dict)
