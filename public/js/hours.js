// Fissa Fissa — horaires d'ouverture OpenStreetMap (opening_hours) : « ouvert à telle heure ? »
// Gère la forme courante : « Mo-Fr 07:00-19:30; Sa 08:00-12:00,14:00-18:00; Su off », « 24/7 »,
// les horaires qui passent minuit (« 18:00-02:00 »). Tout le reste (mois, jours fériés, lever du soleil…)
// donne « inconnu » plutôt qu'une réponse fausse. Expose window.HOURS.
(function(){
  const DAYS = ["Mo","Tu","We","Th","Fr","Sa","Su"];
  const DAY_FR = ["lun.","mar.","mer.","jeu.","ven.","sam.","dim."], DAY_EN = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  // Traduction (i18n.js) si elle est chargée ; sinon français
  // « 14:00 » et jours de la langue choisie partout sauf en français
  const EN = () => typeof window !== "undefined" && window.I18N && window.I18N.lang !== "fr";
  const dayName = i => { const L = window.I18N.lang; if(L === "en") return DAY_EN[i];
    try{ return new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(window.I18N.locale, {weekday: "short", timeZone: "UTC"}); }catch(e){ return DAY_EN[i]; } };
  const tx = (s, v) => (typeof window !== "undefined" && window.tx ? window.tx(s, v) : s.replace(/\{(\w+)\}/g, (m, k) => v && k in v ? v[k] : m));
  const cache = new Map();

  // « Mo-Fr,Su » → [0,1,2,3,4,6]
  function parseDays(s){
    const out = new Set();
    for(const part of s.split(",")){
      const m = /^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/.exec(part);
      if(!m) return null;
      const a = DAYS.indexOf(m[1]), b = m[2] ? DAYS.indexOf(m[2]) : a;
      for(let d = a; ; d = (d + 1) % 7){ out.add(d); if(d === b) break; }
    }
    return [...out];
  }
  // « 08:00-12:00,14:00-02:00 » → [[480,720],[840,1560]]
  function parseTimes(s){
    const out = [];
    for(const part of s.split(",")){
      const m = /^(\d{1,2})[:h.](\d{2})\s*-\s*(\d{1,2})[:h.](\d{2})$/.exec(part.trim());
      if(!m) return null;
      const a = +m[1] * 60 + +m[2];
      let b = +m[3] * 60 + +m[4];
      if(b === 1439) b = 1440;           // « 23:59 » = jusqu'à minuit
      if(a >= 1440 || b > 1440 + 720) return null;
      if(b <= a) b += 1440;             // passe minuit
      out.push([a, b]);
    }
    return out;
  }

  // → tableau de 7 jours (lundi = 0) d'intervalles en minutes, ou null si non compris
  function parse(oh){
    if(!oh || typeof oh !== "string") return null;
    if(cache.has(oh)) return cache.get(oh);
    let week = null;
    const src = oh.trim();
    if(/^24\/7$/.test(src)) week = Array.from({length:7}, () => [[0, 1440]]);
    else {
      week = Array.from({length:7}, () => []);
      let ok = true, any = false, prevDays = null;
      // « Temporarily closed », « fermé temporairement » (commentaire seul) : fermé
      if(/^"?[^"]*\b(temporar\w* closed|closed temporar\w*|ferm[ée]e?s? (temporairement|définitivement|pour travaux)|permanently closed)\b[^"]*"?$/i.test(src)){
        week = Array.from({length:7}, () => []); cache.set(oh, week); return week;
      }
      const DAY = "(?:Mo|Tu|We|Th|Fr|Sa|Su|PH|SH)";
      const norm = src
        .replace(new RegExp("(" + DAY + ")\\s*,\\s*(?=" + DAY + "\\b)", "g"), "$1,")          // « Mo-Th, Su » → « Mo-Th,Su »
        .replace(new RegExp("(\\d)\\s*,\\s*(?=" + DAY + "\\b)", "g"), "$1\u0001");        // « 20:30, Su 09:00… » : règle en plus
      // « ; » : la règle remplace les horaires de ses jours ; « , » entre deux règles : elle s'y ajoute
      const parts = norm.split(/\s*(;|\|\||\u0001)\s*/);
      for(let i = 0; i < parts.length; i += 2){
        let rule = parts[i]; const add = parts[i - 1] === "\u0001";
        rule = rule.trim().replace(/\s+/g, " ");
        if(!rule) continue;
        if(/^"/.test(rule)) continue;                                   // commentaire : ignoré
        // jours fériés (PH) : on les retire de la liste des jours ; une règle « PH … » seule est ignorée
        rule = rule.replace(/^PH,|,PH\b/g, "");
        if(/^(PH|SH)\b/.test(rule)) continue;
        let m = /^((?:Mo|Tu|We|Th|Fr|Sa|Su)[A-Za-z,\-]*)?\s*(.*)$/.exec(rule);
        let days = m[1] ? parseDays(m[1]) : null;
        const rest = m[2].trim().replace(/\s*"[^"]*"$/, "");         // commentaire en fin de règle
        if(m[1] && !days){ ok = false; break; }
        // horaires sans jour juste après une règle avec jours (« Mo-Fr 12:00-14:30; 19:00-22:00 ») :
        // c'est la suite des mêmes jours (service du soir), pas une règle pour toute la semaine
        const cont = !days && prevDays && /^\d/.test(rest);
        if(!days) days = cont ? prevDays : [0,1,2,3,4,5,6];
        if(/^(off|closed)$/i.test(rest)){ days.forEach(d => week[d] = []); any = true; prevDays = days; continue; }
        if(rest === "24/7" || rest === "00:00-24:00"){ days.forEach(d => week[d] = [[0, 1440]]); any = true; prevDays = days; continue; }
        const times = parseTimes(rest);
        if(!times){ ok = false; break; }
        days.forEach(d => week[d] = cont || add ? week[d].concat(times.map(t => t.slice())) : times.map(t => t.slice()));
        any = true; prevDays = days;
      }
      if(!ok || !any) week = null;
    }
    cache.set(oh, week);
    return week;
  }

  const hm = min => { min = ((min % 1440) + 1440) % 1440; const h = Math.floor(min / 60), m = min % 60; return EN() ? h + ":" + String(m).padStart(2, "0") : h + "h" + (m ? String(m).padStart(2, "0") : ""); };

  // Intervalles absolus (minutes depuis le début du jour de `date`), de la veille à J+7, fusionnés s'ils se touchent
  function timeline(week, d){
    const iv = [];
    for(let k = -1; k <= 7; k++) week[(d + k + 7) % 7].forEach(([a, b]) => iv.push([k * 1440 + a, k * 1440 + b]));
    iv.sort((x, y) => x[0] - y[0]);
    const out = [];
    for(const [a, b] of iv){
      const last = out[out.length - 1];
      if(last && a <= last[1]) last[1] = Math.max(last[1], b); else out.push([a, b]);
    }
    return out;
  }

  // État à une date donnée : {state:"open"|"closed"|"unknown", closesIn, closesAt, allDay, opensAt:{inDays, min, day}}
  function at(oh, date){
    const week = parse(oh);
    if(!week) return {state:"unknown"};
    const d = (date.getDay() + 6) % 7, m = date.getHours() * 60 + date.getMinutes();
    const tl = timeline(week, d);
    const hit = tl.find(([a, b]) => m >= a && m < b);
    if(hit) return {state:"open", closesIn: hit[1] - m, closesAt: hit[1], allDay: hit[1] - m > 6 * 1440};
    const next = tl.find(([a]) => a > m);
    if(!next) return {state:"closed"};
    const inDays = Math.floor(next[0] / 1440);
    return {state:"closed", opensAt:{inDays, min: next[0] - inDays * 1440, day:(d + inDays) % 7}};
  }

  // Pour un lieu : état à l'arrivée (maintenant + marche) et pendant le temps sur place.
  // → {state, text, level:"ok"|"warn"|"closed"|"unknown"}
  function forVisit(oh, walkMin, stayMin, now){
    now = now || new Date();
    const arrive = new Date(now.getTime() + walkMin * 60000);
    const s = at(oh, arrive), n = at(oh, now);
    // pas d'horaires sur la carte, ou dans une forme qu'on ne sait pas lire : on le dit, sans deviner
    if(s.state === "unknown") return {state:"unknown", level:"unknown", text: oh ? tx("Horaires à vérifier") : tx("Horaires non indiqués")};
    if(s.state === "open"){
      // late : encore ouvert à 22 h ou plus tard (mis en avant le soir)
      const late = s.allDay || s.closesAt >= 22 * 60;
      if(s.allDay) return {state:"open", level:"ok", late, text:tx("Ouvert 24h/24")};
      if(s.closesIn < stayMin) return {state:"open", level:"warn", text:tx("Ferme à {h}, juste après ton arrivée", {h:hm(s.closesAt)})};
      if(n.state === "open" && n.closesIn <= 45) return {state:"open", level:"warn", text:tx("Ferme dans {m} min", {m:n.closesIn})};
      return {state:"open", level:"ok", late, text:tx("Ouvert · jusqu'à {h}", {h:hm(s.closesAt)})};
    }
    if(!s.opensAt) return {state:"closed", level:"closed", text:tx("Fermé")};
    const o = s.opensAt, when = o.inDays === 0 ? tx("à {h}", {h:hm(o.min)}) : o.inDays === 1 ? tx("demain à {h}", {h:hm(o.min)}) : tx("{d} à {h}", {d:(EN() ? dayName(o.day) : DAY_FR[o.day]), h:hm(o.min)});
    if(n.state === "open") return {state:"closed", level:"closed", text:tx("Fermé à ton arrivée · rouvre {w}", {w:when})};
    return {state:"closed", level:"closed", text:tx("Fermé · ouvre {w}", {w:when})};
  }

  const api = {parse, at, forVisit};
  if(typeof window !== "undefined") window.HOURS = api;
  if(typeof module !== "undefined") module.exports = api;
})();
