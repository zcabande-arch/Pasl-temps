// Temps sur place réglable : chaque rubrique a 3 durées croissantes, et « Normal » = les valeurs d'avant
// (sauf « Sur le pouce », ramené de 30 à 15 min)
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "public", "js", "app.js"), "utf8");
const groups = [...app.matchAll(/\{l:"([^"]+)"[^{}]*?stays:\[(\d+),(\d+),(\d+)\]/g)].map(m => ({l: m[1], s: [+m[2], +m[3], +m[4]]}));
// valeurs de « stay » avant l'étape 3
const BEFORE = {"Boulangeries":[5],"Cafés, salons de thé":[10],"Sur le pouce":[30],"Glaciers":[20],"Restaurants":[60],"Bars":[30],"Pubs, brasseries":[30],
  "Cafés":[15],"Parcs, jardins":[10],"Espaces verts, points de vue":[15],"Supermarchés":[20],"Supérettes, épiceries":[10],"Primeurs, bio":[10],
  "Boucheries, fromageries, poissonneries":[10],"Marchés":[15,10],"Cavistes":[10],"Centres commerciaux, grands magasins":[15],"Cadeaux, souvenirs":[8],
  "Librairies":[10],"Monuments, curiosités":[5],"Bibliothèques":[15],"Musées":[60],"Galeries d'art":[30],"Salons de thé, cafés":[15],"Parcs":[10],
  "Parcs pour marcher ou courir":[10],"Salles de sport":[30],"Cordonniers, clés":[10],"Retouches, couture":[10],"Pressings, laveries":[10],
  "Drogueries, quincailleries":[10],"Réparation téléphone, informatique":[15],"Horlogers":[10],"Imprimeurs, photocopies":[10],"Vélos, réparation":[15],
  "Garages":[30],"Consignes à bagages":[5]};

test("temps sur place : 3 durées croissantes par rubrique, « Normal » inchangé sauf Sur le pouce", () => {
  assert.ok(groups.length >= 39);
  assert.ok(!/\bstay:\d/.test(app), "plus aucune durée fixe « stay: » dans MOODS");
  for(const g of groups){
    assert.ok(g.s[0] < g.s[1] && g.s[1] < g.s[2], g.l + " : " + g.s);
    if(g.l === "Sur le pouce") assert.deepEqual(g.s, [10, 15, 25]);
    else if(BEFORE[g.l]) assert.ok(BEFORE[g.l].includes(g.s[1]), g.l + " : normal " + g.s[1]);   // rubriques d'avant : inchangées
    // (rubriques ajoutées ensuite : seulement les 3 durées croissantes)
  }
});

test("envies : ordre du questionnaire, puis Se poser, puis « Pratique » ; anciennes clés gardées", () => {
  const keys = [...app.matchAll(/^  ([a-z]+): \{(?:img|d):/gm)].map(m => m[1]);
  assert.deepEqual(keys, ["boire", "manger", "cinema", "bouger", "concerts", "air", "shopping", "culture", "jeux", "creatif", "poser", "courses", "artisans"]);
  // les anciennes rubriques existent toujours (historique, favoris, préférences restent reliés)
  for(const l of Object.keys(BEFORE)) assert.ok(groups.some(g => g.l === l), "rubrique perdue : " + l);
});
