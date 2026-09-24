// Requêtes SQL communes au serveur Node (SQLite) et à Cloudflare (D1).
"use strict";
module.exports = {
  get: "SELECT data FROM docs WHERE path = ?",
  set: `INSERT INTO docs (path, parent, id, data, sort, updated) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET data = excluded.data, sort = excluded.sort, updated = excluded.updated`,
  del: "DELETE FROM docs WHERE path = ? OR path LIKE ? ESCAPE '\\'",
  listDesc: "SELECT id, data FROM docs WHERE parent = ? ORDER BY sort DESC LIMIT ?",
  listAsc: "SELECT id, data FROM docs WHERE parent = ? ORDER BY sort ASC LIMIT ?",
  addUser: "INSERT INTO users (uid, token, created) VALUES (?, ?, ?)",
  user: "SELECT uid FROM users WHERE token = ?",
  report: "INSERT OR IGNORE INTO reports (target, reporter, reason, at) VALUES (?, ?, ?, ?)",
  reportCount: "SELECT COUNT(*) AS n FROM reports WHERE target = ?",
  reportList: `SELECT target, COUNT(*) AS n, MAX(at) AS last, GROUP_CONCAT(reason, ' | ') AS reasons,
    EXISTS(SELECT 1 FROM hidden h WHERE h.target = r.target) AS hidden
    FROM reports r GROUP BY target ORDER BY last DESC LIMIT 200`,
  reportClear: "DELETE FROM reports WHERE target = ?",
  hide: "INSERT OR REPLACE INTO hidden (target, by, at) VALUES (?, ?, ?)",
  unhide: "DELETE FROM hidden WHERE target = ?",
  hiddenList: "SELECT target FROM hidden",
  ban: "INSERT OR REPLACE INTO banned (uid, at) VALUES (?, ?)",
  isBanned: "SELECT 1 AS b FROM banned WHERE uid = ?"
};
