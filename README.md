# ZAG Slovenia Twin

Platform version of the ZAG Digital Atlas: the full map, a record page per object and a tool to add objects.

Geographic atlas of buildings, bridges, tunnels, dams, cableways and research sites in Slovenia where the Slovenian National Building and Civil Engineering Institute (ZAG) has documented involvement.

Live site: https://avtandilsvianadzeu.github.io/ZAGSloveniaTwin/

Earlier map only version: https://avtandilsvianadzeu.github.io/ZAGMapLive/

## Layout

- `index.html`, `css/`, `js/`: the application (MapLibre GL JS, no build step)
- `twin.html`, `css/twin.css`, `js/twin.js`: record page per object (`twin.html?id=<record id>`) and the list of all objects (`twin.html`), with a schematic model built only from the mapped geometry and official building data
- `add.html`, `js/add.js`: Add object tool. Draw, paste coordinates or load a file. Objects are kept in the browser and marked as not verified
- `data/user_objects.json`: objects published from the Add object tool (empty by default)
- `data/ai_service.json`: address of the optional AI reader service (empty by default, never holds a key)
- `js/userobjects.js`: layer of added objects on the main map
- `data/zag_projects.geojson`: the 73 records with involvement type, description, sources and position provenance
- `data/images.json`: photo per record with author and licence (filled by the "Find record photos" workflow)
- `data.js`: legacy record store used by the build script
- `tools/build_geojson.js`: rebuilds the GeoJSON from `data.js` and `tools/position_corrections.json`
- `tools/fetch_images.js`: looks up freely licensed photos on Wikimedia Commons
- `tools/terrain/`: options for national terrain (see README there)
- `tools/fetch_news.mjs`: reads recent Slovenian news per record. The scheduled workflow that runs it is not installed in this repository yet

## Handover

Start with `handover/HANDOVER.md`. It describes the data, how every position and value was checked, what is still open and how each part was built. `handover/research/` holds the research and check results, `handover/dev_tools/` the scripts used for checking positions, and `server/` the optional AI reader (a Cloudflare Worker, see `server/README.md`).

## Publishing

GitHub Pages, branch `main`, folder `/ (root)`.

## Data sources

ZAG publications and the sources cited on each record; OpenStreetMap via OpenFreeMap; Photon geocoder; GURS Kataster nepremičnin (OGC API Features); GURS DOF025 orthophoto via Level2.si; Mapzen / AWS Terrain Tiles; Esri World Imagery.

## Official building data (GURS)

Building records whose coordinate is surveyed or an address are tied to their official GURS building in `data/gurs_buildings.json`: exact outline, height above ground, ground, eave and ridge levels, and survey date. The page then highlights that outline at its real height instead of guessing from OpenStreetMap. Records that do not fall on a GURS building (ZAG Maribor, Gameljne, InnoRenew) keep the OpenStreetMap fallback. To refresh after a new GURS extract (free from https://ipi.eprostor.gov.si/jgp/data):

    py -m pip install pyshp shapely pyproj
    py tools/gurs_buildings.py "C:/Users/<you>/Downloads/DTM_SLO_ZGRADBE_20261003"

## Verified positions and asset records

`tools/position_corrections.json` holds the verified position of each record, with `precision` (matched, surveyed, address, site, epicentre), `sources`, a `note` on how it was verified and, for 29 records, `lines`: the real geometry drawn on the map (bridge decks, tunnel tubes portal to portal, lift lines, dam outlines, the Stože landslide outline). Structures were matched in OpenStreetMap by name, ref and type, then checked against the record (river or road crossed, number of decks, length). `data/twins.json` holds the digital twin sheet per record: specifications each linked to its source, verified reference points (portals, stations, dam axis) and the points where sources disagree. After editing the corrections or `data.js`, run `node tools/build_geojson.js`.

## Live news

Each record shows recent Slovenian news about it, and records with news from the last 7 days get a red ring on the map. `tools/fetch_news.mjs` searches Google News in Slovenian with the keywords in `data/news_keywords.json` (q = query; a headline must contain one of `must`, all of `all` and none of `not`), keeps headlines from the last 12 months, groups the same story across outlets ("reported by N outlets") and writes `data/news.json` (headline, outlet, date and link only). `.github/workflows/news.yml` runs it every 20 minutes and commits the file when something changed; the page re-reads it every 15 minutes. To hide a wrong article, add its link to `data/news_ignore.json` (a JSON list). Run it by hand with `node tools/fetch_news.mjs`.

One-time setup on GitHub: Settings, Actions, General, Workflow permissions, choose "Read and write permissions". Then Actions, "Refresh news", "Run workflow" to test it.

