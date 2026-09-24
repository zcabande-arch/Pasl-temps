"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { createServer } = require("../server/server");
const { openStore } = require("../server/store");

let srv, base;
test.before(async () => {
  srv = createServer(openStore(":memory:"), {rateLimit:false});
  await new Promise(ok => srv.listen(0, "127.0.0.1", ok));
  base = `http://127.0.0.1:${srv.address().port}`;
});
test.after(() => srv.close());

async function session(){ return (await fetch(base + "/api/session", {method:"POST"})).json(); }
function call(auth, method, url, body){
  return fetch(base + url, {method, headers:{Authorization:"Bearer " + auth.token, "Content-Type":"application/json"}, body: body && JSON.stringify(body)});
}
const doc = p => "/api/doc?path=" + encodeURIComponent(p);

test("sert l'appli et répond à /api/health", async () => {
  const r = await fetch(base + "/");
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Pas l'temps/);
  assert.deepEqual(await (await fetch(base + "/api/health")).json(), {ok:true, app:"pasltemps"});
  assert.equal((await fetch(base + "/../server/server.js")).status, 404);
});

test("refuse les appels sans jeton", async () => {
  assert.equal((await fetch(base + doc("walls/x"))).status, 401);
});

test("mur : lisible par tous, modifiable seulement par son propriétaire", async () => {
  const a = await session(), b = await session();
  assert.equal((await call(a, "PUT", doc("walls/" + a.uid), {pseudo:"Alice", updatedAt:1})).status, 200);
  assert.equal((await call(b, "PUT", doc("walls/" + a.uid), {pseudo:"Pirate"})).status, 403);
  const got = await (await call(b, "GET", doc("walls/" + a.uid))).json();
  assert.equal(got.data.pseudo, "Alice");
  const list = await (await call(b, "GET", "/api/list?path=walls")).json();
  assert.ok(list.docs.some(d => d.id === a.uid));
});

test("données privées : invisibles pour les autres", async () => {
  const a = await session(), b = await session();
  const p = `data/users/${a.uid}/profile/history/h1`;
  assert.equal((await call(a, "PUT", doc(p), {n:"Boulangerie", at:5})).status, 200);
  assert.equal((await call(a, "PATCH", doc(p), {done:true})).status, 200);
  const mine = await (await call(a, "GET", `/api/list?path=${encodeURIComponent(`data/users/${a.uid}/profile/history`)}`)).json();
  assert.deepEqual(mine.docs, [{id:"h1", data:{n:"Boulangerie", at:5, done:true}}]);
  assert.equal((await call(b, "GET", doc(p))).status, 403);
  assert.equal((await call(b, "GET", `/api/list?path=${encodeURIComponent(`data/users/${a.uid}/profile/history`)}`)).status, 403);
});

test("sauvegardes : lisibles avec l'identifiant, jamais listées", async () => {
  const a = await session(), b = await session();
  const id = "a".repeat(40);
  assert.equal((await call(a, "PUT", doc("backups/" + id), {iv:"x", ct:"y"})).status, 200);
  assert.equal((await (await call(b, "GET", doc("backups/" + id))).json()).data.ct, "y");
  assert.equal((await call(b, "GET", "/api/list?path=backups")).status, 400);
  assert.equal((await call(b, "PUT", doc("backups/court"), {})).status, 400);
});

test("refuse les chemins invalides et les documents trop gros", async () => {
  const a = await session();
  assert.equal((await call(a, "PUT", doc("walls/../x"), {})).status, 400);
  assert.equal((await call(a, "PUT", doc("autre/chose"), {})).status, 400);
  assert.equal((await call(a, "PUT", doc(`walls/${a.uid}/photos/p1`), {data:"x".repeat(200000)})).status, 413);
});

test("supprimer un mur supprime aussi ses photos", async () => {
  const a = await session();
  await call(a, "PUT", doc("walls/" + a.uid), {pseudo:"A"});
  await call(a, "PUT", doc(`walls/${a.uid}/photos/p1`), {data:"img"});
  await call(a, "DELETE", doc("walls/" + a.uid));
  assert.equal((await (await call(a, "GET", doc(`walls/${a.uid}/photos/p1`))).json()).exists, false);
});
