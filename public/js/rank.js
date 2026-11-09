// Fissa Fissa — classement selon le moment (sans effet de bord ; testé dans test/rank.test.js).
// Ordre de base des envies : celui du questionnaire. Puis :
//  · en semaine, le soir (lundi–vendredi, à partir de 18 h) : « Se poser » passe en tête ;
//  · le week-end (samedi, dimanche) : « Sorties entre amis » reste en tête.
// Les envies « pratiques » (courses, artisans) restent toujours en bas.
// Expose window.RANK (navigateur) et module.exports (Node).
(function(){
  const EVENING = 18;                                   // à partir de 18 h
  const isWeekend = d => d.getDay() === 0 || d.getDay() === 6;
  const isWeekdayEvening = d => !isWeekend(d) && d.getHours() >= EVENING;
  // Envie mise en avant à ce moment-là (ou null)
  function featured(d){
    if(isWeekdayEvening(d)) return "poser";
    if(isWeekend(d)) return "boire";
    return null;
  }
  // keys : clés des envies dans l'ordre de base ; practical : clés à laisser en bas → nouvel ordre
  function moodOrder(keys, d, practical = []){
    const f = featured(d), pr = new Set(practical);
    const main = keys.filter(k => !pr.has(k)), low = keys.filter(k => pr.has(k));
    if(f && main.includes(f)) return [f, ...main.filter(k => k !== f), ...low];
    return [...main, ...low];
  }
  // ---------- Tri des lieux dans une rubrique ----------
  // Vérifié « récemment » : date de vérification (OpenStreetMap ou signalement de la communauté) de moins d'un an
  const RECENT_DAYS = 365;
  function recentlyChecked(date, now){
    if(!date) return false;
    const t = Date.parse(date), n = +now;
    return isFinite(t) && t <= n + 864e5 && n - t <= RECENT_DAYS * 864e5;
  }
  // Prix connu : du moins cher au plus cher ; prix inconnu ensuite
  const lvlKey = l => l >= 1 && l <= 4 ? l : 9;
  // a, b : {open (0 ouvert, 1 horaires inconnus, 2 fermé), lvl (1 € … 3 €€€, ou null), checked (date), near (distance ou détour)}
  // Ordre : fermé à l'arrivée toujours en bas ; puis le moins cher ; puis vérifié récemment ; puis le plus proche.
  // (L'originalité n'existe pas dans les données : elle n'est pas utilisée. La durée est la même pour toute une rubrique.)
  function placeCompare(a, b, now){
    return (a.open - b.open)
      || (lvlKey(a.lvl) - lvlKey(b.lvl))
      || (recentlyChecked(b.checked, now) - recentlyChecked(a.checked, now))
      || (a.near - b.near);
  }
  const api = {featured, moodOrder, isWeekend, isWeekdayEvening, recentlyChecked, placeCompare};
  if(typeof window !== "undefined") window.RANK = api;
  if(typeof module !== "undefined") module.exports = api;
})();
