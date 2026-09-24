"use strict";
// Le stockage Cloudflare D1, testé avec une fausse D1 posée sur SQLite (même moteur, même API asynchrone).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { d1Store } = require("../worker/store-d1");
const { createServer } = require("../server/server");

function fakeD1(){
  const db = new DatabaseSync(":memory:");
  db.exec(fs.readFileSync(path.join(__dirname, "..", "server", "schema.sql"), "utf8"));
  return {prepare(sql){ const st = db.prepare(sql); return {bind(...a){ return {
    run: async () => st.run(...a), first: async () => st.get(...a) ?? null, all: async () => ({results: st.all(...a)})
  }; }}; }};
}

test("l'API fonctionne avec le stockage D1", async () => {
  const srv = createServer(d1Store(fakeD1()), {rateLimit:false, adminToken:"adm"});
  await new Promise(ok => srv.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${srv.address().port}`;
  try{
    const a = await (await fetch(base + "/api/session", {method:"POST"})).json();
    const h = {Authorization: "Bearer " + a.token, "Content-Type": "application/json"};
    const doc = p => base + "/api/doc?path=" + encodeURIComponent(p);
    assert.equal((await fetch(doc("walls/" + a.uid), {method:"PUT", headers:h, body:JSON.stringify({pseudo:"Zoé", updatedAt:2})})).status, 200);
    await fetch(doc(`walls/${a.uid}/photos/p1`), {method:"PUT", headers:h, body:JSON.stringify({data:"x"})});
    const list = await (await fetch(base + "/api/list?path=walls", {headers:h})).json();
    assert.equal(list.docs[0].data.pseudo, "Zoé");
    await fetch(doc("walls/" + a.uid), {method:"DELETE", headers:h});
    assert.equal((await (await fetch(doc(`walls/${a.uid}/photos/p1`), {headers:h})).json()).exists, false);
    const b = await (await fetch(base + "/api/session", {method:"POST"})).json();
    const r = await fetch(base + "/api/report", {method:"POST", headers:{Authorization:"Bearer " + b.token, "Content-Type":"application/json"}, body:JSON.stringify({target:`post:${a.uid}:p9`, reason:"spam"})});
    assert.equal(r.status, 200);
    const rep = await (await fetch(base + "/api/admin/reports", {headers:{"X-Admin-Token":"adm"}})).json();
    assert.equal(rep.reports[0].n, 1);
  } finally { srv.close(); }
});
