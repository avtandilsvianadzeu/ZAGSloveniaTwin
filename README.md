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
- `js/userobjects.js`: layer of added objects on the main map
- `data/zag_projects.geojson`: the 73 records with involvement type, description, sources and position provenance
- `data/images.json`: photo per record with author and licence (filled by the "Find record photos" workflow)
- `data.js`: legacy record store used by the build script
- `tools/build_geojson.js`: rebuilds the GeoJSON from `data.js` and `tools/position_corrections.json`
- `tools/fetch_images.js`: looks up freely licensed photos on Wikimedia Commons
- `tools/terrain/`: options for national terrain (see README there)
- `tools/fetch_news.mjs`: reads recent Slovenian news per record. The scheduled workflow that runs it is not installed in this repository yet

## Handover


## Quality checks

The checks that keep the site publishable are part of the repository and run in GitHub Actions (`.github/workflows/qa.yml`) on every push, on pull requests and, for the slow link check, every Monday. They can also be run locally with `npm install` once and then:

- `npm run qa:data` reads `data/twins.json` and `data/zag_projects.geojson` and reports house-style typography in the atlas's own text, working notes left in public fields, values without a source link, differences without a lead label, positions outside Slovenia and duplicate ids. Blocking problems fail the job.
- `npm run qa:site` serves the repository, opens every page in English and Slovenian in Chromium (plus the main pages at phone width) and reports script errors, failed requests to the site's own files, typography in visible text, English left on Slovenian pages, horizontal overflow and images without alt text. `--pages=quick` opens six record pages instead of all 73.
- `npm run qa:links` asks every source URL whether it still answers and lists the ones that do not. It never fails the build.
- `npm run build` rebuilds `data/zag_projects.geojson` and `api/v1` from `data.js` and `data/twins.json`.

Each run writes `qa/data-report.json`, `qa/site-report.json` and `qa/site-report.md` (ignored by git) and, in Actions, the same as the run summary and a downloadable artifact. Internal working notes about a record belong in the `editorial` field of `data/twins.json`, which is never shown on the site or in the API.

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


## Automatic model builder

Every asset page has a button "Request a 3D model" (or "Update the 3D model"). It opens a short form on GitHub (Issues, template "Model request"). When the repository owner submits it, the workflow `.github/workflows/model_request.yml` runs `tools/build_model_from_request.py`, which:

1. takes the outline from OpenStreetMap, either the way numbers given in the form or the mapped structure that holds the record position,
2. raises it to the height given in the form, which must come with a source link (empty height: the OpenStreetMap height tag if there is one, otherwise flat),
3. stores dragged photos in `img/requests/<record>/` and shows them under Sources as reference photos (photos never change the geometry),
4. writes the model into `data/twins.json`, rebuilds `api/v1/`, commits, and answers on the issue with the result.

It refuses, with an explanation on the issue, when a height has no source link, when no outline is found within 60 m, or when the record already has a more detailed model or the official GURS building (tick "Replace" to override). Editing the issue builds the model again. The workflow needs "Read and write permissions" under Settings, Actions, General, Workflow permissions.

## ZAGBot

**Chat on the site.** Every page has ZAGBot in the lower right corner (`js/zagbot.js`, `css/zagbot.css`). It runs in the browser with no server. It reads `data/zag_projects.geojson` and `data/twins.json`, understands short questions in English and Slovenian (names, places, types such as *predor* or *most*, values such as height, length, year, power), and answers only from that data with the source link. Every step offers clickable replies, so a report of an error ends as an exact request: record, value, current value, new value, source link. "Send the request" delivers it to the atlas team by email.

**Change requests.** `.github/workflows/zagbot.yml` processes a change request from an issue opened by the repository owner, rebuilds the data, checks it and commits the result. Setup notes are kept outside the published site.

