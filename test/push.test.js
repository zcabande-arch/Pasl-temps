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
  const st = await push.send(keys, {endpoint:"https://push.example/1", keys: br.keys}, {title:"Fissa Fissa", body:"C'est l'heure de repartir !"},
    {fetchFn: async (url, o) => { req = o; return {status: 201}; }});
  assert.equal(st, 201);
  assert.equal(req.headers["Content-Encoding"], "aes128gcm");
  assert.deepEqual(await br.decrypt(req.body), {title:"Fissa Fissa", body:"C'est l'heure de repartir !"});
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
    const events = [{at: now + 60e3, title:"Fissa Fissa", body:"🏃 C'est l'heure de repartir !"}, {at: now + 5 * 60e3, title:"Fissa Fissa", body:"⏰ Temps écoulé"}];
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

    // à l'heure prévue (midi, dans 3 jours) : le rappel part, l'abonnement expiré est supprimé
    const r = await push.runReminders(store, {now: before + 60e3, fetchFn});
    assert.deepEqual(r, {sent: 1, removed: 1});
    assert.ok(push.NUDGES.fr.includes(got[1].body));
    assert.equal(store.pushDue(now + 5 * 864e5, 10).length, 0);
    assert.equal(store.pushDue(now + 8 * 864e5, 10).length, 1);
  } finally { srv.close(); }
});

test("créneaux : heures prévues par l'appareil, 1 par jour, rien la nuit ni juste après une ouverture", async () => {
  const store = openStore(":memory:");
  const srv = createServer(store, {rateLimit:false});
  await new Promise(ok => srv.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${srv.address().port}`;
  try{
    const a = await (await fetch(base + "/api/session", {method:"POST"})).json(), other = await (await fetch(base + "/api/session", {method:"POST"})).json();
    const api = (who, url, body) => fetch(base + url, {method:"POST", headers:{Authorization:"Bearer " + who.token, "Content-Type":"application/json"}, body: JSON.stringify(body)});
    const br = await fakeBrowser(), ep = "https://push.example/slots", tz = -60;   // Paris en hiver
    await api(a, "/api/push/subscribe", {subscription:{endpoint: ep, keys: br.keys}, hour:12, tz, lang:"fr"});
    // demain et après-demain (heure de Paris) : 11 h 55, 17 h 30 le même jour, et 22 h (refusé : la nuit)
    const day = d => { const x = new Date(Date.now() - tz * 60000 + d * 864e5); x.setUTCHours(0, 0, 0, 0); return x.getTime() + tz * 60000; };
    const at = (d, h, m) => day(d) + (h * 60 + m) * 60e3;
    const slots = [{at: at(1, 11, 55), slot:"midi", t:30}, {at: at(1, 17, 30), slot:"soir", t:45}, {at: at(1, 22, 0), slot:"soir", t:30},
      {at: at(2, 12, 20), slot:"habitude", t:20, hm: 745}, {at: at(2, 13, 0), slot:"piratage", t:30}];
    assert.equal((await api(other, "/api/push/slots", {endpoint: ep, tz, slots})).status, 403);
    assert.equal((await (await api(a, "/api/push/slots", {endpoint: ep, tz, slots})).json()).count, 3);
    const got = [], fetchFn = async (url, o) => { got.push(await br.decrypt(o.body)); return {status: 201}; };
    // demain midi : envoyée, avec la durée dans l'adresse
    await push.runReminders(store, {now: at(1, 11, 55), fetchFn});
    assert.equal(got.length, 1);
    assert.equal(got[0].url, "./?t=30");
    assert.ok(push.SLOTS.fr.midi.map(x => x.replace("{t}", 30)).includes(got[0].body));
    // 17 h 30 le même jour : déjà une notification aujourd'hui → rien
    await push.runReminders(store, {now: at(1, 17, 30), fetchFn});
    assert.equal(got.length, 1);
    // après-demain : l'appli vient d'être ouverte (moins d'une heure) → rien
    store.pushSeen(ep, at(2, 11, 50));
    await push.runReminders(store, {now: at(2, 12, 20), fetchFn});
    assert.equal(got.length, 1);
    // nouvelle liste : la précédente est remplacée ; habitude envoyée avec son heure (pour le texte fait sur le téléphone)
    await api(a, "/api/push/slots", {endpoint: ep, tz, slots: [{at: at(3, 12, 20), slot:"habitude", t:20, hm: 745}]});
    await push.runReminders(store, {now: at(3, 12, 20), fetchFn});
    assert.equal(got.length, 2);
    assert.deepEqual([got[1].slot, got[1].t, got[1].hm], ["habitude", 20, 745]);
    // se désabonner efface aussi les créneaux
    await api(a, "/api/push/slots", {endpoint: ep, tz, slots: [{at: at(4, 12, 0), slot:"midi", t:30}]});
    await api(a, "/api/push/unsubscribe", {endpoint: ep});
    assert.equal(store.slotsDue(at(5, 0, 0), 10).length, 0);
  } finally { srv.close(); }
});

test("administration : message à tous les abonnés", async () => {
  const store = openStore(":memory:");
  const srv = createServer(store, {rateLimit:false, adminToken:"adm"});
  await new Promise(ok => srv.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${srv.address().port}`;
  try{
    const r0 = await fetch(base + "/api/admin/push", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({body:"x"})});
    assert.equal(r0.status, 403);
    const r = await (await fetch(base + "/api/admin/push", {method:"POST", headers:{"Content-Type":"application/json", "X-Admin-Token":"adm"}, body:JSON.stringify({body:"teste zoé"})})).json();
    assert.deepEqual(r, {subscribers:0, sent:0, removed:0, failed:0});
  } finally { srv.close(); }
});
