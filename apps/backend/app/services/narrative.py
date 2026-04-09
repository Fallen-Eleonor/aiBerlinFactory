from __future__ import annotations


def investor_intent(goals: str) -> bool:
    normalized = goals.lower()
    negative_phrases = (
        "before fundraising",
        "without fundraising",
        "without raising",
        "no fundraising",
        "not planning to raise",
    )
    if any(phrase in normalized for phrase in negative_phrases):
        return False

    keywords = ("seed", "raise", "angel", "vc", "venture", "funding", "runde", "invest")
    return any(keyword in normalized for keyword in keywords)


def deep_tech_intent(industry: str, goals: str) -> bool:
    normalized = f"{industry} {goals}".lower()
    keywords = ("deep tech", "robotics", "ai", "biotech", "climate", "defense", "quantum", "research")
    return any(keyword in normalized for keyword in keywords)


def format_eur(amount: int) -> str:
    value = f"{amount:,.0f}".replace(",", ".")
    return f"EUR {value}"
