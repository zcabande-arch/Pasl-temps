"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { build, center } = require("../scripts/build-places");

test("tuiles : lieux nommés gardés, centre des surfaces, plusieurs étiquettes", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lieux-"));
  const f = (geometry, properties) => "\x1e" + JSON.stringify({type:"Feature", geometry, properties});
  fs.writeFileSync(path.join(dir, "in.geojsonseq"), [
    f({type:"Point", coordinates:[2.35, 48.857]}, {"@type":"node", "@id":1, shop:"bakery", name:"Boulangerie A", opening_hours:"Mo-Fr 07:00-19:00"}),
    f({type:"Polygon", coordinates:[[[2.34,48.86],[2.36,48.86],[2.36,48.87],[2.34,48.87],[2.34,48.86]]]}, {"@type":"way", "@id":7, leisure:"park", name:"Parc B"}),
    f({type:"Point", coordinates:[2.35, 48.857]}, {"@type":"node", "@id":2, amenity:"cafe"}),                       // sans nom : ignoré
    f({type:"Point", coordinates:[2.35, 48.857]}, {"@type":"node", "@id":3, amenity:"bank", name:"Banque"}),       // hors sujet : ignoré
    f({type:"Point", coordinates:[2.35, 48.857]}, {"@type":"node", "@id":4, amenity:"cafe", shop:"bakery", name:"Café-boulangerie"})
  ].join("\n"));
  const r = await build(path.join(dir, "in.geojsonseq"), path.join(dir, "out"));
  assert.equal(r.kept, 3);
  const idx = JSON.parse(fs.readFileSync(path.join(dir, "out", "index.json"), "utf8"));
  const tile = JSON.parse(fs.readFileSync(path.join(dir, "out", "t", "977_47.json"), "utf8"));
  const a = tile.find(x => x[3] === "Boulangerie A");
  assert.equal(idx.sels[a[2]], "shop=bakery");
  assert.equal(a[5], "Mo-Fr 07:00-19:00");
  assert.equal(a[10], "n1");
  const both = tile.find(x => x[3] === "Café-boulangerie");
  assert.deepEqual(both[2].map(i => idx.sels[i]).sort(), ["amenity=cafe", "shop=bakery"]);
  const park = JSON.parse(fs.readFileSync(path.join(dir, "out", "t", "977_46.json"), "utf8"))[0];
  assert.equal(park[3], "Parc B"); assert.equal(park[10], "w7");
  assert.deepEqual(center({type:"Polygon", coordinates:[[[0,0],[2,0],[2,2],[0,2]]]}), [1, 1]);
});

test("toutes les étiquettes utilisées par l'appli sont dans les tuiles", () => {
  const { SELS } = require("../scripts/build-places");
  const app = fs.readFileSync(path.join(__dirname, "..", "public", "js", "app.js"), "utf8");
  const used = [...app.matchAll(/osm:\[([^\]]*)\]/g)].flatMap(m => m[1].match(/"[a-z_]+=[a-z_]+"/g) || []).map(s => s.slice(1, -1));
  assert.ok(used.length > 20);
  assert.deepEqual(used.filter(s => !SELS.includes(s)), []);
});

test("codes postaux : centre des lieux, plusieurs communes pour un même code", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cp-"));
  const f = (lng, lat, props) => JSON.stringify({type:"Feature", geometry:{type:"Point", coordinates:[lng, lat]}, properties:{"@type":"node", "@id":Math.floor(Math.random()*1e9), name:"X", shop:"bakery", ...props}});
  fs.writeFileSync(path.join(dir, "in.geojsonseq"), [
    f(2.37, 48.85, {"addr:postcode":"75011", "addr:city":"Paris"}),
    f(2.39, 48.87, {"addr:postcode":"75011", "addr:city":"Paris"}),
    f(5.22, 46.20, {"addr:postcode":"01000", "addr:city":"Bourg-en-Bresse"}),
    f(5.24, 46.21, {"addr:postcode":"01000", "addr:city":"Bourg-en-Bresse"}),
    f(5.19, 46.20, {"addr:postcode":"01000", "addr:city":"Saint-Denis-lès-Bourg"}),
    f(2.30, 48.80, {"addr:postcode":"750"})                         // code invalide : ignoré
  ].join("\n"));
  await build(path.join(dir, "in.geojsonseq"), path.join(dir, "out"));
  const pcs = JSON.parse(fs.readFileSync(path.join(dir, "out", "postcodes.json"), "utf8"));
  assert.deepEqual(pcs["75011"], [[48.86, 2.38, "Paris", 2]]);
  assert.deepEqual(pcs["01000"].map(x => x[2]), ["Bourg-en-Bresse", "Saint-Denis-lès-Bourg"]);
  assert.equal(pcs["750"], undefined);
});

