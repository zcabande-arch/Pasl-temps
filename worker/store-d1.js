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
    async userFor(tokenHash){ const r = await first("user", tokenHash, tokenHash); return r ? r.uid : null; },
    async addSession(uid, tokenHash){ await run("addSession", tokenHash, uid, Date.now()); },
    async accountUid(email){ const r = await first("accountByEmail", email); return r ? r.uid : null; },
    async accountEmail(uid){ const r = await first("accountByUid", uid); return r ? r.email : null; },
    async addAccount(email, uid){ await run("addAccount", email, uid, Date.now()); },
    async addLogin(hash, email, expires){ await run("purgeLogins", Date.now() - 864e5); await run("addLogin", hash, email, expires); },
    async takeLogin(hash){ const r = await first("takeLogin", hash, Date.now()); return r ? r.email : null; },
    async setCode(email, hash, expires){ await run("setCode", email, hash, expires); },
    async getCode(email){ return (await first("getCode", email)) || null; },
    async codeTry(email){ await run("codeTry", email); },
    async delCode(email){ await run("delCode", email); },
    async deleteAccount(uid){ await run("delAccount", uid); await run("delSessions", uid); await run("delUserRow", uid); await run("timerDelUid", uid); await run("pushDelUid", uid); },
    async kvGet(k){ const r = await first("kvGet", k); return r ? r.v : null; },
    async kvSet(k, v){ await run("kvSet", k, v); },
    async pushSet(endpoint, uid, sub, hour, tz, every, nextAt){ await run("pushSet", endpoint, uid, sub, hour, tz, every, nextAt); },
    async pushDel(endpoint){ await run("pushDel", endpoint); },
    async pushDue(now, limit){ return all("pushDue", now, limit); },
    async pushNext(endpoint, at){ await run("pushNext", at, endpoint); },
    async pushAll(limit){ return all("pushAll", limit); },
    async pushOwner(endpoint){ const r = await first("pushOwner", endpoint); return r ? r.uid : null; },
    async timersSet(endpoint, list){ await run("timerDelEp", endpoint); for(const t of list) await run("timerAdd", endpoint, t.at, t.payload); },
    async timersDue(now, limit){ await run("timerStale", now - 3600e3); return all("timerDue", now, limit); },
    async timerDel(id){ await run("timerDel", id); },
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
