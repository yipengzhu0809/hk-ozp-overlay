"""Make browser layers and Google Earth KMZ files from unsimplified source data."""
import collections
import datetime
import html
import json
import pathlib
import zipfile
from shapely.geometry import shape, mapping

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = ROOT / 'data-cache'
OUT = ROOT / 'dist' / 'data'
OUT.mkdir(exist_ok=True)
(OUT / 'plans').mkdir(exist_ok=True)
(OUT / 'kmz').mkdir(exist_ok=True)
(OUT / 'en' / 'kmz').mkdir(parents=True, exist_ok=True)

def write(path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')))

def fc(features):
    return dict(type='FeatureCollection', features=features)

def rounded(obj):
    if isinstance(obj, float): return round(obj, 8)
    if isinstance(obj, list) or isinstance(obj, tuple): return [rounded(v) for v in obj]
    if isinstance(obj, dict): return {k: rounded(v) for k, v in obj.items()}
    return obj

def slug(plan): return plan.replace('/', '_')
def esc(s): return html.escape(str(s or ''))
def style_id(group): return 'zone-' + str(group).encode().hex()

def polygon_kml(rings):
    result = '<Polygon><tessellate>1</tessellate><altitudeMode>clampToGround</altitudeMode>'
    for i, ring in enumerate(rings):
        tag = 'outerBoundaryIs' if i == 0 else 'innerBoundaryIs'
        coords = ' '.join(f'{p[0]:.8f},{p[1]:.8f},0' for p in ring)
        result += f'<{tag}><LinearRing><coordinates>{coords}</coordinates></LinearRing></{tag}>'
    return result + '</Polygon>'

def placemark(f, language='zh-Hant'):
    p, g = f['properties'], f['geometry']
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    geometry = ''.join(polygon_kml(r) for r in polys)
    if len(polys) > 1: geometry = '<MultiGeometry>' + geometry + '</MultiGeometry>'
    fields = {'Plan': p['plan'], 'Zone': p['zone'], 'Zone group': p['group'],
              'Specified use': p.get('use_en')} if language == 'en' else {
              '圖則': p['plan'], '用途分區': p['zone'], '用途類別': p['group'], '指定用途': p.get('use')}
    extended = ''.join(f'<Data name="{esc(k)}"><value>{esc(v)}</value></Data>' for k, v in fields.items())
    return f'<Placemark><name>{esc(p["zone"])}</name><styleUrl>#{style_id(p["group"])}</styleUrl><ExtendedData>{extended}</ExtendedData>{geometry}</Placemark>'

def kmz(path, groups, palette, names, language='zh-Hant'):
    title = 'Hong Kong Statutory Planning Zones' if language == 'en' else '香港法定規劃用途分區'
    description = ('Source: Hong Kong Town Planning Board SPP3. WGS84, datum transformation EPSG:1825. Planning zones are not land lot boundaries. Snapshot; consult SPP3 for current plans.' if language == 'en' else '資料來源：香港城市規劃委員會 SPP3。WGS84，座標轉換 EPSG:1825。用途分區不等同於地段邊界。本檔案為資料快照，最新圖則請參閱 SPP3。')
    xml = f'<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>{title}</name><description>{description}</description>'
    xml += '<LookAt><longitude>114.12</longitude><latitude>22.39</latitude><range>85000</range><tilt>0</tilt></LookAt>'
    for k, color in palette.items():
        r, g, b = color
        xml += f'<Style id="{style_id(k)}"><LineStyle><color>cc{b:02x}{g:02x}{r:02x}</color><width>1</width></LineStyle><PolyStyle><color>66{b:02x}{g:02x}{r:02x}</color><fill>1</fill><outline>1</outline></PolyStyle></Style>'
    for plan, fs in groups.items():
        xml += f'<Folder><name>{esc(plan)} · {esc(names.get(plan,""))}</name>'
        xml += ''.join(placemark(f, language) for f in fs) + '</Folder>'
    xml += '</Document></kml>'
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED, compresslevel=7) as z:
        z.writestr('doc.kml', xml)

