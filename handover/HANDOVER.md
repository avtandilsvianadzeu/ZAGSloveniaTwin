# ZAG Digital Atlas: handover for the next build

> **Where things are in this repository (added 11 November 2026).** This file was written for a zip package. In the repository `avtandilsvianadzeu/ZAGSloveniaTwin` the website is the repository root (what this file calls `site/`), the AI reader is in `server/`, and this file, `research/` and `dev_tools/` are in `handover/`. The news workflow is kept as `handover/workflows/news.yml` and is not active. To switch it on, copy it to `.github/workflows/news.yml` and allow "Read and write permissions" for workflows in the repository settings. The earlier map only site stays in `avtandilsvianadzeu/ZAGMapLive` and is not changed by this work.

Read this whole file before changing anything. It describes the project, the data, how every position and value was verified, what is still open, and the next version to build. The owner is Avtandil Svianadze (Avto), doctoral candidate at ZAG, Ljubljana. His supervisors Aleš Žnidarič and Andrej Anžlin review the map.

## 1. What the project is

A public web map of structures and sites in Slovenia where ZAG (Zavod za gradbeništvo Slovenije, Slovenian National Building and Civil Engineering Institute) has documented involvement: 73 records (buildings, bridges, tunnels, cableways, dams and hydropower plants, towers, landslides, earthquake study areas, other sites). Every record has ZAG's role, a description, cited sources, a position with an honest precision label and, for most, a "digital twin" sheet of verified specifications.

- Live site: https://avtandilsvianadzeu.github.io/ZAGMapLive/ (GitHub Pages, repository `avtandilsvianadzeu/ZAGMapLive`, branch `main`, root folder).
- Stack: plain HTML, CSS and JavaScript with MapLibre GL JS 5.24.0 from a CDN. No build step for the page. Node is used only for the data build script.
- Base maps: OpenFreeMap (OpenStreetMap vector tiles), Esri World Imagery for satellite, Mapzen / AWS Terrain Tiles for 3D terrain, GURS orthophoto via Level2.si. Geocoding: Photon.

## 2. Package contents

```
HANDOVER.md                this file
server/                    AI reader for the Add object tool (Cloudflare Worker), not part of the website
site/                      the complete website, ready to publish (same as the repository)
research/                  raw research and verification results (JSON), kept for traceability
dev_tools/                 Python scripts used to verify positions against OpenStreetMap and GURS
```

`site/` layout:

