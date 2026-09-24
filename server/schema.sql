-- Pas l'temps : schéma de la base (SQLite en local, Cloudflare D1 en ligne)
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
