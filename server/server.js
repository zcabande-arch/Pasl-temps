// Pas l'temps — serveur : fichiers de l'appli + petite base de documents (SQLite).
// Aucune dépendance : Node.js 22.13+ suffit.
"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { openStore } = require("./store");

const PORT = +process.env.PORT || 8080;
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml",
  ".png": "image/png", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8"
};

// Tailles maximales d'un document, selon son chemin
const LIMITS = { walls: 400_000, photos: 150_000, backups: 1_500_000, data: 300_000 };
const MAX_BODY = 1_600_000;
// Modération : un contenu signalé par REPORT_THRESHOLD personnes différentes est masqué automatiquement.
const REPORT_THRESHOLD = +process.env.REPORT_THRESHOLD || 3;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
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

// ---------- Limite de débit (par IP) ----------
const buckets = new Map();
function allow(key, cost, cap = 240, refill = 2){ // par défaut 240 jetons, 2/s
  const now = Date.now();
  let b = buckets.get(key);
  if(!b){ b = {t:cap, at:now}; buckets.set(key, b); }
  b.t = Math.min(cap, b.t + (now - b.at) / 1000 * refill); b.at = now;
  if(b.t < cost) return false;
  b.t -= cost; return true;
}
setInterval(() => { const old = Date.now() - 600_000; for(const [k,b] of buckets) if(b.at < old) buckets.delete(k); }, 300_000).unref();

