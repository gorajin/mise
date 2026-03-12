"""MISE Agent Tools — Food safety and produce safety grounding tools."""

import json
import os

_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
_FOOD_SAFETY_DB = None
_PRODUCE_SAFETY_DB = None
_NUTRITION_DB = None


def _stem(word: str) -> str:
    """Simple food-specific stemming to handle plural/singular variations."""
    w = word.lower().strip()
    # Handle common food plurals
    for suffix, replacement in [("berries", "berry"), ("ies", "y"), ("ves", "f"), ("es", ""), ("s", "")]:
        if w.endswith(suffix) and len(w) > len(suffix) + 2:
            return w[:-len(suffix)] + replacement
    return w


def _food_match(query: str, candidate: str) -> bool:
    """Check if a query matches a candidate food name (handles plurals)."""
    q = query.lower().strip()
    c = candidate.lower().strip()
    # Direct or substring match
    if q == c or q in c or c in q:
        return True
    # Stemmed match
    if _stem(q) == _stem(c):
        return True
    return False


def _load_food_safety_db() -> dict:
    """Lazy-load the USDA food safety database."""
    global _FOOD_SAFETY_DB
    if _FOOD_SAFETY_DB is None:
        db_path = os.path.join(_DATA_DIR, "food_safety.json")
        with open(db_path, "r") as f:
            _FOOD_SAFETY_DB = json.load(f)
    return _FOOD_SAFETY_DB


def _load_produce_safety_db() -> dict:
    """Lazy-load the produce safety database."""
    global _PRODUCE_SAFETY_DB
    if _PRODUCE_SAFETY_DB is None:
        db_path = os.path.join(_DATA_DIR, "produce_safety.json")
        with open(db_path, "r") as f:
            _PRODUCE_SAFETY_DB = json.load(f)
    return _PRODUCE_SAFETY_DB


def get_food_safety_data(food_item: str) -> dict:
    """Look up USDA-grounded safe cooking temperatures and food safety guidelines.

    Use this tool whenever a user asks about cooking temperatures, food safety,
    doneness levels, or when you need to verify that food is safe to eat.
    Do NOT guess food safety information — always use this tool.

    Args:
        food_item: The food item to look up (e.g., "chicken breast", "ground beef",
                   "salmon", "pork chop"). Use common names.

    Returns:
        A dictionary containing safe cooking temperatures, danger zone info,
        storage guidelines, and cross-contamination notes for the food item.
        If the exact item isn't found, returns general food safety guidelines.
    """
    db = _load_food_safety_db()
    search = food_item.lower().strip()

    # Try exact match
    if search in db["items"]:
        return db["items"][search]

    # Try partial match
    for key, value in db["items"].items():
        if search in key or key in search:
            return value

    # Try category match
    for category, items in db["categories"].items():
        for keyword in items["keywords"]:
            if keyword in search:
                return items["guidelines"]

    return db["general"]


def get_produce_safety_data(produce_item: str) -> dict:
    """Look up produce washing methods, pesticide residue info, and prep safety guidelines.

    Use this tool whenever you see produce being prepared, or when a user asks
    about how to wash fruits or vegetables. Provides specific washing methods
    tailored to each type of produce, including pesticide residue awareness
    (Dirty Dozen / Clean Fifteen lists) and food safety considerations.

    Args:
        produce_item: The produce to look up (e.g., "strawberries", "lettuce",
                      "avocado", "mushrooms", "kale"). Use common names.

    Returns:
        A dictionary containing the recommended wash method, why it matters,
        pesticide residue notes, and whether the item is on the Dirty Dozen
        or Clean Fifteen list.
    """
    db = _load_produce_safety_db()
    search = produce_item.lower().strip()

    # Check Dirty Dozen / Clean Fifteen status
    is_dirty_dozen = any(_food_match(search, item) for item in db.get("dirty_dozen", []))
    is_clean_fifteen = any(_food_match(search, item) for item in db.get("clean_fifteen", []))

    # Search produce categories
    for category, data in db["produce"].items():
        items_list = data.get("items", [])
        if any(_food_match(search, item) for item in items_list):
            result = {
                "category": category,
                "wash_method": data["wash_method"],
                "why": data["why"],
                "pesticide_note": data["pesticide_note"],
                "tips": data.get("tips", ""),
                "is_dirty_dozen": is_dirty_dozen,
                "is_clean_fifteen": is_clean_fifteen,
            }
            return result

    # General produce washing guidance
    return {
        "category": "general",
        "wash_method": db["general_produce"]["wash_method"],
        "why": db["general_produce"]["why"],
        "pesticide_note": "Check if this item is on the Dirty Dozen list for extra precaution.",
        "is_dirty_dozen": is_dirty_dozen,
        "is_clean_fifteen": is_clean_fifteen,
    }


def _load_nutrition_db() -> dict:
    """Lazy-load the nutrition reference database."""
    global _NUTRITION_DB
    if _NUTRITION_DB is None:
        db_path = os.path.join(_DATA_DIR, "nutrition.json")
        with open(db_path, "r") as f:
            _NUTRITION_DB = json.load(f)
    return _NUTRITION_DB


