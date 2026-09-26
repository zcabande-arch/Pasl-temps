// Pas l'temps — notifications « T'as l'temps ? » (Web Push, sans service payant).
// Les clés VAPID sont créées par le serveur à la première demande et gardées dans la base.
// On envoie des notifications SANS contenu (pas de chiffrement à faire) : le service worker de l'appli
// affiche lui-même le message. Marche sur Android, ordinateur, et iPhone/iPad (appli sur l'écran d'accueil, iOS 16.4+).
"use strict";
const DAY = 864e5;
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const enc = new TextEncoder();

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

// Envoie les rappels arrivés à échéance ; les abonnements expirés (404/410) sont supprimés
async function runReminders(store, {fetchFn = fetch, now = Date.now(), contact = "mailto:pasltempssav@gmail.com", limit = 300} = {}){
  const due = await store.pushDue(now, limit);
  if(!due.length) return {sent: 0, removed: 0};
  const keys = await vapidKeys(store);
  let sent = 0, removed = 0;
  for(const s of due){
    try{
      const r = await fetchFn(s.endpoint, {method: "POST", headers: {"Authorization": await vapidAuth(keys, s.endpoint, contact), "TTL": "43200", "Urgency": "normal", "Content-Length": "0"}});
      if(r.status === 404 || r.status === 410){ await store.pushDel(s.endpoint); removed++; continue; }
      if(r.ok) sent++;
    }catch(e){ /* réseau : on retentera au prochain passage */ }
    await store.pushNext(s.endpoint, nextAt(now, s.hour, s.tz, s.every));
  }
  return {sent, removed};
}

module.exports = { vapidKeys, vapidAuth, nextAt, runReminders };
