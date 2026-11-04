// Fissa Fissa — calculs de trajet, sans effet de bord (testés dans test/trip.test.js).
// Deux cas :
//  · aller-retour depuis la position (cas historique) : radiusFor, fits ;
//  · arrivée ailleurs (DEST, ex. la maison, un client, la gare) : un lieu tient si
//    trajet(pos → lieu) + temps sur place + trajet(lieu → DEST) ≤ minutes avant l'heure d'arrivée.
//    Les lieux possibles sont alors dans une ellipse dont les foyers sont pos et DEST.
// Un « mode » de transport = {speed (m/min), detour (×), over (min fixes par trajet), cap (m)} (voir TRAVEL dans app.js).
// Expose window.TRIP (navigateur) et module.exports (Node).
(function(){
  const R = 6371000, rad = x => x * Math.PI / 180;
  // Distance à vol d'oiseau (m) entre {lat, lng}
  function meters(a, b){
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  // Minutes de trajet estimées pour une distance à vol d'oiseau (m)
  const travelMin = (d, m) => Math.max(1, Math.round(d * m.detour / m.speed + m.over));

  // ---------- Aller-retour (inchangé) ----------
  // Distance maximale pour que aller + retour + temps sur place tiennent dans t minutes
  const radiusFor = (stay, t, m) => Math.min(m.cap, Math.max(150, ((t - stay) / 2 - m.over) * m.speed / m.detour));
  // La rubrique tient-elle dans t minutes ? (temps minimum g.minT, et au moins 2 min de trajet)
  const fits = (g, t, m, stay = g.stay) => (!g.minT || t >= g.minT) && t - stay - 2 * m.over >= 2;

  // ---------- Arrivée ailleurs ----------
  // Le lieu tient-il ? (trajets en minutes, réels ou estimés)
  const fitsVia = (toPlace, stay, toDest, minutes) => toPlace + stay + toDest <= minutes;
  // Détour par rapport au trajet direct pos → DEST (minutes, jamais négatif)
  const detourOf = (toPlace, toDest, direct) => Math.max(0, toPlace + toDest - direct);
  // Peut-on encore faire un détour ? (il faut au moins 2 min de plus que le trajet direct)
  const roomFor = (direct, minutes) => minutes - direct >= 2;
  // Somme maximale des distances aux deux foyers (m) pour une rubrique : aller + retour vers DEST + temps sur place
  // tiennent dans `minutes`. Plafonnée à « trajet direct + 2 × cap » : on s'écarte d'au plus `cap` du chemin,
  // mais un long trajet (voiture, 30 km) n'est jamais coupé par le plafond.
  function spanFor(stay, minutes, m, direct){
    const s = (minutes - stay - 2 * m.over) * m.speed / m.detour;
    return Math.max(0, Math.min(s, direct + 2 * m.cap));
  }
  // Rubrique possible en mode arrivée : temps minimum, et place pour le temps sur place en plus du trajet direct
  const fitsDest = (g, minutes, directMin, m, stay = g.stay) => (!g.minT || minutes >= g.minT) && minutes - directMin - stay - m.over >= 2;
  // p est-il dans l'ellipse de foyers a et b ?
  const inEllipse = (a, b, p, span) => meters(a, p) + meters(p, b) <= span;
  // Rectangle (lat/lng) qui contient toute l'ellipse : tout point de l'ellipse est à moins de
  // demi-petit-axe B du segment [a, b] (B ≥ demi-grand-axe − demi-distance focale)
  function ellipseBox(a, b, span){
    const c = meters(a, b) / 2, A = Math.max(span / 2, c), B = Math.sqrt(Math.max(0, A * A - c * c));
    const midLat = (a.lat + b.lat) / 2, dLat = B / 111320, dLng = B / (111320 * Math.max(0.01, Math.cos(rad(midLat))));
    return {minLat: Math.min(a.lat, b.lat) - dLat, maxLat: Math.max(a.lat, b.lat) + dLat,
            minLng: Math.min(a.lng, b.lng) - dLng, maxLng: Math.max(a.lng, b.lng) + dLng, B};
  }
  // Part du détour possible déjà utilisée (couleurs du radar en mode arrivée)
  const detourRatio = (detour, maxDetour) => detour / Math.max(1, maxDetour);

  const api = {meters, travelMin, radiusFor, fits, fitsVia, detourOf, roomFor, spanFor, fitsDest, inEllipse, ellipseBox, detourRatio};
  if(typeof window !== "undefined") window.TRIP = api;
  if(typeof module !== "undefined") module.exports = api;
})();
