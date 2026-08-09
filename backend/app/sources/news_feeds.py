import asyncio
import logging
import hashlib
from datetime import datetime, timezone

import feedparser

from backend.app.cache import cache
from backend.app.config import settings

logger = logging.getLogger("news")

NEWS_FEEDS = [
    # ── Global News Agencies ──
    {"name": "Reuters", "url": "https://www.reutersagency.com/feed/", "country": "United Kingdom"},
    {"name": "AP News", "url": "https://rsshub.app/apnews.com/apf-topnews", "country": "United States"},
    {"name": "UPI Top News", "url": "https://rss.upi.com/news/top_news.rss", "country": "United States"},
    {"name": "UPI World", "url": "https://rss.upi.com/news/tn_int.rss", "country": "United States"},
    {"name": "Anadolu Agency EN", "url": "https://www.aa.com.tr/en/rss/default?cat=live", "country": "Turkey"},
    {"name": "Kyodo News", "url": "https://english.kyodonews.net/list/feed/rss4kyodonews-fzone", "country": "Japan"},
    {"name": "Xinhua World", "url": "http://www.xinhuanet.com/english/rss/worldrss.xml", "country": "China"},
    {"name": "Xinhua China", "url": "http://www.xinhuanet.com/english/rss/chinarss.xml", "country": "China"},
    {"name": "Bloomberg", "url": "https://feeds.bloomberg.com/markets/news.rss", "country": "United States"},

    # ── Geopolitics & Security ──
    {"name": "BBC News", "url": "http://feeds.bbci.co.uk/news/rss.xml", "country": "United Kingdom"},
    {"name": "BBC World", "url": "http://feeds.bbci.co.uk/news/world/rss.xml", "country": "United Kingdom"},
    {"name": "Al Jazeera", "url": "https://www.aljazeera.com/xml/rss/all.xml", "country": "Qatar"},
    {"name": "Deutsche Welle", "url": "https://rss.dw.com/rdf/rss-en-world", "country": "Germany"},
    {"name": "France 24", "url": "https://www.france24.com/en/france/rss", "country": "France"},
    {"name": "Foreign Policy", "url": "https://foreignpolicy.com/feed/", "country": "United States"},
    {"name": "Foreign Affairs", "url": "https://www.foreignaffairs.com/rss.xml", "country": "United States"},
    {"name": "The Guardian", "url": "https://www.theguardian.com/world/rss", "country": "United Kingdom"},
    {"name": "The Washington Post", "url": "https://feeds.washingtonpost.com/rss/world", "country": "United States"},
    {"name": "NYT World", "url": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", "country": "United States"},
    {"name": "Politico Europe", "url": "https://www.politico.eu/feed/", "country": "European Union"},
    {"name": "RFERL", "url": "https://www.rferl.org/api/zqqrmoekurmp", "country": "Multiple"},
    {"name": "Crisis Group", "url": "https://www.crisisgroup.org/rss-feed", "country": "United States"},
    {"name": "ISW Research", "url": "https://www.iswresearch.org/feeds/posts/default", "country": "United States"},
    {"name": "EURACTIV", "url": "https://www.euractiv.com/feed/", "country": "European Union"},
    {"name": "Le Monde", "url": "https://www.lemonde.fr/rss/une.xml", "country": "France"},
    {"name": "El País", "url": "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada", "country": "Spain"},
    {"name": "Corriere della Sera", "url": "http://xml2.corriereobjects.it/rss/homepage.xml", "country": "Italy"},
    {"name": "NZZ", "url": "https://www.nzz.ch/recent.rss", "country": "Switzerland"},

    # ── Finance & Economy ──
    {"name": "Financial Times", "url": "https://www.ft.com/rss/home", "country": "United Kingdom"},
    {"name": "CNBC", "url": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114", "country": "United States"},
    {"name": "MarketWatch Top", "url": "http://feeds.marketwatch.com/marketwatch/topstories", "country": "United States"},
    {"name": "MarketWatch RealTime", "url": "http://feeds.marketwatch.com/marketwatch/realtimeheadlines", "country": "United States"},
    {"name": "Forbes", "url": "https://www.forbes.com/real-time/feed2/", "country": "United States"},
    {"name": "Fortune", "url": "https://fortune.com/feed/", "country": "United States"},
    {"name": "Nikkei Asia", "url": "https://asia.nikkei.com/rss/feed/nar", "country": "Japan"},
    {"name": "Les Echos", "url": "https://www.lesechos.fr/rss", "country": "France"},
    {"name": "Seeking Alpha", "url": "https://seekingalpha.com/feed.xml", "country": "United States"},
    {"name": "The Economist", "url": "https://www.economist.com/rss", "country": "United Kingdom"},
    {"name": "Cinco Días", "url": "https://cincodias.elpais.com/rss/cincodias/ultimas_noticias.xml", "country": "Spain"},
    {"name": "Expansión", "url": "https://www.expansion.com/rss.html", "country": "Spain"},
    {"name": "Investing.com", "url": "https://www.investing.com/rss/news.rss", "country": "United States"},

    # ── North America ──
    {"name": "CNN World", "url": "http://rss.cnn.com/rss/edition_world.rss", "country": "United States"},
    {"name": "NBC News", "url": "https://feeds.nbcnews.com/feeds/topstories", "country": "United States"},
    {"name": "CBS News", "url": "https://www.cbsnews.com/latest/rss/main", "country": "United States"},
    {"name": "ABC News US", "url": "https://feeds.abcnews.com/abcnews/topstories", "country": "United States"},
    {"name": "Fox News", "url": "https://moxie.foxnews.com/google-publisher/latest.xml", "country": "United States"},
    {"name": "NPR", "url": "https://feeds.npr.org/1002/rss.xml", "country": "United States"},
    {"name": "CBC World", "url": "https://www.cbc.ca/cmlink/rss-world", "country": "Canada"},
    {"name": "The Globe and Mail", "url": "https://www.theglobeandmail.com/arc/outboundfeeds/rss/", "country": "Canada"},
    {"name": "LA Times", "url": "https://www.latimes.com/world/rss2.0.xml", "country": "United States"},
    {"name": "Chicago Tribune", "url": "https://www.chicagotribune.com/feed/", "country": "United States"},

    # ── Latin America ──
    {"name": "Infobae", "url": "https://www.infobae.com/arc/outboundfeeds/rss/", "country": "Argentina"},
    {"name": "Clarín", "url": "https://www.clarin.com/rss/lo-ultimo/", "country": "Argentina"},
    {"name": "La Nación", "url": "https://www.lanacion.com.ar/arcio/rss/", "country": "Argentina"},
    {"name": "Folha Mundo", "url": "https://feeds.folha.uol.com.br/mundo/rss091.xml", "country": "Brazil"},
    {"name": "O Globo", "url": "http://oglobo.globo.com/rss.xml", "country": "Brazil"},
    {"name": "El Universal MX", "url": "https://www.eluniversal.com.mx/rss/", "country": "Mexico"},
    {"name": "Milenio", "url": "https://www.milenio.com/api/v1/rss", "country": "Mexico"},
    {"name": "El Tiempo", "url": "https://www.eltiempo.com/rss/colombia.xml", "country": "Colombia"},
    {"name": "El Comercio PE", "url": "https://elcomercio.pe/arc/outboundfeeds/rss/?outputType=xml", "country": "Peru"},
    {"name": "La Tercera", "url": "https://www.latercera.com/rss/", "country": "Chile"},

    # ── Europe ──
    {"name": "El Mundo", "url": "https://www.elmundo.es/rss/", "country": "Spain"},
    {"name": "ABC España", "url": "https://www.abc.es/rss/", "country": "Spain"},
    {"name": "La Repubblica", "url": "https://www.repubblica.it/rss/homepage/rss2.0.xml", "country": "Italy"},
    {"name": "Le Figaro", "url": "https://www.lefigaro.fr/rss/figaro_actualites.xml", "country": "France"},
    {"name": "Die Welt", "url": "https://www.welt.de/feeds/latest.rss", "country": "Germany"},
    {"name": "Der Spiegel", "url": "https://www.spiegel.de/international/index.rss", "country": "Germany"},
    {"name": "De Telegraaf", "url": "https://www.telegraaf.nl/rss", "country": "Netherlands"},
    {"name": "The Independent", "url": "https://www.independent.co.uk/rss", "country": "United Kingdom"},
    {"name": "The Telegraph", "url": "https://www.telegraph.co.uk/rss.xml", "country": "United Kingdom"},
    {"name": "Ukrainska Pravda", "url": "https://www.pravda.com.ua/rss/", "country": "Ukraine"},
    {"name": "The Kyiv Independent", "url": "https://kyivindependent.com/feed/", "country": "Ukraine"},
    {"name": "Meduza", "url": "https://meduza.io/rss/all", "country": "Russia"},
    {"name": "TASS", "url": "http://tass.com/rss/v2.xml", "country": "Russia"},
    {"name": "RIA Novosti", "url": "https://ria.ru/export/rss2/index.xml", "country": "Russia"},
    {"name": "Rzeczpospolita", "url": "https://www.rp.pl/rss_main", "country": "Poland"},

    # ── Middle East & Africa ──
    {"name": "Haaretz", "url": "https://www.haaretz.com/site/rss-feeds/1.4967466", "country": "Israel"},
    {"name": "Times of Israel", "url": "https://www.timesofisrael.com/feed/", "country": "Israel"},
    {"name": "Arab News", "url": "https://www.arabnews.com/rss", "country": "Saudi Arabia"},
    {"name": "The National UAE", "url": "https://www.thenationalnews.com/rss", "country": "UAE"},
    {"name": "Tehran Times", "url": "https://www.tehrantimes.com/rss", "country": "Iran"},
    {"name": "Al Arabiya", "url": "https://english.alarabiya.net/tools/mrss", "country": "UAE"},
    {"name": "Middle East Eye", "url": "https://www.middleeasteye.net/rss", "country": "United Kingdom"},
    {"name": "Daily News Egypt", "url": "https://www.dailynewsegypt.com/feed/", "country": "Egypt"},
    {"name": "Mail & Guardian", "url": "https://mg.co.za/feed/", "country": "South Africa"},
    {"name": "News24", "url": "https://www.news24.com/feeds/rss", "country": "South Africa"},
    {"name": "AllAfrica", "url": "https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf", "country": "Africa"},
    {"name": "Daily Nation", "url": "https://nation.africa/kenya/rss.xml", "country": "Kenya"},

    # ── Asia-Pacific ──
    {"name": "SCMP", "url": "https://www.scmp.com/rss/4/feed", "country": "China"},
    {"name": "Times of India", "url": "https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms", "country": "India"},
    {"name": "The Hindu", "url": "https://www.thehindu.com/news/feeder/default.rss", "country": "India"},
    {"name": "The Japan Times", "url": "https://www.japantimes.co.jp/feed/topstories/", "country": "Japan"},
    {"name": "Yonhap", "url": "https://en.yna.co.kr/RSS/news.xml", "country": "South Korea"},
    {"name": "The Korea Herald", "url": "https://www.koreaherald.com/rss/newsAll", "country": "South Korea"},
    {"name": "The Straits Times", "url": "https://www.straitstimes.com/news/singapore/rss.xml", "country": "Singapore"},
    {"name": "ABC Australia", "url": "https://www.abc.net.au/news/feed/51120/rss.xml", "country": "Australia"},
    {"name": "Sydney Morning Herald", "url": "https://www.smh.com.au/rss/feed.xml", "country": "Australia"},
    {"name": "NZ Herald", "url": "https://rss.nzherald.co.nz/rss/xml/nzhrsscid_000000001.xml", "country": "New Zealand"},
]

NEWS_FEEDS.sort(key=lambda f: f["name"])


FEED_TIMEOUT = 15


async def _parse_feed(url: str, timeout: int = FEED_TIMEOUT):
    return await asyncio.wait_for(asyncio.to_thread(feedparser.parse, url), timeout)


async def fetch_news_from_feed(name: str, url: str, country: str, semaphore: asyncio.Semaphore | None = None) -> list[dict]:
    try:
        if semaphore:
            async with semaphore:
                feed = await _parse_feed(url)
        else:
            feed = await _parse_feed(url)
    except Exception as e:
        logger.warning("feed parse failed %s: %s", name, e)
        return []

    articles = []
    now = datetime.now(timezone.utc)
    for entry in feed.entries[:15]:
        article_id = hashlib.md5((entry.get("link", "") + name).encode()).hexdigest()
        pub = entry.get("published_parsed") or entry.get("updated_parsed")
        if pub:
            published = datetime(*pub[:6], tzinfo=timezone.utc).isoformat()
        else:
            published = now.isoformat()

        image_url = None
        if "media_content" in entry:
            for m in entry.media_content:
                if m.get("type", "").startswith("image"):
                    image_url = m["url"]
                    break
        if not image_url and "links" in entry:
            for lnk in entry.links:
                if lnk.get("type", "").startswith("image"):
                    image_url = lnk["href"]
                    break

        articles.append({
            "id": article_id,
            "title": entry.get("title", "Untitled")[:300],
            "description": (entry.get("summary") or entry.get("description") or "")[:500],
            "url": entry.get("link", ""),
            "image_url": image_url,
            "source_name": name,
            "source_country": country,
            "published_at": published,
            "category": None,
        })
    return articles


async def fetch_all_news() -> list[dict]:
    return await cache.get_or_fetch(
        "news:all_feeds",
        settings.cache_ttl_gdelt,
        _fetch_all_news_raw,
    )


async def _fetch_all_news_raw() -> list[dict]:
    semaphore = asyncio.Semaphore(10)
    all_articles = []
    tasks = []
    for feed in NEWS_FEEDS:
        tasks.append(fetch_news_from_feed(feed["name"], feed["url"], feed["country"], semaphore))
    results = await asyncio.gather(*tasks, return_exceptions=True)
    for result in results:
        if isinstance(result, Exception):
            continue
        all_articles.extend(result)
    all_articles.sort(key=lambda a: a["published_at"], reverse=True)
    return all_articles
