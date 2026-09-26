// Rappels « T'as l'temps ? » : clés VAPID, abonnement, envoi des rappels arrivés à échéance
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { createServer } = require("../server/server");
const { openStore } = require("../server/store");
const push = require("../server/push");

const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

test("clés VAPID : créées une fois, et la signature se vérifie", async () => {
  const store = openStore(":memory:");
  const k1 = await push.vapidKeys(store), k2 = await push.vapidKeys(store);
  assert.equal(k1.publicKey, k2.publicKey);
  assert.equal(unb64u(k1.publicKey).length, 65);
  const auth = await push.vapidAuth(k1, "https://web.push.apple.com/abc", "mailto:x@y.fr");
  const [, jwt, k] = /^vapid t=([^,]+), k=(.+)$/.exec(auth);
  assert.equal(k, k1.publicKey);
  const [h, p, sig] = jwt.split(".");
  assert.equal(JSON.parse(new TextDecoder().decode(unb64u(p))).aud, "https://web.push.apple.com");
  const pub = await crypto.subtle.importKey("raw", unb64u(k1.publicKey), {name:"ECDSA", namedCurve:"P-256"}, false, ["verify"]);
  assert.ok(await crypto.subtle.verify({name:"ECDSA", hash:"SHA-256"}, pub, unb64u(sig), new TextEncoder().encode(h + "." + p)));
});

test("prochain rappel : dans 3 jours, à l'heure locale choisie", () => {
  const from = Date.UTC(2026, 8, 26, 15, 0);          // 17 h à Paris (UTC+2 → getTimezoneOffset = -120)
  const at = new Date(push.nextAt(from, 12, -120, 3));
  assert.equal(at.toISOString(), "2026-09-29T10:00:00.000Z");   // 12 h à Paris le 29
});

test("abonnement par l'API, puis envoi : rappel parti, abonnement expiré supprimé", async () => {
  const store = openStore(":memory:");
  const srv = createServer(store, {rateLimit:false});
  await new Promise(ok => srv.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${srv.address().port}`;
  try{
    const key = await (await fetch(base + "/api/push/key")).json();
    assert.equal(unb64u(key.key).length, 65);
    const a = await (await fetch(base + "/api/session", {method:"POST"})).json();
    const sub = ep => fetch(base + "/api/push/subscribe", {method:"POST", headers:{Authorization:"Bearer " + a.token, "Content-Type":"application/json"},
      body: JSON.stringify({subscription:{endpoint:ep, keys:{p256dh:"x", auth:"y"}}, hour:12, tz:-120, every:3})});
    assert.equal((await sub("https://push.example/ok")).status, 200);
    assert.equal((await sub("https://push.example/gone")).status, 200);
    assert.equal((await sub("javascript:alert(1)")).status, 400);
    // rien à envoyer tout de suite
    assert.deepEqual(await push.runReminders(store, {fetchFn: async () => ({status: 201, ok: true})}), {sent: 0, removed: 0});
    // 4 jours plus tard
    const calls = [];
    const later = Date.now() + 4 * 864e5;
    const r = await push.runReminders(store, {now: later, fetchFn: async (url, o) => { calls.push({url, o}); return url.endsWith("gone") ? {status: 410, ok: false} : {status: 201, ok: true}; }});
    assert.deepEqual(r, {sent: 1, removed: 1});
    assert.match(calls[0].o.headers.Authorization, /^vapid t=/);
    // le suivant est reprogrammé ~3 jours plus tard
    assert.equal(store.pushDue(later + 864e5, 10).length, 0);
    assert.equal(store.pushDue(later + 4 * 864e5, 10).length, 1);
  } finally { srv.close(); }
});
