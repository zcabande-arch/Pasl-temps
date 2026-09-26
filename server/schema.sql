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
-- Connexion par e-mail : un compte = une adresse, plusieurs appareils (un jeton de session chacun)
CREATE TABLE IF NOT EXISTS accounts (
  email   TEXT PRIMARY KEY,
  uid     TEXT NOT NULL UNIQUE,
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token   TEXT PRIMARY KEY,
  uid     TEXT NOT NULL,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_uid ON sessions(uid);
-- Liens de connexion envoyés par e-mail (on ne garde que l'empreinte du lien)
CREATE TABLE IF NOT EXISTS logins (
  hash    TEXT PRIMARY KEY,
  email   TEXT NOT NULL,
  expires INTEGER NOT NULL,
  used    INTEGER NOT NULL DEFAULT 0
);
-- Code à 6 chiffres envoyé avec le lien (pour l'appli installée, qui ne reçoit pas le lien) : un seul actif par adresse,
-- 5 essais au plus
CREATE TABLE IF NOT EXISTS login_codes (
  email   TEXT PRIMARY KEY,
  hash    TEXT NOT NULL,
  expires INTEGER NOT NULL,
  tries   INTEGER NOT NULL DEFAULT 0
);
-- Réglages internes du serveur (ex. clés des notifications, créées une fois)
CREATE TABLE IF NOT EXISTS kv (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);
-- Rappels « T'as l'temps ? » : un abonnement aux notifications par appareil
CREATE TABLE IF NOT EXISTS push_subs (
  endpoint TEXT PRIMARY KEY,
  uid      TEXT NOT NULL,
  sub      TEXT NOT NULL,
  hour     INTEGER NOT NULL,
  tz       INTEGER NOT NULL,
  every    INTEGER NOT NULL,
  next_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS push_due ON push_subs(next_at);
