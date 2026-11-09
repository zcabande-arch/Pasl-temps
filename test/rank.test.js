// Classement selon le moment : « Se poser » en tête le soir en semaine, « Sorties entre amis » en tête le week-end
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const RANK = require("../public/js/rank");

const KEYS = ["boire", "manger", "culture", "bouger", "air", "shopping", "jeux", "poser", "courses", "artisans"];
const PRACTICAL = ["courses", "artisans"];
const at = (y, m, d, h) => new Date(y, m - 1, d, h, 0);   // heure locale

test("en semaine, en journée : l'ordre du questionnaire", () => {
  const mar14h = at(2026, 11, 10, 14);                     // mardi 14 h
  assert.equal(RANK.featured(mar14h), null);
  assert.deepEqual(RANK.moodOrder(KEYS, mar14h, PRACTICAL), KEYS);
});

test("en semaine, le soir (dès 18 h) : « Se poser » en tête, la partie pratique reste en bas", () => {
  for(const d of [at(2026, 11, 10, 18), at(2026, 11, 13, 22)]){        // mardi 18 h, vendredi 22 h
    assert.equal(RANK.featured(d), "poser");
    const o = RANK.moodOrder(KEYS, d, PRACTICAL);
    assert.equal(o[0], "poser");
    assert.deepEqual(o.slice(-2), PRACTICAL);
    assert.deepEqual([...o].sort(), [...KEYS].sort());                // rien de perdu, rien en double
  }
  assert.equal(RANK.featured(at(2026, 11, 10, 17)), null);           // 17 h : pas encore le soir
});

test("le week-end : « Sorties entre amis » en tête, même le soir", () => {
  for(const d of [at(2026, 11, 14, 11), at(2026, 11, 15, 21)]){       // samedi 11 h, dimanche 21 h
    assert.equal(RANK.featured(d), "boire");
    assert.equal(RANK.moodOrder(KEYS, d, PRACTICAL)[0], "boire");
  }
});

test("envie mise en avant absente (ex. masquée) : ordre inchangé", () => {
  const sansPoser = KEYS.filter(k => k !== "poser");
  assert.deepEqual(RANK.moodOrder(sansPoser, at(2026, 11, 10, 20), PRACTICAL), sansPoser);
});

// ---------- Tri des lieux dans une rubrique ----------
const NOW = new Date(2026, 10, 9, 12);                     // 9 novembre 2026
const P = (name, o) => ({name, open: 0, lvl: null, checked: "", near: 100, ...o});
const sorted = list => [...list].sort((a, b) => RANK.placeCompare(a, b, NOW)).map(p => p.name);

test("vérifié récemment : moins d'un an, pas dans le futur", () => {
  assert.equal(RANK.recentlyChecked("2026-06-14", NOW), true);
  assert.equal(RANK.recentlyChecked("2025-11-10", NOW), true);
  assert.equal(RANK.recentlyChecked("2025-10-01", NOW), false);
  assert.equal(RANK.recentlyChecked("2030-01-01", NOW), false);
  assert.equal(RANK.recentlyChecked("", NOW), false);
});

test("tri : fermé en bas, puis le moins cher, puis vérifié récemment, puis le plus proche", () => {
  assert.deepEqual(sorted([
    P("cher proche", {lvl: 3, near: 50}),
    P("pas cher loin", {lvl: 1, near: 900}),
    P("pas cher proche", {lvl: 1, near: 100}),
    P("pas cher vérifié loin", {lvl: 1, near: 800, checked: "2026-05-01"}),
    P("prix inconnu", {near: 10}),
    P("fermé pas cher", {lvl: 1, open: 2, near: 5}),
    P("moyen", {lvl: 2, near: 300})
  ]), ["pas cher vérifié loin", "pas cher proche", "pas cher loin", "moyen", "cher proche", "prix inconnu", "fermé pas cher"]);
});

test("tri sans prix (parcs, musées…) : vérifié récemment d'abord, puis le plus proche", () => {
  assert.deepEqual(sorted([P("proche", {near: 100}), P("vérifié", {near: 700, checked: "2026-09-01"}), P("loin", {near: 400})]),
    ["vérifié", "proche", "loin"]);
});
