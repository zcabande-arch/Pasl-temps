// Profil administrateur personnel : compte e-mail + code personnel (empreinte PBKDF2), journal des actions
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { createServer } = require("../server/server");
const { openStore } = require("../server/store");
const { hashCode, checkCode } = require("../server/admin");

test("empreinte du code : vérifiée, jamais le code en clair", async () => {
  const h = await hashCode("ma phrase de passe très longue");
  assert.match(h, /^pbkdf2\$100000\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
  assert.ok(!h.includes("phrase"));
  assert.equal(await checkCode("ma phrase de passe très longue", h), true);
  assert.equal(await checkCode("ma phrase de passe tres longue", h), false);
  assert.equal(await checkCode("", h), false);
  assert.equal(await checkCode("x", "n'importe quoi"), false);
  assert.notEqual(h, await hashCode("ma phrase de passe très longue"));   // sel différent à chaque fois
});

async function setup(extra){
  const store = openStore(":memory:");
  const code = "code admin personnel 2026", hash = await hashCode(code, {iter: 1000});
  const srv = createServer(store, {rateLimit: false, adminToken: "ancien", adminEmail: "Zoe@Example.fr", adminCodeHash: hash, ...extra});
  await new Promise(ok => srv.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${srv.address().port}`;
  // deux comptes : l'admin (e-mail admin) et quelqu'un d'autre
  const mk = async email => { const s = await (await fetch(base + "/api/session", {method: "POST"})).json(); store.addAccount(email, s.uid); return s; };
  const admin = await mk("zoe@example.fr"), other = await mk("autre@example.fr");
  const call = (who, path, {code: c, token, body} = {}) => fetch(base + path, {method: body ? "POST" : "GET", headers: {
    ...(who ? {Authorization: "Bearer " + who.token} : {}), ...(c != null ? {"X-Admin-Code": c} : {}), ...(token ? {"X-Admin-Token": token} : {}),
    "Content-Type": "application/json"}, body: body && JSON.stringify(body)});
  return {store, srv, code, admin, other, call};
}

test("espace admin : il faut le bon compte ET le bon code ; l'ancien code partagé ne suffit plus", async () => {
  const {srv, code, admin, other, call} = await setup();
  try{
    assert.equal((await call(admin, "/api/admin/check", {code})).status, 200);
    assert.equal((await call(admin, "/api/admin/check", {code: "mauvais"})).status, 403);      // bon compte, mauvais code
    assert.equal((await call(other, "/api/admin/check", {code})).status, 403);                // bon code, mauvais compte
    assert.equal((await call(null, "/api/admin/check", {code})).status, 403);                 // code sans compte
    assert.equal((await call(null, "/api/admin/check", {token: "ancien"})).status, 403);      // ancien code partagé
    // l'appli sait afficher « Espace admin » au bon compte seulement (sans le code)
    assert.deepEqual(await (await call(admin, "/api/admin/me")).json(), {account: true, personal: true});
    assert.deepEqual(await (await call(other, "/api/admin/me")).json(), {account: false});
  } finally { srv.close(); }
});

test("espace admin : 10 mauvais codes par heure au plus", async () => {
  const {srv, code, admin, call} = await setup();
  try{
    for(let i = 0; i < 10; i++) await call(admin, "/api/admin/check", {code: "faux " + i});
    assert.equal((await call(admin, "/api/admin/check", {code})).status, 403);               // bloqué, même avec le bon code
  } finally { srv.close(); }
});

test("journal : chaque action de modération est notée avec son auteur", async () => {
  const {srv, code, admin, other, call} = await setup();
  try{
    const target = `post:${other.uid}:p1`;
    assert.equal((await call(admin, "/api/admin/hide", {code, body: {target, why: "spam"}})).status, 200);
    await call(admin, "/api/admin/unhide", {code, body: {target}});
    const {log} = await (await call(admin, "/api/admin/log", {code})).json();
    assert.deepEqual(log.map(x => [x.who, x.action, x.target]), [["zoe@example.fr", "rétablir", target], ["zoe@example.fr", "masquer", target]]);
    assert.equal(log[1].detail, "spam");
    assert.equal((await call(other, "/api/admin/log", {code})).status, 403);
  } finally { srv.close(); }
});

test("sans profil configuré : l'ancien code partagé marche encore (transition)", async () => {
  const {srv, call} = await setup({adminEmail: "", adminCodeHash: ""});
  try{
    assert.equal((await call(null, "/api/admin/check", {token: "ancien"})).status, 200);
    assert.equal((await call(null, "/api/admin/check", {token: "faux"})).status, 403);
  } finally { srv.close(); }
});
