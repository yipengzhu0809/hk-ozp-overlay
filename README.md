# Hong Kong Planning Map

An interactive map of Hong Kong statutory planning zones over official aerial imagery or street maps. English is the default; one language selector switches the interface, official place labels, query details, legends and KMZ downloads to Traditional Chinese.

The checked-in snapshot contains **167 plans and 11,677 land-use zones**, retrieved on **23 October 2026**. It covers the available OZP_PLAN and DEV_PLAN data, rather than every parcel of land in Hong Kong.

## GitHub Pages

This project is ready to publish using the included [GitHub Actions workflow](.github/workflows/pages.yml). It deploys only `dist/`, with no build step or API key required. Setup and push instructions are in [DEPLOY_GITHUB.md](DEPLOY_GITHUB.md).

GitHub Pages hosts the site; the GitHub repository stores its source and version history. The published URL normally looks like `https://YOUR_USERNAME.github.io/hk-ozp-overlay/`.

## Run locally

```sh
python3 -m http.server 8765 --directory dist
```

Open http://localhost:8765 . Serve the files over HTTP rather than double-clicking `index.html`, because the map loads GeoJSON with `fetch`.

## Features

- English / Traditional Chinese interface with remembered language preference.
- Official Lands Department aerial and street basemaps with place/street labels.
- Territory overview plus original zoning geometry at zoom level 12 and above.
- Search by area, plan number or latitude/longitude; click a zone for details.
- Fill-opacity, boundary and label controls.
- Google Maps and Street View links to the selected coordinates.
- Optional Google Maps integration using the visitor's own API key.
- Territory-wide and individual-plan KMZ downloads in both languages.

## Repository structure

```text
.github/workflows/pages.yml  Automatic website deployment
dist/                       Complete static website and data snapshot
  data/plans/               Original zoning geometry by plan
  data/overview.geojson      Simplified overview
  data/kmz/                 Traditional Chinese plan exports
  data/en/                  English KMZ exports
  vendor/                   Leaflet assets and license; LandsD logo
scripts/                    Public-data retrieval and packaging
requirements.txt            Data-packaging dependency
DEPLOY_GITHUB.md             Remote repository and deployment guide
```

## Data and accuracy

Planning data comes from the Town Planning Board's SPP3 public GIS service:

`https://www.ozp.tpb.gov.hk/arcgis2/rest/services/SPP3/`

The website uses the zoning layer `1000` and plan directory `1001` from `OZP_PLAN` and `DEV_PLAN`. Colours come from `OZP_PLAN/MapServer/1015`. Navigation bounds for OZP plans are derived from their zoning geometry, as the plan-directory service returns null geometry.

Source coordinates use Hong Kong 1980 Grid (EPSG:2326). The official service transforms them to WGS84 (EPSG:4326) using EPSG:1825. No manual shift or mainland-China coordinate offset is applied. The territory overview is simplified with a tolerance of 0.00008 degrees. Detail layers and KMZ exports preserve original vertices rounded to eight decimal places.

Numerical coordinate-conversion checks are not a ground-control assessment against Google imagery. Planning zones are not cadastral or land-lot boundaries. Separate amendment items, building-height controls and planning applications are not overlaid. Always consult the official plans and Notes for the latest planning position.

This is a **snapshot**, not an automatically updated planning-data feed. Retrieval time and counts are recorded in `dist/data/metadata.json`.

## Refresh the data snapshot

Publishing the existing website does not need Python packages. To retrieve and package a new snapshot, install the data dependency in your own Python environment:

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

The fetch script resumes from `data-cache/`. Start each new snapshot with an empty cache to avoid mixing dates. If a cache already exists, rename/archive it before fetching:

```sh
.venv/bin/python scripts/fetch-data.py
.venv/bin/python scripts/package-data.py
```

Review the new counts and map, then commit and push the changed `dist/` files. The Pages workflow deploys the checked-in files and does not download data during deployment.

## Google Maps

The default basemap is Lands Department imagery, not Google imagery. There is no built-in Google API key. Visitors may enter their own Maps JavaScript API key in the map settings. Restrict the key to the required API and website referrers, including your GitHub Pages origin if used there.

The key stays in page memory, is sent to the same-origin Google-map frame with `postMessage`, and is not stored in the repository, browser storage, frame URL or KMZ exports. The Google SDK request carries the key as required by Google. Each language uses its own SDK frame (`en` or `zh-HK`). Live Google imagery requires a valid key; language-reload behaviour has been checked with a local SDK stub rather than a live key.

## Attribution and terms

Planning data is owned by the Town Planning Board. Basemap, aerial imagery, labels and the Lands Department logo belong to the respective providers and remain subject to their terms. Attribution is shown on the map. This repository does not grant additional rights to government data or branding. Leaflet 1.9.4 is BSD-2-Clause licensed; see `dist/vendor/LEAFLET-LICENSE`.

- [Town Planning Board SPP3](https://www.ozp.tpb.gov.hk/)
- [Government planning dataset](https://data.gov.hk/en-data/dataset/tpd-tpb1-digital-planning-data-of-statutory-plans)
- [Lands Department imagery API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/ImageryMapAPI)
- [Lands Department label API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/MapLabelAPI)
- [Map API terms](https://portal.csdi.gov.hk/csdi-webpage/doc/TNC)
- [Hong Kong geodetic reference documents](https://www.geodetic.gov.hk/en/gi/refdoc.htm)
