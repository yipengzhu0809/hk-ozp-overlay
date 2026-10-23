'use strict';
const $=id=>document.getElementById(id);
const EMPTY={type:'FeatureCollection',features:[]},HK=[[22.14,113.82],[22.575,114.45]];
let palette={},plans=[],overview=EMPTY,meta,active='leaflet',gmap,googleData,googleOverview;
let leafOverview,leafDetail,viewToken=0,selected=null,peek=false,mapReady=false,pointer=null,pickedSearch=null;
let detailFeatures=[],overviewFeatures=[],statusKey='initialStatus',statusValues={},statusRetry=false,googleMessageKey='';
let googleKey='',googleSDK,googleSDKLanguage='',googleSDKKey='',googleFrame,googleSequence=0,disposeGoogleFrame;
const cache=new Map(),inflight=new Map();
const leaf=L.map('leaflet-map',{zoomControl:false,preferCanvas:true,minZoom:9,maxZoom:20,maxBounds:[[21.9,113.5],[22.8,114.8]],maxBoundsViscosity:0.5});
L.control.zoom({position:'topright',zoomInTitle:t('zoomIn'),zoomOutTitle:t('zoomOut')}).addTo(leaf);
L.control.scale({position:'bottomleft',imperial:false}).addTo(leaf);leaf.fitBounds(HK);
const layers={
 imagery:L.tileLayer('https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/imagery/WGS84/{z}/{x}/{y}.png',{maxZoom:20,attribution:t('attributionImagery'),updateWhenIdle:true,keepBuffer:1}),
 street:L.tileLayer('https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/basemap/WGS84/{z}/{x}/{y}.png',{maxZoom:20,attribution:t('attributionStreet'),updateWhenIdle:true,keepBuffer:1})
};layers.imagery.addTo(leaf);
leaf.createPane('placeLabels');leaf.getPane('placeLabels').style.zIndex='450';leaf.getPane('placeLabels').style.pointerEvents='none';
function labelURL(){return `https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/label/hk/${languageCode()}/WGS84/{z}/{x}/{y}.png`}
const placeLabels=L.tileLayer(labelURL(),{pane:'placeLabels',maxZoom:20,updateWhenIdle:true,keepBuffer:1,attribution:t('attributionLabels')});
let labelErrors=0,tileErrors=0;
placeLabels.on('tileerror',()=>{if(++labelErrors>=3)$('labels-message').hidden=false});
placeLabels.on('load',()=>{if(labelErrors===0)$('labels-message').hidden=true});placeLabels.on('loading',()=>{labelErrors=0});placeLabels.addTo(leaf);
Object.values(layers).forEach(l=>l.on('tileerror',()=>{if(++tileErrors===3)status('baseFailed',{},true)}));
const renderer=L.canvas({padding:0.3});
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function color(group){return `rgb(${(palette[group]||[160,168,157]).join(',')})`}
function alpha(){return !$('zones-visible').checked||peek?0:Number($('opacity').value)/100}
function style(f){return {renderer,color:color(f.properties.group),weight:$('outlines').checked?0.8:0,opacity:alpha()>0?0.85:0,fillColor:color(f.properties.group),fillOpacity:alpha(),smoothFactor:0}}
function gstyle(f){return {fillColor:color(f.getProperty('group')),fillOpacity:alpha(),strokeColor:color(f.getProperty('group')),strokeOpacity:alpha()>0?0.9:0,strokeWeight:$('outlines').checked?0.8:0,clickable:alpha()>0}}
function status(key,values={},retry=false){statusKey=key;statusValues=values;statusRetry=retry;$('status').textContent=t(key,values);$('retry').hidden=!retry}
function googleMessage(key){googleMessageKey=key;$('google-message').textContent=key?t(key):''}
function viewport(){if(active==='google'&&gmap){const b=gmap.getBounds();if(!b)return null;return [b.getSouthWest().lng(),b.getSouthWest().lat(),b.getNorthEast().lng(),b.getNorthEast().lat()]}const b=leaf.getBounds();return [b.getWest(),b.getSouth(),b.getEast(),b.getNorth()]}
function zoom(){return active==='google'&&gmap?gmap.getZoom():leaf.getZoom()}
function center(){if(active==='google'&&gmap){const c=gmap.getCenter();return {lat:c.lat(),lng:c.lng()}}return leaf.getCenter()}
function go(lat,lng,z=15){if(active==='google'&&gmap){gmap.setCenter({lat,lng});gmap.setZoom(z)}else leaf.setView([lat,lng],z)}
function fit(b){if(active==='google'&&gmap)gmap.fitBounds({west:b[0],south:b[1],east:b[2],north:b[3]});else leaf.fitBounds([[b[1],b[0]],[b[3],b[2]]],{padding:[30,30],maxZoom:16})}
function intersects(a,b){return a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1]}
function coord(p){pointer=p;$('coordinate').textContent=p?`${p.lat.toFixed(6)}, ${p.lng.toFixed(6)} · WGS84`:t('coordinateHint')}
async function json(url){const r=await fetch(url);if(!r.ok)throw Error(`${url}: ${r.status}`);return r.json()}
function loadPlan(p){if(cache.has(p.file))return Promise.resolve(cache.get(p.file));if(inflight.has(p.file))return inflight.get(p.file);const promise=json(`data/plans/${p.file}.geojson`).then(d=>{cache.set(p.file,d);inflight.delete(p.file);return d}).catch(e=>{inflight.delete(p.file);throw e});inflight.set(p.file,promise);return promise}
function leafLayer(data){return L.geoJSON(data,{style,onEachFeature:(f,l)=>l.on('click',e=>{L.DomEvent.stopPropagation(e);select(f.properties,e.latlng)})})}
function setGoogleData(layer,features){layer.forEach(f=>layer.remove(f));layer.addGeoJson({type:'FeatureCollection',features});layer.setStyle(gstyle)}
function paint(){if(active==='google'&&googleData){setGoogleData(googleOverview,overviewFeatures);setGoogleData(googleData,detailFeatures)}else{if(leafOverview)leaf.removeLayer(leafOverview);if(leafDetail)leaf.removeLayer(leafDetail);leafOverview=leafLayer({type:'FeatureCollection',features:overviewFeatures}).addTo(leaf);leafDetail=leafLayer({type:'FeatureCollection',features:detailFeatures}).addTo(leaf)}}
function restyle(){if(leafOverview)leafOverview.setStyle(style);if(leafDetail)leafDetail.setStyle(style);if(googleData)googleData.setStyle(gstyle);if(googleOverview)googleOverview.setStyle(gstyle)}
async function update(){
 if(!mapReady)return;const token=++viewToken,b=viewport();if(!b)return;
 if(zoom()<12){overviewFeatures=overview.features;detailFeatures=[];paint();status('overview');return}
 const wanted=plans.filter(f=>intersects(f.properties.bbox,b));
 const refresh=()=>{if(token!==viewToken)return;const done=new Set(wanted.filter(f=>cache.has(f.properties.file)).map(f=>f.properties.plan));overviewFeatures=overview.features.filter(f=>!done.has(f.properties.plan));detailFeatures=wanted.flatMap(f=>cache.get(f.properties.file)?.features||[]);paint()};refresh();
 status('loadingDetail',{loaded:wanted.filter(f=>cache.has(f.properties.file)).length,total:wanted.length});
 let next=0,failed=0;await Promise.all(Array.from({length:Math.min(4,wanted.length)},async()=>{while(next<wanted.length){const p=wanted[next++].properties;try{await loadPlan(p)}catch(e){failed++;console.error(e)}}}));
 if(token!==viewToken)return;refresh();if(failed)status('detailFailed',{n:failed},true);else if(wanted.length)status('detailReady',{plans:number(wanted.length),zones:number(detailFeatures.length)});else status('noCoverage');
}
let updateTimer;function schedule(){clearTimeout(updateTimer);updateTimer=setTimeout(update,180)}
leaf.on('moveend',schedule).on('mousemove',e=>coord(e.latlng)).on('click',e=>coord(e.latlng));
function planName(p){return p?(language==='en'?p.name_en:p.name):'—'}
function select(p,point){selected={properties:p,point};coord(point);renderSelection()}
function renderSelection(){
 if(!selected)return;const p=selected.properties,point=selected.point,plan=plans.find(f=>f.properties.plan===p.plan)?.properties;
 const use=language==='en'?p.use_en:p.use;const hl=googleLanguage(),urlLang=languageCode();
 $('selection-body').className='';
 $('selection-body').innerHTML=`<div class="selection-head"><span class="zone-swatch" style="background:${color(p.group)}"></span><span class="zone-label">${esc(p.zone)}</span><span class="zone-title">${esc(zoneName(p.group))}</span></div><div class="selection-row"><span>${t('area')}</span><span>${esc(planName(plan))}</span></div><div class="selection-row"><span>${t('plan')}</span><strong>${esc(p.plan)}</strong></div>${use?`<div class="selection-row"><span>${t('specificUse')}</span><span>${esc(use)}</span></div>`:''}<div class="selection-buttons"><a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}&hl=${hl}">${t('googleMaps')}</a><a target="_blank" rel="noopener" href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${point.lat},${point.lng}&hl=${hl}">${t('googleStreet')}</a><a download href="${downloadPath(`kmz/${esc(plan?.file||p.plan.replaceAll('/','_'))}.kmz`)}">${t('downloadPlan')}</a><a target="_blank" rel="noopener" href="https://www.ozp.tpb.gov.hk/?lang=${urlLang}">${t('officialInfo')}</a></div><div class="selected-coord">${t('clickedCoordinate',{lat:point.lat.toFixed(6),lng:point.lng.toFixed(6)})}<br>${t(zoom()<12?'overviewHint':'detailHint')}</div>`;
}
function normalize(s){return s.toLowerCase().replaceAll('启','啟').replaceAll('啓','啟').replaceAll('湾','灣').replaceAll('龙','龍').replaceAll('观','觀').replaceAll('乡','鄉').replaceAll('长','長').replaceAll('东','東').replaceAll('门','門').replaceAll('围','圍').replaceAll('岭','嶺').replace(/\s/g,'')}
function search(navigateCoordinates=true){
 const q=$('search').value.trim();$('results').replaceChildren();if(!q)return;
 const coordinates=q.match(/^\s*(\d+(?:\.\d+)?)\s*[,， ]\s*(\d+(?:\.\d+)?)\s*$/);
 if(coordinates){const lat=+coordinates[1],lng=+coordinates[2];if(lat>=22&&lat<=22.7&&lng>=113.7&&lng<=114.6){if(navigateCoordinates)go(lat,lng,17);$('results').innerHTML=`<div class="no-result">${t('coordinateLocated')}</div>`;return}}
 const found=plans.filter(f=>normalize([f.properties.name,f.properties.name_en,f.properties.plan].join(' ')).includes(normalize(q))).slice(0,12);
 if(!found.length){$('results').innerHTML=`<div class="no-result">${t('noResults')}</div>`;return}
 found.forEach(f=>{const b=document.createElement('button');b.type='button';b.setAttribute('role','listitem');b.innerHTML=`${esc(planName(f.properties))}<small>${esc(f.properties.plan)}</small>`;b.onclick=()=>{fit(f.properties.bbox);$('results').replaceChildren();pickedSearch=f.properties;$('search').value=planName(pickedSearch);if(innerWidth<=760)collapse(true)};$('results').append(b)});
}
function collapse(force){document.body.classList.toggle('collapsed',force??!document.body.classList.contains('collapsed'));setTimeout(()=>leaf.invalidateSize(),80)}
function syncLabels(){const visible=$('labels-visible').checked;if(active==='google'){if(leaf.hasLayer(placeLabels))leaf.removeLayer(placeLabels);if(gmap)gmap.setMapTypeId(visible?'hybrid':'satellite')}else if(visible){if(!leaf.hasLayer(placeLabels))placeLabels.addTo(leaf)}else if(leaf.hasLayer(placeLabels))leaf.removeLayer(placeLabels);if(!visible||active==='google')$('labels-message').hidden=true}
function peeking(on){peek=on;$('peek').classList.toggle('pressed',on);restyle()}
function mapTitle(){$('map-title-text').textContent=t(active==='google'?'mapGoogle':leaf.hasLayer(layers.imagery)?'mapImagery':'mapStreet')}
function useLeaflet(type){const c=center(),z=zoom();active='leaflet';$('google-map').hidden=true;$('leaflet-map').hidden=false;$('lands-attribution').hidden=false;$('basemap').value=type;Object.values(layers).forEach(l=>leaf.removeLayer(l));layers[type].addTo(leaf);syncLabels();mapTitle();leaf.invalidateSize();leaf.setView(c,z,{animate:false,reset:true});update()}
function useGoogle(c=center(),z=zoom()){active='google';$('leaflet-map').hidden=true;$('google-map').hidden=false;$('lands-attribution').hidden=true;gmap.setCenter(c);gmap.setZoom(z);syncLabels();$('basemap').value='google';mapTitle();update()}

