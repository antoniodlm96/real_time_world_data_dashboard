import re
from datetime import datetime, timezone

from backend.app.database import get_db

TOKEN_RE = re.compile(r"[a-z0-9]+")
STOPWORDS = {
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with",
    "at", "by", "from", "as", "is", "are", "was", "were", "has", "have",
    "had", "be", "been", "it", "its", "this", "that", "not", "no", "but",
    "their", "they", "after", "says", "said", "say", "report", "reports",
    "amid", "over", "us", "uk", "uae", "vs", "now", "new", "after",
}

SIMILARITY_THRESHOLD = 0.72
BATCH_LIMIT = 500


def normalize(title: str) -> set[str]:
    tokens = TOKEN_RE.findall(title.lower())
    return {t for t in tokens if t not in STOPWORDS and len(t) > 2}


def jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 1.0
    union = a | b
    if not union:
        return 0.0
    return len(a & b) / len(union)


def cluster_articles(articles: list[dict]) -> dict[str, str]:
    """Assign a cluster_id per article id based on normalized-title similarity."""
    normalized = [(a["id"], a.get("title") or "", normalize(a.get("title") or "")) for a in articles]
    clusters: list[list[int]] = []

    for idx, (_aid, _title, tokens) in enumerate(normalized):
        assigned = None
        if tokens:
            best_sim = 0.0
            for ci, cluster in enumerate(clusters):
                rep = cluster[0]
                rep_tokens = normalized[rep][2]
                sim = jaccard(tokens, rep_tokens)
                if sim > best_sim:
                    best_sim = sim
                    assigned = ci
            if assigned is not None and best_sim >= SIMILARITY_THRESHOLD:
                clusters[assigned].append(idx)
                continue
        clusters.append([idx])

    result = {}
    for ci, cluster in enumerate(clusters):
        if len(cluster) == 1:
            continue
        cluster_key = f"c{datetime.now(timezone.utc).strftime('%Y%m%d')}-{ci}"
        for idx in cluster:
            result[normalized[idx][0]] = cluster_key
    return result


async def apply_news_clustering(hours: int = 24) -> int:
    db = await get_db()
    try:
        from backend.app.database import _time_since_sql

        cond, extra = _time_since_sql("ingested_at", hours)
        cursor = await db.execute(
            f"SELECT id, title FROM news WHERE {cond} ORDER BY ingested_at DESC LIMIT ?",
            tuple(extra + [BATCH_LIMIT]),
        )
        rows = await cursor.fetchall()
        articles = [{"id": r["id"], "title": r["title"]} for r in rows]
    finally:
        await db.close()

    if len(articles) < 2:
        return 0

    mapping = cluster_articles(articles)
    if not mapping:
        return 0

    db = await get_db()
    now = datetime.now(timezone.utc).isoformat()
    try:
        await db.execute("UPDATE news SET cluster_id = NULL")
        for aid, cid in mapping.items():
            await db.execute(
                "UPDATE news SET cluster_id = ?, updated_at = ? WHERE id = ?",
                (cid, now, aid),
            )
        await db.commit()
    finally:
        await db.close()
    return len(mapping)
