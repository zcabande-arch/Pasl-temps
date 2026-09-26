// Pas l'temps — serveur : fichiers de l'appli + petite base de documents (SQLite).
// Aucune dépendance : Node.js 22.13+ suffit.
"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
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

const { createApi, rule, parsePath, CORS, MAX_BODY } = require("./core");
const { brevoMailer } = require("./mail");

function send(res, code, body, headers){
  const data = body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(code, {"Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers});
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

function createServer(store, opts = {}){
  const api = createApi(store, {
    adminToken: opts.adminToken ?? process.env.ADMIN_TOKEN,
    reportThreshold: +process.env.REPORT_THRESHOLD || 3,
    rateLimit: opts.rateLimit,
    // E-mails de connexion : BREVO_API_KEY (+ MAIL_FROM) ; APP_ORIGINS = adresses de l'appli, séparées par des virgules
    sendMail: opts.sendMail || (process.env.BREVO_API_KEY ? brevoMailer(process.env.BREVO_API_KEY, process.env.MAIL_FROM || "Pas l'temps <pasltempssav@gmail.com>") : null),
    appOrigins: opts.appOrigins || (process.env.APP_ORIGINS ? process.env.APP_ORIGINS.split(",").map(s => s.trim()) : [`http://localhost:${PORT}`, "https://zcabande-arch.github.io"])
  });

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
      for(const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
      if(req.method === "OPTIONS"){ res.writeHead(204); return res.end(); }
      const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress || "?";
      return api({method:req.method, url, ip, header: n => req.headers[n.toLowerCase()], json: () => readBody(req)})
        .then(r => send(res, r.status, r.body))
        .catch(err => { console.error(err); if(!res.headersSent) fail(res, 500, "server_error"); });
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
