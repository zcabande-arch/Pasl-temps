// Mesure d'audience maison : totaux par jour, anonymes, lisibles seulement avec le code administrateur
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { createServer } = require("../server/server");
const { openStore } = require("../server/store");

test("audience : événements comptés par jour, sans identifiant, tableau réservé à l'admin", async () => {
  const store = openStore(":memory:");
  const srv = createServer(store, {rateLimit:false, adminToken:"adm"});
  await new Promise(ok => srv.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const post = body => fetch(base + "/api/stats", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body)});
  try{
    for(const b of [{ev:"open"}, {ev:"open"}, {ev:"search", dim:"manger"}, {ev:"search", dim:"manger"}, {ev:"search", dim:"culture"}, {ev:"go", dim:"manger"}, {ev:"done"}])
      assert.equal((await post(b)).status, 200);
    // événement inconnu ou valeur bizarre : refusés
    assert.equal((await post({ev:"pageview"})).status, 400);
    assert.equal((await post({ev:"search", dim:"<script>"})).status, 400);
    // sans le code : rien
    assert.equal((await fetch(base + "/api/admin/stats")).status, 403);
    const r = await (await fetch(base + "/api/admin/stats?days=7", {headers:{"X-Admin-Token":"adm"}})).json();
    assert.equal(r.days, 7);
    const today = new Date().toISOString().slice(0, 10), n = (ev, dim = "") => (r.rows.find(x => x.day === today && x.ev === ev && x.dim === dim) || {}).n;
    assert.equal(n("open"), 2);
    assert.equal(n("search", "manger"), 2);
    assert.equal(n("search", "culture"), 1);
    assert.equal(n("go", "manger"), 1);
    assert.equal(n("done"), 1);
    // seules ces colonnes existent : pas d'identifiant, pas d'adresse IP
    assert.deepEqual(Object.keys(r.rows[0]).sort(), ["day", "dim", "ev", "n"]);
    // conservation limitée : les vieux jours sont effacés
    store.statAdd("2020-01-01", "open", "");
    store.statPurge("2024-01-01");
    assert.equal(store.statRange("2000-01-01").filter(x => x.day === "2020-01-01").length, 0);
  } finally { srv.close(); }
});