// ---------- Utilitaires HTTP ----------
function send(res, code, body, headers){
  const data = body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(data);
}
const fail = (res, code, error) => send(res, code, {error});
function readBody(req){
  return new Promise((ok, ko) => {
    let size = 0; const chunks = [];
    req.on("data", c => { size += c.length; if(size > MAX_BODY){ ko({code:413}); req.destroy(); } else chunks.push(c); });
    req.on("end", () => {
      if(!size) return ok(null);
      try{ ok(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }catch(e){ ko({code:400}); }
    });
    req.on("error", ko);
  });
}
const sha = s => crypto.createHash("sha256").update(s).digest("hex");
const isObj = v => v && typeof v === "object" && !Array.isArray(v);

function createServer(store, opts = {}){
  const limited = (key, cost, cap, refill) => opts.rateLimit === false || allow(key, cost, cap, refill);
  const admin = opts.adminToken ?? ADMIN_TOKEN;
  const isAdmin = req => !!admin && req.headers["x-admin-token"] === admin;
  function whoIs(req){
    const m = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(req.headers.authorization || "");
    return m ? store.userFor(sha(m[1])) : null;
  }

  async function api(req, res, url){
    const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress || "?";
    const write = req.method !== "GET";
    if(!limited(ip, write ? 4 : 1)) return fail(res, 429, "rate_limited");

    if(url.pathname === "/api/health") return send(res, 200, {ok:true, app:"pasltemps"});

    if(url.pathname === "/api/session" && req.method === "POST"){
      if(!limited(ip, 30)) return fail(res, 429, "rate_limited");
      const token = crypto.randomBytes(24).toString("base64url");
      const uid = "u" + crypto.randomBytes(9).toString("base64url").replace(/[^A-Za-z0-9]/g, "x");
      store.addUser(uid, sha(token));
      return send(res, 200, {uid, token});
    }

    // Contenus masqués par la modération (public)
    if(url.pathname === "/api/hidden" && req.method === "GET") return send(res, 200, {targets: store.hidden()});

    // Espace modération : réservé à qui connaît ADMIN_TOKEN
    if(url.pathname.startsWith("/api/admin/")){
      if(!isAdmin(req)) return fail(res, 403, "forbidden");
      if(url.pathname === "/api/admin/reports" && req.method === "GET"){
        // Joint un aperçu du contenu signalé pour pouvoir décider
        const reports = store.reports().map(r => {
          const [kind, owner, id] = r.target.split(":"), w = store.get("walls/" + owner) || {};
          const item = kind === "post" ? (w.posts || []).find(p => p.id === id) : kind === "comment" ? (w.comments || []).find(c => c.id === id) : null;
          return {...r, owner, author: w.pseudo || "", preview: item ? [item.place, item.text].filter(Boolean).join(" — ").slice(0, 300) : kind === "user" ? "(profil)" : "(supprimé)"};
        });
        return send(res, 200, {reports, threshold: REPORT_THRESHOLD});
      }
      let body; try{ body = await readBody(req); }catch(e){ return fail(res, 400, "bad_body"); }
      const target = body && body.target;
      if(url.pathname === "/api/admin/hide" && TARGET.test(target || "")){ store.hide(target, "admin"); return send(res, 200, {ok:true}); }
      if(url.pathname === "/api/admin/unhide" && TARGET.test(target || "")){ store.unhide(target); store.clearReports(target); return send(res, 200, {ok:true}); }
      if(url.pathname === "/api/admin/ban" && /^[A-Za-z0-9_-]{1,80}$/.test(body && body.uid || "")){
        store.ban(body.uid); store.hide("user:" + body.uid, "admin"); store.del("walls/" + body.uid);
        return send(res, 200, {ok:true});
      }
      return fail(res, 400, "bad_request");
    }

    const uid = whoIs(req);
    if(!uid) return fail(res, 401, "unauthenticated");

    if(url.pathname === "/api/report" && req.method === "POST"){
      if(!limited("report:" + uid, 1, 20, 20 / 3600)) return fail(res, 429, "rate_limited"); // 20 signalements par heure
      let body; try{ body = await readBody(req); }catch(e){ return fail(res, 400, "bad_body"); }
      const target = body && body.target, reason = body && body.reason;
      if(!TARGET.test(target || "") || !REASONS.includes(reason)) return fail(res, 400, "bad_report");
      if(target.split(":")[1] === uid) return fail(res, 400, "own_content");
      const n = store.report(target, uid, reason);
      if(n >= REPORT_THRESHOLD) store.hide(target, "auto");
      return send(res, 200, {ok:true});
    }

    if(url.pathname === "/api/doc"){
      const segs = parsePath(url.searchParams.get("path"));
      const r = segs && rule(segs, uid, false);
      if(!r) return fail(res, 400, "bad_path");
      const p = segs.join("/");
      if(req.method === "GET"){
        if(!r.read) return fail(res, 403, "forbidden");
        const d = store.get(p);
        return send(res, 200, d ? {exists:true, data:d} : {exists:false});
      }
      if(!r.write) return fail(res, 403, "forbidden");
      if(segs[0] === "walls"){
        if(store.isBanned(uid)) return fail(res, 403, "banned");
        if(!limited("walls:" + uid, 1, 30, 0.5)) return fail(res, 429, "rate_limited"); // 30 d'un coup, puis 1 toutes les 2 s
      }
      if(req.method === "DELETE"){ store.del(p); return send(res, 200, {ok:true}); }
      let body;
      try{ body = await readBody(req); }catch(e){ return fail(res, e.code || 400, "bad_body"); }
      if(!isObj(body)) return fail(res, 400, "bad_body");
      if(req.method === "PATCH"){
        const cur = store.get(p);
        if(!cur) return fail(res, 404, "not_found");
        body = {...cur, ...body};
      } else if(req.method !== "PUT") return fail(res, 405, "method");
      if(segs[0] === "walls" && segs.length === 2){
        const tooMany = (k, n) => body[k] !== undefined && (!Array.isArray(body[k]) || body[k].length > n);
        if(tooMany("posts", 60) || tooMany("comments", 100)) return fail(res, 400, "bad_body");
      }
      const json = JSON.stringify(body);
      if(json.length > r.limit) return fail(res, 413, "too_large");
      store.set(p, json, body.at ?? body.updatedAt);
      return send(res, 200, {ok:true});
    }

    if(url.pathname === "/api/list" && req.method === "GET"){
      const segs = parsePath(url.searchParams.get("path"));
      const r = segs && rule(segs, uid, true);
      if(!r) return fail(res, 400, "bad_path");
      if(!r.read) return fail(res, 403, "forbidden");
      const limit = Math.max(1, Math.min(500, +url.searchParams.get("limit") || 300));
      const desc = url.searchParams.get("dir") !== "asc";
      return send(res, 200, {docs: store.list(segs.join("/"), desc, limit)});
    }

    return fail(res, 404, "not_found");
  }

  function serveStatic(req, res, url){
    if(req.method !== "GET" && req.method !== "HEAD") return fail(res, 405, "method");
    let rel;
    try{ rel = decodeURIComponent(url.pathname); }catch(e){ return fail(res, 400, "bad_path"); }
    if(rel.endsWith("/")) rel += "index.html";
    const file = path.normalize(path.join(PUBLIC_DIR, rel));
    if(!file.startsWith(PUBLIC_DIR + path.sep)) return fail(res, 403, "forbidden");
    fs.stat(file, (err, st) => {
      if(err || !st.isFile()){
        res.writeHead(404, {"Content-Type":"text/plain; charset=utf-8"}); return res.end("Introuvable");
      }
      const ext = path.extname(file);
      res.writeHead(200, {
        "Content-Type": TYPES[ext] || "application/octet-stream",
        "Content-Length": st.size,
        "Cache-Control": ext === ".html" || file.endsWith("sw.js") ? "no-cache" : "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin"
      });
      if(req.method === "HEAD") return res.end();
      fs.createReadStream(file).pipe(res);
    });
  }

  return http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    if(url.pathname.startsWith("/api/")){
      // L'appli peut être servie ailleurs (ex. GitHub Pages) : on autorise les appels d'autres origines.
      // L'authentification passe par un jeton dans l'en-tête, jamais par cookie.
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, PUT, PATCH, DELETE, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Admin-Token");
      res.setHeader("Access-Control-Max-Age", "86400");
      if(req.method === "OPTIONS"){ res.writeHead(204); return res.end(); }
      return api(req, res, url).catch(err => { console.error(err); if(!res.headersSent) fail(res, 500, "server_error"); });
    }
    serveStatic(req, res, url);
  });
}

if(require.main === module){
  fs.mkdirSync(DATA_DIR, {recursive:true});
  const store = openStore(path.join(DATA_DIR, "pasltemps.db"));
  createServer(store).listen(PORT, HOST, () => console.log(`Pas l'temps : http://localhost:${PORT}`));
}

module.exports = { createServer, rule, parsePath };
