import asyncio
import json
import logging

from groq import Groq

from backend.app.config import settings

logger = logging.getLogger("news_classifier")

CATEGORIES = [
    "disaster",
    "conflict",
    "cyber",
    "politics",
    "other",
]

CLASSIFICATION_PROMPT = """You are a news classifier. For each article, determine:
1. **category** — exactly one of:
   - **disaster**: natural disasters, earthquakes, floods, hurricanes, wildfires, pandemics, accidents
   - **conflict**: armed conflicts, wars, military operations, terrorism, protests, sanctions
   - **cyber**: cyberattacks, hacking, data breaches, ransomware, cybersecurity
   - **politics**: elections, policy, government, diplomacy, legislation, international relations
   - **other**: economy, business, sports, entertainment, science, technology, health, environment, or anything else

2. **location** — the country name mentioned in the article. Use ONLY the country name (e.g. "Ukraine", "Japan", "United States"). If no country is mentioned, use "Unknown".

3. **translated_title** — translate the article title into English. If already in English, return the original title.

Respond with ONLY valid JSON. Use the article IDs as keys:
{"<article_id>": {"category": "<category>", "location": "<location>", "translated_title": "<translated title>"}}"""

MODEL = "llama-3.1-8b-instant"

_client: Groq | None = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=settings.groq_api_key)
    return _client


def _classify(articles_text: str, use_json_mode: bool = True) -> dict[str, dict] | None:
    kwargs = dict(
        model=MODEL,
        messages=[
            {"role": "system", "content": CLASSIFICATION_PROMPT},
            {"role": "user", "content": f"Classify these articles:\n\n{articles_text}"},
        ],
        temperature=0.1,
        max_tokens=4096,
    )
    if use_json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    response = _get_client().chat.completions.create(**kwargs)
    content = response.choices[0].message.content.strip()
    result = _parse_json(content)
    return result


def _parse_json(content: str) -> dict:
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        content = content.removeprefix("json").strip()
    content = content.strip()
    return json.loads(content)


BATCH_SIZE = 10


async def classify_articles(articles: list[dict]) -> dict[str, dict]:
    """Returns {article_id: {"category": str, "location": str}}."""
    if not articles:
        return {}
    if not settings.groq_api_key:
        logger.warning("GROQ_API_KEY not set, skipping classification")
        return {}

    classifications = {}
    for i in range(0, len(articles), BATCH_SIZE):
        batch = articles[i : i + BATCH_SIZE]
        id_title_map = {a["id"]: a["title"] for a in batch}
        articles_text = "\n".join(f'{aid}: {title.replace(chr(34), " ").replace(chr(10), " ").replace(chr(13), " ")}' for aid, title in id_title_map.items())

        try:
            result = await asyncio.to_thread(_classify, articles_text, True)
            if result is None:
                continue
        except Exception:
            try:
                result = await asyncio.to_thread(_classify, articles_text, False)
            except Exception as e2:
                logger.warning("Groq batch classification failed (fallback): %s", e2)
                await asyncio.sleep(5)
                continue

        for aid in id_title_map:
            entry = result.get(aid, {})
            if isinstance(entry, str):
                cat = entry
                loc = "Unknown"
                tt = None
            else:
                cat = entry.get("category", "other")
                loc = entry.get("location", "Unknown")
                tt = entry.get("translated_title")
            if cat not in CATEGORIES:
                cat = "other"
            classifications[aid] = {"category": cat, "location": loc, "translated_title": tt}

    counts = {c: sum(1 for v in classifications.values() if v["category"] == c) for c in CATEGORIES}
    logger.info(
        "classified %d articles (%d disaster, %d conflict, %d cyber, %d politics, %d other)",
        len(classifications), counts["disaster"], counts["conflict"],
        counts["cyber"], counts["politics"], counts["other"],
    )
    return classifications
