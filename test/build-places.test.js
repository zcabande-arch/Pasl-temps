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