// Google configures its language when loading the SDK. A separate document for
// each locale avoids loading two SDK languages into the same global namespace.
function googleApi(key){
 if(googleSDK&&googleSDKLanguage===language&&googleSDKKey===key)return Promise.resolve(googleSDK);
 if(disposeGoogleFrame)disposeGoogleFrame();
 googleSDK=undefined;googleSDKLanguage='';googleSDKKey='';
 const requestedLanguage=language;const frame=document.createElement('iframe');frame.className='google-frame';frame.title=t('googleFrame');frame.allowFullscreen=true;frame.src='google-map.html?lang='+encodeURIComponent(requestedLanguage);googleFrame=frame;
 return new Promise((resolve,reject)=>{
  let settled=false;const timer=setTimeout(()=>fail('googleTimeout'),25000);
  function fail(key){clearTimeout(timer);if(!settled){settled=true;reject(Error(key))}else if(key==='googleAuth'){googleMessage(key);if(active==='google')useLeaflet('imagery');$('about').showModal()}}
  function receive(event){if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
   if(event.data?.type==='google-api-ready'){clearTimeout(timer);settled=true;googleSDK=frame.contentWindow.google;googleSDKLanguage=requestedLanguage;googleSDKKey=key;resolve(googleSDK)}
   else if(event.data?.type==='google-auth-error')fail('googleAuth');else if(event.data?.type==='google-network-error')fail('googleNetwork');
  }
  addEventListener('message',receive);disposeGoogleFrame=()=>{clearTimeout(timer);removeEventListener('message',receive);if(!settled){settled=true;reject(Error('googleCancelled'))}};
  frame.onload=()=>frame.contentWindow.postMessage({type:'load-google',key,language:requestedLanguage==='en'?'en':'zh-HK'},location.origin);
  $('google-map').replaceChildren(frame);
 });
}
async function connectGoogle(key,closeDialog=false){
 const operation=++googleSequence,locationNow=center(),zoomNow=zoom();googleKey=key;
 // Keep a usable map while the new locale loads.
 if(active==='google')useLeaflet('imagery');
 $('connect-google').disabled=true;googleMessage('connecting');
 try{const api=await googleApi(key);if(operation!==googleSequence)return;
  const mapElement=googleFrame.contentDocument.getElementById('map');$('google-map').hidden=false;
  gmap=new api.maps.Map(mapElement,{center:{lat:locationNow.lat,lng:locationNow.lng},zoom:zoomNow,mapTypeId:$('labels-visible').checked?'hybrid':'satellite',tilt:0,streetViewControl:true,mapTypeControl:true,fullscreenControl:true,minZoom:9,maxZoom:20,restriction:{latLngBounds:{north:22.8,south:21.9,west:113.5,east:114.8},strictBounds:false}});
  googleData=new api.maps.Data({map:gmap});googleOverview=new api.maps.Data({map:gmap});
  [googleData,googleOverview].forEach(layer=>layer.addListener('click',e=>{const p={};e.feature.forEachProperty((v,k)=>p[k]=v);select(p,{lat:e.latLng.lat(),lng:e.latLng.lng()})}));
  gmap.addListener('idle',schedule);gmap.addListener('mousemove',e=>coord({lat:e.latLng.lat(),lng:e.latLng.lng()}));
  useGoogle(locationNow,zoomNow);$('google-key').value='';googleMessage('connected');if(closeDialog)$('about').close();
 }catch(e){if(operation===googleSequence&&e.message!=='googleCancelled'){googleMessage(e.message in translations.en?e.message:'googleNetwork');$('google-map').hidden=true;$('about').showModal()}}
 finally{if(operation===googleSequence)$('connect-google').disabled=false}
}
function renderLanguage(){
 document.documentElement.lang=language;document.title=t('title')+' · OZP Overlay';document.querySelector('meta[name=description]').content=t('description');
 document.querySelectorAll('[data-i18n]').forEach(e=>e.textContent=t(e.dataset.i18n));
 for(const [attribute,dataKey] of [['aria-label','i18nAria'],['placeholder','i18nPlaceholder'],['alt','i18nAlt']])document.querySelectorAll(`[data-${dataKey.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}]`).forEach(e=>e.setAttribute(attribute,t(e.dataset[dataKey])));
 $('language').value=language;$('language').setAttribute('aria-label',t('language'));
 $('download-all').href=downloadPath('hong-kong-planning.kmz');$('source-map').href='https://www.ozp.tpb.gov.hk/?lang='+languageCode();$('source-data').href=`https://data.gov.hk/${language==='en'?'en':'tc'}-data/dataset/tpd-tpb1-digital-planning-data-of-statutory-plans`;
 for(const [layer,key] of [[layers.imagery,'attributionImagery'],[layers.street,'attributionStreet'],[placeLabels,'attributionLabels']]){if(leaf.hasLayer(layer))leaf.attributionControl.removeAttribution(layer.options.attribution);layer.options.attribution=t(key);if(leaf.hasLayer(layer))leaf.attributionControl.addAttribution(layer.options.attribution)}
 for(const [selector,key] of [['.leaflet-control-zoom-in','zoomIn'],['.leaflet-control-zoom-out','zoomOut']]){const e=document.querySelector(selector);e.title=t(key);e.setAttribute('aria-label',t(key))}
 labelErrors=0;$('labels-message').hidden=true;if(placeLabels._url!==labelURL())placeLabels.setUrl(labelURL());
 if(meta){const date=meta.retrieved_at.slice(0,10);$('coverage').textContent=t('coverage',{n:number(meta.plan_count)});$('snapshot').textContent=t('snapshot',{date,n:number(meta.zone_count)});$('data-summary').textContent=t('dataSummary',{date,plans:number(meta.plan_count),zones:number(meta.zone_count)})}
 const order=['R(A)','R(B)','R(C)','C','CDA','G/IC','O','OU','GB','V','AGR','I','CA','CPA','SSSI','REC'];$('legend').innerHTML=order.filter(g=>palette[g]).map(g=>`<div class="legend-row"><span class="zone-swatch" style="background:${color(g)}"></span><span><b>${esc(g)}</b> ${esc(zoneName(g))}</span></div>`).join('');
 mapTitle();coord(pointer);renderSelection();status(statusKey,statusValues,statusRetry);googleMessage(googleMessageKey);if(googleFrame)googleFrame.title=t('googleFrame');
}
function changeLanguage(next){
 if(next!=='en'&&next!=='zh-Hant'||next===language)return;
 const wasGoogle=active==='google',wasConnecting=$('connect-google').disabled;
 if(pickedSearch&&$('search').value===planName(pickedSearch)){$('search').value=next==='en'?pickedSearch.name_en:pickedSearch.name}
 language=next;try{localStorage.setItem('hk-planning-language',language)}catch{}
 renderLanguage();if($('results').childElementCount)search(false);
 if((wasGoogle||wasConnecting)&&googleKey)connectGoogle(googleKey);else update();
}
$('language').onchange=()=>changeLanguage($('language').value);
$('collapse').onclick=()=>collapse();if(innerWidth<=760)collapse(true);
$('search').addEventListener('input',()=>{pickedSearch=null;search()});$('search').addEventListener('keydown',e=>{if(e.key==='Enter')search()});$('search-go').onclick=()=>search();
 document.querySelectorAll('[data-place]').forEach(b=>b.onclick=()=>{go(...b.dataset.place.split(',').map(Number));if(innerWidth<=760)collapse(true)});
