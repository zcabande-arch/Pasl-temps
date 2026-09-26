// Stockage des documents dans SQLite (module intégré à Node.js 22.13+).
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const SQL = require("./queries");

function openStore(file){
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));
  const q = Object.fromEntries(Object.entries(SQL).map(([k, s]) => [k, db.prepare(s)]));
  const likeEsc = s => s.replace(/[\\%_]/g, c => "\\" + c);
  return {
    get(p){ const r = q.get.get(p); return r ? JSON.parse(r.data) : null; },
    set(p, json, at){
      const i = p.lastIndexOf("/"), now = Date.now();
      q.set.run(p, p.slice(0, i), p.slice(i + 1), json, Number.isFinite(at) ? at : now, now);
    },
    // Supprimer un document supprime aussi ses sous-collections (ex. walls/<uid>/photos/…)
    del(p){ q.del.run(p, likeEsc(p) + "/%"); },
    list(parent, desc, limit){
      return (desc ? q.listDesc : q.listAsc).all(parent, limit).map(r => ({id:r.id, data:JSON.parse(r.data)}));
    },
    addUser(uid, tokenHash){ q.addUser.run(uid, tokenHash, Date.now()); },
    userFor(tokenHash){ const r = q.user.get(tokenHash, tokenHash); return r ? r.uid : null; },
    // Comptes par e-mail
    addSession(uid, tokenHash){ q.addSession.run(tokenHash, uid, Date.now()); },
    accountUid(email){ const r = q.accountByEmail.get(email); return r ? r.uid : null; },
    accountEmail(uid){ const r = q.accountByUid.get(uid); return r ? r.email : null; },
    addAccount(email, uid){ q.addAccount.run(email, uid, Date.now()); },
    addLogin(hash, email, expires){ q.purgeLogins.run(Date.now() - 864e5); q.addLogin.run(hash, email, expires); },
    takeLogin(hash){ const r = q.takeLogin.get(hash, Date.now()); return r ? r.email : null; },
    setCode(email, hash, expires){ q.setCode.run(email, hash, expires); },
    getCode(email){ return q.getCode.get(email) || null; },
    codeTry(email){ q.codeTry.run(email); },
    delCode(email){ q.delCode.run(email); },
    deleteAccount(uid){ q.delAccount.run(uid); q.delSessions.run(uid); q.delUserRow.run(uid); q.timerDelUid.run(uid); q.pushDelUid.run(uid); },
    // Notifications
    kvGet(k){ const r = q.kvGet.get(k); return r ? r.v : null; },
    kvSet(k, v){ q.kvSet.run(k, v); },
    pushSet(endpoint, uid, sub, hour, tz, every, nextAt){ q.pushSet.run(endpoint, uid, sub, hour, tz, every, nextAt); },
    pushDel(endpoint){ q.pushDel.run(endpoint); },
    pushDue(now, limit){ return q.pushDue.all(now, limit); },
    pushNext(endpoint, at){ q.pushNext.run(at, endpoint); },
    pushAll(limit){ return q.pushAll.all(limit); },
    pushOwner(endpoint){ const r = q.pushOwner.get(endpoint); return r ? r.uid : null; },
    timersSet(endpoint, list){ q.timerDelEp.run(endpoint); for(const t of list) q.timerAdd.run(endpoint, t.at, t.payload); },
    timersDue(now, limit){ q.timerStale.run(now - 3600e3); return q.timerDue.all(now, limit); },
    timerDel(id){ q.timerDel.run(id); },
    // Modération
    report(target, reporter, reason){ q.report.run(target, reporter, reason, Date.now()); return q.reportCount.get(target).n; },
    reports(){ return q.reportList.all().map(r => ({...r, hidden: !!r.hidden})); },
    clearReports(target){ q.reportClear.run(target); },
    hide(target, by){ q.hide.run(target, by, Date.now()); },
    unhide(target){ q.unhide.run(target); },
    hidden(){ return q.hiddenList.all().map(r => r.target); },
    ban(uid){ q.ban.run(uid, Date.now()); },
    isBanned(uid){ return !!q.isBanned.get(uid); },
    close(){ db.close(); }
  };
}

module.exports = { openStore };
