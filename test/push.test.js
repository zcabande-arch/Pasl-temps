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

// Un « navigateur » de test : ses clés, et le déchiffrement (RFC 8291) d'une notification reçue
async function fakeBrowser(){
  const kp = await crypto.subtle.generateKey({name:"ECDH", namedCurve:"P-256"}, true, ["deriveBits"]);
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey)), auth = crypto.getRandomValues(new Uint8Array(16));
  const b64u = b => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const hkdf = async (salt, ikm, info, n) => new Uint8Array(await crypto.subtle.deriveBits({name:"HKDF", hash:"SHA-256", salt, info}, await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]), n * 8));
  const te = new TextEncoder();
  return {
    keys: {p256dh: b64u(pub), auth: b64u(auth)},
    async decrypt(body){
      body = new Uint8Array(body);
      const salt = body.slice(0, 16), idlen = body[20], asPub = body.slice(21, 21 + idlen), ct = body.slice(21 + idlen);
      const asKey = await crypto.subtle.importKey("raw", asPub, {name:"ECDH", namedCurve:"P-256"}, false, []);
      const shared = new Uint8Array(await crypto.subtle.deriveBits({name:"ECDH", public: asKey}, kp.privateKey, 256));
      const info = new Uint8Array([...te.encode("WebPush: info\0"), ...pub, ...asPub]);
      const ikm = await hkdf(auth, shared, info, 32);
      const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16), nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
      const pt = new Uint8Array(await crypto.subtle.decrypt({name:"AES-GCM", iv: nonce}, await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]), ct));
      assert.equal(pt[pt.length - 1], 2);
      return JSON.parse(new TextDecoder().decode(pt.slice(0, -1)));
    }
  };
}

test("chiffrement : le téléphone retrouve le message", async () => {
  const br = await fakeBrowser(), store = openStore(":memory:"), keys = await push.vapidKeys(store);
  let req = null;
  const st = await push.send(keys, {endpoint:"https://push.example/1", keys: br.keys}, {title:"Pas l'temps", body:"C'est l'heure de repartir !"},
    {fetchFn: async (url, o) => { req = o; return {status: 201}; }});
  assert.equal(st, 201);
  assert.equal(req.headers["Content-Encoding"], "aes128gcm");
  assert.deepEqual(await br.decrypt(req.body), {title:"Pas l'temps", body:"C'est l'heure de repartir !"});
});

test("abonnement, rappel tous les 3 jours et chrono « Je pars »", async () => {
  const store = openStore(":memory:");
  const srv = createServer(store, {rateLimit:false});
  await new Promise(ok => srv.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${srv.address().port}`;
  try{
    const key = await (await fetch(base + "/api/push/key")).json();
    assert.equal(unb64u(key.key).length, 65);
    const a = await (await fetch(base + "/api/session", {method:"POST"})).json(), other = await (await fetch(base + "/api/session", {method:"POST"})).json();
    const api = (who, url, body) => fetch(base + url, {method:"POST", headers:{Authorization:"Bearer " + who.token, "Content-Type":"application/json"}, body: JSON.stringify(body)});
    const br = await fakeBrowser(), gone = await fakeBrowser();
    assert.equal((await api(a, "/api/push/subscribe", {subscription:{endpoint:"https://push.example/ok", keys: br.keys}, hour:12, tz:-120, lang:"fr"})).status, 200);
    assert.equal((await api(a, "/api/push/subscribe", {subscription:{endpoint:"https://push.example/gone", keys: gone.keys}, hour:12, tz:-120})).status, 200);
    assert.equal((await api(a, "/api/push/subscribe", {subscription:{endpoint:"javascript:alert(1)", keys: br.keys}})).status, 400);
    // se réabonner (appli rouverte) ne repousse pas le rappel prévu
    const before = store.pushDue(Date.now() + 10 * 864e5, 10).find(x => x.endpoint.endsWith("ok")).next_at;
    await api(a, "/api/push/subscribe", {subscription:{endpoint:"https://push.example/ok", keys: br.keys}, hour:12, tz:-120});
    assert.equal(store.pushDue(Date.now() + 10 * 864e5, 10).find(x => x.endpoint.endsWith("ok")).next_at, before);

    // chrono : deux notifications programmées ; un autre compte ne peut pas en poser sur cet appareil
    const now = Date.now();
    const events = [{at: now + 60e3, title:"Pas l'temps", body:"🏃 C'est l'heure de repartir !"}, {at: now + 5 * 60e3, title:"Pas l'temps", body:"⏰ Temps écoulé"}];
    assert.equal((await api(other, "/api/push/timer", {endpoint:"https://push.example/ok", events})).status, 403);
    assert.equal((await (await api(a, "/api/push/timer", {endpoint:"https://push.example/ok", events})).json()).count, 2);
    const got = [];
    const fetchFn = async (url, o) => { if(url.endsWith("gone")) return {status: 410}; got.push(await br.decrypt(o.body)); return {status: 201}; };
    assert.deepEqual(await push.runReminders(store, {now, fetchFn}), {sent: 0, removed: 0});
    await push.runReminders(store, {now: now + 2 * 60e3, fetchFn});
    assert.equal(got[0].body, "🏃 C'est l'heure de repartir !");
    // annuler le chrono (« Je suis rentré·e ») : plus rien
    await api(a, "/api/push/timer", {endpoint:"https://push.example/ok", events: []});
    await push.runReminders(store, {now: now + 10 * 60e3, fetchFn});
    assert.equal(got.length, 1);

    // 4 jours plus tard : le rappel part, l'abonnement expiré est supprimé
    const r = await push.runReminders(store, {now: now + 4 * 864e5, fetchFn});
    assert.deepEqual(r, {sent: 1, removed: 1});
    assert.ok(push.NUDGES.fr.includes(got[1].body));
    assert.equal(store.pushDue(now + 5 * 864e5, 10).length, 0);
    assert.equal(store.pushDue(now + 8 * 864e5, 10).length, 1);
  } finally { srv.close(); }
});
