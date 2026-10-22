// Fissa Fissa — vrais temps de trajet par les rues (et non à vol d'oiseau).
// Service libre OSRM de FOSSGIS (routing.openstreetmap.de, le même que celui d'openstreetmap.org),
// profils piéton, vélo et voiture. En cas d'échec, l'appli garde son estimation habituelle.
(function(){
  const BASE = "https://routing.openstreetmap.de/routed-";
  const PROFILE = {walk: "foot", bike: "bike", car: "car"};
  const CHUNK = 50;                         // destinations par requête
  const KEY = "pasltemps.routes1", KEEP = 7 * 864e5, MAX = 1500;
  let CACHE = {};
  try{ CACHE = JSON.parse(localStorage.getItem(KEY) || "{}"); }catch(e){ CACHE = {}; }
  const now = Date.now();
  for(const k in CACHE) if(!CACHE[k] || now - CACHE[k][1] > KEEP) delete CACHE[k];
  let saveT = null;
  function save(){
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      const keys = Object.keys(CACHE);
      if(keys.length > MAX) keys.sort((a, b) => CACHE[a][1] - CACHE[b][1]).slice(0, keys.length - MAX).forEach(k => delete CACHE[k]);
      try{ localStorage.setItem(KEY, JSON.stringify(CACHE)); }catch(e){}
    }, 800);
  }
  // le point de départ est arrondi à ~30 m : bouger un peu ne relance pas tout
  const origin = pos => pos.lat.toFixed(4) + "," + pos.lng.toFixed(4);
  const key = (mode, pos, p) => mode + "|" + origin(pos) + "|" + (p.id || (p.lat.toFixed(5) + "," + p.lng.toFixed(5)));

  // durée aller en secondes déjà connue, sinon undefined (null = aucun chemin trouvé)
  function known(mode, pos, p){ const c = CACHE[key(mode, pos, p)]; return c ? c[0] : undefined; }

  const busy = new Set();
  async function fetchChunk(mode, pos, list, signal){
    const pts = [[pos.lng, pos.lat], ...list.map(p => [p.lng, p.lat])].map(([x, y]) => x.toFixed(6) + "," + y.toFixed(6)).join(";");
    const url = `${BASE}${PROFILE[mode] || "foot"}/table/v1/driving/${pts}?sources=0&annotations=duration`;
    const r = await fetch(url, {signal});
    if(!r.ok) throw {code: "route_" + r.status};
    const j = await r.json();
    if(j.code !== "Ok" || !j.durations || !j.durations[0]) throw {code: "route_bad"};
    const t = Date.now();
    list.forEach((p, i) => { const s = j.durations[0][i + 1]; CACHE[key(mode, pos, p)] = [s == null ? null : Math.round(s), t]; });
    save();
  }
  // calcule les trajets manquants ; renvoie true si au moins un temps a été ajouté
  async function fill(mode, pos, places, signal){
    const todo = places.filter(p => known(mode, pos, p) === undefined && !busy.has(key(mode, pos, p)));
    if(!todo.length) return false;
    todo.forEach(p => busy.add(key(mode, pos, p)));
    let added = false;
    try{
      for(let i = 0; i < todo.length; i += CHUNK){
        try{ await fetchChunk(mode, pos, todo.slice(i, i + CHUNK), signal); added = true; }
        catch(e){ if(e && e.name === "AbortError") break; }
      }
    } finally { todo.forEach(p => busy.delete(key(mode, pos, p))); }
    return added;
  }
  window.ROUTES = {known, fill};
})();
