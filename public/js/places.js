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
    if(!indexP) indexP = getTileFile("index.json").catch(() => { indexP = null; return null; });
    return indexP;
  }
  const tileCache = new Map();
  function tile(key){
    if(!tileCache.has(key)) tileCache.set(key, getTileFile("t/" + key + ".json").then(r => r || [], e => { tileCache.delete(key); throw e; }));
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
    const rows = (await Promise.all(keys.map(tile))).flat();
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
    return label || String(r.display_name || "").split(",").slice(0, 3).join(",");
  }

  async function geocode(query){
    const u = `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=4&accept-language=fr&q=${encodeURIComponent(query)}`;
    let res;
    try{ res = await fetch(u, {headers:{"Accept":"application/json"}}); }
    catch(e){ throw {code: navigator.onLine === false ? "offline" : "server_unavailable"}; }
    if(res.status === 429) throw {code:"rate_limited"};
    if(!res.ok) throw {code:"server_unavailable"};
    const list = await res.json();
    const seen = new Set();
    return list.map(r => ({lat:+r.lat, lng:+r.lon, label:shortLabel(r)}))
      .filter(x => isFinite(x.lat) && isFinite(x.lng) && !seen.has(x.label) && seen.add(x.label));
  }

  window.PLACES = {nearby, geocode, meters};
})();
