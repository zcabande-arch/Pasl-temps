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
  const api = {featured, moodOrder, isWeekend, isWeekdayEvening};
  if(typeof window !== "undefined") window.RANK = api;
  if(typeof module !== "undefined") module.exports = api;
})();
