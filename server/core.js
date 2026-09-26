// Pas l'temps — l'API, indépendante de la plateforme.
// Utilisée par le serveur Node (server/server.js) et par Cloudflare Workers (worker/index.js).
// Le stockage peut être synchrone (SQLite) ou asynchrone (D1) : on attend toujours ses réponses.
"use strict";

// Tailles maximales d'un document, selon son chemin
const LIMITS = { walls: 400_000, photos: 150_000, backups: 1_500_000, data: 300_000 };
const MAX_BODY = 1_600_000;
// Cibles de signalement : post:<uid>:<id>, comment:<uid>:<id>, user:<uid>
const TARGET = /^(post|comment):[A-Za-z0-9_-]{1,80}:[A-Za-z0-9_-]{1,80}$|^user:[A-Za-z0-9_-]{1,80}$/;
const REASONS = ["spam", "insulte", "inapproprie", "faux", "autre"];

// ---------- Règles d'accès ----------
// walls/<uid>                   : lisible par tous, modifiable par son propriétaire
// walls/<uid>/photos/<id>       : idem
// data/users/<uid>/...          : privé
// backups/<hash du code>        : lisible et modifiable par qui connaît le code (contenu chiffré côté client)
const SEG = /^[A-Za-z0-9_-]{1,80}$/;
function parsePath(p){
  if(typeof p !== "string") return null;
  const s = p.split("/");
  return s.length && s.length <= 8 && s.every(x => SEG.test(x)) ? s : null;
}
function rule(segs, uid, isList){
  const n = segs.length;
  if(segs[0] === "walls"){
    if(isList) return n === 1 || (n === 3 && segs[2] === "photos") ? {read:true, write:false} : null;
    if(n === 2) return {read:true, write:segs[1] === uid, limit:LIMITS.walls};
    if(n === 4 && segs[2] === "photos") return {read:true, write:segs[1] === uid, limit:LIMITS.photos};
    return null;
  }
  if(segs[0] === "data" && segs[1] === "users" && n >= 3){
    const own = segs[2] === uid;
    if(isList) return n >= 4 ? {read:own, write:false} : null;
    return n >= 4 ? {read:own, write:own, limit:LIMITS.data} : null;
  }
  if(segs[0] === "backups"){
    if(isList) return null;               // on ne liste jamais les sauvegardes
    return n === 2 && segs[1].length >= 32 ? {read:true, write:true, limit:LIMITS.backups} : null;
  }
  return null;
}

// ---------- Limite de débit (en mémoire) ----------
const buckets = new Map();
let calls = 0;
function allow(key, cost, cap = 240, refill = 2){ // par défaut 240 jetons, 2/s
  const now = Date.now();
  if(++calls % 1000 === 0){ const old = now - 600_000; for(const [k, b] of buckets) if(b.at < old) buckets.delete(k); }
  let b = buckets.get(key);
  if(!b){ b = {t:cap, at:now}; buckets.set(key, b); }
  b.t = Math.min(cap, b.t + (now - b.at) / 1000 * refill); b.at = now;
  if(b.t < cost) return false;
  b.t -= cost; return true;
}

// ---------- Utilitaires ----------
const enc = new TextEncoder();
async function sha(s){
  const h = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return Array.from(new Uint8Array(h), x => x.toString(16).padStart(2, "0")).join("");
}
function randomId(bytes){
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const isObj = v => v && typeof v === "object" && !Array.isArray(v);
const ok = body => ({status:200, body});
const fail = (status, error) => ({status, body:{error}});

const { loginMail } = require("./mail");
const push = require("./push");
const EMAIL = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,190}\.[A-Za-z]{2,24}$/;
const LOGIN_TTL = 20 * 60_000;
// Adresses où l'appli est servie : le lien de l'e-mail ne peut ramener que vers l'une d'elles
const DEFAULT_ORIGINS = ["https://zcabande-arch.github.io"];

