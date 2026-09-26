/* Pas l'temps — service worker : l'appli s'ouvre même hors connexion */
const VERSION = "pasltemps-v40";
const CORE = [
  "./",
  "./index.html",
  "./legal.html",
  "./config.js",
  "./css/app.css",
  "./fonts/fraunces.woff2",
  "./fonts/fraunces-italic.woff2",
  "./fonts/bricolage.woff2",
  "./js/i18n.js",
  "./js/api.js",
  "./js/places.js",
  "./js/hours.js",
  "./js/icons.js",
  "./js/profile.js",
  "./js/onboard.js",
  "./js/app.js",
  "./manifest.webmanifest",
  "./img/moods/manger.jpg",
  "./img/moods/air.jpg",
  "./img/moods/boire.jpg",
  "./img/moods/courses.jpg",
  "./img/moods/shopping.jpg",
  "./img/moods/poser.svg",
  "./img/moods/bouger.jpg",
  "./img/moods/culture.jpg",
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

// Clé de cache d'une page : « …/ » et « …/index.html » → ./index.html ; les autres pages → ./nom.html
function pageKey(url){
  const name = url.pathname.split("/").pop();
  return "./" + (name && name.endsWith(".html") ? name : "index.html");
}

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
      // toujours une page fraîche (le cache du navigateur garderait sinon l'ancienne ~10 min)
      // chaque page garde sa propre copie (l'accueil sous ./index.html, les mentions légales sous leur nom…)
      fetch(req.url, {cache: "no-cache", credentials: "same-origin"})
        .then(res => { if (res.ok && sameOrigin) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(pageKey(url), copy)); } return res; })
        .catch(() => caches.match(pageKey(url)).then(hit => hit || caches.match("./index.html")))
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
});
