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
  user: "SELECT uid FROM users WHERE token = ? UNION ALL SELECT uid FROM sessions WHERE token = ? LIMIT 1",
  // Comptes par e-mail
  addSession: "INSERT INTO sessions (token, uid, created) VALUES (?, ?, ?)",
  delSessions: "DELETE FROM sessions WHERE uid = ?",
  delUserRow: "DELETE FROM users WHERE uid = ?",
  accountByEmail: "SELECT uid FROM accounts WHERE email = ?",
  accountByUid: "SELECT email FROM accounts WHERE uid = ?",
  addAccount: "INSERT INTO accounts (email, uid, created) VALUES (?, ?, ?)",
  delAccount: "DELETE FROM accounts WHERE uid = ?",
  addLogin: "INSERT OR REPLACE INTO logins (hash, email, expires, used) VALUES (?, ?, ?, 0)",
  takeLogin: "UPDATE logins SET used = 1 WHERE hash = ? AND used = 0 AND expires > ? RETURNING email",
  purgeLogins: "DELETE FROM logins WHERE expires < ?",
  setCode: "INSERT OR REPLACE INTO login_codes (email, hash, expires, tries) VALUES (?, ?, ?, 0)",
  getCode: "SELECT hash, expires, tries FROM login_codes WHERE email = ?",
  codeTry: "UPDATE login_codes SET tries = tries + 1 WHERE email = ?",
  delCode: "DELETE FROM login_codes WHERE email = ?",
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
