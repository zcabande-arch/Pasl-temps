// Stockage des documents dans Cloudflare D1 (même schéma et mêmes requêtes que SQLite en local).
"use strict";
const SQL = require("../server/queries");

function d1Store(db){
  const run = (k, ...a) => db.prepare(SQL[k]).bind(...a).run();
  const first = (k, ...a) => db.prepare(SQL[k]).bind(...a).first();
  const all = async (k, ...a) => (await db.prepare(SQL[k]).bind(...a).all()).results || [];
  const likeEsc = s => s.replace(/[\\%_]/g, c => "\\" + c);
  return {
    async get(p){ const r = await first("get", p); return r ? JSON.parse(r.data) : null; },
    async set(p, json, at){
      const i = p.lastIndexOf("/"), now = Date.now();
      await run("set", p, p.slice(0, i), p.slice(i + 1), json, Number.isFinite(at) ? at : now, now);
    },
    async del(p){ await run("del", p, likeEsc(p) + "/%"); },
    async list(parent, desc, limit){
      return (await all(desc ? "listDesc" : "listAsc", parent, limit)).map(r => ({id:r.id, data:JSON.parse(r.data)}));
    },
    async addUser(uid, tokenHash){ await run("addUser", uid, tokenHash, Date.now()); },
    async userFor(tokenHash){ const r = await first("user", tokenHash); return r ? r.uid : null; },
    async report(target, reporter, reason){
      await run("report", target, reporter, reason, Date.now());
      return (await first("reportCount", target)).n;
    },
    async reports(){ return (await all("reportList")).map(r => ({...r, hidden: !!r.hidden})); },
    async clearReports(target){ await run("reportClear", target); },
    async hide(target, by){ await run("hide", target, by, Date.now()); },
    async unhide(target){ await run("unhide", target); },
    async hidden(){ return (await all("hiddenList")).map(r => r.target); },
    async ban(uid){ await run("ban", uid, Date.now()); },
    async isBanned(uid){ return !!(await first("isBanned", uid)); }
  };
}

module.exports = { d1Store };
