#!/usr/bin/env node
// Fissa Fissa — fabrique les « tuiles » de lieux à partir d'un export OpenStreetMap.
// Entrée : un ou plusieurs fichiers GeoJSON « seq » (une entité par ligne, éventuellement .gz), produits par
// `osmium export`, chacun avec le code de son pays (les codes postaux en ont besoin : 75011 existe en France et ailleurs).
// Sortie : <dossier>/t/<ligne>_<colonne>.json (une tuile par case de CELL degrés), <dossier>/index.json,
//          <dossier>/pc/<2 premiers chiffres>.json (codes postaux à 5 chiffres) et postcodes.json (France, anciennes versions)
// Usage : node scripts/build-places.js sortie/ fr:france.geojsonseq.gz de:germany.geojsonseq.gz …
//    (ou, comme avant : node scripts/build-places.js lieux.geojsonseq sortie/)
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const zlib = require("node:zlib");

const CELL = 0.05; // ~5,5 km (nord-sud) × ~3,7 km (est-ouest) en France
// Étiquettes OSM utilisées par l'appli (voir MOODS dans public/js/app.js)
const SELS = [
  "shop=bakery","shop=pastry","amenity=cafe","amenity=fast_food","amenity=food_court","amenity=ice_cream","shop=ice_cream",
  "amenity=restaurant","leisure=park","leisure=garden","tourism=picnic_site","leisure=nature_reserve","tourism=viewpoint",
  "leisure=common","shop=mall","shop=department_store","amenity=marketplace","shop=farm","shop=gift","shop=souvenir",
  "shop=books","historic=monument","tourism=attraction","historic=castle","amenity=place_of_worship","amenity=library",
  "tourism=museum","tourism=gallery","leisure=track","leisure=fitness_centre","leisure=sports_centre",
  "amenity=bar","amenity=pub","amenity=biergarten",
  "shop=supermarket","shop=convenience","shop=greengrocer","shop=organic","shop=butcher","shop=cheese","shop=seafood","shop=deli","shop=wine","shop=alcohol","shop=frozen_food"
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

// inputs : chemin, ou liste de {path, cc}
async function build(inputs, outDir){
  if(!Array.isArray(inputs)) inputs = [{path: inputs, cc: "fr"}];
  const tiles = new Map();
  const postcodes = new Map();   // "75011|fr|paris" → {pc, cc, city, lat, lng, n}
  const seen = new Set();        // les extraits de pays se chevauchent un peu aux frontières
  let n = 0, kept = 0, minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for(const {path: input, cc: cc0} of inputs){
  let stream = fs.createReadStream(input);
  if(input.endsWith(".gz")) stream = stream.pipe(zlib.createGunzip());
  const rl = readline.createInterface({input: stream, crlfDelay: Infinity});
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
    if(seen.has(id)) continue;
    seen.add(id);
    const row = [lat, lng, sels.length === 1 ? sels[0] : sels, clip(t.name, 80), clip(addr(t), 100),
      clip(t.opening_hours, 160), clip(t.website || t["contact:website"] || t.url, 120),
      clip(t.phone || t["contact:phone"], 30), clip(t.cuisine, 40), t.wheelchair === "yes" ? 1 : 0, id];
    // Codes postaux : centre des lieux qui portent ce code (et cette commune)
    const pc = String(t["addr:postcode"] || "").trim();
    if(/^\d{5}$/.test(pc)){
      // pays : celui de l'adresse s'il est indiqué (extraits par continent), sinon celui de l'extrait
      const ac = String(t["addr:country"] || "").trim().toLowerCase(), cc = /^[a-z]{2}$/.test(ac) ? ac : cc0;
      const city = String(t["addr:city"] || "").trim().slice(0, 60);
      const k = pc + "|" + cc + "|" + city.toLowerCase();
      const e = postcodes.get(k) || {pc, cc, city, lat: 0, lng: 0, n: 0};
      e.lat += lat; e.lng += lng; e.n++; postcodes.set(k, e);
    }
    const key = Math.floor(lat / CELL) + "_" + Math.floor(lng / CELL);
    if(!tiles.has(key)) tiles.set(key, []);
    tiles.get(key).push(row);
    kept++;
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat); minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
  }
  }
  fs.mkdirSync(path.join(outDir, "t"), {recursive: true});
  let bytes = 0;
  for(const [key, rows] of tiles){
    const json = JSON.stringify(rows);
    bytes += json.length;
    fs.writeFileSync(path.join(outDir, "t", key + ".json"), json);
    tiles.set(key, null);            // mémoire : l'Europe entière fait plusieurs millions de lieux
  }
  // Codes postaux : { "75011": [[lat, lng, "Paris", nombre de lieux, "fr"], …], … } (triés par nombre de lieux)
  const byPc = {};
  for(const e of postcodes.values()){
    if(e.n < 2 && !e.city) continue;
    ((byPc[e.pc] = byPc[e.pc] || {})[e.cc] = byPc[e.pc][e.cc] || []).push([+(e.lat / e.n).toFixed(5), +(e.lng / e.n).toFixed(5), e.city, e.n, e.cc]);
  }
  const shards = {}, frOnly = {};
  for(const pc in byPc){
    // par pays : même commune écrite de façons différentes / sans commune → on garde les plus fréquentes
    const all = [];
    for(const cc in byPc[pc]){
      const list = byPc[pc][cc].sort((a, b) => b[3] - a[3]), named = list.filter(x => x[2]);
      const keep = (named.length ? named : list).slice(0, 6);
      all.push(...keep);
      if(cc === "fr") frOnly[pc] = keep.map(x => x.slice(0, 4));
    }
    (shards[pc.slice(0, 2)] = shards[pc.slice(0, 2)] || {})[pc] = all.sort((a, b) => b[3] - a[3]);
  }
  fs.mkdirSync(path.join(outDir, "pc"), {recursive: true});
  for(const k in shards) fs.writeFileSync(path.join(outDir, "pc", k + ".json"), JSON.stringify(shards[k]));
  fs.writeFileSync(path.join(outDir, "postcodes.json"), JSON.stringify(frOnly));   // anciennes versions de l'appli
  const index = {v: 2, postcodes: Object.keys(byPc).length, pcShards: true, countries: [...new Set(inputs.map(x => x.cc).filter(Boolean))], built: new Date().toISOString(), cell: CELL, sels: SELS, count: kept, tiles: tiles.size,
    bbox: [+minLat.toFixed(3), +minLng.toFixed(3), +maxLat.toFixed(3), +maxLng.toFixed(3)],
    // colonnes de chaque lieu : [lat, lng, étiquette(s), nom, adresse, horaires, site, téléphone, cuisine, accessible, id]
    fields: ["lat","lng","sel","name","addr","oh","web","phone","cuisine","wc","id"]};
  fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify(index));
  return {read: n, kept, tiles: tiles.size, bytes, postcodes: Object.keys(byPc).length};
}

if(require.main === module){
  const args = process.argv.slice(2);
  let outDir, inputs;
  if(args.length === 2 && !args[1].includes(":")){ inputs = args[0]; outDir = args[1]; }          // ancienne forme
  else { outDir = args[0]; inputs = args.slice(1).map(a => { const i = a.indexOf(":"); return {cc: a.slice(0, i).toLowerCase(), path: a.slice(i + 1)}; }); }
  if(!outDir || !inputs || !inputs.length){ console.error("Usage : node scripts/build-places.js sortie/ fr:france.geojsonseq.gz de:germany.geojsonseq.gz …"); process.exit(1); }
  build(inputs, outDir).then(r => console.log(`${r.read} entités lues, ${r.kept} lieux gardés, ${r.tiles} tuiles, ${(r.bytes / 1e6).toFixed(1)} Mo, ${r.postcodes} codes postaux`))
    .catch(e => { console.error(e); process.exit(1); });
}

module.exports = { build, SELS, CELL, center };
