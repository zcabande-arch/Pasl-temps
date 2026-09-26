#!/usr/bin/env node
// Pas l'temps — fabrique les illustrations des envies qui n'ont pas (encore) de photo (public/img/moods/*.svg), dans le style de l'icône :
// grandes formes à plat + dessin au trait (rouge épais, noir fin) repris de public/js/icons.js, en grand.
// Deux formats : <nom>.svg (vignette 4:5) et <nom>-large.svg (bandeau large, dessin à droite).
// Usage : node scripts/build-covers.js
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// On récupère les dessins de icons.js (même trait que partout dans l'appli)
const src = fs.readFileSync(path.join(__dirname, "../public/js/icons.js"), "utf8");
const D = vm.runInNewContext("(" + /const D = (\{[\s\S]*?\n  \});/.exec(src)[1] + ")");

const C = {red: "#E1140A", cream: "#F4ECDF", ink: "#1C1512", sun: "#F2B632", green: "#23895D", blue: "#2B4C7E", pink: "#F3C9C1", sky: "#BFD7EA"};

// Chaque illustration : fond, formes de décor (dans un carré 400×400), dessin (icône), couleurs du dessin
const COVERS = {
  "poser":    {bg: C.sky,   deco: [["circle", 210, 200, 150, C.cream], ["rect", 40, 330, 320, 18, C.red]], icon: "chair", a: C.red, k: C.ink}
};

function deco(d){
  const [t, x, y, r, fill] = d;
  if(t === "circle") return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
  if(t === "half") return `<path d="M${x - r} ${y} A${r} ${r} 0 0 1 ${x + r} ${y} Z" fill="${fill}"/>`;
  return "";
}
// rect : ["rect", x, y, largeur, hauteur, couleur]
function decoRect(d){ return `<rect x="${d[1]}" y="${d[2]}" width="${d[3]}" height="${d[4]}" fill="${d[5]}"/>`; }
const shape = d => d[0] === "rect" ? decoRect(d) : deco(d);

// Le dessin de l'icône (grille 48) agrandi dans le carré 400×400, traits un peu affinés pour le grand format
function drawing(c){
  const d = D[c.icon], s = 6.4, off = (400 - 48 * s) / 2;
  return `<g transform="translate(${off} ${off}) scale(${s})" stroke-linecap="round" stroke-linejoin="round">` +
    (d.f ? `<path d="${d.f}" fill="${c.a}"/>` : "") +
    (d.a ? `<path d="${d.a}" fill="none" stroke="${c.a}" stroke-width="4.2"/>` : "") +
    `<path d="${d.k}" fill="none" stroke="${c.k}" stroke-width="2"/></g>`;
}
function scene(c){ return c.deco.map(shape).join("") + drawing(c); }

function tile(c){
  // 400×500 : la scène en haut, la place du titre en bas (dégradé sombre ajouté par l'appli)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="800" height="1000">` +
    `<rect width="400" height="500" fill="${c.bg}"/><g transform="translate(55 15) scale(.725)">${scene(c)}</g></svg>`;
}
function large(c){
  // 1200×500 : scène à droite (le titre est en bas à gauche), grand cercle de rappel à gauche
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 500" width="1200" height="500">` +
    `<rect width="1200" height="500" fill="${c.bg}"/>` +
    `<circle cx="120" cy="60" r="150" fill="${c.deco[0][4]}" opacity=".35"/>` +
    `<g transform="translate(640 50) scale(1)">${scene(c)}</g></svg>`;
}

const out = path.join(__dirname, "../public/img/moods");
for(const [name, c] of Object.entries(COVERS)){
  fs.writeFileSync(path.join(out, name + ".svg"), tile(c));
  fs.writeFileSync(path.join(out, name + "-large.svg"), large(c));
}
console.log(Object.keys(COVERS).length + " illustrations écrites dans public/img/moods/");