test("Europe : plusieurs pays (.gz), doublons aux frontières, codes postaux par pays et par préfixe", async () => {
  const zlib = require("node:zlib");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lieux-eu-"));
  const f = (lng, lat, p) => "\x1e" + JSON.stringify({type:"Feature", geometry:{type:"Point", coordinates:[lng, lat]}, properties:p});
  const fr = [f(2.35, 48.86, {"@type":"node", "@id":1, amenity:"cafe", name:"Café Paris", "addr:postcode":"75004", "addr:city":"Paris"}),
              f(2.351, 48.861, {"@type":"node", "@id":2, amenity:"cafe", name:"Café 2", "addr:postcode":"75004", "addr:city":"Paris"}),
              f(7.59, 47.56, {"@type":"node", "@id":9, amenity:"bar", name:"Bar frontière"})].join("\n");
  const de = [f(13.4, 52.52, {"@type":"node", "@id":3, amenity:"pub", name:"Kneipe", "addr:postcode":"10115", "addr:city":"Berlin"}),
              f(13.401, 52.521, {"@type":"node", "@id":4, shop:"supermarket", name:"Markt", "addr:postcode":"10115", "addr:city":"Berlin"}),
              f(8.7, 48.9, {"@type":"node", "@id":5, amenity:"cafe", name:"Pforzheim Café", "addr:postcode":"75004", "addr:city":"Pforzheim"}),
              f(8.701, 48.901, {"@type":"node", "@id":6, amenity:"cafe", name:"Pforzheim Café 2", "addr:postcode":"75004", "addr:city":"Pforzheim"}),
              f(7.59, 47.56, {"@type":"node", "@id":9, amenity:"bar", name:"Bar frontière"})].join("\n");
  fs.writeFileSync(path.join(dir, "fr.geojsonseq.gz"), zlib.gzipSync(fr));
  fs.writeFileSync(path.join(dir, "de.geojsonseq"), de);
  const r = await build([{path: path.join(dir, "fr.geojsonseq.gz"), cc:"fr"}, {path: path.join(dir, "de.geojsonseq"), cc:"de"}], path.join(dir, "out"));
  assert.equal(r.kept, 7, "le bar présent dans les deux extraits n'est gardé qu'une fois");
  const pc75 = JSON.parse(fs.readFileSync(path.join(dir, "out", "pc", "75.json"), "utf8"))["75004"];
  assert.deepEqual(pc75.map(x => [x[2], x[4]]).sort(), [["Paris", "fr"], ["Pforzheim", "de"]]);
  const pc10 = JSON.parse(fs.readFileSync(path.join(dir, "out", "pc", "10.json"), "utf8"))["10115"];
  assert.equal(pc10[0][2], "Berlin");
  const old = JSON.parse(fs.readFileSync(path.join(dir, "out", "postcodes.json"), "utf8"));
  assert.deepEqual(Object.keys(old), ["75004"], "postcodes.json : France seulement (anciennes versions)");
  const idx = JSON.parse(fs.readFileSync(path.join(dir, "out", "index.json"), "utf8"));
  assert.deepEqual(idx.countries, ["fr", "de"]);
});