$('home').onclick=()=>fit([HK[0][1],HK[0][0],HK[1][1],HK[1][0]]);
$('opacity').oninput=()=>{$('opacity-value').textContent=$('opacity').value+'%';restyle()};$('zones-visible').onchange=restyle;$('outlines').onchange=restyle;$('labels-visible').onchange=syncLabels;
$('peek').onpointerdown=e=>{e.preventDefault();peeking(true)};window.addEventListener('pointerup',()=>peeking(false));window.addEventListener('pointercancel',()=>peeking(false));window.addEventListener('blur',()=>peeking(false));$('peek').onkeydown=e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();peeking(true)}};$('peek').onkeyup=()=>peeking(false);
$('retry').onclick=()=>{tileErrors=0;Object.values(layers).forEach(l=>l.redraw());if(mapReady)update();else init()};$('retry-labels').onclick=()=>{labelErrors=0;$('labels-message').hidden=true;placeLabels.redraw()};
$('about-button').onclick=()=>$('about').showModal();$('close-about').onclick=()=>$('about').close();$('about').addEventListener('click',e=>{if(e.target===$('about')){const r=$('about').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('about').close()}});
$('basemap').onchange=()=>{if($('basemap').value==='google'){if(gmap&&googleSDKLanguage===language)useGoogle();else if(googleKey)connectGoogle(googleKey);else{$('basemap').value=leaf.hasLayer(layers.imagery)?'imagery':'street';$('about').showModal();$('google-key').focus()}}else{++googleSequence;$('connect-google').disabled=false;useLeaflet($('basemap').value)}};
$('connect-google').onclick=()=>{const key=$('google-key').value.trim();if(!key){googleMessage('missingKey');return}connectGoogle(key,true)};
async function init(){try{[palette,meta]=await Promise.all([json('data/palette.json'),json('data/metadata.json')]);plans=(await json('data/plans.geojson')).features;renderLanguage();overview=await json('data/overview.geojson');mapReady=true;await update()}catch(e){console.error(e);status('dataFailed',{},true)}}
renderLanguage();init();
