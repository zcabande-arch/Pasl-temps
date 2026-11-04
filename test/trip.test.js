// Calculs de trajet : aller-retour (inchangé) et arrivée ailleurs (ellipse pos → lieu → DEST)
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const TRIP = require("../public/js/trip");

const WALK = {speed:80, detour:1.3, over:0, cap:3000}, CAR = {speed:400, detour:1.4, over:4, cap:3500};

test("aller-retour : mêmes valeurs qu'avant (radiusFor, fits)", () => {
  // ((20 - 5) / 2) * 80 / 1.3 = 461.5 m
  assert.equal(Math.round(TRIP.radiusFor(5, 20, WALK)), 462);
  assert.equal(TRIP.radiusFor(5, 600, WALK), 3000);                // plafond cap
  assert.equal(TRIP.radiusFor(60, 61, WALK), 150);                 // plancher 150 m
  assert.equal(TRIP.fits({stay:60}, 60, WALK), false);
  assert.equal(TRIP.fits({stay:5}, 10, WALK), true);
  assert.equal(TRIP.fits({stay:30, minT:45}, 40, WALK), false);
  assert.equal(TRIP.fits({stay:5}, 15, CAR), true);                // 15 - 5 - 8 = 2
  assert.equal(TRIP.fits({stay:5}, 14, CAR), false);
});

test("arrivée ailleurs : aller + sur place + vers l'arrivée ≤ temps disponible", () => {
  assert.equal(TRIP.fitsVia(8, 15, 12, 35), true);
  assert.equal(TRIP.fitsVia(8, 15, 13, 35), false);
  assert.equal(TRIP.detourOf(8, 12, 15), 5);
  assert.equal(TRIP.detourOf(3, 10, 15), 0);                       // jamais négatif (trajets arrondis)
  assert.equal(TRIP.roomFor(30, 31), false);
  assert.equal(TRIP.roomFor(30, 32), true);
  assert.equal(TRIP.fitsDest({stay:10}, 40, 25, WALK), true);       // 40 - 25 - 10 = 5
  assert.equal(TRIP.fitsDest({stay:10}, 36, 25, WALK), false);
});

test("arrivée au point de départ : même zone que l'aller-retour", () => {
  // DEST = pos : l'ellipse devient le cercle de rayon radiusFor (hors plafonds)
  const span = TRIP.spanFor(5, 20, WALK, 0);
  assert.ok(Math.abs(span / 2 - TRIP.radiusFor(5, 20, WALK)) < 1e-9);
});

test("le plafond cap ne coupe pas un long trajet en voiture", () => {
  // 30 km à faire en voiture, 3 h devant soi : la zone va au-delà de l'arrivée
  const direct = 30000, span = TRIP.spanFor(15, 180, CAR, direct);
  assert.ok(span >= direct, "la zone contient au moins le trajet direct");
  assert.equal(span, direct + 2 * CAR.cap);                        // on s'écarte d'au plus 3,5 km du chemin
  // à pied, peu de temps : c'est le temps qui limite, pas le plafond
  assert.equal(Math.round(TRIP.spanFor(5, 30, WALK, 1000)), Math.round(25 * 80 / 1.3));
});

test("ellipse : le rectangle chargé contient bien toute la zone", () => {
  const a = {lat:48.8566, lng:2.3522}, b = {lat:48.8738, lng:2.2950};   // Hôtel de Ville → Étoile (~4,6 km)
  const span = TRIP.meters(a, b) + 1500, box = TRIP.ellipseBox(a, b, span);
  // on échantillonne des points de l'ellipse : tous dans le rectangle
  let inside = 0;
  for(let i = 0; i < 4000; i++){
    const p = {lat: box.minLat - .02 + Math.random() * (box.maxLat - box.minLat + .04), lng: box.minLng - .03 + Math.random() * (box.maxLng - box.minLng + .06)};
    if(!TRIP.inEllipse(a, b, p, span)) continue;
    inside++;
    assert.ok(p.lat >= box.minLat && p.lat <= box.maxLat && p.lng >= box.minLng && p.lng <= box.maxLng, JSON.stringify(p));
  }
  assert.ok(inside > 50);
  // un point à mi-chemin est dedans ; un point loin à côté non
  assert.ok(TRIP.inEllipse(a, b, {lat:(a.lat + b.lat) / 2, lng:(a.lng + b.lng) / 2}, span));
  assert.ok(!TRIP.inEllipse(a, b, {lat:48.80, lng:2.33}, span));
});

test("couleurs du radar en mode arrivée : part du détour possible", () => {
  assert.equal(TRIP.detourRatio(5, 20), .25);
  assert.equal(TRIP.detourRatio(3, 0), 3);
});
