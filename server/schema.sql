-- Fissa Fissa : schéma de la base (SQLite en local, Cloudflare D1 en ligne)
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
-- Notifications du chrono « Je pars » (c'est l'heure de repartir, temps écoulé) : envoyées une fois puis effacées
CREATE TABLE IF NOT EXISTS push_timers (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL,
  at       INTEGER NOT NULL,
  payload  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS push_timers_at ON push_timers(at);
CREATE INDEX IF NOT EXISTS push_timers_ep ON push_timers(endpoint);
-- Notifications par créneau (midi, sortie du travail, samedi, habitudes) : l'appareil envoie seulement les heures
-- prévues, jamais sa position ; le serveur applique les limites (1 par jour, 8 h – 21 h, pas juste après une ouverture)
CREATE TABLE IF NOT EXISTS push_slots (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL,
  at       INTEGER NOT NULL,
  slot     TEXT NOT NULL,
  minutes  INTEGER NOT NULL,
  hm       INTEGER NOT NULL DEFAULT -1
);
CREATE INDEX IF NOT EXISTS push_slots_at ON push_slots(at);
CREATE INDEX IF NOT EXISTS push_slots_ep ON push_slots(endpoint);
-- Par appareil : dernière ouverture de l'appli, et dernier jour (heure locale) où une notification « créneau » est partie
CREATE TABLE IF NOT EXISTS push_state (
  endpoint TEXT PRIMARY KEY,
  seen     INTEGER NOT NULL DEFAULT 0,
  day      TEXT NOT NULL DEFAULT ''
);
-- Prix donnés par la communauté (« C'était plutôt € / €€ / €€€ ? », en notant une sortie) : une réponse par personne
-- et par lieu (la dernière compte). Niveau publié à partir de 3 réponses. Table ajoutée sans toucher aux autres (aucune perte).
CREATE TABLE IF NOT EXISTS price_votes (
  place TEXT NOT NULL,
  uid   TEXT NOT NULL,
  lvl   INTEGER NOT NULL,
  at    INTEGER NOT NULL,
  PRIMARY KEY (place, uid)
);
-- Mesure d'audience maison (exemptée de consentement par la CNIL) : seulement des totaux par jour,
-- sans identifiant, sans adresse IP, gardés 25 mois au plus. ev : open, search, go, done ; dim : envie ou moyen de transport.
CREATE TABLE IF NOT EXISTS stats (
  day TEXT NOT NULL,
  ev  TEXT NOT NULL,
  dim TEXT NOT NULL DEFAULT '',
  n   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, ev, dim)
);
-- Journal de l'espace admin : qui a fait quoi, et quand (masquer, rétablir, bannir, annonce)
CREATE TABLE IF NOT EXISTS admin_log (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  at     INTEGER NOT NULL,
  who    TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS admin_log_at ON admin_log(at);
