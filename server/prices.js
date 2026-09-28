// Fissa Fissa — gamme de prix d'un lieu, lue chez Google (Places API officielle, payante au-delà d'un quota gratuit).
// Rien n'est gardé côté serveur (conditions de Google) : l'appli redemande à chaque session.
// Sans clé GOOGLE_PLACES_KEY, le service est coupé et l'appli garde ses prix estimés.
"use strict";

const LEVELS = {PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4};

function meters(a, b){
  const R = 6371e3, r = x => x * Math.PI / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// {name, lat, lng} → {level (0-4) | null, from, to, cur} ; null si Google ne trouve pas ce lieu à moins de 250 m
async function googlePrice(item, {key, fetchFn = fetch, lang = "fr"}){
  const res = await fetchFn("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {"Content-Type": "application/json", "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.location,places.priceLevel,places.priceRange"},
    body: JSON.stringify({textQuery: item.name, languageCode: lang, maxResultCount: 3,
      locationBias: {circle: {center: {latitude: item.lat, longitude: item.lng}, radius: 150}}})
  });
  if(!res.ok) throw {code: "google_" + res.status};
  const j = await res.json();
  const best = (j.places || []).filter(p => p.location)
    .map(p => ({p, d: meters(item, {lat: p.location.latitude, lng: p.location.longitude})}))
    .filter(x => x.d < 250).sort((a, b) => a.d - b.d)[0];
  if(!best) return null;
  const p = best.p, r = p.priceRange || {};
  const level = p.priceLevel in LEVELS ? LEVELS[p.priceLevel] : null;
  const from = r.startPrice ? +r.startPrice.units || 0 : null, to = r.endPrice ? +r.endPrice.units || null : null;
  if(level == null && from == null) return null;
  return {level, from, to, cur: (r.startPrice || r.endPrice || {}).currencyCode || null};
}

module.exports = { googlePrice, LEVELS };
