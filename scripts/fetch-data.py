"""Fetch the same public GIS layers used by SPP3, with explicit datum conversion."""
import concurrent.futures
import datetime
import hashlib
import json
import pathlib
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = ROOT / 'data-cache'
CACHE.mkdir(exist_ok=True)
BASE = 'https://www.ozp.tpb.gov.hk/arcgis2/rest/services/SPP3/'

def fetch(name, service, layer, params):
    path = CACHE / (name + '.json')
    if path.exists():
        return json.loads(path.read_text())
    url = BASE + service + '/MapServer/' + str(layer) + '/query?' + urllib.parse.urlencode(params)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=150) as response:
                data = json.load(response)
            if 'error' in data:
                raise RuntimeError(data['error'])
            path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
            print(name, len(data.get('features', [])), flush=True)
            return data
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 * (attempt + 1))

def main():
    renderer_path = CACHE / 'palette-source.json'
    if not renderer_path.exists():
        with urllib.request.urlopen(BASE + 'OZP_PLAN/MapServer/1015?f=json', timeout=60) as response:
            renderer_path.write_bytes(response.read())
    counts = {}
    for service in ['OZP_PLAN', 'DEV_PLAN']:
        counts[service] = fetch(service + '-count', service, 1000,
                                dict(where='1=1', returnCountOnly='true', f='json'))['count']
        for layer in [1000, 1001]:
            n = counts[service] if layer == 1000 else 200
            fields = '*' if layer == 1001 else ','.join(
                ['OBJECTID', 'OZP_PLAN_NO' if service == 'OZP_PLAN' else 'DEV_PLAN_NO',
                 'ZONE_LABEL', 'ZONE_LABEL_GRP', 'ZONE_SPUSE_CHT', 'ZONE_SPUSE_ENG'])
            tasks = []
            for offset in range(0, n, 400):
                tasks.append((f'{service}-{layer}-{offset}', service, layer,
                    dict(where='1=1', outFields=fields, returnGeometry='true', outSR=4326,
                         datumTransformation=1825, f='geojson', orderByFields='OBJECTID ASC',
                         resultOffset=offset, resultRecordCount=400)))
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
                parts = list(pool.map(lambda args: fetch(*args), tasks))
            features = [f for part in parts for f in part['features']]
            if layer == 1000:
                assert len(features) == counts[service], (service, len(features), counts[service])
                assert len({f['properties']['OBJECTID'] for f in features}) == len(features)
            (CACHE / f'{service}-{layer}-all.geojson').write_text(json.dumps(
                dict(type='FeatureCollection', features=features), ensure_ascii=False, separators=(',', ':')))
            print('COMPLETE', service, layer, len(features), flush=True)
    (CACHE / 'retrieval.json').write_text(json.dumps(dict(
        retrieved_at=datetime.datetime.now(datetime.timezone.utc).isoformat(), counts=counts,
        source=BASE, source_crs='EPSG:2326', output_crs='EPSG:4326', datum_transformation=1825)))

if __name__ == '__main__':
    main()
