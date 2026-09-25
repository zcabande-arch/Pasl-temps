/* Pas l'temps — service worker : l'appli s'ouvre même hors connexion */
const VERSION = "pasltemps-v15";
const CORE = [
  "./",
  "./index.html",
  "./config.js",
  "./css/app.css",
  "./js/api.js",
  "./js/places.js",
  "./js/hours.js",
  "./js/icons.js",
  "./js/app.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/mark.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE.map(u => new Request(u, {cache: "reload"})))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== "pasltemps-lieux").map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // API, recherche de lieux et d'adresses : toujours en direct, jamais en cache
  if (sameOrigin && url.pathname.includes("/api/")) return;

  // Pages : réseau d'abord (pour recevoir les mises à jour), cache en secours
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put("./index.html", copy)); return res; })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Fichiers de l'appli : réseau d'abord (toujours la dernière version), cache si hors connexion
  if (sameOrigin) {
    e.respondWith(
      fetch(req, {cache: "no-cache"})
        .then(res => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Tuiles de lieux : sur l'appareil d'abord (instantané, hors connexion), mise à jour en arrière-plan
  const tiles = (url.hostname === "raw.githubusercontent.com" || url.hostname === "cdn.jsdelivr.net") && /Pasl-temps[@/]places\//.test(url.pathname);
  if (tiles) {
    e.respondWith(
      caches.open("pasltemps-lieux").then(c => c.match(req).then(hit => {
        const net = fetch(req).then(res => { if (res.ok || res.status === 404) c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      }))
    );
    return;
  }

  // Polices Google : cache d'abord
  const fonts = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!fonts) return;
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && (res.ok || res.type === "opaque")) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
