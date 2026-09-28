"use strict";
const test = require("node:test");
const assert = require("node:assert");
const H = require("../public/js/hours.js");

// 24 septembre 2026 = un jeudi
const t = (day, h, m = 0) => new Date(2026, 8, 21 + day, h, m); // day : 0 = lundi 21/09

test("horaires simples", () => {
  const oh = "Mo-Fr 07:00-19:30; Sa 08:00-13:00; Su off";
  assert.equal(H.at(oh, t(3, 10)).state, "open");
  assert.equal(H.at(oh, t(3, 10)).closesIn, 570);
  assert.equal(H.at(oh, t(3, 20)).state, "closed");
  assert.deepEqual(H.at(oh, t(3, 20)).opensAt, {inDays:1, min:420, day:4});
  assert.deepEqual(H.at(oh, t(5, 14)).opensAt, {inDays:2, min:420, day:0}); // samedi après-midi → lundi
  assert.equal(H.at(oh, t(6, 12)).state, "closed");
});

test("coupure du midi, passage de minuit, 24/7", () => {
  const coupure = "Tu-Sa 09:00-12:30,14:00-19:00";
  assert.equal(H.at(coupure, t(1, 13)).state, "closed");
  assert.deepEqual(H.at(coupure, t(1, 13)).opensAt, {inDays:0, min:840, day:1});
  assert.equal(H.at(coupure, t(0, 10)).state, "closed");
  const nuit = "Mo-Su 18:00-02:00";
  assert.equal(H.at(nuit, t(3, 1)).state, "open");
  assert.equal(H.at(nuit, t(3, 23)).closesIn, 180);
  assert.equal(H.at("24/7", t(3, 3)).allDay, true);
});

test("formats non compris → inconnu, jamais faux", () => {
  for(const oh of ["Jan-Mar Mo-Fr 08:00-18:00", "Mo-Fr sunrise-sunset", "", null, "n'importe quoi"])
    assert.equal(H.at(oh, t(3, 10)).state, "unknown");
  assert.equal(H.at("Mo-Fr 08:00-18:00; PH off", t(3, 10)).state, "open");
});

test("texte pour une visite : à l'arrivée et pendant le temps sur place", () => {
  const oh = "Mo-Su 08:00-19:00";
  assert.equal(H.forVisit(oh, 5, 10, t(3, 12)).text, "Ouvert · jusqu'à 19h");
  assert.equal(H.forVisit(oh, 5, 10, t(3, 18, 30)).level, "warn");
  assert.equal(H.forVisit(oh, 5, 10, t(3, 18, 57)).text, "Fermé à ton arrivée · rouvre demain à 8h");
  assert.equal(H.forVisit(oh, 5, 10, t(3, 7)).text, "Fermé · ouvre à 8h");
  assert.equal(H.forVisit("24/7", 5, 10, t(3, 7)).text, "Ouvert 24h/24");
  assert.equal(H.forVisit(undefined, 5, 10, t(3, 7)).level, "unknown");
});

// Cas trouvés en comparant avec l'outil officiel OpenStreetMap sur ~40 000 commerces réels
test("jours fériés dans la liste des jours : le week-end reste ouvert", () => {
  const oh = "Mo-Fr 07:00-20:00; PH,Sa,Su 08:00-20:00";
  assert.equal(H.at(oh, t(5, 10)).state, "open");      // samedi
  assert.equal(H.at(oh, t(6, 10)).state, "open");      // dimanche
  assert.equal(H.at("14:00-19:00; PH,Su,Mo off", t(0, 15)).state, "closed");   // lundi fermé
  assert.equal(H.at("14:00-19:00; PH,Su,Mo off", t(1, 15)).state, "open");
});

test("service du soir sans jour : il s'ajoute au midi des mêmes jours", () => {
  const oh = "Mo-Fr 12:00-14:30; 19:00-22:00";
  assert.equal(H.at(oh, t(0, 13)).state, "open");
  assert.equal(H.at(oh, t(0, 20)).state, "open");
  assert.equal(H.at(oh, t(5, 20)).state, "closed");    // samedi : rien
  assert.equal(H.at("Mo-Su 12:00-14:30; 19:00-22:00", t(6, 13)).state, "open");
  assert.equal(H.at("Mo-Su 12:00-14:30; 19:00-22:00", t(6, 20)).state, "open");
});

test("virgules : espaces, jours séparés, règles en plus", () => {
  assert.equal(H.at("Mo-Sa 12:00-14:30, 19:00-22:30", t(0, 20)).state, "open");
  assert.equal(H.at("Mo-Sa 09:00-20:30, Su 09:00-12:45", t(6, 10)).state, "open");
  assert.equal(H.at("Mo-Sa 09:00-20:30, Su 09:00-12:45", t(6, 14)).state, "closed");
  assert.equal(H.at("Mo-Th, Su 11:00-22:00; Fr, Sa 11:00-23:00", t(6, 21)).state, "open");
  const plus = "Mo-Sa 11:30-14:30, Mo-Su 18:30-22:30";
  assert.equal(H.at(plus, t(0, 12)).state, "open");    // le midi n'est pas effacé
  assert.equal(H.at(plus, t(6, 19)).state, "open");
  assert.equal(H.at(plus, t(6, 12)).state, "closed");
});

test("23:59 = minuit, fermeture temporaire, formats non gérés → inconnu", () => {
  assert.equal(H.at("Mo-Su 00:00-02:00, 07:00-23:59", t(2, 23, 59)).state, "open");
  assert.equal(H.at('"Temporarily closed"', t(2, 12)).state, "closed");
  assert.equal(H.at("sunrise-sunset", t(2, 12)).state, "unknown");
  assert.equal(H.at("Mo-Su 18:00+", t(2, 19)).state, "unknown");
});
