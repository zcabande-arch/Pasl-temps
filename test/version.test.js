"use strict";
// La page, le code et le service worker doivent annoncer la même version (sinon l'appli se recharge en boucle
// ou garde une page périmée) : à changer ensemble à chaque mise à jour.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", "public", f), "utf8");

test("même numéro de version dans index.html, app.js et sw.js", () => {
  const page = /<meta name="app-version" content="(\d+)">/.exec(read("index.html"))[1];
  const app = /const APP_VERSION = "(\d+)";/.exec(read("js/app.js"))[1];
  const sw = /const VERSION = "pasltemps-v(\d+)";/.exec(read("sw.js"))[1];
  assert.equal(app, page);
  assert.equal(sw, page);
});
