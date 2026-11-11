// Fissa Fissa — notifications par créneau : midi, sortie du travail ou des cours, samedi matin, et tes habitudes.
// Habitudes : à chaque ouverture, on note SUR L'APPAREIL « case d'environ 500 m + heure ». Un même couple vu 3 jours
// différents → une notification environ 5 min avant ce créneau, avec si possible un lieu ouvert tout près.
// Vie privée : la position ne quitte jamais le téléphone. Le serveur reçoit seulement les heures prévues et la durée
// proposée ; le texte avec le lieu est écrit ici et gardé pour le service worker (IndexedDB), qui l'affiche.
// Limites (appliquées par le serveur) : 1 notification par jour, rien entre 21 h et 8 h, rien dans l'heure qui suit une ouverture.
// Debug (console, en local seulement) : NOTIF.simulate("midi" | "soir" | "samedi" | "habitude"), NOTIF.plan(), NOTIF.habits(), NOTIF.fakeHabit() ;
// ou ajoute ?notif=midi (etc.) à l'adresse de l'appli.
(function(){
  const KEY = "pasltemps.habits", CELL = 0.005, BUCKET = 30, KEEP_DAYS = 60;
  const DAY_MIN = 8 * 60, NIGHT_MIN = 21 * 60;
  // Créneaux par défaut selon le jour (0 = dimanche) : [créneau, minute de la journée, durée proposée]
  const DEFAULTS = [null, ["midi", 715, 30], ["soir", 1050, 45], ["midi", 715, 30], ["soir", 1050, 45], ["midi", 715, 30], ["samedi", 600, 60]];
  const on = () => SET.notif !== "off";

  // ---------- Habitudes (sur l'appareil seulement) ----------
  const load = () => { try{ const a = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(a) ? a : []; }catch(e){ return []; } };
  const save = a => { try{ localStorage.setItem(KEY, JSON.stringify(a.slice(-400))); }catch(e){} };
  const dayKey = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const cellOf = p => Math.floor(p.lat / CELL) + "_" + Math.floor(p.lng / CELL);
  const weekend = d => d.getDay() === 0 || d.getDay() === 6;
  const noted = new Set();   // une seule note par case et par ouverture de l'appli
  function note(p, when){
    if(!on() || !p) return;
    const c = cellOf(p); if(noted.has(c)) return; noted.add(c);
    when = when || new Date();
    const a = load().filter(h => Date.now() - h.at < KEEP_DAYS * 864e5);
    a.push({c, m: when.getHours() * 60 + when.getMinutes(), d: dayKey(when), we: weekend(when), at: when.getTime()});
    save(a);
  }
  // Même case, même demi-heure, au moins 3 jours différents → {c, n (jours), hm (heure moyenne − 5 min), we (semaine/week-end)}
  function habits(){
    const g = new Map();
    load().forEach(h => {
      const k = h.c + "|" + Math.floor(h.m / BUCKET), e = g.get(k) || {c: h.c, days: new Set(), ms: [], we: new Set()};
      e.days.add(h.d); e.ms.push(h.m); e.we.add(!!h.we); g.set(k, e);
    });
    return [...g.values()].filter(e => e.days.size >= 3)
      .map(e => ({c: e.c, n: e.days.size, hm: Math.round(e.ms.reduce((s, x) => s + x, 0) / e.ms.length) - 5, we: [...e.we]}))
      .filter(h => h.hm >= DAY_MIN && h.hm < NIGHT_MIN)
      .sort((a, b) => b.n - a.n);
  }

  // ---------- Calendrier des 7 prochains jours (au plus 1 par jour) ----------
  const usualT = () => [10, 20, 30, 45, 60, 90, 120].includes(+SET.time) ? +SET.time : 30;
  function plan(now){
    now = now || new Date();
    const hs = habits(), out = [];
    for(let i = 0; i < 7; i++){
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const h = hs.find(x => x.we.includes(weekend(d)));
      const pick = h ? {slot: "habitude", min: h.hm, t: usualT(), hm: h.hm} : DEFAULTS[d.getDay()] && {slot: DEFAULTS[d.getDay()][0], min: DEFAULTS[d.getDay()][1], t: DEFAULTS[d.getDay()][2]};
      if(!pick || pick.min < DAY_MIN || pick.min >= NIGHT_MIN) continue;
      const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(pick.min / 60), pick.min % 60).getTime();
      if(at < now.getTime() + 5 * 60e3) continue;
      out.push({at, slot: pick.slot, t: pick.t, ...(pick.hm != null ? {hm: pick.hm} : {})});
    }
    return out;
  }

  // ---------- Textes gardés pour le service worker (IndexedDB : il n'a pas accès au localStorage) ----------
  function idb(){
    return new Promise((ok, ko) => {
      const r = indexedDB.open("fissa-notif", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
    });
  }
  async function idbDo(mode, fn){
    const db = await idb();
    return new Promise((ok, ko) => { const tr = db.transaction("kv", mode), st = tr.objectStore("kv"), r = fn(st); tr.oncomplete = () => { db.close(); ok(r && r.result); }; tr.onerror = () => { db.close(); ko(tr.error); }; });
  }
  const idbSet = (k, v) => idbDo("readwrite", st => st.put(v, k)).catch(() => {});
  const idbClear = () => idbDo("readwrite", st => st.clear()).catch(() => {});
  // Pour chaque habitude de la case où l'on est : un lieu ouvert à cette heure-là, tout près, parmi les résultats affichés
  function writeHabitTexts(){
    if(!on() || !pos || typeof LOADED === "undefined") return;
    const here = cellOf(pos), items = Object.values(LOADED).flatMap(x => x && x.items || []);
    habits().filter(h => h.c === here).forEach(h => {
      const when = new Date(); when.setHours(Math.floor(h.hm / 60), h.hm % 60 + 5, 0, 0);
      const best = items.filter(p => p.name && p.walk <= 10 && (!p.oh || !window.HOURS || HOURS.at(p.oh, when).state === "open"))
        .sort((a, b) => (!!b.oh - !!a.oh) || a.walk - b.walk)[0];
      if(best) idbSet("hm:" + h.hm, tx("C'est bientôt ton moment habituel : {e} {n} est ouvert à {w} min d'ici. On y va ?", {e: best.em || "📍", n: best.name, w: best.walk}));
    });
  }

  // ---------- Envoi du calendrier au serveur (heures seulement) ----------
  async function sync(){
    try{
      if(!("serviceWorker" in navigator) || typeof PLT === "undefined") return;
      const reg = await navigator.serviceWorker.getRegistration(), sub = reg && reg.pushManager && await reg.pushManager.getSubscription();
      if(!sub) return;
      writeHabitTexts();
      await PLT.push.slots(sub.endpoint, new Date().getTimezoneOffset(), on() ? plan() : []);
    }catch(e){}
  }
  async function clear(){
    try{ localStorage.removeItem(KEY); }catch(e){}
    noted.clear(); await idbClear(); sync();
  }

  // ---------- Debug : afficher tout de suite une notification de créneau (même chemin que le service worker) ----------
  const SAMPLE = {midi: "{t} min devant toi ce midi ? Découvre ce qui est ouvert autour de toi !", soir: "Fini pour aujourd'hui ? {t} min pour souffler avant de rentrer ?",
    samedi: "Samedi matin ! Une heure devant toi ? On te trouve quoi faire près de chez toi.", habitude: "C'est ton moment habituel : {t} min devant toi ? Regarde ce qui est ouvert tout près."};
  async function simulate(slot){
    slot = SAMPLE[slot] ? slot : "midi";
    const t = slot === "habitude" ? usualT() : {midi: 30, soir: 45, samedi: 60}[slot], h = habits()[0];
    if(Notification.permission !== "granted" && await Notification.requestPermission() !== "granted") return "notifications refusées";
    writeHabitTexts();
    const reg = await navigator.serviceWorker.ready;
    const msg = {title: "Fissa Fissa", body: SAMPLE[slot].replace("{t}", t), tag: "pasltemps-creneau", url: "./?t=" + t, slot, t, hm: h ? h.hm : -1};
    (reg.active || navigator.serviceWorker.controller).postMessage({type: "simulate-push", msg});
    return msg;
  }
  // Debug : 3 passages ici (jours précédents), dans 10 min → une habitude repérée pour aujourd'hui
  function fakeHabit(){
    if(!pos) return "position inconnue";
    const now = new Date(), a = load();
    for(let i = 1; i <= 3; i++){
      const d = new Date(now.getTime() - i * 864e5 + 15 * 60e3);
      a.push({c: cellOf(pos), m: d.getHours() * 60 + d.getMinutes(), d: dayKey(d), we: weekend(now), at: d.getTime()});
    }
    save(a); writeHabitTexts(); sync();
    return habits();
  }

  window.NOTIF = {note, habits, plan, sync, clear, writeHabitTexts, count: () => habits().length};
  // Outils de test (simulate, fakeHabit, ?notif=midi) : seulement en local, jamais sur le site publié ni dans l'appli
  if(/^(localhost|127\.0\.0\.1)$/.test(location.hostname)){
    Object.assign(window.NOTIF, {simulate, fakeHabit});
    const dbg = new URLSearchParams(location.search).get("notif");
    if(dbg) setTimeout(() => simulate(dbg).then(r => console.log("NOTIF.simulate", r)), 3000);
  }
})();
