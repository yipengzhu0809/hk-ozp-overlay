'use strict';
// Video files are loaded only when the visitor plays an open popup.
const videoSites=[
 {lat:22.3387439,lng:114.2692495,depth:'6',id:'01'},
 {lat:22.3385936,lng:114.2694086,depth:'7',id:'02'},
 {lat:22.3393337,lng:114.2686456,depth:'6.5',id:'03'}
];
function videoPopup(site,doc=document){
 const box=doc.createElement('div');box.className='video-popup';
 const zh=language==='zh-Hant';
 const heading=doc.createElement('h3');heading.textContent=zh?'水下影片':'Underwater video';
 const info=doc.createElement('p');info.textContent=(zh?'水深：':'Depth: ')+site.depth+' m';
 const video=doc.createElement('video');video.controls=true;video.preload='none';video.playsInline=true;
 video.poster=new URL(`videos/site-${site.id}.jpg`,document.baseURI).href;
 video.src=new URL(`videos/site-${site.id}.mp4`,document.baseURI).href;
 const coords=doc.createElement('small');coords.textContent=`${site.lat.toFixed(7)}, ${site.lng.toFixed(7)} · WGS84`;
 box.append(heading,info,video,coords);return box;
}
const videoIcon=L.divIcon({className:'video-marker',html:'<div class="video-pin"><span>▶</span></div>',iconSize:[34,38],iconAnchor:[15,30],popupAnchor:[0,-29]});
const videoMarkers=videoSites.map(site=>L.marker([site.lat,site.lng],{icon:videoIcon,title:`Underwater video · ${site.depth} m`,keyboard:true}).bindPopup(()=>videoPopup(site),{maxWidth:310}).addTo(leaf));
window.addGoogleVideoSites=(api,map)=>{
 const frameDoc=googleFrame.contentDocument;
 const css=frameDoc.createElement('style');css.textContent='.video-popup{width:270px;max-width:65vw;color:#173448;font:14px/1.4 system-ui,sans-serif}.video-popup h3{margin:0 0 3px;font-size:16px}.video-popup p{margin:2px 0 8px}.video-popup video{display:block;width:100%;aspect-ratio:16/9;background:#0a2029;border-radius:6px;object-fit:contain}.video-popup small{display:block;margin-top:5px;color:#516675}';frameDoc.head.append(css);
 const info=new api.maps.InfoWindow();
 videoSites.forEach(site=>{
  const marker=new api.maps.Marker({position:{lat:site.lat,lng:site.lng},map,title:`Underwater video · ${site.depth} m`});
  marker.addListener('click',()=>{info.setContent(videoPopup(site,frameDoc));info.open({map,anchor:marker})});
 });
};
function updateVideoLabels(){const zh=language==='zh-Hant';$('video-sites-title').textContent=zh?'水下影片':'Underwater videos';$('video-sites-description').textContent=zh?'探索香港科技大學碼頭附近的水下影片。':'Explore video sites near HKUST Pier.';$('video-sites-go').textContent=zh?'查看影片位置 ↗':'Show video locations ↗'}
$('video-sites-go').addEventListener('click',()=>{go(22.33906,114.26930,17);if(innerWidth<=760)collapse(true)});
$('language').addEventListener('change',updateVideoLabels);updateVideoLabels();
