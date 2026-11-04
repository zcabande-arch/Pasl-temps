// Fissa Fissa — notifications « T'as l'temps ? » (Web Push, sans service payant).
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
  fr: ["T'as 20 minutes ? Une vraie pause, fissa fissa.", "Une pause café ? On te trouve un endroit juste à côté.",
       "Et si tu prenais l'air 20 minutes ?", "T'as une demi-heure ? Il y a sûrement un truc sympa près de toi.",
       "Petite pause aujourd'hui ? Ouvre Fissa Fissa, on s'occupe du reste."],
  en: ["Got 20 minutes? A real break, fissa fissa.", "Coffee break? We'll find a spot right around the corner.",
       "How about 20 minutes of fresh air?", "Got half an hour? There's surely something nice near you.",
       "A little break today? Open Fissa Fissa, we'll handle the rest."],
  es: ["¿Tienes 20 minutos? Una pausa de verdad, fissa fissa.", "¿Una pausa para un café? Te encontramos un sitio justo al lado.",
       "¿Y si tomas el aire 20 minutos?", "¿Tienes media hora? Seguro que hay algo chulo cerca de ti.",
       "¿Una pausita hoy? Abre Fissa Fissa, nosotros nos encargamos del resto."],
  de: ["20 Minuten frei? Eine echte Pause, fissa fissa.", "Kaffeepause? Wir finden dir einen Ort gleich um die Ecke.",
       "Wie wär's mit 20 Minuten frischer Luft?", "Eine halbe Stunde Zeit? In deiner Nähe gibt's bestimmt was Schönes.",
       "Kleine Pause heute? Öffne Fissa Fissa, wir kümmern uns um den Rest."],
  it: ["Hai 20 minuti? Una vera pausa, fissa fissa.", "Pausa caffè? Ti troviamo un posto proprio qui vicino.",
       "E se prendessi un po' d'aria per 20 minuti?", "Hai mezz'ora? Di sicuro c'è qualcosa di bello vicino a te.",
       "Una pausa oggi? Apri Fissa Fissa, al resto pensiamo noi."],
  pt: ["Tem 20 minutos? Uma pausa de verdade, fissa fissa.", "Pausa pro café? A gente acha um lugar bem pertinho.",
       "Que tal 20 minutos de ar livre?", "Tem meia hora? Com certeza tem algo legal perto de você.",
       "Uma pausinha hoje? Abra Fissa Fissa, a gente cuida do resto."],
  nl: ["20 minuten? Een echte pauze, fissa fissa.", "Koffiepauze? We vinden een plekje vlak om de hoek.",
       "Wat dacht je van 20 minuten frisse lucht?", "Half uurtje? Er is vast iets leuks bij jou in de buurt.",
       "Even pauze vandaag? Open Fissa Fissa, wij regelen de rest."]
};

