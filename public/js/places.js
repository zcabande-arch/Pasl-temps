// Pas l'temps — recherche de lieux et d'adresses avec OpenStreetMap (Overpass + Nominatim).
// Gratuit, sans clé. Expose window.PLACES.
(function(){
  const CFG = window.PASLTEMPS_CONFIG || {};
  const OVERPASS = CFG.overpass || [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
  ];
  const NOMINATIM = CFG.nominatim || "https://nominatim.openstreetmap.org";

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

  let ep = 0;
  async function overpass(query, signal){
    let lastErr;
    for(let i = 0; i < OVERPASS.length; i++){
      const url = OVERPASS[(ep + i) % OVERPASS.length];
      try{
        const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 25000);
        if(signal) signal.addEventListener("abort", () => ctl.abort(), {once:true});
        const res = await fetch(url, {method:"POST", body:"data=" + encodeURIComponent(query),
          headers:{"Content-Type":"application/x-www-form-urlencoded"}, signal:ctl.signal});
        clearTimeout(t);
        if(res.status === 429 || res.status >= 500){ lastErr = {code: res.status === 429 ? "rate_limited" : "server_unavailable"}; continue; }
        if(!res.ok) throw {code:"bad_request"};
        ep = (ep + i) % OVERPASS.length;
        return await res.json();
      }catch(e){
        if(signal && signal.aborted) throw {code:"aborted"};
        lastErr = e && e.code ? e : {code: navigator.onLine === false ? "offline" : "server_unavailable"};
      }
    }
    throw lastErr || {code:"server_unavailable"};
  }

  // groups : [{l, osm:["shop=bakery", …], radius}] → {nomDuGroupe: [lieux triés par distance]}
  async function nearby(pos, groups, opts){
    opts = opts || {};
    const around = r => `(around:${Math.round(r)},${pos.lat.toFixed(5)},${pos.lng.toFixed(5)})`;
    const parts = [];
    groups.forEach(g => g.osm.forEach(sel => { const [k, v] = pair(sel); parts.push(`nwr["${k}"="${v}"]["name"]${around(g.radius)};`); }));
    const q = `[out:json][timeout:20];(${parts.join("")});out center tags 400;`;
    const data = await overpass(q, opts.signal);
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
