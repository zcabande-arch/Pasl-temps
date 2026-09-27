// Pas l'temps — recherche de lieux et d'adresses avec OpenStreetMap (Overpass + Nominatim).
// Gratuit, sans clé. Expose window.PLACES.
(function(){
  const CFG = window.PASLTEMPS_CONFIG || {};
  const OVERPASS = CFG.overpass || [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
  ];
  const NOMINATIM = CFG.nominatim || "https://nominatim.openstreetmap.org";
  // Tuiles de lieux préparées chaque semaine (branche « places » du dépôt, voir scripts/build-places.js)
  const TILES = CFG.tiles || [
    "https://raw.githubusercontent.com/zcabande-arch/Pasl-temps/places/",
    "https://cdn.jsdelivr.net/gh/zcabande-arch/Pasl-temps@places/"
  ];

  const R = 6371000, rad = x => x * Math.PI / 180;
  function meters(a, b){
    const dLa = rad(b.lat - a.lat), dLo = rad(b.lng - a.lng);
    return 2 * R * Math.asin(Math.sqrt(Math.sin(dLa/2)**2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLo/2)**2));
  }

  // "shop=bakery" → ["shop","bakery"]
  const pair = s => s.split("=");
  const matches = (tags, sel) => { const [k, v] = pair(sel); return tags[k] === v; };

  function fixUrl(u){
    if(!u) return ""; u = String(u).trim().split(";")[0];
    if(!/^https?:\/\//i.test(u)) u = "https://" + u;
    try{ const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ""; }catch(e){ return ""; }
  }
  function addrOf(t){
    const street = [t["addr:housenumber"], t["addr:street"] || t["addr:place"]].filter(Boolean).join(" ");
    const city = [t["addr:postcode"], t["addr:city"]].filter(Boolean).join(" ");
    return [street, city].filter(Boolean).join(", ");
  }
  // "Mo-Fr 07:00-19:30; Sa 08:00-13:00" → "lun.–ven. 7h–19h30 ; sam. 8h–13h"
  const DAYS = {Mo:"lun.", Tu:"mar.", We:"mer.", Th:"jeu.", Fr:"ven.", Sa:"sam.", Su:"dim.", PH:"fériés"};
  function hoursFr(h){
    if(!h) return "";
    if(h.trim() === "24/7") return "24h/24, 7j/7";
    return h.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, d => DAYS[d])
      .replace(/(\d{2}):(\d{2})/g, (_, H, M) => (+H) + "h" + (M === "00" ? "" : M))
      .replace(/(\S)-(\S)/g, "$1–$2").replace(/\boff\b/g, "fermé").replace(/;\s*/g, " ; ").replace(/,(?=\S)/g, ", ");
  }
  const CUISINE = {pizza:"pizza", burger:"burgers", kebab:"kebab", sushi:"sushis", crepe:"crêpes", sandwich:"sandwichs", french:"français",
    italian:"italien", japanese:"japonais", chinese:"chinois", indian:"indien", thai:"thaï", vietnamese:"vietnamien", lebanese:"libanais",
    mexican:"mexicain", vegetarian:"végétarien", vegan:"vegan", coffee_shop:"coffee shop", bagel:"bagels", salad:"salades", tea:"thé",
    ice_cream:"glaces", noodle:"nouilles", asian:"asiatique", regional:"régional", seafood:"fruits de mer", greek:"grec", turkish:"turc",
    korean:"coréen", spanish:"espagnol", moroccan:"marocain", african:"africain", brunch:"brunch", breakfast:"petit-déj", bubble_tea:"bubble tea"};
  const cuisineFr = c => c ? c.split(";").map(x => CUISINE[x.trim()] || x.trim().replace(/_/g, " ")).slice(0, 3).join(", ") : "";

  // Les serveurs Overpass gratuits sont parfois surchargés : on en interroge deux en même temps
  // et on garde la première réponse (l'autre requête est annulée). Le troisième sert de secours.
  let ep = 0;
  function ask(url, query, signal, ms){
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
    const stop = () => ctl.abort();
    if(signal) signal.addEventListener("abort", stop, {once:true});
    return fetch(url, {method:"POST", body:"data=" + encodeURIComponent(query),
      headers:{"Content-Type":"application/x-www-form-urlencoded"}, signal:ctl.signal})
      .then(async res => {
        if(res.status === 429) throw {code:"rate_limited"};
        if(!res.ok) throw {code: res.status >= 500 ? "server_unavailable" : "bad_request"};
        const data = await res.json();
        if(data.remark && /runtime error|timed out|out of memory/i.test(data.remark) && !(data.elements || []).length) throw {code:"server_unavailable"};
        return {data, ctl};
      })
      .catch(e => { throw e && e.code ? e : {code: navigator.onLine === false ? "offline" : "server_unavailable"}; })
      .finally(() => { clearTimeout(t); if(signal) signal.removeEventListener("abort", stop); });
  }
  async function overpass(query, signal, quick){
    const order = OVERPASS.map((_, i) => OVERPASS[(ep + i) % OVERPASS.length]);
    const first = order.slice(0, 2), rest = quick ? [] : order.slice(2);
    const tries = first.map(u => ask(u, query, signal, 30000).then(r => ({...r, u})));
    try{
      const win = await Promise.any(tries);
      tries.forEach(p => p.then(r => { if(r.u !== win.u) r.ctl.abort(); }, () => {}));
      ep = OVERPASS.indexOf(win.u);
      return win.data;
    }catch(agg){
      if(signal && signal.aborted) throw {code:"aborted"};
      let last = (agg.errors || []).find(e => e && e.code === "bad_request") || (agg.errors || [])[0];
      for(const u of rest){
        try{ const r = await ask(u, query, signal, 30000); ep = OVERPASS.indexOf(u); return r.data; }
        catch(e){ if(signal && signal.aborted) throw {code:"aborted"}; if(!last || last.code !== "bad_request") last = e; }
      }
      throw last || {code:"server_unavailable"};
    }
  }

  // ---------- Tuiles (rapide) ----------
  // Un fichier par case d'environ 5 km ; « null » = case vide (pas de fichier).
  async function getTileFile(path){
    let lastErr;
    for(const base of TILES){
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
      try{
        const res = await fetch(base + path, {signal: ctl.signal});
        if(res.status === 404) return null;
        if(res.ok) return await res.json();
        lastErr = {code: "server_unavailable"};
      }catch(e){ lastErr = {code: navigator.onLine === false ? "offline" : "server_unavailable"}; }
      finally{ clearTimeout(t); }
    }
    throw lastErr;
  }
  let indexP = null;
  function tileIndex(){
    // adresse différente chaque heure : aucune vieille copie (navigateur, service worker) ne peut resservir
    // une ancienne liste des zones couvertes (la couverture s'agrandit : France, puis Europe…)
    if(!indexP) indexP = getTileFile("index.json?h=" + Math.floor(Date.now() / 36e5)).catch(() => { indexP = null; return null; });
    return indexP;
  }
  const tileCache = new Map();
  function tile(key){
    if(!tileCache.has(key)) tileCache.set(key, getTileFile("t/" + key + ".json").then(r => r, e => { tileCache.delete(key); throw e; }));
    return tileCache.get(key);
  }
  // → mêmes résultats que la recherche Overpass, ou null si on est hors de la zone couverte par les tuiles
  async function nearbyFromTiles(pos, groups, limit){
    const idx = await tileIndex();
    if(!idx || !idx.cell) return null;
    const [aLat, aLng, bLat, bLng] = idx.bbox, m = 0.05;
    if(pos.lat < aLat - m || pos.lat > bLat + m || pos.lng < aLng - m || pos.lng > bLng + m) return null;
    const maxR = Math.max(...groups.map(g => g.radius));
    const dLat = maxR / 111320, dLng = maxR / (111320 * Math.cos(rad(pos.lat))), c = idx.cell;
    const keys = [];
    for(let i = Math.floor((pos.lat - dLat) / c); i <= Math.floor((pos.lat + dLat) / c); i++)
      for(let j = Math.floor((pos.lng - dLng) / c); j <= Math.floor((pos.lng + dLng) / c); j++) keys.push(i + "_" + j);
    const files = await Promise.all(keys.map(tile));
    const rows = files.flatMap(f => f || []);
    // Aucune donnée ni sur la case où l'on est, ni autour : zone non couverte (ex. juste après la frontière)
    const here = Math.floor(pos.lat / c) + "_" + Math.floor(pos.lng / c);
    if(!rows.length && !files[keys.indexOf(here)]) return null;
    const out = {};
    groups.forEach(g => out[g.l] = []);
    const want = groups.map(g => new Set(g.osm));
    for(const r of rows){
      const [lat, lng, sel, name, addr, oh, web, phone, cuisine, wc, id] = r;
      const sels = (Array.isArray(sel) ? sel : [sel]).map(i => idx.sels[i]);
      let dist = -1;
      groups.forEach((g, gi) => {
        if(!sels.some(x => want[gi].has(x))) return;
        if(dist < 0) dist = meters(pos, {lat, lng});
        if(dist > g.radius * 1.05) return;
        out[g.l].push({id: "osm:" + id, name, cat: cuisineFr(cuisine), addr: addr || "", phone: phone || "", url: fixUrl(web),
          hours: hoursFr(oh), oh: oh || "", wheelchair: wc === 1, lat, lng, dist});
      });
    }
    Object.keys(out).forEach(k => { out[k].sort((a, b) => a.dist - b.dist); out[k] = out[k].slice(0, limit || 12); });
    return out;
  }

  // Garde les plus proches, puis une sélection répartie jusqu'au bout du rayon (pour proposer aussi plus loin)
  function spread(list, limit){
    if(list.length <= limit) return list;
    const near = Math.ceil(limit / 2), rest = list.slice(near), n = limit - near, picked = list.slice(0, near);
    for(let i = 1; i <= n; i++) picked.push(rest[Math.min(rest.length - 1, Math.round(i * rest.length / n) - 1)]);
    return [...new Set(picked)];
  }

  // groups : [{l, osm:["shop=bakery", …], radius}] → {nomDuGroupe: [lieux triés par distance]}
  // Tuiles d'abord (quasi instantané) ; service Overpass seulement hors zone couverte ou si les tuiles ne répondent pas.
  async function nearby(pos, groups, opts){
    opts = opts || {};
    let out = null;
    try{ out = await nearbyFromTiles(pos, groups, 6000); }
    catch(e){ if(opts.signal && opts.signal.aborted) throw {code:"aborted"}; }
    if(!out) out = await nearbyOverpass(pos, groups, {...opts, limit: 600});
    // Un même lieu est parfois saisi deux fois dans OpenStreetMap (point + contour) : on n'en garde qu'un
    const norm = t => String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    Object.keys(out).forEach(k => {
      const kept = [];
      for(const p of out[k]) if(!kept.some(q => norm(q.name) === norm(p.name) && meters(q, p) < 150)) kept.push(p);
      out[k] = spread(kept, opts.limit || 12);
    });
    return out;
  }
  async function nearbyOverpass(pos, groups, opts){
    const around = r => `(around:${Math.round(r)},${pos.lat.toFixed(5)},${pos.lng.toFixed(5)})`;
    const parts = [];
    // Les « relations » (grands parcs…) sont lentes à calculer : seulement pour les espaces verts,
    // et jamais en recherche allégée (opts.lite).
    groups.forEach(g => g.osm.forEach(sel => {
      const [k, v] = pair(sel), type = !opts.lite && k === "leisure" ? "nwr" : "nw";
      parts.push(`${type}["${k}"="${v}"]["name"]${around(g.radius)};`);
    }));
    const q = `[out:json][timeout:25];(${parts.join("")});out center tags 400;`;
    const data = await overpass(q, opts.signal, opts.quick);
    const out = {};
    groups.forEach(g => out[g.l] = []);
    const seen = new Set();
    (data.elements || []).forEach(el => {
      const t = el.tags || {};
      const lat = el.lat ?? (el.center && el.center.lat), lng = el.lon ?? (el.center && el.center.lon);
      if(!isFinite(lat) || !isFinite(lng) || !t.name) return;
      if(t.access === "private" || t.disused || t["disused:shop"]) return;
      const id = "osm:" + el.type[0] + el.id;
      const dist = meters(pos, {lat, lng});
      groups.forEach(g => {
        if(dist > g.radius * 1.05 || !g.osm.some(s => matches(t, s))) return;
        const key = g.l + "|" + id; if(seen.has(key)) return; seen.add(key);
        out[g.l].push({
          id, name: t.name, cat: cuisineFr(t.cuisine), addr: addrOf(t),
          phone: t.phone || t["contact:phone"] || "", url: fixUrl(t.website || t["contact:website"] || t.url),
          hours: hoursFr(t.opening_hours), oh: t.opening_hours || "", wheelchair: t.wheelchair === "yes",
          lat, lng, dist
        });
      });
    });
    Object.keys(out).forEach(k => { out[k].sort((a, b) => a.dist - b.dist); out[k] = out[k].slice(0, opts.limit || 12); });
    return out;
  }

  function shortLabel(r){
    const a = r.address || {};
    const first = [a.house_number, a.road || a.pedestrian || a.square].filter(Boolean).join(" ") || r.name ||
      a.neighbourhood || a.suburb || a.quarter || "";
    const city = a.city || a.town || a.village || a.municipality || a.county || "";
    const label = [first, city].filter(Boolean).filter((x, i, arr) => arr.indexOf(x) === i).join(", ");
    const cc = a.country_code && a.country_code !== "fr" ? " (" + a.country_code.toUpperCase() + ")" : "";   // hors de France : le pays
    return (label || String(r.display_name || "").split(",").slice(0, 3).join(",")) + cc;
  }

  // ---------- Codes postaux ----------
  // 1) notre liste (calculée chaque semaine à partir des lieux, servie avec les tuiles) ;
  // 2) la Base Adresse Nationale (service officiel français) ; 3) OpenStreetMap, en précisant « code postal, France ».
  const BAN = CFG.ban || ["https://data.geopf.fr/geocodage/search", "https://api-adresse.data.gouv.fr/search/"];
  // Codes postaux à 5 chiffres : un fichier par préfixe (pc/75.json), avec le pays de chaque commune ;
  // les anciennes données (France seule) sont dans postcodes.json
  const pcShards = new Map();
  async function postcodeIndex(pc){
    const k = pc.slice(0, 2);
    if(!pcShards.has(k)) pcShards.set(k, (async () => {
      const idx = await tileIndex().catch(() => null);
      if(idx && idx.pcShards) return getTileFile("pc/" + k + ".json").catch(e => (e && e.status === 404 ? {} : Promise.reject(e)));
      return getTileFile("postcodes.json");
    })().catch(() => { pcShards.delete(k); return null; }));
    return pcShards.get(k);
  }
  const LANG = () => (window.I18N && I18N.lang) || "fr";
  // Pays préféré pour un code postal ambigu : celui de la commune la plus proche d'où l'on est, sinon celui du téléphone
  const localeCc = () => { const m = /-([A-Za-z]{2})\b/.exec(navigator.language || ""); return (m ? m[1] : "fr").toLowerCase(); };
  const normTxt = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  async function getJSON(url, ms){
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms || 8000);
    try{ const r = await fetch(url, {signal: ctl.signal, headers: {"Accept": "application/json"}}); return r.ok ? await r.json() : null; }
    catch(e){ return null; } finally{ clearTimeout(t); }
  }
  async function geocodePostcode(pc, hint, near){
    let list = [], ours = [];
    const idx = await postcodeIndex(pc);
    if(idx && idx[pc]){
      // on écarte le bruit (erreurs de saisie dans OpenStreetMap) : une autre commune doit compter au moins 2 lieux,
      // et « Paris 11eme Arrondissement » est une variante de « Paris »
      let raw = idx[pc];
      // plusieurs pays pour ce code (ex. 75004 Paris et 75004 Pforzheim) : on garde celui d'ici
      const ccs = [...new Set(raw.map(x => x[4] || "fr"))];
      if(ccs.length > 1){
        let pick = localeCc();
        if(near){ const best = raw.reduce((a, b) => meters(near, {lat:a[0], lng:a[1]}) <= meters(near, {lat:b[0], lng:b[1]}) ? a : b); pick = best[4] || "fr"; }
        if(ccs.includes(pick) && !hint) raw = raw.filter(x => (x[4] || "fr") === pick);
      }
      const first = normTxt(raw[0][2]);
      const pretty = c => c && c === c.toUpperCase() ? c.toLowerCase().replace(/(^|[\s-])\p{L}/gu, m => m.toUpperCase()) : c;
      const multi = new Set(raw.map(x => x[4] || "fr")).size > 1;
      list = raw.filter((x, i) => i === 0 || (x[3] >= 2 && !(first && normTxt(x[2]).startsWith(first))))
        .map(([lat, lng, city, n, cc]) => ({lat, lng, label: (pc + " " + (pretty(city) || "")).trim() + ((multi || (cc && cc !== localeCc())) && cc ? " (" + cc.toUpperCase() + ")" : "")}));
      // ville tapée avec le code mais absente de notre liste : on demande aux autres sources
      if(hint && !list.some(x => normTxt(x.label).includes(normTxt(hint)))){ ours = list; list = []; }
    }
    if(!list.length && (!near || inFrance(near))) for(const base of BAN){
      const j = await getJSON(`${base}?q=${encodeURIComponent((pc + " " + (hint || "")).trim())}&type=municipality&limit=10`);
      const feats = (j && j.features || []).filter(f => f.properties && String(f.properties.postcode) === pc && f.geometry);
      list = feats.map(f => ({lat: +f.geometry.coordinates[1], lng: +f.geometry.coordinates[0], label: `${pc} ${f.properties.city || f.properties.name || ""}`.trim()}));
      if(list.length) break;
    }
    if(!list.length){
      // pas en France (ni dans nos données) : partout
      const j = await getJSON(`${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=5&accept-language=${LANG()}&postalcode=${pc}`);
      list = (j || []).map(r => { const a = r.address || {}; return {lat: +r.lat, lng: +r.lon, label: `${pc} ${a.city || a.town || a.village || a.municipality || ""}${a.country_code && a.country_code !== "fr" ? " (" + a.country_code.toUpperCase() + ")" : ""}`.trim()}; });
    }
    list = list.filter(x => isFinite(x.lat) && isFinite(x.lng));
    if(!list.length) return ours;    // la ville tapée n'a été trouvée nulle part : communes connues pour ce code
    if(hint){ const h = normTxt(hint), m = list.filter(x => normTxt(x.label).includes(h)); if(m.length) list = m; }
    const seen = new Set();
    return list.filter(x => !seen.has(x.label) && seen.add(x.label));
  }

  const STOP = new Set("rue av ave avenue bd boulevard place pl chemin allee quai impasse route cours square passage faubourg esplanade promenade voie lieu dit des del les une sur sous aux the france".split(" "));
  const words = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter(Boolean);
  function covers(query, label){
    const have = words(label);
    return words(query).filter(w => w.length >= 3 && !/\d/.test(w) && !STOP.has(w))
      .every(w => have.some(h => h.startsWith(w.slice(0, 4)) || w.startsWith(h.slice(0, 4)) && h.length >= 4));
  }
  // Là où la BAN (adresses françaises) a du sens : métropole, Corse et Outre-mer
  const FR_BOX = [[41.3, -5.3, 51.2, 9.7], [15.8, -61.9, 16.6, -60.9], [14.3, -61.3, 14.9, -60.8], [2.1, -54.7, 5.8, -51.6],
    [-21.4, 55.2, -20.8, 55.9], [-13.1, 44.9, -12.6, 45.3], [46.7, -56.5, 47.2, -56.1]];
  const inFrance = p => FR_BOX.some(([a, b, c, d]) => p.lat >= a && p.lat <= c && p.lng >= b && p.lng <= d);
  function banLabel(p){
    if(p.type === "municipality") return `${p.name}${p.postcode ? " (" + p.postcode + ")" : ""}`;
    return [p.name, [p.postcode, p.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  }
  async function geocodeBAN(query){
    for(const base of BAN){
      const j = await getJSON(`${base}?q=${encodeURIComponent(query)}&limit=5&autocomplete=0`, 6000);
      if(!j) continue;                                  // service injoignable : on essaie le suivant
      // Sans numéro ni mot de rue (« Lyon », « Tour Eiffel », « Bruxelles »), on ne garde que des communes / lieux-dits :
      // sinon « Bruxelles » donnerait « Rue de Bruxelles » à Lille. Le reste part à Nominatim.
      const streety = /\d|\b(rue|av|avenue|bd|boulevard|place|pl|chemin|all[ée]e|quai|impasse|route|cours|square|passage|faubourg|esplanade|promenade|voie)\b/i.test(query);
      const feats = (j.features || []).filter(f => f.geometry && f.properties && f.properties.score >= 0.6 &&
        (streety || f.properties.type === "municipality" || f.properties.type === "locality"));
      // Chaque mot important tapé doit se retrouver dans la réponse : sinon « Damrak 1, Amsterdam »
      // donnerait « 1 Rue d'Amsterdam, Paris » (la BAN ne connaît que la France)
      const seen = new Set();
      return feats.filter(f => covers(query, banLabel(f.properties) + " " + (f.properties.city || "") + " " + (f.properties.context || "")))
        .map(f => ({lat: +f.geometry.coordinates[1], lng: +f.geometry.coordinates[0], label: banLabel(f.properties)}))
        .filter(x => isFinite(x.lat) && isFinite(x.lng) && !seen.has(x.label) && seen.add(x.label)).slice(0, 4);
    }
    return [];
  }

  // Photon (Komoot, données OpenStreetMap) : secours si Nominatim ne répond pas
  async function geocodePhoton(query){
    const j = await getJSON(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=4&lang=${["en", "de", "it"].includes(LANG()) ? LANG() : LANG() === "fr" ? "fr" : "en"}`, 6000);
    const seen = new Set();
    return ((j && j.features) || []).filter(f => f.geometry).map(f => {
      const p = f.properties || {}, first = [p.housenumber, p.street].filter(Boolean).join(" ") || p.name || "";
      const label = [first, p.city || p.town || p.village || p.county, p.countrycode && p.countrycode !== "FR" ? p.countrycode : ""].filter(Boolean)
        .filter((x, i, a) => a.indexOf(x) === i).join(", ");
      return {lat: +f.geometry.coordinates[1], lng: +f.geometry.coordinates[0], label: label || query};
    }).filter(x => isFinite(x.lat) && isFinite(x.lng) && !seen.has(x.label) && seen.add(x.label));
  }

  async function geocode(query, near){
    // « 75011 », « 75011 Paris » ou « Paris 75011 » : recherche par code postal
    const pcm = /^\s*(?:(.*?)[\s,]+)?(\d{5})(?:[\s,]+(.*?))?\s*$/.exec(query || "");
    if(pcm && !/\d/.test((pcm[1] || "") + (pcm[3] || ""))){
      const found = await geocodePostcode(pcm[2], [pcm[1], pcm[3]].filter(Boolean).join(" "), near);
      if(found.length) return found;
      if(!pcm[1] && !pcm[3]) return [];
    }
    // En France : Base Adresse Nationale (service public, libre, sans limite commerciale), Nominatim en secours.
    // Ailleurs (ou téléphone réglé dans une autre langue sans position connue) : Nominatim d'abord.
    const frHere = near ? inFrance(near) : (LANG() === "fr" || localeCc() === "fr");
    if(frHere){
      const ban = await geocodeBAN(query);
      if(ban.length) return ban;
      return nominatim(query, near);
    }
    let err = null, found = [];
    try{ found = await nominatim(query, near); }catch(e){ err = e; }
    if(found.length) return found;
    if(!near || inFrance(near)){ const ban = await geocodeBAN(query); if(ban.length) return ban; }
    if(err) throw err;
    return found;
  }
  // Nominatim (OpenStreetMap, monde entier), avec préférence pour les résultats proches d'où l'on est ; Photon en secours
  async function nominatim(query, near){
    const box = near ? `&viewbox=${(near.lng - 1).toFixed(3)},${(near.lat + 1).toFixed(3)},${(near.lng + 1).toFixed(3)},${(near.lat - 1).toFixed(3)}` : "";
    const u = `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=4&accept-language=${LANG()}${box}&q=${encodeURIComponent(query)}`;
    let res;
    try{ res = await fetch(u, {headers:{"Accept":"application/json"}}); }
    catch(e){ if(navigator.onLine === false) throw {code:"offline"}; res = null; }
    if(!res || !res.ok){
      const ph = await geocodePhoton(query);
      if(ph.length) return ph;
      if(!res) throw {code:"server_unavailable"};
      if(res.status === 429) throw {code:"rate_limited"};
      throw {code:"server_unavailable"};
    }
    const list = await res.json();
    const seen = new Set();
    return list.map(r => ({lat:+r.lat, lng:+r.lon, label:shortLabel(r)}))
      .filter(x => isFinite(x.lat) && isFinite(x.lng) && !seen.has(x.label) && seen.add(x.label));
  }

  // Nom de la ville où l'on est (position GPS sans nom) : Nominatim, une fois par endroit
  const towns = new Map();
  function townAt(pos){
    const k = pos.lat.toFixed(2) + "," + pos.lng.toFixed(2);
    if(!towns.has(k)) towns.set(k, getJSON(`${NOMINATIM}/reverse?format=jsonv2&zoom=10&addressdetails=1&accept-language=${LANG()}&lat=${pos.lat}&lon=${pos.lng}`, 6000)
      .then(j => { const a = (j && j.address) || {}; return a.city || a.town || a.village || a.municipality || null; }));
    return towns.get(k);
  }

  window.PLACES = {nearby, geocode, townAt, meters, isPostcode: q => /^\s*\d{5}\s*$/.test(q || "")};
})();