// Notifications par créneau : le texte varie selon le moment. {t} = durée proposée (minutes).
// « habitude » : texte de secours ; le téléphone le remplace par un lieu ouvert près de chez lui (service worker),
// sans que le serveur ne connaisse ni le lieu ni la position.
const SLOT_KINDS = ["midi", "soir", "samedi", "habitude"];
const SLOTS = {
  fr: {midi: ["{t} min devant toi ce midi ? Découvre ce qui est ouvert autour de toi !", "Pause déj' ? En {t} min, on te trouve un coin sympa tout près."],
       soir: ["Fini pour aujourd'hui ? {t} min pour souffler avant de rentrer ?", "Sortie du boulot ou des cours : un petit détour de {t} min ?"],
       samedi: ["Samedi matin ! Une heure devant toi ? On te trouve quoi faire près de chez toi.", "C'est samedi : un marché, un café, un parc ? Regarde ce qui est ouvert."],
       habitude: ["C'est ton moment habituel : {t} min devant toi ? Regarde ce qui est ouvert tout près."]},
  en: {midi: ["{t} min free this lunchtime? See what's open around you!", "Lunch break? In {t} min we'll find you a nice spot nearby."],
       soir: ["Done for the day? {t} min to unwind before heading home?", "Leaving work or class: a little {t}-min detour?"],
       samedi: ["Saturday morning! An hour to spare? We'll find something to do near you.", "It's Saturday: a market, a café, a park? See what's open."],
       habitude: ["It's your usual moment: {t} min free? See what's open nearby."]},
  es: {midi: ["¿{t} min libres este mediodía? ¡Descubre qué está abierto a tu alrededor!", "¿Pausa para comer? En {t} min te encontramos un sitio chulo cerca."],
       soir: ["¿Terminaste por hoy? ¿{t} min para desconectar antes de volver?", "Saliendo del trabajo o de clase: ¿un desvío de {t} min?"],
       samedi: ["¡Sábado por la mañana! ¿Una hora libre? Te encontramos un plan cerca de casa.", "Es sábado: ¿un mercado, un café, un parque? Mira qué está abierto."],
       habitude: ["Es tu momento de siempre: ¿{t} min libres? Mira qué está abierto cerca."]},
  de: {midi: ["{t} Min. Zeit heute Mittag? Entdecke, was in deiner Nähe offen hat!", "Mittagspause? In {t} Min. finden wir dir einen schönen Ort ganz in der Nähe."],
       soir: ["Feierabend? {t} Min. zum Durchatmen, bevor du heimgehst?", "Nach Arbeit oder Uni: ein kleiner Umweg von {t} Min.?"],
       samedi: ["Samstagmorgen! Eine Stunde Zeit? Wir finden etwas in deiner Nähe.", "Es ist Samstag: ein Markt, ein Café, ein Park? Schau, was offen hat."],
       habitude: ["Dein üblicher Moment: {t} Min. Zeit? Schau, was in der Nähe offen hat."]},
  it: {midi: ["{t} min liberi a pranzo? Scopri cosa è aperto intorno a te!", "Pausa pranzo? In {t} min ti troviamo un bel posto vicino."],
       soir: ["Finito per oggi? {t} min per rilassarti prima di tornare a casa?", "Uscita dal lavoro o dalle lezioni: una deviazione di {t} min?"],
       samedi: ["Sabato mattina! Un'ora libera? Ti troviamo cosa fare vicino a casa.", "È sabato: un mercato, un caffè, un parco? Guarda cosa è aperto."],
       habitude: ["È il tuo solito momento: {t} min liberi? Guarda cosa è aperto qui vicino."]},
  pt: {midi: ["{t} min livres neste almoço? Descobre o que está aberto à tua volta!", "Pausa para almoço? Em {t} min encontramos um sítio giro perto de ti."],
       soir: ["Acabou por hoje? {t} min para descontrair antes de ir para casa?", "Saída do trabalho ou das aulas: um desvio de {t} min?"],
       samedi: ["Sábado de manhã! Uma hora livre? Encontramos o que fazer perto de ti.", "É sábado: um mercado, um café, um parque? Vê o que está aberto."],
       habitude: ["É o teu momento habitual: {t} min livres? Vê o que está aberto perto."]},
  nl: {midi: ["{t} min vrij deze middag? Ontdek wat er open is bij jou in de buurt!", "Lunchpauze? In {t} min vinden we een leuk plekje vlakbij."],
       soir: ["Klaar voor vandaag? {t} min om te ontspannen voor je naar huis gaat?", "Op weg van werk of school: een omweg van {t} min?"],
       samedi: ["Zaterdagochtend! Een uurtje vrij? We vinden iets te doen bij jou in de buurt.", "Het is zaterdag: een markt, een café, een park? Kijk wat er open is."],
       habitude: ["Je vaste moment: {t} min vrij? Kijk wat er open is vlakbij."]}
};
const slotText = (lang, slot, t) => { const l = (SLOTS[lang] || SLOTS.fr)[slot] || SLOTS.fr.midi; return l[Math.floor(Math.random() * l.length)].replace("{t}", t); };
// Jour et minute de la journée à l'heure locale de l'appareil (tz : décalage comme getTimezoneOffset)
const localDay = (at, tz) => new Date(at - tz * 60000).toISOString().slice(0, 10);
const localMin = (at, tz) => { const d = new Date(at - tz * 60000); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
const QUIET_FROM = 21 * 60, QUIET_TO = 8 * 60;      // rien entre 21 h et 8 h
const quiet = (at, tz) => { const m = localMin(at, tz); return m >= QUIET_FROM || m < QUIET_TO; };

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
  const due = await store.pushDue(now, limit), timers = await store.timersDue(now, limit), slots = await store.slotsDue(now, limit);
  if(!due.length && !timers.length && !slots.length) return {sent: 0, removed: 0};
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
  // Limites communes aux créneaux et au rappel : 1 par jour, rien la nuit, rien si l'appli a été ouverte dans l'heure
  const blocked = async (endpoint, tz) => {
    const st = await store.pushState(endpoint);
    return quiet(now, tz) || st.day === localDay(now, tz) || now - st.seen < 3600e3;
  };
  for(const t of slots){
    await store.slotDel(t.id);
    if(now - t.at > 15 * 60e3 || await blocked(t.endpoint, t.tz)) continue;   // trop tard, ou limite atteinte
    let lang = "fr"; try{ lang = JSON.parse(t.sub).lang; }catch(e){}
    await go(t.endpoint, t.sub, {title: "Fissa Fissa", body: slotText(lang, t.slot, t.minutes), tag: "pasltemps-creneau",
      url: "./?t=" + t.minutes, slot: t.slot, t: t.minutes, hm: t.hm}, 1800);
    await store.pushDay(t.endpoint, localDay(now, t.tz));
  }
  for(const s of due){
    let lang = "fr"; try{ lang = JSON.parse(s.sub).lang; }catch(e){}
    if(!NUDGES[lang]) lang = "fr";
    const list = NUDGES[lang];
    await store.pushNext(s.endpoint, nextAt(now, s.hour, s.tz, s.every));
    if(await blocked(s.endpoint, s.tz)) continue;
    await go(s.endpoint, s.sub, {title: "Fissa Fissa", body: list[Math.floor(Math.random() * list.length)], tag: "pasltemps-rappel", url: "./"}, 43200);
    await store.pushDay(s.endpoint, localDay(now, s.tz));
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

module.exports = { vapidKeys, vapidAuth, nextAt, encrypt, send, runReminders, broadcast, NUDGES, SLOTS, SLOT_KINDS, localDay, localMin, quiet };