def get_nutrition_estimate(food_item: str) -> dict:
    """Look up approximate nutritional information for a food item.

    Use this tool when users ask about calories, macros, protein, carbs, or fat
    content of ingredients or dishes. Provides per-serving estimates based on
    USDA FoodData Central reference values, plus healthy substitution suggestions.

    Args:
        food_item: The food item to look up (e.g., "chicken breast", "white rice",
                   "olive oil", "greek yogurt"). Use common names.

    Returns:
        A dictionary with per-serving calories, protein, carbs, fat, fiber,
        serving size, and optional healthy substitution suggestions.
    """
    db = _load_nutrition_db()
    search = food_item.lower().strip()

    # Search items
    for key, value in db["items"].items():
        if _food_match(search, key):
            return value

    # Search by category
    for category, data in db.get("categories", {}).items():
        for keyword in data.get("keywords", []):
            if _food_match(search, keyword):
                return data["estimate"]

    return {
        "note": f"No exact match for '{food_item}'. Ask Google Search for detailed nutritional info.",
        "tip": "For a rough estimate: protein/carbs ≈ 4 cal/g, fat ≈ 9 cal/g.",
    }


def update_timeline_step(step_name: str, step_description: str, status: str) -> dict:
    """Update the visual dinner timeline on the user's screen.

    Use this tool whenever you establish a cooking sequence, or when a user moves
    to the next step in their cooking process. This provides a visual confirmation
    (Agentic Proof) of the workflow you are managing.

    Args:
        step_name: Short title of the step (e.g., "Prep Veggies", "Sear Steak").
        step_description: 1-sentence description of what to do (e.g., "Chop onions and garlic.").
        status: The state of this step. Should be "pending", "active", or "completed".

    Returns:
        A dict confirming the UI update with step details.
    """
    return {
        "action": "timeline_updated",
        "step_name": step_name,
        "step_description": step_description,
        "status": status,
    }


def set_observation_interval(seconds: int, reason: str) -> dict:
    """Dynamically adjust how often the camera takes a picture.

    Use this tool to control your own visual polling rate based on the physics
    of the food being cooked. Call this proactively:
    - 5 seconds for fast-paced/risky tasks (searing, chopping, high heat).
    - 15-20 seconds for normal active cooking.
    - 30-60 seconds for passive waiting (baking, simmering, proofing).

    Args:
        seconds: The new interval in seconds between camera captures.
        reason: Brief explanation of why you're changing the interval.

    Returns:
        A confirmation dict with the new interval and reason.
    """
    return {
        "action": "interval_updated",
        "new_interval_seconds": seconds,
        "reason": reason,
    }


def add_visual_annotation(
    label: str, region: str, style: str, duration_seconds: int = 5
) -> dict:
    """Add a visual annotation overlay on the user's camera feed to highlight something you see.

    Use this tool whenever you observe something noteworthy in the camera — food that
    needs attention, an ingredient you're identifying, a safety concern, or doneness
    feedback. The annotation appears as a labeled highlight directly on the video feed,
    making it visually obvious what you're referring to.

    This is your PRIMARY way to visually communicate camera observations. Use it
    liberally — every time you comment on something visible, annotate it.

    Args:
        label: Short text label (1-5 words) for the annotation.
            Examples: "Flip now!", "Needs 165°F", "Dirty Dozen ⚠", "Nice sear ✓",
            "Too much smoke", "Add oil", "Strawberries"
        region: Where in the camera frame the item is located.
            One of: "center", "top-left", "top-right", "bottom-left", "bottom-right",
            "top-center", "bottom-center", "left-center", "right-center"
        style: The visual style/urgency of the annotation.
            One of: "info" (blue, neutral observation), "success" (green, looks good),
            "warning" (amber, needs attention soon), "danger" (red, act now),
            "identify" (purple, identifying an ingredient/item)
        duration_seconds: How long the annotation stays visible (default 5, max 15).

    Returns:
        A confirmation dict with the annotation parameters.
    """
    return {
        "action": "visual_annotation_added",
        "label": label,
        "region": region,
        "style": style,
        "duration_seconds": min(duration_seconds, 15),
    }


def analyze_and_recreate_recipe(
    dish_name: str, ingredients: list[str], chronological_steps: list[str]
) -> dict:
    """Reverse-engineer a recipe seen on a TV show or requested by the user.

    Generates a grocery list and extracts the exact chronological cooking steps
    so you can walk the user through it step-by-step. Use this when:
    - The user points the camera at a cooking show and you identify dishes.
    - The user describes a dish they want to recreate.
    - You want to build a structured recipe from observed techniques.

    After calling this tool, proactively use update_timeline_step to build
    out a timeline of the reverse-engineered recipe.

    Args:
        dish_name: Name of the dish being reverse-engineered.
        ingredients: Full list of ingredients needed (grocery list).
        chronological_steps: Ordered list of cooking steps from start to finish.

    Returns:
        A structured dict with the dish name, grocery list, steps, and UI status.
    """
    return {
        "action": "recipe_reverse_engineered",
        "dish": dish_name,
        "grocery_list": ingredients,
        "reconstructed_steps": chronological_steps,
        "ui_status": "Recipe and Grocery List added to Activity Log.",
    }
