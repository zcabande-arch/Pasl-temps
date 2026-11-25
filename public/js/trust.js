// Fissa Fissa — à quel point se fier aux horaires d'un lieu (sans effet de bord ; testé dans test/trust.test.js).
// Du plus sûr au moins sûr :
//  · « visitors » : des visiteurs l'ont trouvé ouvert à l'heure indiquée ;
//  · « checked »  : vérifié sur OpenStreetMap (ou horaires signalés par un pote) depuis moins d'un an ;
//  · « old »      : horaires connus, mais sans vérification récente → on dit « Sans doute ouvert » ;
//  · « doubt »    : plusieurs visiteurs l'ont trouvé fermé → « Horaires à confirmer » ;
//  · « none »     : pas d'horaires.
// Expose window.TRUST (navigateur) et module.exports (Node).
(function(){
  const DAY = 864e5, RECENT = 365 * DAY;
  const time = d => { const t = Date.parse(d || ""); return isFinite(t) ? t : null; };
  // x : {oh, checked: « AAAA-MM-JJ » ou "", community: {s: "ok" | "doubt", n, day} ou null}
  function level(x, now){
    if(!x.oh) return "none";
    const c = x.community, chk = time(x.checked), recent = chk != null && chk <= +now + DAY && +now - chk <= RECENT;
    if(c && c.s === "doubt") return recent && chk > time(c.day) ? "checked" : "doubt";      // vérifié depuis : le doute est levé
    if(c && c.s === "ok") return "visitors";
    return recent ? "checked" : "old";
  }
  // o : résultat de HOURS.forVisit. On n'affirme « Ouvert » que si c'est vérifié ; un « Fermé » n'est jamais adouci.
  // → {...o, trust} ; la clé du texte est rendue (texte français à traduire) avec ses variables
  function soften(o, lvl){
    const out = {...o, trust: lvl};
    if(o.state !== "open" || o.holiday) return out;
    if(lvl === "doubt") return {...out, level: "warn", late: false, say: ["Horaires à confirmer"]};
    if(lvl === "old" && o.level === "ok") return {...out, say: o.until ? ["Sans doute ouvert · jusqu'à {h}", {h: o.until}] : ["Sans doute ouvert"]};
    return out;
  }
  // Faut-il demander « C'était bien ouvert ? » : lieu à horaires, pas annoncé fermé, et on a eu le temps d'arriver
  const shouldAsk = (t, now) => !!(t && t.pid && t.oh && now - t.start >= t.walk * 60000);
  const api = {level, soften, shouldAsk};
  if(typeof window !== "undefined") window.TRUST = api;
  if(typeof module !== "undefined") module.exports = api;
})();