def main():
    renderer = json.loads((CACHE / 'palette-source.json').read_text())['drawingInfo']['renderer']
    palette = {s['value']: s['symbol']['color'][:3] for s in renderer['uniqueValueInfos']}
    groups = collections.defaultdict(list)
    plans = []
    overview = []
    names = {}
    english_names = {}
    for service in ['OZP_PLAN', 'DEV_PLAN']:
        zones = json.loads((CACHE / f'{service}-1000-all.geojson').read_text())['features']
        bounds = {}
        for zone in zones:
            p = zone['properties']
            plan = p.get('OZP_PLAN_NO') or p.get('DEV_PLAN_NO')
            b = shape(zone['geometry']).bounds
            old = bounds.get(plan, b)
            bounds[plan] = [min(old[0], b[0]), min(old[1], b[1]), max(old[2], b[2]), max(old[3], b[3])]
        for f in json.loads((CACHE / f'{service}-1001-all.geojson').read_text())['features']:
            p = f['properties']
            plan = p.get('OZP_PLAN_NO') or p.get('DEV_PLAN_NO')
            names[plan] = p['NAME_CHT']
            english_names[plan] = p['NAME_ENG']
            # OZP 1001 is a metadata layer: the service returns null geometry.
            # Navigation bounds are derived from its original zoning geometry.
            plan_bounds = list(shape(f['geometry']).bounds) if f['geometry'] else bounds.get(plan)
            assert plan_bounds, ('Missing navigation bounds', plan)
            plans.append(dict(type='Feature', geometry=None,
                properties=dict(plan=plan, name=p['NAME_CHT'], name_en=p['NAME_ENG'],
                    kind=service, file=slug(plan), bbox=plan_bounds,
                    gazette=p.get('GAZ_DATE'), notes=p.get('NOTES_TC_PATH'))))
        for f in zones:
            p = f['properties']
            plan = p.get('OZP_PLAN_NO') or p.get('DEV_PLAN_NO')
            props = dict(id=f'{service}-{p["OBJECTID"]}', plan=plan, zone=p['ZONE_LABEL'],
                group=p['ZONE_LABEL_GRP'], use=p.get('ZONE_SPUSE_CHT'), use_en=p.get('ZONE_SPUSE_ENG'), kind=service)
            groups[plan].append(dict(type='Feature', properties=props, geometry=rounded(f['geometry'])))
            geom = shape(f['geometry'])
            overview.append(dict(type='Feature', properties=props,
                geometry=rounded(mapping(geom.simplify(0.00008, preserve_topology=True)))))
    assert set(groups) <= set(names), set(groups) - set(names)
    for plan, features in groups.items():
        write(OUT / 'plans' / (slug(plan) + '.geojson'), fc(features))
        kmz(OUT / 'kmz' / (slug(plan) + '.kmz'), {plan: features}, palette, names)
        kmz(OUT / 'en' / 'kmz' / (slug(plan) + '.kmz'), {plan: features}, palette, english_names, 'en')
    for f in plans: f['properties']['zone_count'] = len(groups[f['properties']['plan']])
    write(OUT / 'plans.geojson', fc(plans))
    write(OUT / 'overview.geojson', fc(overview))
    write(OUT / 'palette.json', palette)
    meta = json.loads((CACHE / 'retrieval.json').read_text())
    meta.update(plan_count=len(plans), zone_count=sum(map(len, groups.values())),
        overview_tolerance_degrees=0.00008,
        detail='Original geometry from SPP3; coordinates rounded to 8 decimal places. No manual offsets.')
    write(OUT / 'metadata.json', meta)
    kmz(OUT / 'hong-kong-planning.kmz', groups, palette, names)
    kmz(OUT / 'en' / 'hong-kong-planning.kmz', groups, palette, english_names, 'en')
    print(json.dumps(meta, indent=2))
    print('KMZ bytes', (OUT / 'hong-kong-planning.kmz').stat().st_size)

if __name__ == '__main__': main()
