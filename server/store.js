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
    userFor(tokenHash){ const r = q.user.get(tokenHash); return r ? r.uid : null; },
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
