// Pas l'temps — l'API sur Cloudflare Workers, avec la base D1 (offre gratuite).
// L'appli elle-même reste sur GitHub Pages et appelle cette adresse (voir public/config.js).
import core from "../server/core.js";
import d1 from "./store-d1.js";
import mail from "../server/mail.js";

const { createApi, CORS, MAX_BODY } = core;
let api = null;

function reply(status, body){
  return new Response(JSON.stringify(body), {status, headers: {"Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CORS}});
}

export default {
  async fetch(request, env){
    const url = new URL(request.url);
    if(request.method === "OPTIONS") return new Response(null, {status: 204, headers: CORS});
    if(!url.pathname.startsWith("/api/")) return reply(200, {app: "pasltemps", info: "API de Pas l'temps. L'appli : https://zcabande-arch.github.io/Pasl-temps/"});
    if(!api) api = createApi(d1.d1Store(env.DB), {
      adminToken: env.ADMIN_TOKEN, reportThreshold: +env.REPORT_THRESHOLD || 3, rateLimit: env.RATE_LIMIT !== "off",
      sendMail: mail.mailerFrom(env),
      appOrigins: String(env.APP_ORIGINS || "https://zcabande-arch.github.io").split(",").map(s => s.trim())
    });
    try{
      const r = await api({
        method: request.method, url,
        ip: request.headers.get("CF-Connecting-IP") || "?",
        header: n => request.headers.get(n),
        json: async () => {
          const text = await request.text();
          if(text.length > MAX_BODY) throw {code: 413};
          if(!text) return null;
          try{ return JSON.parse(text); }catch(e){ throw {code: 400}; }
        }
      });
      return reply(r.status, r.body);
    }catch(err){
      console.error(err);
      return reply(500, {error: "server_error"});
    }
  }
};