// opts : {adminToken, reportThreshold, rateLimit, sendMail({to, subject, html, text}), appOrigins: [origines autorisées]}
// req  : {method, url (URL), header(nom) → valeur, ip, json() → corps JSON (rejette {code})}
// → {status, body}
function createApi(store, opts = {}){
  const threshold = opts.reportThreshold || 3;
  const admin = opts.adminToken || "";
  const limited = (key, cost, cap, refill) => opts.rateLimit === false || allow(key, cost, cap, refill);
  const isAdmin = req => !!admin && req.header("x-admin-token") === admin;
  async function whoIs(req){
    const m = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(req.header("authorization") || "");
    return m ? store.userFor(await sha(m[1])) : null;
  }
  async function body(req){
    try{ return {value: await req.json()}; }catch(e){ return {error: fail(e && e.code === 413 ? 413 : 400, "bad_body")}; }
  }

  return async function handle(req){
    const {method, url} = req, path = url.pathname;
    const write = method !== "GET";
    if(!limited(req.ip, write ? 4 : 1)) return fail(429, "rate_limited");

    if(path === "/api/health") return ok({ok:true, app:"pasltemps"});

    // ---------- Connexion par e-mail ----------
    // 1. l'appli demande un lien pour une adresse ; 2. le lien de l'e-mail ramène à l'appli avec #login=<jeton> ;
    // 3. l'appli échange ce jeton contre une session du compte (créé à la première connexion).
    if(path === "/api/login/start" && method === "POST"){
      if(!opts.sendMail) return fail(503, "mail_unavailable");
      const b = await body(req); if(b.error) return b.error;
      const email = String(b.value && b.value.email || "").trim().toLowerCase();
      if(!EMAIL.test(email)) return fail(400, "bad_email");
      // 5 demandes par heure et par adresse IP, 3 par heure et par adresse e-mail
      if(!limited("mailip:" + req.ip, 1, 5, 5 / 3600) || !limited("mail:" + email, 1, 3, 3 / 3600)) return fail(429, "rate_limited");
      let back;
      try{ back = new URL(String(b.value.back || "")); }catch(e){ return fail(400, "bad_back"); }
      const origins = opts.appOrigins || DEFAULT_ORIGINS;
      if(!origins.includes(back.origin)) return fail(400, "bad_back");
      const token = randomId(24);
      await store.addLogin(await sha(token), email, Date.now() + LOGIN_TTL);
      back.hash = "login=" + token;
      // … et un code à 6 chiffres, à taper dans l'appli installée (l'iPhone ouvre le lien dans Safari, pas dans l'appli)
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
      await store.setCode(email, await sha(email + ":" + code), Date.now() + LOGIN_TTL);
      const m = loginMail(back.href, b.value.lang === "en" ? "en" : "fr", code);
      try{ await opts.sendMail({to: email, ...m}); }
      catch(e){ console.error(e); return fail(502, "mail_failed"); }
      return ok({ok:true});
    }
    if(path === "/api/login/verify" && method === "POST"){
      if(!limited("verify:" + req.ip, 1, 20, 20 / 3600)) return fail(429, "rate_limited");
      const b = await body(req); if(b.error) return b.error;
      let email;
      if(b.value && b.value.code != null){
        // Code à 6 chiffres + adresse
        email = String(b.value.email || "").trim().toLowerCase();
        const code = String(b.value.code).replace(/\s/g, "");
        if(!EMAIL.test(email) || !/^\d{6}$/.test(code)) return fail(400, "bad_code");
        const c = await store.getCode(email);
        if(!c || c.expires < Date.now() || c.tries >= 5) return fail(400, "expired");
        if(c.hash !== await sha(email + ":" + code)){ await store.codeTry(email); return fail(400, c.tries >= 4 ? "expired" : "bad_code"); }
        await store.delCode(email);
      } else {
        const token = String(b.value && b.value.token || "");
        if(!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return fail(400, "bad_token");
        email = await store.takeLogin(await sha(token));
        if(!email) return fail(400, "expired");
        await store.delCode(email);
      }
      let uid = await store.accountUid(email);
      if(!uid){
        // Première connexion : le compte de cet appareil (s'il en a un, pas encore relié) devient celui de l'adresse
        const device = await whoIs(req);
        uid = device && !(await store.accountEmail(device)) ? device : "u" + randomId(9).replace(/[^A-Za-z0-9]/g, "x");
        await store.addAccount(email, uid);
      }
      const session = randomId(24);
      await store.addSession(uid, await sha(session));
      return ok({uid, token: session, email});
    }

    if(path === "/api/session" && method === "POST"){
      // Création de compte : 30 d'un coup par adresse, puis 1 toutes les 10 s (familles, bureaux derrière une même box)
      if(!limited("session:" + req.ip, 1, 30, 0.1)) return fail(429, "rate_limited");
      const token = randomId(24);
      const uid = "u" + randomId(9).replace(/[^A-Za-z0-9]/g, "x");
      await store.addUser(uid, await sha(token));
      return ok({uid, token});
    }

    // Clé publique des notifications (créée à la première demande)
    if(path === "/api/push/key" && method === "GET") return ok({key: (await push.vapidKeys(store)).publicKey});

    // Contenus masqués par la modération (public)
    if(path === "/api/hidden" && method === "GET") return ok({targets: await store.hidden()});

    // Espace modération : réservé à qui connaît le code administrateur
    if(path.startsWith("/api/admin/")){
      if(!isAdmin(req)) return fail(403, "forbidden");
      if(path === "/api/admin/reports" && method === "GET"){
        // Joint un aperçu du contenu signalé pour pouvoir décider
        const reports = await Promise.all((await store.reports()).map(async r => {
          const [kind, owner, id] = r.target.split(":"), w = (await store.get("walls/" + owner)) || {};
          const item = kind === "post" ? (w.posts || []).find(p => p.id === id) : kind === "comment" ? (w.comments || []).find(c => c.id === id) : null;
          return {...r, owner, author: w.pseudo || "", preview: item ? [item.place, item.text].filter(Boolean).join(" — ").slice(0, 300) : kind === "user" ? "(profil)" : "(supprimé)"};
        }));
        return ok({reports, threshold});
      }
      const b = await body(req); if(b.error) return b.error;
      const target = b.value && b.value.target;
      if(path === "/api/admin/hide" && TARGET.test(target || "")){ await store.hide(target, "admin"); return ok({ok:true}); }
      if(path === "/api/admin/unhide" && TARGET.test(target || "")){ await store.unhide(target); await store.clearReports(target); return ok({ok:true}); }
      if(path === "/api/admin/ban" && /^[A-Za-z0-9_-]{1,80}$/.test(b.value && b.value.uid || "")){
        const uid = b.value.uid;
        await store.ban(uid); await store.hide("user:" + uid, "admin"); await store.del("walls/" + uid);
        return ok({ok:true});
      }
      return fail(400, "bad_request");
    }

    const uid = await whoIs(req);
    if(!uid) return fail(401, "unauthenticated");

    // Rappels « T'as l'temps ? » : s'abonner (heure locale, tous les N jours) ou se désabonner
    if(path === "/api/push/subscribe" && method === "POST"){
      if(!limited("push:" + uid, 1, 20, 20 / 3600)) return fail(429, "rate_limited");
      const b = await body(req); if(b.error) return b.error;
      const v = b.value || {}, sub = v.subscription || {};
      let ep; try{ ep = new URL(sub.endpoint); }catch(e){ return fail(400, "bad_subscription"); }
      if(ep.protocol !== "https:" || String(sub.endpoint).length > 800) return fail(400, "bad_subscription");
      const hour = Math.min(22, Math.max(7, Math.round(+v.hour) || 12));
      const tz = Math.min(840, Math.max(-840, Math.round(+v.tz) || 0));
      const every = Math.min(14, Math.max(1, Math.round(+v.every) || 3));
      if(!isObj(sub.keys) || typeof sub.keys.p256dh !== "string" || typeof sub.keys.auth !== "string") return fail(400, "bad_subscription");
      const saved = JSON.stringify({endpoint: sub.endpoint, keys: {p256dh: sub.keys.p256dh.slice(0, 200), auth: sub.keys.auth.slice(0, 100)}, lang: v.lang === "en" ? "en" : "fr"});
      // premier abonnement : rappel dans 3 jours ; ensuite le rythme continue (le serveur garde la date prévue)
      await store.pushSet(sub.endpoint, uid, saved, hour, tz, every, push.nextAt(Date.now(), hour, tz, every));
      return ok({ok:true});
    }
    // Chrono « Je pars » : notifications à heure fixe (c'est l'heure de repartir, temps écoulé) ; liste vide = annuler
    if(path === "/api/push/timer" && method === "POST"){
      if(!limited("timer:" + uid, 1, 30, 30 / 3600)) return fail(429, "rate_limited");
      const b = await body(req); if(b.error) return b.error;
      const v = b.value || {};
      if(typeof v.endpoint !== "string" || (await store.pushOwner(v.endpoint)) !== uid) return fail(403, "forbidden");
      const now = Date.now(), list = (Array.isArray(v.events) ? v.events : []).slice(0, 4)
        .filter(e => isObj(e) && Number.isFinite(+e.at) && +e.at > now - 60e3 && +e.at < now + 6 * 3600e3)
        .map(e => ({at: +e.at, payload: JSON.stringify({title: String(e.title || "Pas l'temps").slice(0, 80), body: String(e.body || "").slice(0, 200), tag: "pasltemps-chrono", url: "./"})}));
      await store.timersSet(v.endpoint, list);
      return ok({ok:true, count: list.length});
    }
    if(path === "/api/push/unsubscribe" && method === "POST"){
      const b = await body(req); if(b.error) return b.error;
      if(b.value && typeof b.value.endpoint === "string") await store.pushDel(b.value.endpoint);
      return ok({ok:true});
    }

    // Le compte de cette session : adresse e-mail reliée, ou suppression complète (données comprises)
    if(path === "/api/account"){
      if(method === "GET") return ok({email: await store.accountEmail(uid)});
      if(method === "DELETE"){
        await store.del("data/users/" + uid); await store.del("walls/" + uid);
        await store.deleteAccount(uid);
        return ok({ok:true});
      }
      return fail(405, "method");
    }

    if(path === "/api/report" && method === "POST"){
      if(!limited("report:" + uid, 1, 20, 20 / 3600)) return fail(429, "rate_limited"); // 20 signalements par heure
      const b = await body(req); if(b.error) return b.error;
      const target = b.value && b.value.target, reason = b.value && b.value.reason;
      if(!TARGET.test(target || "") || !REASONS.includes(reason)) return fail(400, "bad_report");
      if(target.split(":")[1] === uid) return fail(400, "own_content");
      const n = await store.report(target, uid, reason);
      if(n >= threshold) await store.hide(target, "auto");
      return ok({ok:true});
    }

    if(path === "/api/doc"){
      const segs = parsePath(url.searchParams.get("path"));
      const r = segs && rule(segs, uid, false);
      if(!r) return fail(400, "bad_path");
      const p = segs.join("/");
      if(method === "GET"){
        if(!r.read) return fail(403, "forbidden");
        const d = await store.get(p);
        return ok(d ? {exists:true, data:d} : {exists:false});
      }
      if(!r.write) return fail(403, "forbidden");
      if(segs[0] === "walls"){
        if(await store.isBanned(uid)) return fail(403, "banned");
        if(!limited("walls:" + uid, 1, 30, 0.5)) return fail(429, "rate_limited"); // 30 d'un coup, puis 1 toutes les 2 s
      }
      if(method === "DELETE"){ await store.del(p); return ok({ok:true}); }
      const b = await body(req); if(b.error) return b.error;
      let data = b.value;
      if(!isObj(data)) return fail(400, "bad_body");
      if(method === "PATCH"){
        const cur = await store.get(p);
        if(!cur) return fail(404, "not_found");
        data = {...cur, ...data};
      } else if(method !== "PUT") return fail(405, "method");
      if(segs[0] === "walls" && segs.length === 2){
        const tooMany = (k, n) => data[k] !== undefined && (!Array.isArray(data[k]) || data[k].length > n);
        if(tooMany("posts", 60) || tooMany("comments", 100)) return fail(400, "bad_body");
      }
      const json = JSON.stringify(data);
      if(json.length > r.limit) return fail(413, "too_large");
      await store.set(p, json, data.at ?? data.updatedAt);
      return ok({ok:true});
    }

    if(path === "/api/list" && method === "GET"){
      const segs = parsePath(url.searchParams.get("path"));
      const r = segs && rule(segs, uid, true);
      if(!r) return fail(400, "bad_path");
      if(!r.read) return fail(403, "forbidden");
      const limit = Math.max(1, Math.min(500, +url.searchParams.get("limit") || 300));
      const desc = url.searchParams.get("dir") !== "asc";
      return ok({docs: await store.list(segs.join("/"), desc, limit)});
    }

    return fail(404, "not_found");
  };
}

// En-têtes communs : l'appli peut être servie ailleurs (ex. GitHub Pages), on autorise donc les autres origines.
// L'authentification passe par un jeton dans l'en-tête, jamais par cookie.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, PATCH, DELETE, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Admin-Token",
  "Access-Control-Max-Age": "86400"
};

module.exports = { createApi, rule, parsePath, CORS, MAX_BODY };
