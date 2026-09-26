#!/usr/bin/env node
// Pas l'temps — réassemble les tuiles calculées continent par continent (scripts/build-places.js) en un seul jeu.
// Les tuiles d'une même case venues de plusieurs continents (frontières) sont fusionnées, sans doublon.
// Usage : node scripts/merge-places.js sortie/ partie-europe/ partie-asie/ …
"use strict";
const fs = require("node:fs");
const path = require("node:path");

function readJSON(f){ return JSON.parse(fs.readFileSync(f, "utf8")); }
const list = dir => fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith(".json")) : [];

function merge(outDir, parts){
  parts = parts.filter(p => fs.existsSync(path.join(p, "index.json")));
  if(!parts.length) throw new Error("aucune partie à réassembler");
  const idx = parts.map(p => readJSON(path.join(p, "index.json")));
  const sels = JSON.stringify(idx[0].sels);
  if(idx.some(i => JSON.stringify(i.sels) !== sels)) throw new Error("étiquettes différentes entre les parties");
  fs.mkdirSync(path.join(outDir, "t"), {recursive: true});
  fs.mkdirSync(path.join(outDir, "pc"), {recursive: true});

  // Tuiles : une case peut exister dans plusieurs parties
  const where = new Map();
  parts.forEach(p => list(path.join(p, "t")).forEach(f => { if(!where.has(f)) where.set(f, []); where.get(f).push(p); }));
  let count = 0;
  for(const [f, ps] of where){
    let rows = readJSON(path.join(ps[0], "t", f));
    if(ps.length > 1){
      const seen = new Set(rows.map(r => r[10]));
      for(const p of ps.slice(1)) for(const r of readJSON(path.join(p, "t", f))) if(!seen.has(r[10])){ seen.add(r[10]); rows.push(r); }
    }
    count += rows.length;
    fs.writeFileSync(path.join(outDir, "t", f), JSON.stringify(rows));
  }

  // Codes postaux : par préfixe, communes de toutes les parties (sans doublon pays + commune)
  const shards = new Set(parts.flatMap(p => list(path.join(p, "pc"))));
  let pcs = 0;
  for(const f of shards){
    const out = {};
    for(const p of parts){
      const file = path.join(p, "pc", f);
      if(!fs.existsSync(file)) continue;
      for(const [pc, arr] of Object.entries(readJSON(file))){
        const cur = out[pc] = out[pc] || [];
        for(const e of arr) if(!cur.some(x => x[4] === e[4] && x[2] === e[2])) cur.push(e);
      }
    }
    for(const pc in out) out[pc].sort((a, b) => b[3] - a[3]);
    pcs += Object.keys(out).length;
    fs.writeFileSync(path.join(outDir, "pc", f), JSON.stringify(out));
  }
  // Anciennes versions de l'appli : France seule
  const withFr = parts.find(p => fs.existsSync(path.join(p, "postcodes.json")) && Object.keys(readJSON(path.join(p, "postcodes.json"))).length);
  fs.writeFileSync(path.join(outDir, "postcodes.json"), withFr ? fs.readFileSync(path.join(withFr, "postcodes.json")) : "{}");

  const bbox = idx.reduce((b, i) => [Math.min(b[0], i.bbox[0]), Math.min(b[1], i.bbox[1]), Math.max(b[2], i.bbox[2]), Math.max(b[3], i.bbox[3])], [90, 180, -90, -180]);
  const index = {...idx[0], built: new Date().toISOString(), count, tiles: where.size, postcodes: pcs, bbox,
    countries: [...new Set(idx.flatMap(i => i.countries || []))], parts: parts.map(p => path.basename(p))};
  fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify(index));
  return {count, tiles: where.size, postcodes: pcs, parts: parts.length};
}

if(require.main === module){
  const [outDir, ...parts] = process.argv.slice(2);
  if(!outDir || !parts.length){ console.error("Usage : node scripts/merge-places.js sortie/ partie1/ partie2/ …"); process.exit(1); }
  const r = merge(outDir, parts);
  console.log(`${r.parts} parties réassemblées : ${r.count} lieux, ${r.tiles} tuiles, ${r.postcodes} codes postaux`);
}

module.exports = { merge };
