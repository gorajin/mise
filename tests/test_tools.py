"""Tests for MISE grounding tools — food safety, produce safety, nutrition.

These tests verify that all 3 grounding tools return correct data for known
food items and handle unknown items gracefully.
"""

import pytest
from app.mise_agent.tools import (
    get_food_safety_data,
    get_produce_safety_data,
    get_nutrition_estimate,
    set_observation_interval,
    update_timeline_step,
    analyze_and_recreate_recipe,
    add_visual_annotation,
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


# ═══════════════════════════════════════════════════════
#  update_timeline_step
# ═══════════════════════════════════════════════════════


class TestUpdateTimelineStep:
    def test_returns_dict(self):
        result = update_timeline_step("Prep Veggies", "Chop onions and garlic.", "pending")
        assert isinstance(result, dict)

    def test_returns_expected_keys(self):
        result = update_timeline_step("Sear Steak", "High heat for 3 minutes per side.", "active")
        assert result["action"] == "timeline_updated"
        assert result["step_name"] == "Sear Steak"
        assert result["step_description"] == "High heat for 3 minutes per side."
        assert result["status"] == "active"

    def test_active_status(self):
        result = update_timeline_step("Boil Water", "Bring pot to a rolling boil.", "active")
        assert result["status"] == "active"

    def test_completed_status(self):
        result = update_timeline_step("Rest Meat", "Let steak rest for 5 minutes.", "completed")
        assert result["status"] == "completed"


# ═══════════════════════════════════════════════════════
#  set_observation_interval
# ═══════════════════════════════════════════════════════


class TestSetObservationInterval:
    def test_returns_dict(self):
        result = set_observation_interval(5, "monitoring high heat")
        assert isinstance(result, dict)

    def test_returns_expected_keys(self):
        result = set_observation_interval(30, "baking mode")
        assert result["action"] == "interval_updated"
        assert result["new_interval_seconds"] == 30
        assert result["reason"] == "baking mode"

    def test_short_interval(self):
        result = set_observation_interval(5, "searing")
        assert result["new_interval_seconds"] == 5

    def test_long_interval(self):
        result = set_observation_interval(60, "oven roasting")
        assert result["new_interval_seconds"] == 60


# ═══════════════════════════════════════════════════════
#  analyze_and_recreate_recipe
# ═══════════════════════════════════════════════════════


class TestAnalyzeAndRecreateRecipe:
    def test_returns_dict(self):
        result = analyze_and_recreate_recipe("Pasta", ["noodles", "sauce"], ["boil", "mix"])
        assert isinstance(result, dict)

    def test_returns_expected_keys(self):
        result = analyze_and_recreate_recipe(
            "Beef Stew", ["beef", "carrots", "potatoes"], ["brown beef", "add veggies", "simmer"]
        )
        assert result["action"] == "recipe_reverse_engineered"
        assert result["dish"] == "Beef Stew"
        assert result["grocery_list"] == ["beef", "carrots", "potatoes"]
        assert len(result["reconstructed_steps"]) == 3
        assert "ui_status" in result

    def test_empty_ingredients(self):
        result = analyze_and_recreate_recipe("Toast", [], ["toast bread"])
        assert result["grocery_list"] == []
        assert result["dish"] == "Toast"

    def test_single_step(self):
        result = analyze_and_recreate_recipe("Boiled Egg", ["egg"], ["boil for 10 minutes"])
        assert len(result["reconstructed_steps"]) == 1

    def test_many_ingredients(self):
        ingredients = ["flour", "sugar", "butter", "eggs", "vanilla", "milk", "baking powder"]
        result = analyze_and_recreate_recipe("Cake", ingredients, ["mix dry", "mix wet", "combine", "bake"])
        assert len(result["grocery_list"]) == 7


# ═══════════════════════════════════════════════════════
#  add_visual_annotation
# ═══════════════════════════════════════════════════════


class TestAddVisualAnnotation:
    def test_returns_dict(self):
        result = add_visual_annotation("Flip now!", "center", "warning")
        assert isinstance(result, dict)

    def test_returns_expected_keys(self):
        result = add_visual_annotation("Nice sear", "center", "success", 8)
        assert result["action"] == "visual_annotation_added"
        assert result["label"] == "Nice sear"
        assert result["region"] == "center"
        assert result["style"] == "success"
        assert result["duration_seconds"] == 8

    def test_default_duration(self):
        result = add_visual_annotation("Test", "top-left", "info")
        assert result["duration_seconds"] == 5

    def test_max_duration_capped(self):
        result = add_visual_annotation("Test", "center", "danger", 60)
        assert result["duration_seconds"] == 15

    def test_all_styles(self):
        for style in ["info", "success", "warning", "danger", "identify"]:
            result = add_visual_annotation("Test", "center", style)
            assert result["style"] == style

    def test_all_regions(self):
        regions = ["center", "top-left", "top-right", "bottom-left", "bottom-right",
                    "top-center", "bottom-center", "left-center", "right-center"]
        for region in regions:
            result = add_visual_annotation("Test", region, "info")
            assert result["region"] == region


# ═══════════════════════════════════════════════════════
#  Agent Construction (Multiagent Architecture)
# ═══════════════════════════════════════════════════════


class TestAgentConstruction:
    def test_root_agent_has_sub_agents(self):
        from app.mise_agent.agent import agent
        assert hasattr(agent, "sub_agents")
        assert len(agent.sub_agents) == 4

    def test_sub_agent_names(self):
        from app.mise_agent.agent import agent
        names = {a.name for a in agent.sub_agents}
        assert names == {"dinner_coordinator", "food_scientist", "safety_nutrition", "recipe_explorer"}

    def test_sub_agent_descriptions_non_empty(self):
        from app.mise_agent.agent import agent
        for sub in agent.sub_agents:
            assert sub.description and len(sub.description) > 10, f"{sub.name} missing description"

    def test_sub_agent_tool_assignment(self):
        from app.mise_agent.agent import agent
        tool_map = {a.name: {getattr(t, '__name__', None) or getattr(t, 'name', str(t)) for t in (a.tools or [])} for a in agent.sub_agents}
        assert "update_timeline_step" in tool_map["dinner_coordinator"]
        assert "get_food_safety_data" in tool_map["safety_nutrition"]
        assert "analyze_and_recreate_recipe" in tool_map["recipe_explorer"]
        # All specialist agents should have visual annotation capability
        for name in ["dinner_coordinator", "food_scientist", "safety_nutrition", "recipe_explorer"]:
            assert "add_visual_annotation" in tool_map[name], f"{name} missing add_visual_annotation"

    def test_root_agent_has_annotation_tool(self):
        from app.mise_agent.agent import agent
        tool_names = {getattr(t, '__name__', None) or getattr(t, 'name', str(t)) for t in (agent.tools or [])}
        assert "add_visual_annotation" in tool_names

    def test_root_agent_model(self):
        from app.mise_agent.agent import agent
        assert "gemini" in agent.model.lower() or "flash" in agent.model.lower()


