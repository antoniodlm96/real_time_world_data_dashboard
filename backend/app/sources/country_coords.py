COUNTRY_COORDS: dict[str, tuple[float, float]] = {
    "United States": (39.8, -98.6),
    "United Kingdom": (55.4, -3.4),
    "Canada": (56.1, -106.3),
    "Mexico": (23.6, -102.6),
    "Brazil": (-14.2, -51.9),
    "Argentina": (-38.4, -63.6),
    "Chile": (-35.7, -71.5),
    "Colombia": (4.6, -74.3),
    "Peru": (-9.2, -75.0),
    "Uruguay": (-32.5, -55.8),
    "Venezuela": (6.4, -66.6),
    "Cuba": (21.5, -80.0),
    "Spain": (40.5, -3.7),
    "France": (46.6, 2.2),
    "Germany": (51.2, 10.5),
    "Italy": (41.9, 12.6),
    "Portugal": (39.4, -8.2),
    "Netherlands": (52.1, 5.3),
    "Belgium": (50.9, 4.5),
    "Switzerland": (46.8, 8.2),
    "Austria": (47.5, 14.6),
    "Sweden": (60.1, 18.6),
    "Norway": (60.5, 8.5),
    "Denmark": (55.7, 10.5),
    "Finland": (61.9, 25.7),
    "Ireland": (53.4, -8.2),
    "Poland": (52.1, 19.4),
    "Czech Republic": (49.8, 15.3),
    "Hungary": (47.2, 19.5),
    "Romania": (45.9, 24.9),
    "Bulgaria": (42.7, 25.5),
    "Greece": (39.1, 21.8),
    "Croatia": (45.1, 15.2),
    "Serbia": (44.2, 20.9),
    "Ukraine": (48.4, 31.2),
    "Russia": (61.5, 105.3),
    "Turkey": (39.0, 35.2),
    "Israel": (31.0, 34.9),
    "Saudi Arabia": (24.0, 45.1),
    "UAE": (23.4, 53.8),
    "Iran": (32.4, 53.7),
    "Iraq": (33.0, 43.8),
    "Egypt": (26.8, 30.8),
    "Morocco": (31.8, -7.1),
    "South Africa": (-30.6, 22.9),
    "Kenya": (-0.3, 37.9),
    "Nigeria": (9.1, 8.7),
    "Ghana": (7.9, -1.0),
    "China": (35.9, 104.2),
    "Japan": (36.2, 138.3),
    "South Korea": (35.9, 127.8),
    "India": (20.6, 78.9),
    "Indonesia": (-0.8, 117.2),
    "Philippines": (12.9, 121.8),
    "Vietnam": (14.1, 108.3),
    "Thailand": (15.9, 101.0),
    "Singapore": (1.3, 103.8),
    "Malaysia": (4.2, 102.0),
    "Australia": (-25.3, 133.8),
    "New Zealand": (-41.5, 172.8),
    "Taiwan": (23.7, 121.0),
    "Pakistan": (30.4, 69.3),
    "Bangladesh": (23.7, 90.4),
    "Afghanistan": (33.9, 67.7),
    "Syria": (34.8, 39.0),
    "Yemen": (15.6, 48.5),
    "Qatar": (25.3, 51.2),
    "Kuwait": (29.3, 47.5),
    "Oman": (21.5, 55.9),
    "Lebanon": (33.9, 35.5),
    "Jordan": (31.2, 36.6),
    "Algeria": (28.0, 3.0),
    "Tunisia": (33.9, 9.5),
    "Libya": (26.3, 17.2),
    "Sudan": (16.0, 30.0),
    "Ethiopia": (9.1, 40.5),
    "Somalia": (5.2, 46.2),
    "Angola": (-11.2, 17.9),
    "Mozambique": (-18.7, 35.5),
    "Madagascar": (-18.8, 46.9),
    "European Union": (50.0, 10.0),
    "Europe": (50.0, 10.0),
    "Africa": (0.0, 20.0),
    "Asia": (30.0, 100.0),
    "Middle East": (28.0, 45.0),
    "Latin America": (-10.0, -60.0),
}


def extract_country(location: str | None) -> str | None:
    if not location or location == "Unknown":
        return None
    low = location.lower()
    for name in COUNTRY_COORDS:
        if name.lower() in low:
            return name
    return None


def lookup_location(location: str) -> tuple[float, float] | None:
    if not location or location == "Unknown":
        return None
    loc = location.strip()
    exact = COUNTRY_COORDS.get(loc)
    if exact:
        return exact
    for key, coords in COUNTRY_COORDS.items():
        if key.lower() in loc.lower() or loc.lower() in key.lower():
            return coords
    return None
