// Pas l'temps — notifications « T'as l'temps ? » (Web Push, sans service payant).
// Les clés VAPID sont créées par le serveur à la première demande et gardées dans la base.
// Le texte de chaque notification est chiffré pour l'appareil (norme « aes128gcm », RFC 8291) : seul le téléphone le lit.
// Marche sur Android, ordinateur, et iPhone/iPad (appli sur l'écran d'accueil, iOS 16.4+).
"use strict";
const DAY = 864e5;
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const enc = new TextEncoder();
const unb64u = s => Uint8Array.from(atob(String(s).replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
const cat = (...a) => { const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for(const x of a){ out.set(x, i); i += x.length; } return out; };
async function hkdf(salt, ikm, info, len){
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({name: "HKDF", hash: "SHA-256", salt, info}, k, len * 8));
}
// Chiffre `text` pour l'abonnement (clés p256dh et auth du navigateur) → corps de la requête
async function encrypt(sub, text){
  const ua = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const as = await crypto.subtle.generateKey({name: "ECDH", namedCurve: "P-256"}, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", as.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", ua, {name: "ECDH", namedCurve: "P-256"}, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({name: "ECDH", public: uaKey}, as.privateKey, 256));
  const ikm = await hkdf(auth, shared, cat(enc.encode("WebPush: info\0"), ua, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({name: "AES-GCM", iv: nonce}, key, cat(enc.encode(text), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]);            // taille d'enregistrement : 4096
  return cat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}
// Envoie une notification {title, body, tag, url} à un abonnement ; → code HTTP du service de notifications
async function send(keys, sub, msg, {fetchFn = fetch, contact = "mailto:pasltempssav@gmail.com", ttl = 43200} = {}){
  const headers = {"Authorization": await vapidAuth(keys, sub.endpoint, contact), "TTL": String(ttl), "Urgency": "high"};
  let body;
  if(sub.keys && sub.keys.p256dh && sub.keys.auth){
    body = await encrypt(sub, JSON.stringify(msg));
    Object.assign(headers, {"Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream"});
  } else headers["Content-Length"] = "0";
  return (await fetchFn(sub.endpoint, {method: "POST", headers, body})).status;
}

// Messages du rappel tous les 3 jours
const NUDGES = {
  fr: ["T'as pas l'temps ? 20 minutes suffisent pour une vraie pause.", "Une pause café ? On te trouve un endroit juste à côté.",
       "Et si tu prenais l'air 20 minutes ?", "T'as une demi-heure ? Il y a sûrement un truc sympa près de toi.",
       "Petite pause aujourd'hui ? Ouvre Pas l'temps, on s'occupe du reste."],
  en: ["No time? 20 minutes is enough for a real break.", "Coffee break? We'll find a spot right around the corner.",
       "How about 20 minutes of fresh air?", "Got half an hour? There's surely something nice near you.",
       "A little break today? Open Pas l'temps, we'll handle the rest."]
};

// → {publicKey (base64url, 65 octets), privateJwk}
async function vapidKeys(store){
  const saved = await store.kvGet("vapid");
  if(saved) return JSON.parse(saved);
  const kp = await crypto.subtle.generateKey({name: "ECDSA", namedCurve: "P-256"}, true, ["sign", "verify"]);
  const keys = {publicKey: b64u(await crypto.subtle.exportKey("raw", kp.publicKey)), privateJwk: await crypto.subtle.exportKey("jwk", kp.privateKey)};
  await store.kvSet("vapid", JSON.stringify(keys));
  return JSON.parse(await store.kvGet("vapid"));   // si deux demandes se croisent, la première écrite gagne
}

// En-tête d'autorisation VAPID pour un service de notifications (jeton ES256 valable 12 h)
async function vapidAuth(keys, endpoint, contact){
  const aud = new URL(endpoint).origin;
  const part = o => b64u(enc.encode(JSON.stringify(o)));
  const unsigned = part({typ: "JWT", alg: "ES256"}) + "." + part({aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: contact});
  const key = await crypto.subtle.importKey("jwk", keys.privateJwk, {name: "ECDSA", namedCurve: "P-256"}, false, ["sign"]);
  const sig = await crypto.subtle.sign({name: "ECDSA", hash: "SHA-256"}, key, enc.encode(unsigned));
  return `vapid t=${unsigned}.${b64u(sig)}, k=${keys.publicKey}`;
}

// Prochain passage à `hour` (heure locale de l'appareil, décalage tz en minutes comme getTimezoneOffset), au moins `days` jours après `from`
function nextAt(from, hour, tz, days){
  const local = new Date(from - tz * 60000 + days * DAY);   // « heure locale » exprimée en UTC
  local.setUTCHours(hour, 0, 0, 0);
  return local.getTime() + tz * 60000;
}

// Envoie les rappels « tous les 3 jours » et les notifications du chrono arrivés à échéance ;
// les abonnements expirés (404/410) sont supprimés
async function runReminders(store, {fetchFn = fetch, now = Date.now(), contact = "mailto:pasltempssav@gmail.com", limit = 300} = {}){
  const due = await store.pushDue(now, limit), timers = await store.timersDue(now, limit);
  if(!due.length && !timers.length) return {sent: 0, removed: 0};
  const keys = await vapidKeys(store);
  let sent = 0, removed = 0;
  const go = async (endpoint, subJson, msg, ttl) => {
    let sub; try{ sub = JSON.parse(subJson); }catch(e){ return; }
    try{
      const st = await send(keys, sub, msg, {fetchFn, contact, ttl});
      if(st === 404 || st === 410){ await store.pushDel(endpoint); removed++; }
      else if(st >= 200 && st < 300) sent++;
    }catch(e){ /* réseau : tant pis pour celle-ci */ }
  };
  for(const t of timers){
    await store.timerDel(t.id);
    let msg; try{ msg = JSON.parse(t.payload); }catch(e){ continue; }
    await go(t.endpoint, t.sub, msg, 900);             // plus d'intérêt au-delà de 15 min
  }
  for(const s of due){
    let lang = "fr"; try{ lang = JSON.parse(s.sub).lang === "en" ? "en" : "fr"; }catch(e){}
    const list = NUDGES[lang];
    await go(s.endpoint, s.sub, {title: "Pas l'temps", body: list[Math.floor(Math.random() * list.length)], tag: "pasltemps-rappel", url: "./"}, 43200);
    await store.pushNext(s.endpoint, nextAt(now, s.hour, s.tz, s.every));
  }
  return {sent, removed};
}

// Message à tous les appareils abonnés (administration : test, annonce)
async function broadcast(store, msg, {fetchFn = fetch, contact = "mailto:pasltempssav@gmail.com"} = {}){
  const keys = await vapidKeys(store), subs = await store.pushAll(1000);
  let sent = 0, removed = 0, failed = 0;
  for(const s of subs){
    try{
      const st = await send(keys, JSON.parse(s.sub), msg, {fetchFn, contact, ttl: 3600});
      if(st === 404 || st === 410){ await store.pushDel(s.endpoint); removed++; }
      else if(st >= 200 && st < 300) sent++; else failed++;
    }catch(e){ failed++; }
  }
  return {subscribers: subs.length, sent, removed, failed};
}

module.exports = { vapidKeys, vapidAuth, nextAt, encrypt, send, runReminders, broadcast, NUDGES };
