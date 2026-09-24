// Stockage des documents dans SQLite (module intégré à Node.js 22.13+).
"use strict";
const { DatabaseSync } = require("node:sqlite");

function openStore(file){
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS docs (
      path    TEXT PRIMARY KEY,
      parent  TEXT NOT NULL,
      id      TEXT NOT NULL,
      data    TEXT NOT NULL,
      sort    REAL NOT NULL,
      updated INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS docs_parent ON docs(parent, sort);
    CREATE TABLE IF NOT EXISTS reports (
      target   TEXT NOT NULL,
      reporter TEXT NOT NULL,
      reason   TEXT NOT NULL,
      at       INTEGER NOT NULL,
      PRIMARY KEY (target, reporter)
    );
    CREATE TABLE IF NOT EXISTS hidden (
      target TEXT PRIMARY KEY,
      by     TEXT NOT NULL,
      at     INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS banned (
      uid TEXT PRIMARY KEY,
      at  INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      uid     TEXT PRIMARY KEY,
      token   TEXT NOT NULL UNIQUE,
      created INTEGER NOT NULL
    );
  `);
  const q = {
    get: db.prepare("SELECT data FROM docs WHERE path = ?"),
    set: db.prepare(`INSERT INTO docs (path, parent, id, data, sort, updated) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET data = excluded.data, sort = excluded.sort, updated = excluded.updated`),
    del: db.prepare("DELETE FROM docs WHERE path = ? OR path LIKE ? ESCAPE '\\'"),
    listDesc: db.prepare("SELECT id, data FROM docs WHERE parent = ? ORDER BY sort DESC LIMIT ?"),
    listAsc: db.prepare("SELECT id, data FROM docs WHERE parent = ? ORDER BY sort ASC LIMIT ?"),
    addUser: db.prepare("INSERT INTO users (uid, token, created) VALUES (?, ?, ?)"),
    user: db.prepare("SELECT uid FROM users WHERE token = ?"),
    report: db.prepare("INSERT OR IGNORE INTO reports (target, reporter, reason, at) VALUES (?, ?, ?, ?)"),
    reportCount: db.prepare("SELECT COUNT(*) AS n FROM reports WHERE target = ?"),
    reportList: db.prepare(`SELECT target, COUNT(*) AS n, MAX(at) AS last, GROUP_CONCAT(reason, ' | ') AS reasons,
      EXISTS(SELECT 1 FROM hidden h WHERE h.target = r.target) AS hidden
      FROM reports r GROUP BY target ORDER BY last DESC LIMIT 200`),
    reportClear: db.prepare("DELETE FROM reports WHERE target = ?"),
    hide: db.prepare("INSERT OR REPLACE INTO hidden (target, by, at) VALUES (?, ?, ?)"),
    unhide: db.prepare("DELETE FROM hidden WHERE target = ?"),
    hiddenList: db.prepare("SELECT target FROM hidden"),
    ban: db.prepare("INSERT OR REPLACE INTO banned (uid, at) VALUES (?, ?)"),
    isBanned: db.prepare("SELECT 1 AS b FROM banned WHERE uid = ?")
  };
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
    // Modération
    report(target, reporter, reason){ q.report.run(target, reporter, reason, Date.now()); return q.reportCount.get(target).n; },
    reports(){ return q.reportList.all().map(r => ({...r, hidden: !!r.hidden})); },
    clearReports(target){ q.reportClear.run(target); },
    hide(target, by){ q.hide.run(target, by, Date.now()); },
    unhide(target){ q.unhide.run(target); },
    hidden(){ return q.hiddenList.all().map(r => r.target); },
    ban(uid){ q.ban.run(uid, Date.now()); },
    isBanned(uid){ return !!q.isBanned.get(uid); },
    userFor(tokenHash){ const r = q.user.get(tokenHash); return r ? r.uid : null; },
    close(){ db.close(); }
  };
}

module.exports = { openStore };
