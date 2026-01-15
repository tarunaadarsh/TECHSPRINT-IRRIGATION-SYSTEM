mapboxgl.accessToken =
'pk.eyJ1IjoibWFoYXRoaTYiLCJhIjoiY21qd2Z2dDNuMHcwNTNjczR1amk2NTM3MyJ9.vNFp1qTBQIV5aR5wXqf8yQ';

const map = new mapboxgl.Map({
 container:'map',
 style:'mapbox://styles/mapbox/dark-v10',
 center:[78.9629,22.5937],
 zoom:4
});

map.addControl(new mapboxgl.NavigationControl());

map.fitBounds([[67,6],[98,37]],{padding:20});

// INDIA STATES GEOJSON
const INDIA_GEOJSON =
"https://raw.githubusercontent.com/geohacker/india/master/state/india_telengana.geojson";

// Crop Categories
const HIGH = [
 "Punjab","Haryana","Uttar Pradesh",
 "West Bengal","Tamil Nadu","Kerala",
 "Andhra Pradesh","Bihar"
];

const LESS = [
 "Maharashtra","Karnataka","Gujarat",
 "Telangana","Odisha","Madhya Pradesh"
];

const LOW = [
 "Rajasthan","Chhattisgarh","Jharkhand",
 "Meghalaya","Nagaland","Ladakh"
];

map.on("load",()=>{

 map.addSource("states",{
  type:"geojson",
  data:INDIA_GEOJSON
 });

 map.addLayer({
  id:"india-crops",
  type:"fill",
  source:"states",
  paint:{
   "fill-color":"#00ff6a",
   "fill-opacity":0.0,
   "fill-outline-color":"#00ff6a"
  }
 });

 setMode("high");
});

function setMode(mode){

 let color = "#00ff6a";
 let list = HIGH;

 if(mode==="less"){
  color = "#7CFC00";
  list = LESS;
 }

 if(mode==="no"){
  color = "#9AFFC4";
  list = LOW;
 }

 map.setPaintProperty("india-crops","fill-color",color);

 map.setFilter("india-crops",[
  "in",["get","NAME_1"],["literal",list]
 ]);

 map.setPaintProperty("india-crops","fill-opacity",0.75);
}