test("monde : les continents calculés à part sont réassemblés (cases de frontière fusionnées, sans doublon)", async () => {
  const { merge } = require("../scripts/merge-places");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lieux-monde-"));
  const f = (lng, lat, p) => "\x1e" + JSON.stringify({type:"Feature", geometry:{type:"Point", coordinates:[lng, lat]}, properties:p});
  fs.writeFileSync(path.join(dir, "eu.geojsonseq"), [
    f(28.97, 41.01, {"@type":"node", "@id":1, amenity:"cafe", name:"Istanbul A"}),
    f(28.971, 41.011, {"@type":"node", "@id":2, amenity:"cafe", name:"Istanbul B"}),
    f(2.35, 48.86, {"@type":"node", "@id":5, amenity:"cafe", name:"Paris", "addr:postcode":"75004", "addr:city":"Paris"}),
    f(2.351, 48.861, {"@type":"node", "@id":6, amenity:"cafe", name:"Paris 2", "addr:postcode":"75004", "addr:city":"Paris"})].join("\n"));
  fs.writeFileSync(path.join(dir, "as.geojsonseq"), [
    f(28.97, 41.01, {"@type":"node", "@id":1, amenity:"cafe", name:"Istanbul A"}),
    f(28.972, 41.012, {"@type":"node", "@id":3, amenity:"cafe", name:"Istanbul C"}),
    f(-77.03, 38.9, {"@type":"node", "@id":4, amenity:"cafe", name:"DC", "addr:postcode":"20001", "addr:country":"US"}),
    f(-77.031, 38.901, {"@type":"node", "@id":7, amenity:"cafe", name:"DC 2", "addr:postcode":"20001", "addr:country":"US"})].join("\n"));
  await build([{path: path.join(dir, "eu.geojsonseq"), cc:"tr"}], path.join(dir, "p-eu"));
  await build([{path: path.join(dir, "as.geojsonseq"), cc:"as"}], path.join(dir, "p-as"));
  const r = merge(path.join(dir, "out"), [path.join(dir, "p-eu"), path.join(dir, "p-as"), path.join(dir, "absent")]);
  assert.equal(r.count, 7, "Istanbul A, présent des deux côtés, n'est gardé qu'une fois");
  const ist = JSON.parse(fs.readFileSync(path.join(dir, "out", "t", "820_579.json"), "utf8"));
  assert.deepEqual(ist.map(x => x[3]).sort(), ["Istanbul A", "Istanbul B", "Istanbul C"]);
  const us = JSON.parse(fs.readFileSync(path.join(dir, "out", "pc", "20.json"), "utf8"))["20001"];
  assert.equal(us[0][4], "us", "pays pris dans addr:country");
  const idx = JSON.parse(fs.readFileSync(path.join(dir, "out", "index.json"), "utf8"));
  assert.ok(idx.bbox[1] < -70 && idx.bbox[3] > 28);
  assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(path.join(dir, "out", "postcodes.json"), "utf8"))), [], "postcodes.json : France seule (ici, aucune)");
});

test("mode gare : gares de train et consignes gardées, métro et gares routières écartés", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gares-"));
  const f = (id, properties) => "\x1e" + JSON.stringify({type:"Feature", geometry:{type:"Point", coordinates:[2.373, 48.844]}, properties:{"@type":"node", "@id":id, ...properties}});
  fs.writeFileSync(path.join(dir, "in.geojsonseq"), [
    f(1, {railway:"station", name:"Paris-Gare-de-Lyon"}),
    f(2, {railway:"station", station:"subway", name:"Gare de Lyon (métro)"}),                 // métro : écarté
    f(3, {railway:"station", station:"subway", train:"yes", name:"Station mixte"}),          // métro avec trains : gardé
    f(4, {public_transport:"station", name:"Gare routière"}),                                // bus : écarté
    f(5, {public_transport:"station", train:"yes", name:"Pôle gare"}),
    f(6, {amenity:"luggage_locker", name:"Consigne Gare de Lyon"})
  ].join("\n"));
  const r = await build(path.join(dir, "in.geojsonseq"), path.join(dir, "out"));
  const idx = JSON.parse(fs.readFileSync(path.join(dir, "out", "index.json"), "utf8"));
  const tile = JSON.parse(fs.readFileSync(path.join(dir, "out", "t", "976_47.json"), "utf8"));
  assert.deepEqual(tile.map(x => x[3]).sort(), ["Consigne Gare de Lyon", "Paris-Gare-de-Lyon", "Pôle gare", "Station mixte"]);
  assert.equal(r.kept, 4);
  assert.equal(idx.sels[tile.find(x => x[3] === "Consigne Gare de Lyon")[2]], "amenity=luggage_locker");
});

test("date de vérification : gardée seulement si elle existe (check_date, survey:date)", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "verif-"));
  const f = (id, properties) => "\x1e" + JSON.stringify({type:"Feature", geometry:{type:"Point", coordinates:[1.444, 43.6045]}, properties:{"@type":"node", "@id":id, ...properties}});
  fs.writeFileSync(path.join(dir, "in.geojsonseq"), [
    f(1, {amenity:"cafe", name:"Vérifié", check_date:"2025-03-02", "check_date:opening_hours":"2026-06-14"}),
    f(2, {amenity:"cafe", name:"Mois seul", "survey:date":"2024-09"}),
    f(3, {amenity:"cafe", name:"Jamais vérifié"}),
    f(4, {amenity:"cafe", name:"Date bizarre", check_date:"hier"})
  ].join("\n"));
  await build(path.join(dir, "in.geojsonseq"), path.join(dir, "out"));
  const tile = JSON.parse(fs.readFileSync(path.join(dir, "out", "t", "872_28.json"), "utf8"));
  const by = n => tile.find(x => x[3] === n);
  assert.equal(by("Vérifié")[11], "2026-06-14");          // la plus récente
  assert.equal(by("Mois seul")[11], "2024-09-01");
  assert.equal(by("Jamais vérifié").length, 11);           // rien d'ajouté
  assert.equal(by("Date bizarre").length, 11);
});
