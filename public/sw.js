/* Fissa Fissa — service worker : l'appli s'ouvre même hors connexion */
const VERSION = "pasltemps-v86";
const CORE = [
  "./",
  "./index.html",
  "./legal.html",
  "./config.js",
  "./css/app.css",
  "./fonts/fraunces.woff2",
  "./fonts/fraunces-italic.woff2",
  "./fonts/bricolage.woff2",
  "./fonts/anton.woff2",
  "./fonts/poppins-400.woff2",
  "./fonts/archivo.woff2",
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
  "./img/moods/poser.jpg",
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
        // la liste des zones couvertes et les « rien ici » gardés en mémoire : réseau d'abord (la couverture s'agrandit)
        if (hit && (hit.status === 404 || url.pathname.endsWith("/index.json"))) return net.then(r => r || hit);
        return hit || net;
      }))
    );
    return;
  }
});

// ---------- Rappels « T'as l'temps ? » ----------
// Le serveur envoie une notification vide ; on choisit ici le message (dans la langue du téléphone).
const RAPPELS = {
  fr: ["T'as 20 minutes ? Une vraie pause, fissa fissa.", "Une pause café ? On te trouve un endroit juste à côté.",
       "Et si tu prenais l'air 20 minutes ?", "T'as une demi-heure ? Il y a sûrement un truc sympa près de toi.",
       "Petite pause aujourd'hui ? Ouvre Fissa Fissa, on s'occupe du reste."],
  en: ["Got 20 minutes? A real break, fissa fissa.", "Coffee break? We'll find a spot right around the corner.",
       "How about 20 minutes of fresh air?", "Got half an hour? There's surely something nice near you.",
       "A little break today? Open Fissa Fissa, we'll handle the rest."],
  es: ["¿Tienes 20 minutos? Una pausa de verdad, fissa fissa.", "¿Una pausa para un café? Te encontramos un sitio justo al lado.",
       "¿Y si tomas el aire 20 minutos?", "¿Tienes media hora? Seguro que hay algo chulo cerca de ti.",
       "¿Una pausita hoy? Abre Fissa Fissa, nosotros nos encargamos del resto."],
  de: ["20 Minuten frei? Eine echte Pause, fissa fissa.", "Kaffeepause? Wir finden dir einen Ort gleich um die Ecke.",
       "Wie wär's mit 20 Minuten frischer Luft?", "Eine halbe Stunde Zeit? In deiner Nähe gibt's bestimmt was Schönes.",
       "Kleine Pause heute? Öffne Fissa Fissa, wir kümmern uns um den Rest."],
  it: ["Hai 20 minuti? Una vera pausa, fissa fissa.", "Pausa caffè? Ti troviamo un posto proprio qui vicino.",
       "E se prendessi un po' d'aria per 20 minuti?", "Hai mezz'ora? Di sicuro c'è qualcosa di bello vicino a te.",
       "Una pausa oggi? Apri Fissa Fissa, al resto pensiamo noi."],
  pt: ["Tem 20 minutos? Uma pausa de verdade, fissa fissa.", "Pausa pro café? A gente acha um lugar bem pertinho.",
       "Que tal 20 minutos de ar livre?", "Tem meia hora? Com certeza tem algo legal perto de você.",
       "Uma pausinha hoje? Abra Fissa Fissa, a gente cuida do resto."],
  nl: ["20 minuten? Een echte pauze, fissa fissa.", "Koffiepauze? We vinden een plekje vlak om de hoek.",
       "Wat dacht je van 20 minuten frisse lucht?", "Half uurtje? Er is vast iets leuks bij jou in de buurt.",
       "Even pauze vandaag? Open Fissa Fissa, wij regelen de rest."]
};
self.addEventListener("push", e => {
  // le serveur envoie {title, body, tag, url} (chiffré, déchiffré par le navigateur) ; sinon, message au hasard
  let m = null; try{ m = e.data ? e.data.json() : null; }catch(err){}
  const code = String(self.navigator.language || "fr").slice(0, 2).toLowerCase(), list = RAPPELS[code] || RAPPELS.en;
  if(!m || !m.body) m = {title: "Fissa Fissa", body: list[Math.floor(Math.random() * list.length)], tag: "pasltemps-rappel", url: "./"};
  e.waitUntil(self.registration.showNotification(m.title || "Fissa Fissa", {
    body: m.body, icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: m.tag || "pasltemps", renotify: true,
    vibrate: [200, 100, 200], data: {url: m.url || "./"}
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type: "window", includeUncontrolled: true}).then(list => {
    const open = list.find(c => "focus" in c);
    return open ? open.focus() : self.clients.openWindow("./");
  }));
});
