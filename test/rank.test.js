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
