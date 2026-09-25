#!/usr/bin/env node
// Pas l'temps — fabrique les « tuiles » de lieux à partir d'un export OpenStreetMap.
// Entrée : un fichier GeoJSON « seq » (une entité par ligne), produit par `osmium export`.
// Sortie : <dossier>/t/<ligne>_<colonne>.json (une tuile par case de CELL degrés) + <dossier>/index.json
// Usage : node scripts/build-places.js lieux.geojsonseq sortie/
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");

const CELL = 0.05; // ~5,5 km (nord-sud) × ~3,7 km (est-ouest) en France
// Étiquettes OSM utilisées par l'appli (voir MOODS dans public/js/app.js)
const SELS = [
  "shop=bakery","shop=pastry","amenity=cafe","amenity=fast_food","amenity=food_court","amenity=ice_cream","shop=ice_cream",
  "amenity=restaurant","leisure=park","leisure=garden","tourism=picnic_site","leisure=nature_reserve","tourism=viewpoint",
  "leisure=common","shop=mall","shop=department_store","amenity=marketplace","shop=farm","shop=gift","shop=souvenir",
  "shop=books","historic=monument","tourism=attraction","historic=castle","amenity=place_of_worship","amenity=library",
  "tourism=museum","tourism=gallery","leisure=track","leisure=fitness_centre","leisure=sports_centre",
  "amenity=bar","amenity=pub","amenity=biergarten"
];
const SEL_INDEX = new Map(SELS.map((s, i) => [s, i]));
const KEYS = [...new Set(SELS.map(s => s.split("=")[0]))];

// Centre approximatif d'une géométrie GeoJSON (moyenne des sommets de l'anneau extérieur)
function center(g){
  if(!g) return null;
  if(g.type === "Point") return g.coordinates;
  let ring = null;
  if(g.type === "Polygon") ring = g.coordinates[0];
  else if(g.type === "MultiPolygon") ring = g.coordinates.reduce((a, p) => (p[0].length > (a ? a.length : 0) ? p[0] : a), null);
  else if(g.type === "LineString") ring = g.coordinates;
  else if(g.type === "MultiLineString") ring = g.coordinates[0];
  if(!ring || !ring.length) return null;
  let x = 0, y = 0;
  for(const [lx, ly] of ring){ x += lx; y += ly; }
  return [x / ring.length, y / ring.length];
}
const clip = (s, n) => (s && String(s).length > n ? String(s).slice(0, n) : s || "");
function addr(t){
  const street = [t["addr:housenumber"], t["addr:street"] || t["addr:place"]].filter(Boolean).join(" ");
  const city = [t["addr:postcode"], t["addr:city"]].filter(Boolean).join(" ");
  return [street, city].filter(Boolean).join(", ");
}

async function build(input, outDir){
  const tiles = new Map();
  const postcodes = new Map();   // "75011|paris" → {pc, city, lat, lng, n}
  let n = 0, kept = 0, minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  const rl = readline.createInterface({input: fs.createReadStream(input), crlfDelay: Infinity});
  for await (let line of rl){
    line = line.replace(/^\x1e/, "").trim();   // geojsonseq : séparateur RS en début de ligne
    if(!line) continue;
    n++;
    let f; try{ f = JSON.parse(line); }catch(e){ continue; }
    const t = f.properties || {};
    if(!t.name || t.access === "private" || t.disused || t["disused:shop"] || t["disused:amenity"]) continue;
    const sels = [];
    for(const k of KEYS){ const i = SEL_INDEX.get(k + "=" + t[k]); if(i !== undefined) sels.push(i); }
    if(!sels.length) continue;
    const c = center(f.geometry);
    if(!c || !isFinite(c[0]) || !isFinite(c[1])) continue;
    const lng = +c[0].toFixed(5), lat = +c[1].toFixed(5);
    const id = (t["@type"] ? t["@type"][0] : "x") + (t["@id"] || f.id || "");
    const row = [lat, lng, sels.length === 1 ? sels[0] : sels, clip(t.name, 80), clip(addr(t), 100),
      clip(t.opening_hours, 160), clip(t.website || t["contact:website"] || t.url, 120),
      clip(t.phone || t["contact:phone"], 30), clip(t.cuisine, 40), t.wheelchair === "yes" ? 1 : 0, id];
    // Codes postaux : centre des lieux qui portent ce code (et cette commune)
    const pc = String(t["addr:postcode"] || "").trim();
    if(/^\d{5}$/.test(pc)){
      const city = String(t["addr:city"] || "").trim().slice(0, 60);
      const k = pc + "|" + city.toLowerCase();
      const e = postcodes.get(k) || {pc, city, lat: 0, lng: 0, n: 0};
      e.lat += lat; e.lng += lng; e.n++; postcodes.set(k, e);
    }
    const key = Math.floor(lat / CELL) + "_" + Math.floor(lng / CELL);
    if(!tiles.has(key)) tiles.set(key, []);
    tiles.get(key).push(row);
    kept++;
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat); minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
  }
  fs.mkdirSync(path.join(outDir, "t"), {recursive: true});
  let bytes = 0;
  for(const [key, rows] of tiles){
    const json = JSON.stringify(rows);
    bytes += json.length;
    fs.writeFileSync(path.join(outDir, "t", key + ".json"), json);
  }
  // postcodes.json : { "75011": [[lat, lng, "Paris", nombre de lieux], …], … } (communes triées par nombre de lieux)
  const byPc = {};
  for(const e of postcodes.values()){
    if(e.n < 2 && !e.city) continue;
    (byPc[e.pc] = byPc[e.pc] || []).push([+(e.lat / e.n).toFixed(5), +(e.lng / e.n).toFixed(5), e.city, e.n]);
  }
  for(const pc in byPc){
    // même commune écrite de façons différentes / sans commune : on regroupe sous la plus fréquente
    const list = byPc[pc].sort((a, b) => b[3] - a[3]);
    const named = list.filter(x => x[2]);
    byPc[pc] = (named.length ? named : list).slice(0, 6);
  }
  fs.writeFileSync(path.join(outDir, "postcodes.json"), JSON.stringify(byPc));
  const index = {v: 1, postcodes: Object.keys(byPc).length, built: new Date().toISOString(), cell: CELL, sels: SELS, count: kept, tiles: tiles.size,
    bbox: [+minLat.toFixed(3), +minLng.toFixed(3), +maxLat.toFixed(3), +maxLng.toFixed(3)],
    // colonnes de chaque lieu : [lat, lng, étiquette(s), nom, adresse, horaires, site, téléphone, cuisine, accessible, id]
    fields: ["lat","lng","sel","name","addr","oh","web","phone","cuisine","wc","id"]};
  fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify(index));
  return {read: n, kept, tiles: tiles.size, bytes};
}

if(require.main === module){
  const [input, outDir] = process.argv.slice(2);
  if(!input || !outDir){ console.error("Usage : node scripts/build-places.js lieux.geojsonseq sortie/"); process.exit(1); }
  build(input, outDir).then(r => console.log(`${r.read} entités lues, ${r.kept} lieux gardés, ${r.tiles} tuiles, ${(r.bytes / 1e6).toFixed(1)} Mo`))
    .catch(e => { console.error(e); process.exit(1); });
}

module.exports = { build, SELS, CELL, center };