- `index.html`, `css/atlas.css`, `js/*.js`: the application.
- `data/zag_projects.geojson`: the 73 records. Generated, do not edit by hand.
- `data.js`: the master record store (legacy format) that the build reads.
- `tools/position_corrections.json`: verified positions per record id (point, optional `lines` = drawn geometry such as bridge decks, tunnel tubes, lift lines, `precision`, `sources`, `note`).
- `tools/build_geojson.js`: run `node tools/build_geojson.js` to regenerate the GeoJSON from `data.js` plus the corrections. Always rebuild after editing either.
- `data/gurs_buildings.json`: official GURS building outline and height for 10 building records, made by `tools/gurs_buildings.py` from the GURS topographic building layer (DTM_SLO_ZGRADBE_BU_STAVBE_P, free from https://ipi.eprostor.gov.si/jgp/data).
- `data/twins.json`: digital twin sheets (specs with source per value, verified reference points, source differences, open questions).

## 3. How the page works (key functions)

- `js/main.js` creates the map; `js/basemap.js` switches Map, Satellite and 3D terrain.
- `js/atlas-data.js` loads the GeoJSON, `data/gurs_buildings.json` and `data/twins.json` into `ZA`.
- `js/panel.js` `showInfo(id)` opens a record: panel HTML (`infoHTML`, `twinHTML`), pin (`setSel`), drawn geometry (`showLine` with `p.lines` or `p.line`), twin reference points (`showTwinPoints`), then `locate()`.
- `js/locate.js` `locate()` highlights the building: if the record has an official GURS building, that exact outline is extruded at its real height (`officialBuilding`); otherwise it falls back to the nearest OpenStreetMap footprint. Records with fixed `lines` skip all live guessing.
- Precision labels live in `PREC` in `js/locate.js`: `surveyed` (published coordinate), `matched` (matched to the mapped structure), `address`, `site`, `epicentre`, `settlement`, `locality`, `municipality`, `approximate`, `derived`.

## 4. Verification standard (keep it)

The owner's rule: everything evidence based, exact links, never invent. "If you cannot find it, leave it out."

What was done in November 2026:

1. **Buildings:** each record whose coordinate falls on a GURS building is tied to that official building (outline, height, ground, eave and ridge levels, survey date). Where GURS holds overlapping outlines from different surveys, the newest survey wins. Example: ZAG Fire Laboratory Logatec, Obrtna cona Logatec 35, GURS height 18.0 m, surveyed July 2023, confirmed by the address register.
2. **Bridges, tunnels, cableways, dams, sites:** matched through the OpenStreetMap API by name, ref and type (not just proximity), tubes and decks chained portal to portal, then checked against the record (river or road crossed, number of decks, length). Examples: Ravbarkomanda viaduct confirmed by crossing a double-track railway and a state road twice each, the old pin was 3.8 km off; Leščevje tunnel was 15 km off (pin was the village of that name, the tunnel is on the A2 near Belšinja vas).
3. **Specifications:** collected by research per object group, each value with its source URL. Where sources disagree the value is not resolved; the disagreement is listed in the twin sheet under "Where the sources differ".
4. **Independent check:** two separate passes that had not seen the work. Positions: all 56 records with an exact precision checked against OpenStreetMap and the GURS address register, 55 correct, 1 doubtful (the ice-storm masts, now labelled as a site area), none wrong; every drawn line lies on the matching OpenStreetMap way. Specifications: 206 values checked against their sources, 192 confirmed, the other 14 corrected or removed, and missed source disagreements added. Results in `research/check_pos/` and `research/check_specs/`.
5. **Result:** 40 records matched to the mapped structure, 9 published coordinates, 5 street addresses, 4 site areas, 1 epicentre, and 14 that stay at settlement, locality or municipality level because no source places them more exactly. 29 records draw their real geometry. All 73 records open without errors.
6. **Weak source to replace:** lotsberg.net (cited for several tunnel lengths and opening dates) looks like an automatically generated mirror. Its numbers agreed with other sources everywhere they were checked, but prefer Structurae, DARS or official documents.

Precision honesty: a record is never shown more precisely than its evidence. Areas (earthquake studies, municipal projects) stay areas.

## 5. Still open (do not guess these)

- **Vransko bridge, resolved in part:** identified as the A1 motorway bridge at Brode near Vransko. The IM-SAFE case study gives 46° 14' 54.20" N, 14° 58' 7.70" E and describes two independent superstructures, one per travel direction. The point lies on OpenStreetMap way 202466220, with the twin deck way 202466216 beside it. Still open: which of the two decks carried the SiWIM system, and the year of construction.
- **Črna na Koroškem bridge:** the CIRCUIT pilot bridge over the Meža. Client corrected to the Municipality. It is not the bridge opened on 7 September 2025, because visit-crna.si still announced it as a future structure on 1 October 2025. Still open: the exact site (the marker on the CIRCUIT pilot page, 46.47286, 14.85117, and the text "Center 2 to 4" do not clearly agree) and whether it has been built since.
- **Grosuplje and Kamnik bridges:** the records name no single bridge. A second search in November 2026 found no document that names them. Keep them as municipal areas unless ZAG confirms which.
- **Planica and Rateče cableways:** the records do not name the lift and share one coordinate in Rateče. New evidence by client name only: Smuk (client of the Rateče record) is the operator and concession holder of the Macesnovc lifts (skiresort.com, Gorenjski glas 12 March 2016), chairlift base about 46.491714, 13.7073. Zavod za šport RS Planica (client of the Planica record) manages the Planica Nordic Centre, whose chairlift is Čaplja. No ZAG document names either lift, so both pins were left unchanged. Note that Macesnovc was reported closed for eight years before February 2016.
- **SIJ Acroni pavers:** SIJ Acroni places the paved bicycle area in front of the steelworks building. No source gives the exact spot, so it stays a site area.
- **Vzideh tunnel:** now named in press reports as "predor V Zideh" on the regional road Trojane to Izlake in Lukovica, which is the road of the matched tunnel. The tunnel is still unnamed in OpenStreetMap, and length and opening year rest on Lotsberg only.
- **RTP Gorica, resolved to an address:** ELES lists RTP Gorica 110/20 kV at Ulica Vinka Vodopivca 13, Kromberk. The point is the ELES building at that address (OpenStreetMap way 853682719). The switchyard outline is not confirmed.
- **Old fire laboratory Gameljne, resolved to an address:** Srednje Gameljne 41, 1211 Ljubljana-Šmartno, from the annex to accreditation certificate LP-005 of 23 May 2014 (section 3.2.7). OpenStreetMap way 316700919 carries that address but is tagged residential and has no name, so the map confirms the address, not the laboratory.
- **Tabor tunnel:** the point is right for the H4 Podnanos (Tabor) tunnel. No source settles whether ZAG's reference list means this one or the A3 Tabor tunnel near Sežana.
- **Cenkova tunnel opening date:** Lotsberg gives 30 May 2008, while the official 2008 plan lists the section for December 2008 and RTV SLO reports the section opened on 30 October 2008. Listed in the twin sheet, not resolved.
- **Rakuschev mlin:** demolished from 4 April 2015. No street address or coordinate was found, so it stays at municipality level.
- **P2B3 Šenčur and Maribor pilot sites:** no source places them more exactly. CINDERELA is reported at Nigrad in Dogoše and the URBAN SOIL 4 FOOD gardens near the Pekre creek, both without an address.
- **Pečna Reber tower:** a 2013 Ministry of Defence tender lists a 40 m antenna tower on parcel 2297/91, k.o. Postojna. The parcel allows an exact check in the GURS cadastre, not done yet.
- **ZAG Maribor (Dobrovce, Kidričeva cesta 47) and InnoRenew (Izola, Livade 6a):** addresses confirmed, but the buildings are newer than the GURS building survey, so they use the OpenStreetMap footprint.
- **Live cadastre panel:** the page queries the GURS cadastre service live; the service refuses requests from some origins (CORS). It fails quietly. Consider pre-fetching the cadastre data at build time instead.

Ask Aleš or Andrej for the open structures; they know them.

## 6. Next version: design brief

The owner wants a more professional, expert-grade design while keeping every current function.

- House style: ZAG blue `#203469` for titles, clean white surfaces, restrained shadows, no heavy glass effects on hover (an earlier version clipped on hover), British spelling, no en or em dashes, no semicolons in visible text, no wording that sounds like an AI wrote it, nothing negative about Slovenia.
- Panel as an expert data sheet: identity block, a compact key figures strip (length, height, year, capacity), the twin specs table with a source link per value, the geometry summary, ZAG involvement, then sources. Collapsible "Where the sources differ".
- Map: keep Map, Satellite, 3D. Consider official GURS orthophoto and lidar-based terrain as layers. For structures, show the drawn geometry (decks, tubes, lift lines, dam outlines) prominently.
- Google Maps photorealistic 3D tiles are possible only with a Google Maps Platform API key with billing (owner's decision). Do not add them without a key.
- Performance: the page must stay fast on a laptop; avoid loading large files on start.

## 7. Live news per object (built, November 2026)

Each record shows recent Slovenian news, for example closures of the Kastelec tunnel or the November 2026 rescue drill in the Pletovarje tunnel ("reported by 10 outlets"). Records with news from the last 7 days get a red ring on the map.

- `data/news_keywords.json`: per record a Google News query `q` and headline filters `must` (any), `all` (every), `not` (none). Tune these when an unrelated article slips through, or add the link to `data/news_ignore.json`.
- `tools/fetch_news.mjs` (Node 18+, no packages): Google News RSS in Slovenian (`hl=sl&gl=SI&ceid=SI:sl`), which already covers 24ur, STA, Delo, RTV SLO, Dnevnik, Večer and local outlets. Keeps the last 12 months, groups the same story across outlets, stores headline, outlet, date and link only, keeps the previous result for a record when a request fails.
- `.github/workflows/news.yml`: runs every 20 minutes (GitHub may start scheduled runs some minutes late) and commits `data/news.json` only when it changed. Needs "Read and write permissions" for workflows in the repository settings.
- The page re-reads the news file every 15 minutes and labels the section as automatic keyword matching.

Ideas for the next version: an email or push notice to the owner when a ZAG record gets new news; per-record news archive beyond 12 months; a small review page where the owner can hide articles without editing JSON.

## 8. Working rules from the owner

- No Claude attribution in his commits or files. He uploads files himself through GitHub's web interface ("Add files via upload"), so deliver a zip of the site folder without git history unless he asks you to push.
- Keep his structure and style; change only what is asked.
- Every number needs a source. Mark anything unverified as unverified.
- Emails he sends are short and direct, open with "Dear Aleš and Andrej," and end with "Hvala." then "Kind regards, Avto".
- His supervisor Aleš reported the Logatec fire laboratory problem on 6 October 2026; it is now fixed (official GURS building, 18.0 m).

## 9. How to publish

1. Rebuild data if you edited `data.js` or the corrections: `node tools/build_geojson.js`.
2. Test locally: `python -m http.server` in `site/`, open http://localhost:8000, open several records (for example `#zag_logatec`, `#lescevje`, `#kanin_z`, `#ravbarkomanda`), check the browser console for errors.
3. Zip the contents of `site/` (not the folder itself) and give it to the owner, or push if he asks.

## 10. Recheck of November 2026 (second pass)

Five independent passes rechecked all 73 records against outside sources (bridges, tunnels, dams and sites, cableways and towers, buildings and institutions). No record was found on a wrong structure. Their full results, with a source link and a short quote per finding, are in `research/recheck_2026_11/`. Several findings in those files were not applied and are worth reading before the next build (key figures for the hydropower plants, building data for InnoRenew, TR3, KPD and NUK, the Verd contractor question).

What changed in the data, all through `tools/apply_recheck_2026_11.js` (kept for traceability, already applied, do not run it again):

- Positions moved: Vransko bridge (about 1.9 km, now on the A1 bridge at Brode, both decks drawn), old fire laboratory Gameljne (about 1.1 km, to Srednje Gameljne 41), RTP Gorica (about 620 m, to Ulica Vinka Vodopivca 13).
- Črna na Koroškem: client corrected to the Municipality, status planned, built year removed.
- Text errors corrected: Soča earthquake note said 12 April 1998 for the 12 July 2004 epicentre, Stože still said the pin was the village, the funicular note called the upper station the valley station, three records still said "Position: the settlement centre", the three timeline stories for ZAG headquarters sat 535 m south of ZAG, spellings Kidričeva, Špruha, Sitarjevška and Ulica heroja Starihe.
- Sourced additions: Tomačevo length 204 m, Rakuschev mlin built 1903 and demolished 2015, Vzideh name and road, Čatež wording on the seven bridges, Smuk linked to the Macesnovc lifts.
- 36 source differences added to the twin sheets, listed and not resolved.

How it was checked: the three moved positions and the Vransko decks were read from OpenStreetMap (Nominatim and the OpenStreetMap API). Six of the source statements behind the text edits were opened again and confirmed. The 36 added source differences come from the five passes and were filtered, but not each one was opened a second time. All 73 records open without script errors in a local test.

One correction to section 4: Lotsberg is a hand-compiled list by Gunnar Lotsberg, not an automatic mirror. It is still a weak source for exact dates.

## 11. Digital twin pages (built November 2026)

Every record has its own page: `twin.html?id=<record id>`. `twin.html` without an id is the platform home: counts, a type filter, a text filter and a card per object. The map panel has a button "Open digital twin" (added in `js/panel.js`, styled in `css/atlas.css`). The main map is unchanged.

Style, as asked by the owner on 11 November 2026: the light glass style of the ZAG Partnerships page (translucent white cards over soft blue, lilac and green washes, navy headings, iOS colours, Inter, pills and segmented controls). Not dark. For these pages this replaces the plain white style of section 6. Blur is used only on the header, the stage and the key figures, to keep the page fast, and nothing moves on hover.

- Files: `twin.html`, `css/twin.css`, `js/twin.js`. The page does not load `data.js`. It reads `data/zag_projects.geojson`, `data/twins.json`, `data/gurs_buildings.json`, `data/news.json` and `data/images.json`.
- Stage with two tabs. **Model** is a schematic mesh in the manner of a finite element model, drawn on a canvas with no library (`buildModel()` and `initModel()`). **Map** is the MapLibre 3D view (`initView()`), created only when its tab is first opened.
- What the model is built from, and nothing else: the drawn alignment of each part, a deck width only when the twin sheet has a `Width` value in metres, and the official GURS outline raised to its surveyed height. Element size is a drawing choice (8 to 48 elements per part). No pier, span, cross section or floor is assumed. Parts along an alignment are drawn flat because the sources give no heights. The page says this under the model.
- 41 records have a model (31 with drawn geometry, 10 with a GURS building). The other 32 have no geometry in the data, so they open on the Map tab and say so.
- Using the model: drag to rotate, Shift and drag to move, click the model first and then scroll to zoom, pinch on a phone, arrow keys and plus or minus on the keyboard. 3D, Top and Side views. Click a node, an element, a part label or a reference point for its data (number, part, distance along the part, length, height, coordinates, source). Rows in the Geometry tables select the same part.
- Moving light: a point of light travels along every part, in the model and on the map. It is an animation and carries no measured data. The Light button switches it off, and it stays off when the system asks for reduced motion. All animation stops when the stage is off screen or the tab is hidden.
- Sections are expandable cards, with "Expand all" in the section list. About, ZAG involvement, Specifications, Geometry and Verification start open.
- Key figures are picked by rule in `keyFigures()` from the twin sheet, the GURS building, the record structure fields and the drawn geometry. Nothing is typed in by hand, and each figure shows where it comes from.
- Visible text is passed through `clean()`, which removes en and em dashes, semicolons and middle dots. Headlines of news and titles of sources keep their original wording.
- Known oddity: at Vransko the two decks overlap in the model, because the two OpenStreetMap centre lines lie about 9 m apart while the source gives a deck width of 12 m.
- Tested in a headless browser: all 73 pages and the home page open without script errors at desktop and phone width with no sideways scrolling, node and element clicks return the right data, rotate, zoom, the three views, the Map tab, Expand all and both filters work. Not tested: the map with live tiles, terrain and satellite, because the tile servers were not reachable from the build workspace. Check a few pages in a browser after upload.

Ideas for the next step: real heights along alignments from a terrain or survey source, true structural models where ZAG holds them, per part values (per tube, per deck, per station), photographs per object.

## 12. Platform step 1: Add object tool and models on the map (built November 2026)

Everything here runs in the browser. There is no server and no AI in it.

- `add.html` with `js/add.js`: the Add object tool. Name, type, description, optional source link, optional length, width and height. The shape comes from clicks on the map, pasted rows of latitude and longitude, or a file: GeoJSON, KML, GPX, CSV, or a text file with fields such as `name: ...`, `type: ...`, `height: ...` followed by coordinate rows. The model preview updates while you work.
- It does not read photographs, graphs or free text. That needs an AI service behind a small server that keeps the key secret (step 2, not built). GitHub Pages alone cannot do it safely.
- Saving: objects are kept in the browser (`localStorage`, key `zag_user_objects`). "Download my objects" gives `user_objects.json`. Uploading that file to the repository as `data/user_objects.json` shows the objects to everyone. The repository ships an empty file so nothing fails.
- User objects are never mixed into the ZAG records. They have ids that start with `user_`, their own orange layer on the map (`js/userobjects.js`), and every view labels them "Added by a user, not verified". Their twin page shows the entered dimensions as "entered by the user". Links from user files are accepted only when they start with http or https.
- Models on the full map: the panel of every record with geometry shows its model in a small frame (`twin.html?id=...&embed=1`, embed styles in `css/twin.css`), under the button "Open digital twin". The header of the map has links to the twins and to the tool.
- `js/twin.js` is shared: `add.html` loads it with `window.TWIN_NO_BOOT=true` to reuse `buildModel()` and `initModel()`.
- Tested in a headless browser: the readers for all five file kinds, drawing three points on the map, the building outline from pasted rows, saving, the list, the twin pages of saved objects, the home page count, the embedded model in the panel, phone width. The user layer on the main map was tested with the map marked ready by hand, because the main map does not finish loading without its tile servers in the build workspace.

## 13. Platform step 2: AI reader (code written November 2026, not deployed)

`server/worker.js` is a Cloudflare Worker that reads a description, a text file or a picture and returns a draft object. `server/README.md` has the setup steps and `server/test.mjs` tests it without any account (22 checks pass). It is kept outside `site/` and is not part of the upload zip.

- Not deployed. It needs the owner's Cloudflare account, the owner's AI key and an access code the owner chooses. It has never been run against the real AI service, only against a stand-in, so the quality of real drafts is not measured yet.
- The site side is in place: `add.html` has the panel "Read a description, a drawing or a photo", and `data/ai_service.json` holds the service address (empty now, so the reader is switched off). No key and no access code is ever stored in the repository. The access code is kept only for the browser session.
- Rules: the AI may report only what the input states or shows, with a quote per value. The Worker drops values that do not fit. Drafts are marked "AI draft, not verified" in the tool, in the list and on the twin page.
- Limits are best effort (6 per minute per address, 200 per day by default). The real budget is the spending limit of the AI account.
- Not built: a login per person and a shared review queue.

## 14. Changes after going live (11 November 2026, evening)

The platform is live at https://avtandilsvianadzeu.github.io/ZAGSloveniaTwin/ and this repository is the working copy. Sections 11 to 13 describe the first build. This section says what changed after the owner saw it live. Where the two differ, this section is right.

- Twin stage rebuilt at the owner's request. There are no Model and Map tabs any more. The map shows the structure in its real place and is always visible. Beside it are the model, the data of the selected part and a list of all data on the object (twin sheet specifications with their source links, record structure fields, record facts). A click on the structure on the map selects the same part in the model, and the other way round.
- Removed: the moving light, the automatic rotation, the permanent labels on the map.
- Handling: on the map, plain drag, scroll to zoom, right button or Ctrl and drag to turn (cooperative gestures are off). In the model, drag turns it about both axes without limits, the wheel zooms at once towards the pointer, Shift or the right button moves it, double click resets.
- Bug found on the live site and fixed: the 3D map was blank because the camera stayed under the terrain after a programmatic move. `initView()` now releases the terrain height (`unfreeze`), the same way `js/main.js` does.
- Script and style links carry a version (`?v=5`). Raise it when `js/twin.js`, `js/add.js`, `js/dashboard.js` or `css/twin.css` change, or browsers keep the old file for up to ten minutes.
- "Request latest information" on every twin page opens an email with the object, its page link, its open points and the last inspection. The recipient comes from `data/contacts.json` (empty now, so the sender chooses).
- Inspection log on every twin page: date, kind, condition (good, fair, poor, critical, not rated), inspector, notes, report link. Records are kept in the browser (`localStorage`, key `zag_inspections`) and can be sent by email. Published records live in `data/inspections.json` (empty now).
- `dashboard.html` with `js/dashboard.js`: totals, condition from inspection records, objects by type, objects with the fewest specifications, open questions, recent news, and a download of all inspection records. Condition is shown only where a person entered a record. The atlas holds no sensor data.
- `.nojekyll` makes GitHub Pages serve the files as they are.

Checked on the live site through the owner's browser: a twin page with its model, the map with terrain and the raised building, the full map with the model inside the panel. Not checked live: satellite view, the Add object tool, phone width.

Still wanted by the owner and not built: sensor layer, traffic replay and alerts (these need measured data and a data format agreed with ZAG), compare mode, timeline, measure tool, sections and profiles, guided tour, share and print.

## 15. Asset workspace (11 November 2026, late evening)

The owner asked for the look and flow of professional digital twin platforms. The twin page is now an asset workspace, and section 14 is out of date where it describes the stage.

- Layout of `twin.html?id=...`: app bar with breadcrumbs and an asset search, then three columns. Left: the asset card (identity, asset id, position basis, coordinates), key figures with their source, the structure breakdown (parts and reference points, clickable) and tools. Centre: the viewport with the site map and the model side by side (Split, Site or Model), background and tilt switches, and a status bar with live coordinates. Right: the inspector with tabs Properties, Data, Quality, Inspections and Sources.
- Selection is shared. A click in the breakdown, on the map or in the model selects the same part everywhere and shows it under Properties.
- Model: surfaces are filled and shaded where the data supports them (deck plate when a width is sourced, building walls and roof from the GURS outline and height). Buildings are drawn as their real massing, with no intermediate mesh levels.
- New tools: Measure (pick two nodes: distance, horizontal distance, height difference, bearing), Export mesh as CSV (nodes and elements with coordinates), Copy link, Print data sheet.
- `css/platform.css` is the shared professional skin for `twin.html`, `add.html` and `dashboard.html` (white panels, cool grey ground, one blue, no blur). `css/twin.css` still holds the base rules. Versions are at `?v=6`.
- In the map panel of the main map the model is embedded through `twin.html?id=...&embed=1`, which renders only the model and the selection.
- Tested headless: all 73 asset pages at desktop and phone width, breakdown clicks, measure, tabs, in-page links, layouts, CSV, asset search, embed, home, add and dashboard pages.


## 16. Changes of 12 November 2026

- Site builds of 11 November evening failed at start on the GitHub side (two runs, "startup_failure"). The next push built normally, so the live site now carries the asset workspace.
- Researched values merged with `node tools/merge_recon.js`: 485 values with a source link each, across 59 records. The research files with the quoted source sentences are in `handover/research/reconstruction_2026_11/`. `data/rebuild_status.json` lists per asset what is still missing for a true model.
- These values were read from the sources by the research passes. The source pages have not been opened a second time to confirm each quote, so treat them as read once.
- Visible text: middle dots, ellipsis marks and arrow marks removed from the map page, the search, the list and the side panel.
- Site map on the asset page now fills its pane (it stayed 128 px high until the window was resized).
- Positions looked at on Google Maps satellite view, centre of view on the stored point: Tomačevo, Vransko, Novo mesto footbridge, Čatež, Ravbarkomanda, Verd, Gameljne and RTP Gorica sit on the structure. Črna na Koroškem sits in the town centre, and its exact bridge is still an open item.

### Later on 12 November 2026

- All points looked at on Google Maps satellite view. Results per record are in `handover/research/recheck_2026_11/google_maps_view_2026_11_12.json`. Read by eye, so small offsets are not resolved. The four earthquake study areas were not viewed.
- Rakuschev mlin moved about 660 m, from a placeholder in the old town of Celje to the Google Maps place pin in Gaberje. Kamra places the mill in Gaberje by the railway towards Velenje.
- No structure at the point for: Črna bridge, Grosuplje bridge, Planica and Rateče lifts, P2B3 Šenčur. These need a source for the exact site.
- Selection on the main map: a building picked from the map tiles is now drawn by the tile layer itself, so it is whole. Before, pieces cut at tile edges could show half a building. Glow removed, one accent colour with a white casing.
- Models rebuilt from published dimensions (`model` block per object in `data/twins.json`): Novo mesto footbridge (span, width, sag, segments), Čatež bridge (span lengths, support axes), Vransko bridge (length, bearing span, width). Each states its drawing choices. Other structures stay schematic until span, section and pier data are published or supplied.

### Tools added on 12 November 2026

- Timeline on the map page (`js/timeline.js`): a year slider with Play and All years. It shows records whose ZAG work started in or before the chosen year. Records without a year in the sources stay visible at every position.
- Table view on the Twins page: sortable columns, the same filters as the cards, and a CSV download with coordinates and ids.
- Ground profile on each asset page with a drawn alignment (Data tab, Geometry): terrain heights read from the Mapzen terrain tiles along the line, with a readout on hover. It is the ground surface, not the deck level or the tunnel floor.

### Evidence and data API, 12 November 2026

- Evidence: 485 values now carry the sentence they were read from (`quote` in `data/twins.json`). On the asset page each such value has an Evidence button that shows the sentence with the value marked and a link to the source. For web pages the link opens the source at that sentence, for PDF files it opens the document.
- 64 of the 485 quotes do not contain the value in the same form (a translation, a table row or a title). They are labelled "Evidence, check" and counted on the Quality tab. They need a person to open the source.
- No screenshots of the source pages are stored. The sources could not be opened from the build environment, and zag.si could not be reached from the built-in browser on 12 November.
- Data API: `node tools/build_api.js` writes `api/v1/` (index, objects list, one file per object, GeoJSON, CSV, OpenAPI description). `api.html` documents it and has a try-it box. Run the script after every data change.

### Buildings on imagery, 12 November 2026

- A record holds one official outline (GURS). A site such as ZAG at Dimičeva has several buildings, and the atlas has no source that says which neighbouring buildings belong to it, so only the documented building is highlighted.
- On imagery the neighbouring buildings are now drawn in 3D as a light see-through volume, and the selected building is see-through with a clear footprint outline. Nothing is left flat beside the selection.
- OpenStreetMap building at each stored point checked through the OSM API: `handover/research/recheck_2026_11/osm_building_at_point_2026_11_12.json`.
- Open sources for detail: GURS publishes national LiDAR point clouds and surface models (clss.si). No open source with facade detail was found. Facades and bridge detail need BIM or IFC files, or a photo survey.

### Newer building outlines and the live cadastre, 12 November 2026

- Outlines compared: the stored GURS topographic outlines (mostly surveyed 2001 to 2004) against the OpenStreetMap outline at each point, read from the OSM API. Raw data: `handover/research/recheck_2026_11/osm_buildings_raw_2026_11_12.json`.
- Largest differences: Former Maribor Prison (the GURS outline held one wing of 1,401 m², the OpenStreetMap outline holds the whole building of 5,487 m²), ZAG at Dimičeva (2,781 against 3,135 m²), TR3 (GURS outline included the low part, OpenStreetMap part is the tower), Kočevje school, Stara Cerkev school, Cestel.
- `data/gurs_buildings.json` now uses the OpenStreetMap outline for 10 records and names it per building (`outline`), with the earlier outline noted (`outline_before`). Heights stay from the GURS survey. Three records gained an outline for the first time: Gameljne, ZAG Maribor (no surveyed height, so drawn flat) and InnoRenew.
- InnoRenew is drawn from six OpenStreetMap building parts with storey counts. Storey height is not in the sources, so 3 m per storey is used and stated as a drawing choice.
- Live cadastre: each asset page with a building asks the GURS Kataster nepremičnin service for the current record at the point (storeys, year built, H1 and H2 levels) and draws the neighbouring cadastre buildings on the site map at their recorded heights. The service refuses several requests at once, so the page sends one. If it does not answer, the page says so.
- Shapes from Google Maps are not used. They are not open data.

### Cadastre facts and solid building models, 12 November 2026

- `data/gurs_buildings.json` holds per building a `kn` block: the GURS Kataster nepremičnin record of the building that contains the stored point (storeys, year built, H1 lowest point, H2 highest point, H3 ground level), read on 12 November 2026. Height above ground is H2 minus H3. It agrees with the GURS topographic height within 1 m for six buildings. It differs for UL FGG (28.0 against 23.7 m) and Fibran (5.9 against 8.6 m), and both values are listed on those pages.
- ZAG Maribor and InnoRenew had no height. They now use the cadastre height (8.4 m and 18.1 m).
- No cadastre building contains the stored point for Cestel, Former Maribor Prison, NUK and Gameljne. Their points sit beside or between cadastre outlines.
- The cadastre service rejects coordinates with long decimals. Requests now round to six decimals. The same fault was in the map panel and is fixed.
- Building models are drawn as solid volumes: hidden edges are no longer drawn through the roof, and volumes are ordered far to near. Storey lines come from the cadastre storey count. The window pattern is illustrative and the page says so.

### ZAG site at Dimičeva rebuilt, 12 November 2026

- The owner drew the site boundary on a Google Maps view. It was transferred by eye to coordinates (good to about 10 m) and stored as `site` on the ZAG record.
- The record now holds the 15 buildings of the GURS cadastre with at least half of their outline inside that boundary, each with its own cadastre number, year, storey count and height (H2 minus H3). Source data: `handover/research/recheck_2026_11/zag_site_cadastre_2026_11_12.json`.
- The office building in the owner's photographs is cadastre building 892: built 1984, 8 storeys in all, 23.5 m above ground. The earlier model showed only hall building 962 (1953, 14.5 m).
- Five cadastre buildings are cut by the boundary with less than half inside and are left out (8291, 768, 1281, 1250, 1354). The owner should confirm these and the boundary.
- Parking areas and yards are not modelled. The cadastre holds buildings only.
- Storeys above ground are not known. The cadastre counts all storeys below and above ground (8 for building 892). An earlier derived figure of 7 was removed.

### Assumptions removed, 12 November 2026

Rule from the owner: if something is not known, do not assume it and do not draw it.

- Window patterns and storey lines removed from all building models. They were derived, not sourced.
- Derived "storeys above ground" removed from the data. The cadastre gives only the total of storeys below and above ground (rules on cadastre data, article 15).
- Meaning of the cadastre heights checked against the rules (article 13): lowest height is the floor of the first storey, highest height is the top of the roof or wall, characteristic height is the terrain at the main entrance. The rules name these three heights but do not print the field codes H1, H2, H3, so the mapping of the codes is by content and by agreement with the GURS topographic heights.
- Former Maribor Prison: the 23.2 m height was surveyed on one wing only, so the whole outline is now drawn flat and the height stays as a value for that wing.
- Vransko bridge: bearing axes removed. The bearing span is sourced, their position along the deck is not.
- Novo mesto footbridge: segment joints removed. Their position is not sourced. The sag at mid-span is sourced, and the curve between is drawn and labelled as not surveyed.
- InnoRenew: part heights are drawn in proportion to storey counts and labelled as not measured.
- ZAG office building floors: cadastre 8 storeys below and above ground, dLib source 7, owner's count on photographs 6. Listed as a difference, not resolved.

### Later on 12 November 2026

- ZAG site: cadastre buildings 901 and 1079 removed. The owner states they are not part of ZAG. The site now holds 13 buildings, 7,616 m².
- Map selection: map-tile buildings under the official outlines are hidden, so their grey walls no longer show through the blue selection.
- Timeline bar moved to the bottom right of the map.
- Inspection form: a saved record stays in the browser where it was typed. Nobody else sees it. Sharing needs a server with sign-in, which this static site does not have.

### ZAG sites from the cadastre manager records, 12 November 2026

The GURS cadastre names the manager (upravljavec) of state property. Its public service lists the buildings and parcels where the manager is Zavod za gradbeništvo Slovenije (registration number 5866324000). This replaces the boundary drawn by eye and the choice of buildings by position.

- How it was read: OGC API Features service of the cadastre, collections `SI.GURS.KN:DST_UPRAVLJAVCI` (building parts) and `SI.GURS.KN:PARCELE_UPRAVLJAVCI` (parcels), filter `NAZIV ILIKE '%gradbeništvo slovenije%'`. Outlines from `STAVBE` and `PARCELE` by bounding box. The service accepts at most 50 items per request and rejects long decimals and several requests at once.
- Dimičeva, Ljubljana (community 2636 Bežigrad): 14 buildings, 8,402 m², 23 parcels. Against the list of the morning: buildings 1079, 1321 and 1365 added, buildings 889 and 784 removed (not under ZAG in the cadastre). Building 901 stays out. Most entries there carry the status "Začasen" (provisional).
- Gameljne (community 1749): 14 buildings, 4,467 m², 14 parcels. Before, the record showed one house outline. Two buildings (1095, 1096) have no heights and are drawn flat.
- Maribor unit (community 708 Skoke): building 1809, 2 parcels. Logatec (community 2017): building 2382, 3 parcels.
- Source files: `handover/research/recheck_2026_11/zag_managed_buildings_cadastre_2026_11_12.json` and `zag_managed_parcels_cadastre_2026_11_12.json`.
- Not looked into: the ownership collection (`LASTNISTVO_PRAVNIH_OSEB`) also names parcels 534/128 and 553/115 and building 224 in community 1297 Mostec, and a part of building 343 in community 2680 Nove Jarše. These may be further ZAG locations.
- The same lookup works for any legal person, so it can confirm sites of other institutions in the atlas.

### Other records against the cadastre, 12 November 2026

GURS Javni vpogled (https://ipi.eprostor.gov.si/jv/) is the public viewer of the same cadastre that the atlas reads through the OGC API Features service.

- With the above-ground outline of the cadastre the stored point lies in a cadastre building for: Former Maribor Prison (659 Tabor 416), NUK (1728 Ljubljana mesto 174), RTP Gorica (2302 Kromberk 1386), Livarna Črnomelj (1535 Črnomelj 857). Cestel sits 2 m from building 1961 Trzin 1362.
- Former Maribor Prison: building 416 is one building of the group, 1,457 m², 23.1 m. It is drawn at that height. The outline of the whole group from OpenStreetMap is the light site area.
- Cestel: the cadastre lists two buildings in Trzin under the company as owner. Both are drawn.
- NUK and Stara Cerkev school: the building at the point is among those the cadastre lists under the institution as manager.
- UL FGG: the faculty's ownership rows name building 2679/807, the building at the point is 2679/907. Listed as a difference on the page, not resolved.
- No cadastre building at the point: P2B3 Šenčur (nearest 41 m, built 2013, not confirmed as the object) and Rakuschev mlin (demolished).
- Details: `handover/research/recheck_2026_11/cadastre_other_records_2026_11_12.json`.
- Fibran Sodražica: four buildings in community 1619 that the cadastre lists under the company as owner are drawn (5,929 m²). Before, only building 411 (419 m²) was shown. Stara Cerkev school: buildings 555 and 333 are drawn. Kočevje school: the building at the point (1577/105) is among those the cadastre lists under the school as manager.
- InnoRenew: owner or manager not confirmed. The owner rows of Univerza na Primorskem exceed the 50 row limit of one request.

### Owner and manager from the cadastre, 12 November 2026

- Source: GURS Javni vpogled, https://ipi.eprostor.gov.si/jv/. The requests it makes were read in the browser and repeated for the atlas records:
  - parcel or building at a point: `wfs-si-gurs-kn/wfs?request=GetFeature&version=2.0.0&typeName=SI.GURS.KN:PARCELE&REFERER_APP_CODE=JV&outputFormat=application/json&bbox=lat,lon,lat,lon,urn:ogc:def:crs:EPSG::4326`
  - building parts of a building: typeName `SI.GURS.KN:DELI_STAVB` with `cql_filter=EID_STAVBA=...`
  - owners: `javni-service-api/v1/external/std-service/features?featureType=JAVNI_SERVIS_LASTNIKI_PARCELE.JSON&filter=EID` and `JAVNI_SERVIS_LASTNIKI_STAVBE.JSON&filter=EID of the building part`
  - managers: typeName `SI.GURS.KN:PARCELE_UPRAVLJAVCI` and `SI.GURS.KN:DST_UPRAVLJAVCI`
  This WFS route accepts numeric filters. The OGC API route refuses them.
- Result: `data/ownership.json`, 37 records (bridges, dams, buildings, institutions, towers). Shown on each asset page under Data, Owner and manager, and in the API as `cadastre_owner_and_manager`. Tunnels, cableways, landslides and study areas were left out, because the parcel above a tunnel or at a representative point says nothing about the object.
- Only legal persons are stored. Holders that the cadastre marks "Podatek ni javen" are counted, never named.
- For bridges and dams the parcel at the point is often the river parcel. The page says so.
- Findings that bear on positions: the parcel at the Grosuplje bridge point and at the P2B3 Šenčur point has a holder that is not public, and the Črna point too. This fits the open question that these points are not on the object.
- ZAG at Dimičeva: office building 892 is owned by Republika Slovenija and managed by ZAG. Hall buildings 962 and 1079 are co-owned by Republika Slovenija, ZAG and KOMPAS KAPITAL d.o.o., with ZAG as manager.
- UL FGG: the building at the point (2679/907) is owned by Univerza v Ljubljani. InnoRenew: building and parcel are owned by Občina Izola.
- LiDAR: Javni vpogled lists the laser scanning files per 1 km sheet. They are used since 12 November 2026, see Laser scanning below.

### Laser scanning, 12 November 2026

- Source: GURS laser scanning of Slovenia (CLSS), file series NDMP, one GeoTIFF per square kilometre, 0.5 m pixels, 2000 by 2000, 32 bit float. Address: `https://ipi.eprostor.gov.si/javne-datoteke/DALJINSKO_ZAZNAVANJE/CLSS/ndmp/NDMP_<E km>_<N km>.tif` in D96/TM (EPSG:3794). The server allows range requests and cross origin reads.
- Reading of the values: height above the ground in metres. No official description of the series was found (gov.si news of 27 March 2025 and the Geodetski vestnik note on CLSS list other products). The reading rests on the agreement with the cadastre: footprint areas agree within 1 %, and the cadastre highest point lies close to the 99 % level of the scan for most buildings. Say so wherever the data is shown.
- How it was read: in Chrome on the Javni vpogled page, geotiff.js 2.1.3 read the window of each building from the sheets, a transverse Mercator projection (GRS80, central meridian 15°, scale 0.9999, false easting 500000, false northing -5000000) placed the outlines, and the result was saved to Downloads as one JSON file. Copy in `handover/research/recheck_2026_11/lidar_ndmp_2026_11_12.json`. The cloud workspace cannot reach ipi.eprostor.gov.si, so this step runs in the browser.
- Import: `node tools/import_lidar.js handover/research/recheck_2026_11/lidar_ndmp_2026_11_12.json` writes `data/lidar/<id>.json` (1 m cells, each the mean of the 0.5 m pixels inside the building outlines, decimetres, 65535 outside) and the statistics per building into `data/gurs_buildings.json` (`scan` on each part or on the record: pixels, min, median, 90 % level, 99 % level, max, mean).
- 13 records have a scan: zag, zag_gameljne, zag_logatec, zag_maribor, cestel, ulfgg, ss_kocevje, os_stara_cerkev, fibran_sodrazica, tr3, kpd, nuk, innorenew. Sheets: 462_103, 461_110, 441_86, 553_149, 464_108, 460_100, 488_55, 487_58, 470_69 and 471_69, 461_101, 549_157 and 550_157, 461_100 and 461_101, 395_44.
- On the asset page the model opens in the Laser scan view: every cell is a column to its measured height, drawn far to near (`drawScan` in `js/twin.js`). The Laser scan button switches back to the plain cadastre blocks. A click on a cell gives its height, position and the source file. The Geometry section shows the middle and the 99 % level per building next to the cadastre height.
- InnoRenew: the six OpenStreetMap parts are now drawn at the middle height measured by the scan, not at storeys times an assumed storey height.
- Differences recorded on the pages (cadastre against scan): ZAG 892 (23.5 m against 26.3 m at the 99 % level), ZAG 8300 (10.0 against 13.2), ZAG 1365 (scan shows almost no raised surface), NUK (21.9 against 25.5), TR3 (69.2 against 72.1, highest pixel 77.2), Gameljne 38 and 71.
- API: `laser_scan` in `api/v1/objects/<id>.json`.
- `js/vendor/geotiff.js` (2.1.3, MIT) is kept for a later live reader. No page loads it yet.

### ZAG property outside the four sites, 12 November 2026

- The cadastre lists ZAG as owner of two dwellings: one in Čatež ob Savi (community 1297 Mostec, building 224, 37.1 m²) and one flat in Ljubljana (community 2680 Nove Jarše, building 343, part 184, 46.9 m²). They are not research facilities and are not on the map. Details in `handover/research/recheck_2026_11/zag_managed_buildings_cadastre_2026_11_12.json`.
- A second, separate read of the manager records in Chrome gave the same 30 buildings and 42 parcels as the first read.

### Independent checks, 12 November 2026

Three separate checkers, which had not seen the work being made, went through the data: one audited the files against each other, two opened the stated sources for all 73 records. They could not open the GURS cadastre, OpenStreetMap or Wikipedia, so cadastre and mapped values rest on the atlas's own reads.

Result of the source check: ZAG involvement is confirmed for every record except the former Maribor prison (the listed sources do not name the prison as the CABE case) and UL FGG (a partner entry). 25 records are only partly supported. No record was found on a provably wrong structure.

Fixed on the same day:
- Footprint areas were about 0.7 % low, because the formula used the equator length of a degree. They are now computed through the D96/TM projection (ZAG site 8,464 m², before 8,402). The laser scan pixel count confirms the new values. Older sections of this file still quote the old numbers.
- HE Solkan: the gross head of 20.55 m holds at 60 m³/s (SENG brochure, checked again), "youngest" and "a single unit" removed.
- CABE runs from January 2025 to December 2027 (Driving Urban Transitions page, checked again).
- Ten stale position notes removed from "Where the sources differ". They described points that were corrected long ago.
- Railway masts record: the straight line between Borovnica and Divača was not real geometry. The two stations are now reference points, and the municipality is Postojna.
- RTP Gorica: the unsourced "Owner" value is now "Client named in the ZAG reference list" with its link, and the cadastre owner ELES is listed as a difference.
- API: quotes are no longer altered, and `position_exact` is false for site areas, as on the pages.
- Geometry table: each row names its survey (cadastre or topographic survey of the given date).
- Spelling of two school names, units (m³, m², m/s, min), three semicolons in the credits, text tidy-up in the map panel.
- `data/rebuild_status.json`: items the cadastre now answers were removed from the missing lists.

Listed on the pages under "Where the sources differ", not resolved (each needs a person to decide):
- Former Maribor prison: link to CABE not in a public source.
- HE Solkan, HE Zlatoličje, HE Vuhred: the ZAG book credits the predecessor ZRMK. HE Vuhred municipality. HE Zlatoličje refurbishment years, and several figures that no opened source confirms (17.2 km, 6.2 km, 450 to 530 m³/s, 62 million euros, runner size, MHE Melje date).
- Ravbarkomanda deck lengths and sides, Verd contractor, Tomačevo details, Novo mesto footbridge load test wording, Tabor tunnel identity, Jez Melje model scale, Črna wording, SIJ Acroni wording, Strunjan years, TR3 role, ZAG staff and department counts, Logatec staff, Soča earthquake municipality, CINDERELA end date, CROSScade years.
- Pairs of values that differ inside one sheet (UL FGG year, KPD year, Šentvid start, Karavanke lay-bys, anchors of the Novo mesto footbridge, HE Vrhovo head, HE Arto generation, Slano Blato volume, cross passage spacing in Kastelec and Dekani).

Open after the checks:
- 618 of 1,104 values have a source link but no stored quote. 73 quotes miss part of the numbers of their value, 20 of them all numbers (for example tomacevo 1980, ravbarkomanda moduli, karavanke_c 3332 and 1200, nuk 2000).
- Tunnel records: "1998 to 2014" and "1990 to 2013" are the ranges of the whole ZAG reference list, not years per tunnel. The ZAG page says "External control of the following tunnels".
- No raw evidence file holds the rows behind `data/ownership.json` and behind some `kn` blocks (ulfgg, ss_kocevje, tr3, innorenew). They were read live and only the result was stored.
- Ownership file: Gameljne has no building entry, and four records at settlement precision are in although the note says such points were left out.
- Working notes still read as notes in some difference lists (Karavanke, Krvavec, Golte, Velika planina).
- Several statements in sections 2, 4.5, 5 and 11 of this file are older than the data (counts of building records, of matched positions and of models).

### Other GURS services, 12 November 2026

- Besides the cadastre (`wfs-si-gurs-kn`) the same server answers for the register of spatial units (`wfs-si-gurs-rpe`, 32 collections, among them OBCINE and NASELJA), the cadastre of public infrastructure (`wfs-si-gurs-kgi`, 86 collections: roads, railways, cableways, electricity, water infrastructure as lines, points and polygons), the address register (`wfs-si-gurs-rn`) and map names (`wfs-si-gurs-dtm`). All read as `.../ogc/features/collections/<name>/items?f=json&limit=50&bbox=...`.
- Read in Chrome for all 73 records, saved to Downloads and copied to `handover/research/recheck_2026_11/gurs_rpe_kgi_check_2026_11_12.json` (attribute rows without geometries). Result for the site: `data/official_check.json`, shown under Position on each asset page and in the API as `official_place_and_line_check`.
- Municipalities: the register corrected five records. HE Vuhred is in Radlje ob Dravi and HE Arto in Sevnica, as the first data said. Two earlier "corrections" to Podvelka and Krško were wrong and are removed. The Soča earthquake point is in Bovec (settlement Lepena), not Kobarid. Four tunnels cross a municipal boundary: Karavanke road tunnel (Jesenice and Kranjska Gora), Kastelec (Koper and Hrpelje-Kozina), Markovec (Koper and Izola), Pletovarje (Slovenske Konjice and Šentjur).
- Roads and railways: for 20 bridge and tunnel records the drawn line lies within 22 m of the official road centre line near the point, mostly within 2 m. Tunnel points sit 12 to 25 m from a centre line because they lie between two tubes. The Karavanke railway tunnel and the railway masts point are 2 and 3 m from the official railway line.
- Limits: the infrastructure cadastre carries no names and no object type. It cannot say which bridge stands at Grosuplje, Kamnik or Črna, so those three points stay settlement points. Its cableway layer holds lines near only four of the eleven cableway records, and those lines are other lifts of the same resorts, so it confirms none of the drawn cableways.
- DRSI keeps the bridge and road register (Banka cestnih podatkov). No open download of it was found on gov.si in this pass.

### Quotes, second round, 12 November 2026

- Before: 486 of 1,105 values had a stored quote. After: 717.
- How: the source pages were opened again and the sentence or table row that states each value was taken. Two routes:
  - Government files read in Chrome and saved (gov.si pages and PDFs): the quote was copied from the text of the file itself. These carry the note "Copied from the text of the file itself". 14 values.
  - Other sources (Lotsberg tunnel list, the IBE papers and the ZAG book on dLib, SENG publications, NHESS papers, lift-world data sheets, SEL, Slovenian Railways magazine, Elea, UCD, power-technology, CFBR): read through a page reader. These carry the note "Text as returned by a page reader". The reader can alter a word, so the wording is not guaranteed. 203 values.
  - Uradni list 103/2006 (official list of cableways): the reader would not copy the long rows and restated them. These carry the note "restated", and they are not verbatim.
- `quote_note` is stored with each of these values, shown in the evidence box and in the API.
- `handover/dev_tools/qf.js` is the reader used in Chrome: on a page of the source site it fetches the listed pages of that site and saves them as one file. Chrome refused to open dlib.si and uradni-list.si ("Navigation to this domain is not allowed"), so only gov.si was read this way.
- Still without a quote, 388 values: 86 cadastre values (the evidence is the attribute record, kept in `handover/research`), 51 values computed from OpenStreetMap geometry (no sentence exists), and about 250 from other pages: Structurae (31), lift-world (23, two pages refused), Wikipedia (20), remontees-mecaniques (15), Ujma (10) and many single pages.
- What the fresh reads showed: lift-world gives 170 kW for Velika planina and 986 kW for Krvavec against 180 and 980 kW in the official list of 2006, already listed as differences. The railway magazine says all concrete masts between Logatec and Verd had to be removed, which is not the same as "fell over about 1 km".

### Changes asked by the owner, 12 November 2026, afternoon

- ZAG site at Dimičeva: the south-west corner towards Ptujska ulica is not part of ZAG according to the owner. Buildings 1079, 1321 and 1365 and parcels 258/1, 258/6, 258/7, 259/1, 259/2, 245/1, 249/2, 246/4 are not drawn. The cadastre still lists ZAG as manager of them. They are kept under `site.excluded` in `data/gurs_buildings.json`, and the page lists the conflict under "Where the sources differ". Earlier the owner had asked to draw the long building 1079 in blue, so this point changed twice. Ask before changing it again.
- Office building 892: 7 floors, confirmed by the owner for the left side.
- Wording: the pages are called asset records and asset pages, no longer digital twins. The file stays `twin.html` so that links keep working.
- Site map on the asset page: the 3D buildings of the base map are hidden once the cadastre answers, and the cadastre buildings within about 230 m (up to 200, read in pages of 50) are drawn instead as solid grey blocks. The record's own buildings are not drawn a second time. Before, three sources overlapped and flickered.
- Map and model turn together: turning or tilting the site map turns the model, and turning the model turns the map (`setCamera` and `setView` in `js/twin.js`). The map stops at 85° tilt, the model does not.
- A click on a building of a site picks that building and shows its cadastre and laser scan values under Properties.
- Map settings for smoother drawing: no label fade on the site map, a tile store of 600 tiles, pixel ratio capped at 1.5. The frame rate itself is set by the screen and the browser.
- Cestel is shown as a company, not an institution. Cadastre read of the same day: building 1365 at Špruha 36 with a share of 1/1, building 1362 at Špruha 32 (registered address) with a share of 1/4.
- Not verified on the live map: the Chrome tab used for checking was not being painted (no animation frames), so the map there never finished loading. The changes were tested locally with stand-in map and cadastre answers.
- Later the same afternoon: the site map draws the record's buildings as pale blue glass (`GLASS` in `js/twin.js`, opacity 0.56) with a band of light that rises through each building (`bld-flow`, off when the system asks for reduced motion). The excluded south-west corner is a dashed grey outline. Building sites are drawn without terrain. With map and model linked, the model keeps to the tilt range of the map (0 to 85°), and the map keeps its centre and zoom when the model turns it. The selection of a building shows number, year, storeys and height only.
- Look, 12 November 2026: `css/ios.css` is loaded last on every page and gives the iOS look the owner asked for: system colours with blue #007AFF for action, filled grey buttons, segmented controls with a white selected segment, capsule tags, large soft radii, hairline separators, the system font first. It changes colour, shape and type only, not the layout. Blur is used on the top bar only, so nothing translucent lies over the map canvas. To go back, remove the one `<link>` line per page.
- Map colours, 12 November 2026: `js/mapstyle.js` recolours the OpenFreeMap style after it loads (warm paper land, soft green, light blue water, white streets, pale yellow main roads, grey labels). It matches layers by name pattern and was tested against assumed layer names only, because the style file could not be opened from the build machine. Check on the live map that parks, water and roads took the colours.
- ZAG site, third change of the day: the owner asked to add the long building 1079 back. Drawn now: 12 buildings and 17 parcels. Still excluded on the owner's word: buildings 1321 and 1365 and parcels 258/1, 258/6, 258/7, 259/1, 259/2, 246/4.
- Map panel: the list of values is hidden for buildings, institutions and companies. Pixel ratio cap raised to 2 for sharp drawing on high-density screens.
- Design, later passes on 12 November 2026 (all in `css/ios.css`): side columns as inset grouped cards on a grey ground, the five tabs as one segmented control, value rows with the source as one quiet line under the value, raised white keys for buttons with a blue key for the main action, model tools with the view switch on the left and the actions on the right.
- Main map: markers are round with system colours (blue for projects, indigo for ZAG facilities, grey for referenced partners), drawn at three times the size for sharp screens. Clusters are blue with a white ring and a soft shadow (`clu-s` is the shadow layer). The main map keeps its own palette in `js/config.js` (`PAL`), now with a quieter relief and softer greens. `js/mapstyle.js` is used on the asset and add maps only.
- Measure: it takes any two points, a node of the model or a place on the scanned surface, shows the distance on the model and in the panel, and now also works in the small view inside the map panel. Before, it had no handler there, and in the laser scan view there were no nodes to click.
- Main map, 12 November 2026, 15:00: the timeline has a Hide button and comes back from a "Timeline" chip. A legend at the lower left names every marker symbol, the three marker colours and the numbered circle, and can be hidden to a "Legend" chip (`js/legend.js`). Both choices are remembered in the browser. The zoom, rotate, tilt, north and home buttons sit in the lower right corner, also on the site map of the asset pages. The list page says "facts and figures, each with its source" instead of "sourced specifications".

### Platform pass, 12 November 2026, evening

- Open questions page (`questions.html`, `js/questions.js`): 295 points in four kinds: 216 places where sources differ, 10 notes marked as not verified, 16 approximate positions, 53 records with values lacking a quote. Each can be ticked as decided with a note, filtered, searched and downloaded as CSV. Marks are kept in the browser only.
- Search inside the facts on the asset list: the search field matches names, places, values, units, source sites, quotes and difference texts, and shows where it found the match.
- Evidence: 801 of 1,105 values now have a quote. 37 more quotes were copied from the page text itself, read in Chrome (Structurae, DRI, remontees-mecaniques). 37 cadastre values carry the attribute record as evidence and 10 the topographic survey record. 90 values carry a "How it was obtained" note instead of a quote (counted from records, or computed from OpenStreetMap geometry). 214 values have neither yet. WebFetch refused pages that came only from the data files, and Chrome refused ic-group.org and tunnelbuilder.com.
- Structurae now shows one length, 757 m, for Golo Rebro. The stored 750 m and 786 m were not on the page. Listed as a difference.
- Positions: the Planica and Rateče cableway records moved from the settlement centre onto the chairlifts mapped in OpenStreetMap (ways 373928812 and 292050650), with the line drawn and precision "site". Both links are inferences and are written as such on the pages. Črna, Šenčur, Grosuplje and Kamnik stay approximate: no source that was opened names the exact object.
- Asset page: Print report and Data file buttons. The site map opens on the whole site. No animation.

## Source pages, full reread (12 November 2026, evening)

- Reader - handover/dev_tools/qf2.js now follows a host that moved to or from www. (run(k) takes the list key by hand).
- Pages read - 150 pages or files from about 90 hosts, list with text sizes in research/recheck_2026_11/source_pages_read_2026_11_12.json.
- Quote check - 564 values have source text in hand. 436 quotes match the page literally, 124 more match once accents, tables or line breaks are allowed for (already noted on each value). Golovec cost and lighting quotes now checked word for word. Golovec contractor quote stays unverified (STA article for subscribers only).
- New quotes - 15 values (Stože areas, Straža and Čaplja chairlifts, Počivalo chairlift, Strunjan instruments, Karavanke road tunnel operation, HE Vrhovo owner, funicular valley station, Golte from RTV SLO because the Golte page no longer exists). Field quote_source holds the page a quote came from when it is not the cited source.
- New differences - Golo Rebro (Structurae now 757 m and 1 tube), Karavanke railway tunnel (tubes and boring method not on Wikipedia).
- Still refused by the Chrome extension - dlib.si, uradni-list.si, ic-group.org, tunnelbuilder.com, power-technology.com, ojs-gr.zrc-sazu.si, graz.elsevierpure.com (JS), core.ac.uk and wcee.nicee.org (403 or bot check), lift-world.info (connection error). The owner can allow all sites in the extension settings.
- Count now - 1,105 values, 917 with quote, 90 with "how obtained" note, 98 with neither.

## 3D model honesty pass (12 November 2026, late)

- Badge - every model view now shows how it was made: Built from published dimensions (green), Plan from published dimensions (blue), Plan from the land cadastre (purple), Schematic, not the real structure (orange). Set by model.level in buildModel.
- Model block - lengths_m gives one published length per drawn line. level "plan" means only plan length and width are published.
- New plan models - Kastelec, Dekani, Markovec, Tabor (tube lengths and road width), Pletovarje and Golo Rebro (road width only, tube lengths disagree). Which drawn tube is northern was read from the line positions.
- Not done - HE Boštanj, HE Krško and ČHE Avče have only a point on the map. A dam or penstock model needs the mapped dam axis or penstock line (OSM or GURS KGI), which needs the browser. The bridge to the owner's computer and Chrome was lost during this pass.
- Ravbarkomanda and Tomačevo - span lengths are not published (only "34 to 40 m"), deck lengths disagree between sources, so they stay schematic.
- Dams, done without a browser - outlines taken from the earlier OpenStreetMap pull in handover/research/dams_osm.json. Model block "blocks" holds rings with base z0 and height h, level "outline" (teal badge "Mapped outline, published height"). HE Boštanj: OSM dam outline (way 965129574, shows the piers) raised to 26.85 m. HE Krško: OSM plant outline (way 651093189, 84 x 19 m, matches the published 85 x 20 m powerhouse) raised to 40 m. ČHE Avče: OSM plant outline flat, plus the published powerhouse shaft (18 m inner diameter, 80 m deep) at its centre, position assumed. Base levels are drawn at 0 because ground and foundation elevations are not published.
