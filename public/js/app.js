// Page et code doivent être de la même version : sinon (page gardée en mémoire par le navigateur),
// on recharge une fois la page fraîche.
const APP_VERSION = "26";
(function(){
  const m = document.querySelector('meta[name="app-version"]');
  if((m && m.content) === APP_VERSION) return;
  let done = false; try{ done = sessionStorage.getItem("pasltemps.reload") === APP_VERSION; sessionStorage.setItem("pasltemps.reload", APP_VERSION); }catch(e){}
  if(done) return;
  fetch(location.pathname, {cache: "reload"}).catch(() => {}).finally(() => location.reload());
  throw new Error("Ancienne page : rechargement");
})();

// Chaque envie = des rubriques, chacune une recherche OpenStreetMap (étiquettes osm). stay = temps minimum sur place (min).
const MOODS = {
  manger: {img:"img/moods/manger.jpg", d:"Boulangeries, cafés, snacks", e:"🥐", l:"Manger", sl:"Manger", groups:[
    {l:"Boulangeries", em:"🥖", h:35, osm:["shop=bakery","shop=pastry"], stay:5, q:"boulangerie"},
    {l:"Cafés, salons de thé", em:"☕", h:20, osm:["amenity=cafe"], stay:10, q:"café"},
    {l:"Sur le pouce", em:"🌯", h:5, osm:["amenity=fast_food","amenity=food_court"], stay:30, q:"snack"},
    {l:"Glaciers", em:"🍦", h:320, osm:["amenity=ice_cream","shop=ice_cream"], stay:20, q:"glacier"},
    {l:"Restaurants", em:"🍝", h:0, osm:["amenity=restaurant"], stay:60, q:"restaurant"}]},
  air: {img:"img/moods/air.jpg", d:"Parcs, jardins, points de vue", e:"🌳", l:"Prendre l'air", sl:"Prendre l'air", groups:[
    {l:"Parcs, jardins", em:"🌳", h:130, osm:["leisure=park","leisure=garden","tourism=picnic_site"], stay:10, q:"parc"},
    {l:"Espaces verts, points de vue", em:"🌲", h:150, osm:["leisure=nature_reserve","tourism=viewpoint","leisure=common"], stay:15, q:"espace vert"}]},
  shopping: {img:"img/moods/shopping.jpg", d:"Galeries, marchés, cadeaux", e:"🛍️", l:"Galerie marchande", sl:"Shopping", groups:[
    {l:"Centres commerciaux, grands magasins", em:"🛍️", h:270, osm:["shop=mall","shop=department_store"], stay:15, q:"centre commercial"},
    {l:"Marchés", em:"🧺", h:45, osm:["amenity=marketplace","shop=farm"], stay:10, q:"marché"},
    {l:"Cadeaux, souvenirs", em:"🎁", h:340, osm:["shop=gift","shop=souvenir"], stay:8, q:"boutique cadeaux"}]},
  culture: {img:"img/moods/culture.jpg", d:"Musées, librairies, monuments", e:"📚", l:"Culture", sl:"Culture", groups:[
    {l:"Librairies", em:"📖", h:210, osm:["shop=books"], stay:10, q:"librairie"},
    {l:"Monuments, curiosités", em:"🏛️", h:190, osm:["historic=monument","tourism=attraction","historic=castle","amenity=place_of_worship"], stay:5, q:"monument"},
    {l:"Bibliothèques", em:"📚", h:230, osm:["amenity=library"], stay:15, q:"bibliothèque"},
    {l:"Musées, galeries", em:"🖼️", h:260, osm:["tourism=museum","tourism=gallery"], stay:60, q:"musée"}]},
  poser: {img:"img/moods/poser.jpg", d:"Salons de thé, parcs", e:"🛋️", l:"Se poser au calme", sl:"Au calme", groups:[
    {l:"Salons de thé, cafés", em:"🫖", h:20, osm:["amenity=cafe"], stay:15, q:"salon de thé"},
    {l:"Parcs", em:"🌳", h:130, osm:["leisure=park","leisure=garden"], stay:10, q:"parc"},
    {l:"Bibliothèques", em:"📚", h:230, osm:["amenity=library"], stay:15, q:"bibliothèque"}]},
  bouger: {img:"img/moods/bouger.jpg", d:"Parcs, salles de sport", e:"🏃", l:"Bouger", sl:"Bouger", groups:[
    {l:"Parcs pour marcher ou courir", em:"👟", h:130, osm:["leisure=park","leisure=track","leisure=nature_reserve"], stay:10, q:"parc"},
    {l:"Salles de sport", em:"🏋️", h:200, osm:["leisure=fitness_centre","leisure=sports_centre"], stay:30, q:"salle de sport", minT:45}]}
};

let T = 20, M = "manger", pos = null, geoState = "wait";
let LOADED = {};               // groupe -> {state, items, err}
let runId = 0, pickedId = null;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

// Marche : 80 m/min, +30 % de détours
// ---------- Profil (gardé sur l'appareil) ----------
const PROFILE_KEY = "pasltemps.profile";
let PROFILE = {name:"", age:"", gender:"", prefs:[], photo:""};
try{ PROFILE = {...PROFILE, ...JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}")}; }catch(e){}
if(!Array.isArray(PROFILE.prefs)) PROFILE.prefs = [];
function saveProfile(){
  try{ localStorage.setItem(PROFILE_KEY, JSON.stringify(PROFILE)); }
  catch(e){ try{ localStorage.setItem(PROFILE_KEY, JSON.stringify({...PROFILE, photo:""})); }catch(_){} }
  scheduleBackup();
}
// Types d'endroits qu'on peut préférer (étiquettes OpenStreetMap correspondantes)
const PREF_TYPES = [
  {k:"bakery",  l:"Boulangeries",        ico:"baguette", sels:["shop=bakery","shop=pastry"]},
  {k:"cafe",    l:"Cafés, salons de thé", ico:"cup",      sels:["amenity=cafe"]},
  {k:"fast",    l:"Sur le pouce",        ico:"sandwich", sels:["amenity=fast_food","amenity=food_court"]},
  {k:"ice",     l:"Glaciers",            ico:"icecream", sels:["amenity=ice_cream","shop=ice_cream"]},
  {k:"resto",   l:"Restaurants",         ico:"plate",    sels:["amenity=restaurant"]},
  {k:"park",    l:"Parcs, jardins",      ico:"tree",     sels:["leisure=park","leisure=garden","tourism=picnic_site"]},
  {k:"nature",  l:"Nature, points de vue", ico:"forest", sels:["leisure=nature_reserve","tourism=viewpoint","leisure=common"]},
  {k:"shop",    l:"Shopping",            ico:"bag",      sels:["shop=mall","shop=department_store","shop=gift","shop=souvenir"]},
  {k:"market",  l:"Marchés",             ico:"market",   sels:["amenity=marketplace","shop=farm"]},
  {k:"books",   l:"Librairies",          ico:"openbook", sels:["shop=books"]},
  {k:"museum",  l:"Musées, galeries",    ico:"frame",    sels:["tourism=museum","tourism=gallery"]},
  {k:"monument",l:"Monuments",           ico:"monument", sels:["historic=monument","tourism=attraction","historic=castle","amenity=place_of_worship"]},
  {k:"library", l:"Bibliothèques",       ico:"books",    sels:["amenity=library"]},
  {k:"sport",   l:"Sport",               ico:"dumbbell", sels:["leisure=fitness_centre","leisure=sports_centre","leisure=track"]}
];
function isPreferred(g){
  if(!PROFILE.prefs.length || !g) return false;
  const want = new Set(PREF_TYPES.filter(t => PROFILE.prefs.includes(t.k)).flatMap(t => t.sels));
  return g.osm.some(x => want.has(x));
}

// Moyens de transport : vitesse en ville (m/min), détours (×), temps fixe par trajet (min : garer, attacher le vélo…)
const TRAVEL = {
  walk: {l:"À pied",  ico:"walk", e:"🚶", speed:80,  detour:1.3, over:0, cap:3000, gm:"walking",   of:"de marche", way:"à pied",     rings:[2,5,10,15,20]},
  bike: {l:"Vélo",    ico:"bike", e:"🚲", speed:250, detour:1.3, over:1, cap:3000, gm:"bicycling", of:"de vélo",   way:"à vélo",     rings:[3,5,10,15,20]},
  car:  {l:"Voiture", ico:"car",  e:"🚗", speed:400, detour:1.4, over:4, cap:3500, gm:"driving",   of:"de route",  way:"en voiture", rings:[5,8,12,16,20]}
};
const TR = () => TRAVEL[SET.travel] || TRAVEL.walk;
// Durées lisibles : 45 → « 45 min », 60 → « 1 h », 90 → « 1 h 30 »
const fmtDur = m => { m = Math.round(m); if(m < 60) return m + " min"; const h = Math.floor(m / 60), r = m % 60; return h + " h" + (r ? " " + String(r).padStart(2, "0") : ""); };
// Code couleur selon l'éloignement : part du trajet aller maximal possible pour le temps choisi
const BANDS = [
  {max:.25, c:"#2E9E5B", l:"Tout près"},
  {max:.5,  c:"#D39A00", l:"Proche"},
  {max:.75, c:"#EA6A1B", l:"Un peu loin"},
  {max:9,   c:"#D7261E", l:"Juste à temps"}
];
function maxLeg(){
  const gs = groupsNow(); if(!gs.length) return 1;
  return Math.max(1, (T - Math.min(...gs.map(g => g.stay))) / 2);
}
const bandOf = walk => BANDS.find(b => walk / maxLeg() <= b.max);
// Minutes de trajet pour une distance à vol d'oiseau (m)
const travelOf = d => { const t = TR(); return Math.max(1, Math.round(d * t.detour / t.speed + t.over)); };
// Distance maximale pour que aller + retour + temps sur place tiennent dans t minutes
const radiusFor = (stay, t = T) => { const m = TR(); return Math.min(m.cap, Math.max(150, ((t - stay) / 2 - m.over) * m.speed / m.detour)); };
const fits = (g, t) => (!g.minT || t >= g.minT) && t - g.stay - 2 * TR().over >= 2;
const groupsNow = () => MOODS[M].groups.filter(g => fits(g, T));
function dirUrl(p){ return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=${TR().gm}`; }
function mapsSearch(q){ return pos ? `https://www.google.com/maps/search/${encodeURIComponent(q)}/@${pos.lat.toFixed(5)},${pos.lng.toFixed(5)},16z` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q+" à proximité")}`; }

// ---------- Recherche des lieux ----------
// Les résultats sont gardés sur l'appareil (12 h) : même endroit + même envie = affichage immédiat,
// puis mise à jour discrète s'ils ont plus de 20 min. On cherche d'emblée assez loin pour 30 min,
// pour que passer de 10 à 20 ou 30 min ne relance pas de recherche.
const PC_KEY = "pasltemps.placecache2", PC_FRESH = 20 * 60e3, PC_KEEP = 12 * 3600e3;
let PCACHE = [];
try{ PCACHE = JSON.parse(localStorage.getItem(PC_KEY) || "[]").filter(e => Date.now() - e.at < PC_KEEP); }catch(e){ PCACHE = []; }
function pcSave(){
  for(let n = 12; n > 0; n = Math.floor(n / 2)){
    try{ localStorage.setItem(PC_KEY, JSON.stringify(PCACHE.slice(0, n))); return; }catch(e){}
  }
}
function pcFind(mood, need){
  return PCACHE.find(e => e.m === mood && Date.now() - e.at < PC_KEEP && PLACES.meters(e.pos, pos) < 80 &&
    Object.entries(need).every(([g, r]) => (e.radii[g] || 0) >= r - 1));
}
let searchCtl = null;
function showFound(entry, groups, need){
  groups.forEach(g => {
    const fit = (entry.found[g.l] || []).map(p => ({...p, dist: PLACES.meters(pos, p)}))
      .filter(p => p.dist <= need[g.l] * 1.05)
      .sort((a, b) => a.dist - b.dist)
      .map(p => ({...p, walk: travelOf(p.dist), g:g.l, stay:g.stay, em:g.em, h:g.h}))
      .filter(p => 2*p.walk + g.stay <= T);
    LOADED[g.l] = {state:"ok", items: fit};
  });
}
async function search(){
  const my = ++runId; pickedId = null; $("ideaTxt").textContent = "";
  LOADED = {};
  if(searchCtl) searchCtl.abort();
  const groups = groupsNow();
  if(!pos){ renderResults(); return; }
  const need = Object.fromEntries(groups.map(g => [g.l, Math.round(radiusFor(g.stay))]));
  const hit = pcFind(M, need);
  if(hit){
    showFound(hit, groups, need); renderResults();
    if(Date.now() - hit.at < PC_FRESH) return;
  } else {
    groups.forEach(g => LOADED[g.l] = {state:"loading"});
    renderResults();
  }
  // On cherche au moins pour 30 min (les petits changements de temps restent instantanés)
  const Tw = Math.max(T, 30);
  const wide = Object.fromEntries(MOODS[M].groups.filter(g => fits(g, Tw)).map(g => [g.l, Math.round(radiusFor(g.stay, Tw))]));
  groups.forEach(g => { wide[g.l] = Math.max(wide[g.l] || 0, need[g.l]); });
  const fetchGroups = MOODS[M].groups.filter(g => wide[g.l]);
  try{
    searchCtl = new AbortController();
    let radii = wide, found;
    try{
      found = await PLACES.nearby(pos, fetchGroups.map(g => ({l:g.l, osm:g.osm, radius:wide[g.l]})), {signal:searchCtl.signal, limit:24, quick:true});
    }catch(err){
      if(!err || err.code === "aborted" || err.code === "bad_request" || err.code === "offline" || my !== runId) throw err;
      // Service surchargé : on réessaie une fois, plus petit (juste le temps choisi) et plus léger
      if(!hit){ groups.forEach(g => LOADED[g.l] = {state:"loading", slow:true}); renderResults(); }
      radii = need;
      found = await PLACES.nearby(pos, groups.map(g => ({l:g.l, osm:g.osm, radius:need[g.l]})), {signal:searchCtl.signal, limit:24, lite:true});
    }
    const wideUsed = radii;
    const entry = {m:M, pos:{lat:pos.lat, lng:pos.lng}, at:Date.now(), radii:wideUsed, found};
    // on remplace seulement les anciennes recherches du même endroit entièrement couvertes par celle-ci
    const covered = e => e.m === M && PLACES.meters(e.pos, entry.pos) < 80 && Object.entries(e.radii).every(([g, r]) => (wideUsed[g] || 0) >= r);
    PCACHE = [entry, ...PCACHE.filter(e => !covered(e))];
    pcSave();
    if(my !== runId) return;
    const before = JSON.stringify(Object.values(LOADED).map(x => (x.items || []).map(p => p.id)));
    showFound(entry, groups, need);
    if(!hit || JSON.stringify(Object.values(LOADED).map(x => (x.items || []).map(p => p.id))) !== before) renderResults();
  }catch(err){
    if(my !== runId || (err && err.code === "aborted") || hit) return;   // avec des résultats déjà affichés, on garde ceux-là
    groups.forEach(g => LOADED[g.l] = {state:"err", err});
    renderResults();
  }
}

function errText(err){
  const c = err && err.code;
  if(c === "offline") return "Pas de connexion internet.";
  if(c === "rate_limited") return "Trop de recherches d'un coup, réessayez dans une minute.";
  if(c === "server_unavailable") return "Le service de carte (OpenStreetMap, gratuit) est surchargé en ce moment. Réessayez dans une minute.";
  if(c === "bad_request") return "La recherche n'a pas été comprise par le service de carte.";
  return "Recherche impossible pour l'instant.";
}

function placeEl(p){
  const n = HIST.filter(h => h.pid === p.id && h.done).length;
  const el = document.createElement("div");
  el.className = "place" + (p.id === pickedId ? " picked open" : "") + (p.open && p.open.level === "closed" ? " closed" : "");
  el.style.setProperty("--h", p.h);
  el.id = "p-" + p.id.replace(/[^\w-]/g,"");
  const total = 2*p.walk + p.stay, band = bandOf(p.walk);
  const wPct = Math.min(50, p.walk/T*100), sPct = Math.min(100-2*wPct, p.stay/T*100);
  const free = Math.max(0, T - total);
  const rv = reviewsFor(p), who = [...new Set(rv.map(r => r.author.pseudo || "Quelqu'un"))];
  const hrs = rv.find(r => r.hours);
  const grp = findGroup(p), avg = grp && grp.avg;
  el.innerHTML = `<button aria-expanded="false"><span class="emo" aria-hidden="true">${ICONS.ico(p.em, 34)}</span><span class="txt"><span class="nm">${esc(p.name)}${n?`<span class="badge">fait ${n}×</span>`:""}</span><span class="tot"><b>${fmtDur(total)} au total</b> · ${p.walk} min aller · ${fmtDur(p.stay)} sur place · ${p.walk} min retour</span>${avg?`<span class="rvsc">★ ${avg.toFixed(1).replace(".",",")} <span style="color:var(--soft);font-weight:400">(${grp.rated} avis)</span></span>`:""}${p.open && p.open.text ? `<span class="oh oh-${p.open.level}">${esc(p.open.text)}</span>` : ""}<span class="sub">${p.first?`<span class="sticker">⚡ le plus proche</span>`:""}${esc((p.addr||"").split(",")[0])}</span>${who.length?`<span class="pals">😋 ${esc(who.slice(0,2).join(", "))}${who.length>2?` +${who.length-2}`:""} ${who.length>1?"y sont allés":"y est allé·e"}</span>`:""}<span class="tbar" aria-hidden="true"><i class="w" style="width:${wPct}%"></i><i class="s" style="width:${sPct}%"></i><i class="w" style="width:${wPct}%"></i></span></span><span class="ticket" style="--band:${band.c}"><b>${p.walk}</b><span>min ${ICONS.ico(TR().ico, 14)}</span></span></button>
    <div class="det">
      <p class="legend">${TR().e} Aller ${p.walk} min · ⏱️ Sur place ${fmtDur(p.stay)} minimum · ${TR().e} Retour ${p.walk} min = <b>${fmtDur(total)}</b>${free?` · il te restera ${fmtDur(free)}`:""}</p>
      ${p.addr?`<p>${esc(p.addr)}</p>`:""}
      ${p.phone?`<p><a href="tel:${esc(p.phone.replace(/\s/g,""))}">${esc(p.phone)}</a></p>`:""}
      ${p.hours?`<p class="legend">🕐 ${esc(p.hours)}</p>`:""}
      ${p.cat||p.wheelchair?`<div class="tags">${p.cat?`<span>🍽️ ${esc(p.cat)}</span>`:""}${p.wheelchair?`<span>♿ accessible</span>`:""}</div>`:""}
      ${hrs?`<p class="legend">🕐 ${esc(hrs.hours)} (signalé par ${esc(hrs.author.pseudo||"un pote")}, ${esc(whenTxt(hrs.at).toLowerCase())})</p>`:""}
      <div class="rvs"></div>
      <div class="acts"><a class="go" target="_blank" rel="noopener" href="${dirUrl(p)}">${TR().e} Je pars</a><button class="ghost tog2 fv" aria-pressed="${!!LISTS.fav[p.id]}">⭐</button><button class="ghost tog2 td" aria-pressed="${!!LISTS.todo[p.id]}">📌 À tester</button>${p.url?`<a class="ghost" target="_blank" rel="noopener" href="${esc(p.url)}">Site web</a>`:""}</div>
    </div>`;
  const head = el.querySelector("button");
  head.onclick = () => { el.classList.toggle("open"); head.setAttribute("aria-expanded", String(el.classList.contains("open"))); };
  el.querySelector(".go").addEventListener("click", () => { const h = logVisit(p); startTimer(p, h); });
  el.querySelector(".fv").onclick = e => { toggleList("fav", p); e.currentTarget.setAttribute("aria-pressed", String(!!LISTS.fav[p.id])); };
  el.querySelector(".td").onclick = e => { toggleList("todo", p); e.currentTarget.setAttribute("aria-pressed", String(!!LISTS.todo[p.id])); };
  const rvBox = el.querySelector(".rvs");
  rv.filter(r => r.text).slice(0,2).forEach(r => { const q = document.createElement("div"); q.className = "quote"; q.innerHTML = `<b></b> `; q.firstChild.textContent = (r.author.pseudo||"Quelqu'un") + " :"; q.appendChild(document.createTextNode(r.text.length > 140 ? r.text.slice(0,140) + "…" : r.text)); rvBox.appendChild(q); });
  return el;
}

function renderResults(){
  // « J'ai 20 minutes. » / « J'ai 1 heure. » / « J'ai 1 h 30. » / « J'ai 2 heures. »
  const [num, unit] = T < 60 ? [T, " minutes"] : T % 60 ? [fmtDur(T), ""] : [T / 60, T === 60 ? " heure" : " heures"];
  const h1 = document.querySelector(".hero2 .display, .hero .display");
  if(h1 && !$("unitTxt")) h1.innerHTML = `J'ai <em id="numTxt"></em><span id="unitTxt"></span>.`;
  $("numTxt").textContent = num; $("unitTxt").textContent = unit;
  if($("arc")) $("arc").setAttribute("stroke-dashoffset", (326.73 * (1 - T/60)).toFixed(1));
  const R = $("results"); R.innerHTML = "";
  const s = $("status");
  // Statut
  if(geoState === "wait") s.textContent = "Localisation en cours…";
  else if(geoState === "no") s.textContent = "Tapez une adresse ou une ville ci-dessus pour voir les lieux autour.";
  else s.textContent = `Lieux où aller, en profiter et revenir ${TR().way} tient dans tes ${fmtDur(T)}.`;

  const groups = groupsNow().map((g, i) => ({g, i})).sort((a, b) => (isPreferred(b.g) - isPreferred(a.g)) || a.i - b.i).map(x => x.g);
  if(!groups.length){ R.innerHTML = `<p class="status">${fmtDur(T)}, c'est court pour ça. Choisis un peu plus de temps.</p>`; $("idea").classList.remove("on"); return; }
  let total = 0;
  // Filtre « ouverts seulement », affiché dès qu'on connaît des horaires
  const known = allLoaded().some(p => HOURS.parse(p.oh));
  if(known){
    const f = document.createElement("div"); f.className = "sortrow openrow";
    f.innerHTML = `<button class="chip" aria-pressed="${!!SET.openOnly}">🕐 Ouverts seulement</button><span>à ton arrivée</span>`;
    f.querySelector("button").onclick = () => { SET.openOnly = !SET.openOnly; saveSet(); renderResults(); };
    R.appendChild(f);
  }
  const rd = radarEl(); if(rd) R.appendChild(rd);
  groups.forEach(g => {
    const st = LOADED[g.l];
    const sec = document.createElement("section"); sec.className = "group"; sec.style.setProperty("--h", g.h);
    // Ouvert / fermé à l'arrivée : les lieux fermés passent en bas (ou disparaissent avec le filtre)
    const all = st && st.items ? st.items.map(p => ({...p, open: HOURS.forVisit(p.oh, p.walk, p.stay)})) : [];
    const items = all.filter(p => !SET.openOnly || p.open.level !== "closed")
      .sort((a, b) => (a.open.level === "closed") - (b.open.level === "closed") || a.dist - b.dist);
    if(items[0] && items[0].open.level !== "closed") items[0].first = true;
    const n = items.length; total += n;
    sec.innerHTML = `<h3><span><span class="gi">${ICONS.ico(g.em, 22)}</span>${esc(g.l)}${isPreferred(g) ? `<span class="pref" title="Dans tes préférences">♥</span>` : ""}</span> ${n?`<small>${n}</small>`:""}</h3>`;
    if(!st){
      sec.innerHTML += `<p class="note"><a class="link" target="_blank" rel="noopener" href="${mapsSearch(g.q)}">Chercher « ${esc(g.q)} » sur la carte</a></p>`;
    } else if(st.state === "loading"){
      sec.innerHTML += `<p class="note">${st.slow ? "Le service de carte est chargé, je réessaie…" : "Recherche…"}</p>`;
    } else if(st.state === "err"){
      sec.innerHTML += `<p class="note err">${esc(errText(st.err))} <button class="link retry">Réessayer</button> · <a class="link" target="_blank" rel="noopener" href="${mapsSearch(g.q)}">Google Maps</a></p>`;
      sec.querySelector(".retry").onclick = () => search();
    } else if(!n){
      sec.innerHTML += `<p class="note">${all.length ? "Tout est fermé à cette heure-ci." : `Rien d'assez proche pour ${fmtDur(T)}.`}</p>`;
    } else {
      const SHOW = 6, all = EXPANDED.has(g.l);
      (all ? items : items.slice(0, SHOW)).forEach(p => sec.appendChild(placeEl(p)));
      if(items.length > SHOW){
        const more = document.createElement("button"); more.className = "more-btn";
        more.textContent = all ? "Voir moins" : `Voir plus (${items.length - SHOW}), jusqu'à ${items[items.length - 1].walk} min ${TR().way}`;
        more.onclick = () => { all ? EXPANDED.delete(g.l) : EXPANDED.add(g.l); renderResults(); };
        sec.appendChild(more);
      }
    }
    R.appendChild(sec);
  });
  // Bandeau photo de l'envie choisie, en tête des résultats
  if(pos && MOODS[M].img){
    const bn = document.createElement("div"); bn.className = "banner";
    bn.style.backgroundImage = `url('${MOODS[M].img.replace(".jpg", "-large.jpg")}'), url('${MOODS[M].img}')`;
    const loading = groups.some(g => LOADED[g.l] && LOADED[g.l].state === "loading");
    bn.innerHTML = `<span class="k">${fmtDur(T)} ${esc(TR().way)}, retour compris</span><h3></h3><p>${loading ? "Je cherche autour de toi…" : total ? `${total} lieu${total>1?"x":""} à portée` : "Rien à portée pour l'instant"}</p>`;
    bn.querySelector("h3").textContent = MOODS[M].l;
    R.insertBefore(bn, R.firstChild);
  }
  $("idea").classList.toggle("on", total > 0);
}

const EXPANDED = new Set();
function allLoaded(){ return Object.values(LOADED).flatMap(x => x.items || []); }

function renderMoods(){
  $("moods").innerHTML = Object.entries(MOODS).map(([k,v]) =>
    v.img
      ? `<button class="photo" data-m="${k}" aria-pressed="${k===M}" style="background:url('${v.img}') center/cover no-repeat"><span class="ok" aria-hidden="true">${k===M ? "✓" : v.groups.some(isPreferred) ? "♥" : "+"}</span><b>${v.sl||v.l}</b><small>${v.d||""}</small></button>`
      : `<button data-m="${k}" aria-pressed="${k===M}"><span>${ICONS.ico(v.e, 36)}</span>${v.sl||v.l}</button>`).join("");
}
// Choix du temps : jusqu'à 2 h
const TIMES = [10, 20, 30, 45, 60, 90, 120];
$("dial").innerHTML = TIMES.map(t => `<button${t < 60 ? ` class="m"` : ""} data-t="${t}" aria-pressed="${t === T}">${t < 60 ? t : fmtDur(t)}</button>`).join("");
$("dial").addEventListener("click", e => {
  const b = e.target.closest("button"); if(!b) return;
  T = +b.dataset.t;
  document.querySelectorAll("#dial button").forEach(x => x.setAttribute("aria-pressed", String(x===b)));
  const n=$("numTxt"); n.classList.add("bump"); setTimeout(()=>n.classList.remove("bump"),200);
  search();
});
// Une seule ligne, une bulle qui glisse sous le mode choisi
function renderTravel(){
  const box = $("travelSeg"), keys = Object.keys(TRAVEL), cur = SET.travel || "walk";
  if(!box.querySelector(".thumb")){
    box.innerHTML = `<span class="thumb" aria-hidden="true"></span>` + keys.map(k =>
      `<button data-v="${k}">${ICONS.ico(TRAVEL[k].ico, 22)}<span>${TRAVEL[k].l}</span></button>`).join("");
  }
  box.style.setProperty("--i", Math.max(0, keys.indexOf(cur)));
  box.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === cur)));
}
$("travelSeg").addEventListener("click", e => {
  const b = e.target.closest("button"); if(!b || b.dataset.v === (SET.travel || "walk")) return;
  SET.travel = b.dataset.v; saveSet(); renderTravel(); search();
});
$("moods").addEventListener("click", e => {
  const b = e.target.closest("button"); if(!b) return;
  M = b.dataset.m; renderMoods(); search();
});

function locate(manual){
  if(!pos){ geoState = "wait"; renderResults(); }
  if(manual) $("whereMsg").textContent = "Localisation…";
  try{
    if(!navigator.geolocation) throw 0;
    navigator.geolocation.getCurrentPosition(g => {
      $("whereMsg").textContent = "";
      setPlace(g.coords.latitude, g.coords.longitude, "ma position", false);
    }, () => {
      if(manual) $("whereMsg").textContent = "Position GPS indisponible ici : tapez une adresse ou une ville.";
      if(!pos){ geoState = "no"; renderResults(); }
    }, {enableHighAccuracy:false, timeout:7000, maximumAge:600000}); // position réseau/Wi-Fi : rapide et assez précise pour marcher
  }catch(e){ if(!pos){ geoState = "no"; renderResults(); } }
}

// ---------- Lieu : GPS ou adresse tapée ----------
let posLabel = "", RECENTS = [];
const LOC_KEY = "pasltemps.places";
try{ RECENTS = JSON.parse(localStorage.getItem(LOC_KEY) || "[]"); }catch(e){ RECENTS = []; }
function saveRecents(){ try{ localStorage.setItem(LOC_KEY, JSON.stringify(RECENTS.slice(0,5))); }catch(e){} scheduleBackup(); }
function setPlace(lat, lng, label, remember){
  // Même endroit (à 60 m près) : pas besoin de relancer la recherche
  if(pos && !remember && label === posLabel && PLACES.meters(pos, {lat, lng}) < 60){ geoState = "ok"; renderWhere(); return; }
  pos = {lat, lng}; posLabel = label; geoState = "ok";
  if(remember){
    RECENTS = [{lat, lng, label}, ...RECENTS.filter(r => r.label !== label)].slice(0,5);
    saveRecents();
  }
  renderWhere(); renderHistory(); renderSaved(); search();
}
function renderWhere(choices){
  $("here").innerHTML = pos ? `📍 Autour de <b></b>` : "📍 Où êtes-vous ?";
  if(pos) $("here").querySelector("b").textContent = posLabel || "ma position";
  const row = $("whereRow"); row.innerHTML = "";
  const list = choices || RECENTS.filter(r => r.label !== posLabel);
  if(!choices && navigator.geolocation){
    const g = document.createElement("button"); g.className = "chip gps"; g.textContent = "🛰️ Ma position";
    g.onclick = () => locate(true); row.appendChild(g);
  }
  list.forEach(r => {
    const b = document.createElement("button"); b.className = "chip";
    b.textContent = (choices ? "👉 " : "🕘 ") + r.label;
    b.onclick = () => { $("whereMsg").textContent = ""; setPlace(r.lat, r.lng, r.label, true); };
    row.appendChild(b);
  });
}
$("whereForm").addEventListener("submit", async e => {
  e.preventDefault();
  const q = $("whereInput").value.trim(); if(!q) return;
  const msg = $("whereMsg");
  msg.textContent = "Je cherche…";
  try{
    const found = await PLACES.geocode(q);
    if(!found.length){ msg.textContent = "Adresse introuvable. Essayez avec la ville, par exemple « rue X, Lyon »."; return; }
    $("whereInput").value = ""; $("whereInput").blur();
    if(found.length === 1){ msg.textContent = ""; setPlace(found[0].lat, found[0].lng, found[0].label, true); }
    else { msg.textContent = "Lequel ?"; renderWhere(found); }
  }catch(err){ msg.textContent = errText(err); }
});


// ---------- Réglages : thèmes ----------
const K = ["bg","glow","ink","soft","card","line","acc","accink","accsoft"];
const THEMES = {
  creme:{n:"Crème", flat:true, L:["#F5EEE6","#F5EEE6","#1C1512","#7A6E63","#FFFCF8","#E8DFD3","#E1140A","#FFFFFF","#F8DCD8"], D:["#161310","#161310","#F4ECDF","#A99F92","#201C18","#3A332C","#FF3B2F","#FFFFFF","#2E2620"]},
  lavande:{n:"Lavande", L:["#F4F2FF","#E0D9FF","#1E1846","#6B6790","#FFFFFF","#E4E0F5","#5B4BDB","#FFFFFF","#ECE9FF"], D:["#13112A","#2B2366","#F1EEFF","#A9A4CC","#1F1B3D","#302A58","#8F82FF","#13112A","#2A2459"]},
  menthe:{n:"Menthe", L:["#EEF7F3","#CDEEDD","#143D33","#5E7F75","#FFFFFF","#D6EAE1","#1F9D74","#FFFFFF","#DDF3EA"], D:["#0F1F1B","#17493B","#E8F7F1","#9DBDB2","#182D28","#24423A","#4FD1A5","#0F1F1B","#1D3E35"]},
  peche:{n:"Pêche", L:["#FFF3EE","#FFD9C9","#3A1F1A","#86655C","#FFFFFF","#F4DDD4","#E8603C","#FFFFFF","#FFE4DA"], D:["#1F1412","#4A2419","#FFEFEA","#C9A69C","#2C1D1A","#43302B","#FF8A66","#1F1412","#43261F"]},
  ocean:{n:"Océan", L:["#EEF5FF","#CFE2FF","#0F2447","#5B6E8F","#FFFFFF","#DCE6F5","#1E6FE8","#FFFFFF","#E0ECFF"], D:["#0B1526","#13305E","#EAF2FF","#9FB2D1","#14223A","#223556","#5B9BFF","#0B1526","#1A2F55"]},
  bonbon:{n:"Bonbon", L:["#FFF0F7","#FFD1E8","#3D1030","#8A5F7A","#FFFFFF","#F5DCEA","#D63A8A","#FFFFFF","#FFE0EF"], D:["#1E0F19","#4B1638","#FFEAF5","#CFA3BD","#2B1724","#45263A","#FF6FB5","#1E0F19","#45203A"]},
  soleil:{n:"Soleil", L:["#FFF9E6","#FFE9A3","#2A2410","#7D7456","#FFFFFF","#F1E7C4","#2A2410","#FFD84D","#FFF0BF"], D:["#16140C","#3D3510","#FFF6D6","#C2B791","#221F13","#3A351F","#FFD84D","#16140C","#3A3314"]}
};
const SET_KEY = "pasltemps.settings";
let SET = {theme:"creme", mode:"auto", motion:"on", layout:"auto"};
try{ SET = {...SET, ...JSON.parse(localStorage.getItem(SET_KEY) || "{}")}; }catch(e){}
if(!THEMES[SET.theme]) SET.theme = "creme";
if((SET.v || 1) < 2){ SET.theme = "creme"; SET.v = 2; try{ localStorage.setItem(SET_KEY, JSON.stringify(SET)); }catch(e){} } // passage au thème Crème, assorti à l'icône
const mq = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
function applyTheme(){
  const dark = SET.mode === "dark" || (SET.mode === "auto" && mq && mq.matches);
  const root = document.documentElement;
  root.setAttribute("data-theme", dark ? "dark" : "light");
  const vals = THEMES[SET.theme][dark ? "D" : "L"];
  K.forEach((k,i) => root.style.setProperty("--" + k, vals[i]));
  document.body.classList.toggle("no-motion", SET.motion === "off");
  document.body.classList.toggle("flat", !!THEMES[SET.theme].flat);
  const meta = document.querySelector('meta[name="theme-color"]'); if(meta) meta.content = vals[0];
}
function saveSet(){ try{ localStorage.setItem(SET_KEY, JSON.stringify(SET)); }catch(e){} scheduleBackup(); }
function renderSettings(){
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  $("swatches").innerHTML = Object.entries(THEMES).map(([k,t]) => {
    const v = t[dark ? "D" : "L"];
    return `<button class="sw" data-k="${k}" aria-pressed="${k===SET.theme}"><i style="background:linear-gradient(135deg, ${v[6]} 0 50%, ${v[1]} 50% 100%)"></i>${t.n}</button>`;
  }).join("");
  document.querySelectorAll("#modeSeg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === SET.mode)));
  document.querySelectorAll("#layoutSeg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === (SET.layout || "auto"))));
  const L = {phone:"Mobile", tablet:"Tablette", wide:"Ordi (grand écran)"};
  $("layoutNote").textContent = (SET.layout || "auto") === "auto"
    ? `Choisi selon la taille de l'écran : ${L[layoutNow()].toLowerCase()} en ce moment.`
    : innerWidth < 600 && SET.layout !== "phone" ? "Cet écran est trop petit : l'affichage reste en format mobile." : "";
  document.querySelectorAll("#motionSeg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === SET.motion)));
}
function openSheet(on){
  $("sheet").classList.toggle("on", on); $("sheetBg").classList.toggle("on", on);
  if(on){ renderSettings(); recView = "main"; renderRec(); $("sheetDone").focus(); } else $("gear").focus();
}
$("gear").onclick = () => openSheet(true);
$("sheetBg").onclick = $("sheetDone").onclick = () => openSheet(false);
document.addEventListener("keydown", e => { if(e.key === "Escape" && $("sheet").classList.contains("on")) openSheet(false); });
$("swatches").addEventListener("click", e => { const b = e.target.closest(".sw"); if(!b) return; SET.theme = b.dataset.k; saveSet(); applyTheme(); renderSettings(); });
$("modeSeg").addEventListener("click", e => { const b = e.target.closest("button"); if(!b) return; SET.mode = b.dataset.v; saveSet(); applyTheme(); renderSettings(); });
// ---------- Format d'affichage ----------
// auto : selon la largeur de la fenêtre (téléphone < 720 px ≤ tablette < 1100 px ≤ grand écran)
function layoutNow(){
  const w = innerWidth, l = SET.layout || "auto";
  if(w < 600) return "phone";
  if(l !== "auto") return l;
  return w >= 1100 ? "wide" : w >= 720 ? "tablet" : "phone";
}
function applyLayout(){
  const l = layoutNow(), b = document.body.classList;
  b.toggle("lay-tablet", l === "tablet"); b.toggle("lay-wide", l === "wide");
}
addEventListener("resize", () => { applyLayout(); if($("sheet").classList.contains("on")) renderSettings(); });
$("layoutSeg").addEventListener("click", e => { const b = e.target.closest("button"); if(!b) return; SET.layout = b.dataset.v; saveSet(); applyLayout(); renderSettings(); });
applyLayout();
$("motionSeg").addEventListener("click", e => { const b = e.target.closest("button"); if(!b) return; SET.motion = b.dataset.v; saveSet(); applyTheme(); renderSettings(); });
if(mq){ const f = () => { if(SET.mode === "auto"){ applyTheme(); if($("sheet").classList.contains("on")) renderSettings(); } }; mq.addEventListener ? mq.addEventListener("change", f) : mq.addListener(f); }
applyTheme();


// ---------- Code de récupération ----------
// La sauvegarde est chiffrée avec le code (AES-GCM) : sans le code, elle est illisible,
// même pour les autres personnes qui ouvrent l'appli.
const ALPH = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_KEY = "pasltemps.code";
let MYCODE = ""; try{ MYCODE = localStorage.getItem(CODE_KEY) || ""; }catch(e){}
let backupTimer = null, lastBackup = 0;
const enc = new TextEncoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));
function newCode(){
  const r = crypto.getRandomValues(new Uint8Array(16));
  const c = Array.from(r, x => ALPH[x % ALPH.length]).join("");
  return c.match(/.{4}/g).join("-");
}
const cleanCode = c => String(c).toUpperCase().replace(/[^0-9A-Z]/g,"");
async function docIdFor(code){
  const h = await crypto.subtle.digest("SHA-256", enc.encode("pasltemps-id:" + cleanCode(code)));
  return Array.from(new Uint8Array(h)).map(x => x.toString(16).padStart(2,"0")).join("").slice(0,40);
}
async function keyFor(code){
  const base = await crypto.subtle.importKey("raw", enc.encode(cleanCode(code)), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2", salt:enc.encode("pasltemps-salt-v1"), iterations:150000, hash:"SHA-256"},
    base, {name:"AES-GCM", length:256}, false, ["encrypt","decrypt"]);
}
function snapshot(){
  return {v:1, me:{name:PROFILE.name, age:PROFILE.age, gender:PROFILE.gender, prefs:PROFILE.prefs}, settings:SET, lists:LISTS, recents:RECENTS.slice(0,5), blocked:BLOCKED, profile: myWall() ? {code:myWall().code, pseudo:myWall().pseudo, avatar:myWall().avatar, photo:myWall().photo||"", posts:myWall().posts||[]} : null, friends:FRIENDS,
    history:HIST.slice(0,200).map(({id,at,n,q,pid,addr,url,mood,T,done,note,lat,lng}) => ({id,at,n,q,pid,addr,url,mood,T,done,note,lat,lng}))};
}
async function saveBackup(code){
  if(!DB) throw {code:"no_db"};
  const key = await keyFor(code), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({name:"AES-GCM", iv}, key, enc.encode(JSON.stringify(snapshot())));
  await DB.doc("backups/" + await docIdFor(code)).set({v:1, iv:b64(iv), ct:b64(ct), at:Date.now()});
  lastBackup = Date.now();
}
function scheduleBackup(){
  if(!MYCODE || !DB) return;
  clearTimeout(backupTimer);
  backupTimer = setTimeout(() => saveBackup(MYCODE).then(renderRec).catch(() => {}), 4000);
}
async function restore(code){
  if(!DB) throw {code:"no_db"};
  const snap = await DB.doc("backups/" + await docIdFor(code)).get();
  if(!snap.exists) throw {code:"not_found"};
  const d = snap.data();
  let data;
  try{
    const plain = await crypto.subtle.decrypt({name:"AES-GCM", iv:unb64(d.iv)}, await keyFor(code), unb64(d.ct));
    data = JSON.parse(new TextDecoder().decode(plain));
  }catch(e){ throw {code:"not_found"}; }
  return applyBackupData(data);
}
// Remet en place les données d'une sauvegarde (serveur ou code autonome), sans rien effacer
async function applyBackupData(data){
  if(data.me && typeof data.me === "object"){
    ["name","age","gender"].forEach(k => { if(data.me[k] != null && data.me[k] !== "") PROFILE[k] = String(data.me[k]).slice(0, 40); });
    if(Array.isArray(data.me.prefs)) PROFILE.prefs = [...new Set([...PROFILE.prefs, ...data.me.prefs.filter(x => PREF_TYPES.some(t => t.k === x))])];
    saveProfile(); renderMoods();
  }
  // Réglages et lieux récents
  if(data.settings){ SET = {...SET, ...data.settings}; if(!THEMES[SET.theme]) SET.theme = "creme"; try{ localStorage.setItem(SET_KEY, JSON.stringify(SET)); }catch(e){} applyTheme(); }
  if(Array.isArray(data.recents) && data.recents.length){
    const seen = new Set(RECENTS.map(r => r.label));
    RECENTS = [...RECENTS, ...data.recents.filter(r => !seen.has(r.label))].slice(0,5);
    try{ localStorage.setItem(LOC_KEY, JSON.stringify(RECENTS)); }catch(e){}
    if(!pos && RECENTS[0]){ pos = {lat:RECENTS[0].lat, lng:RECENTS[0].lng}; posLabel = RECENTS[0].label; geoState = "ok"; search(); }
    renderWhere();
  }
  if(data.lists){ ['fav','todo'].forEach(k => { LISTS[k] = {...(data.lists[k]||{}), ...LISTS[k]}; }); saveLists(); }
  // Profil du blog et potes
  if(data.profile && data.profile.code && DB && UID){
    const w = myWall() || {};
    const have = new Set((w.posts||[]).map(p => p.id));
    await saveWall({...w, code:data.profile.code, pseudo:data.profile.pseudo, avatar:data.profile.avatar, photo:safePhoto(data.profile.photo),
      posts:[...(w.posts||[]), ...(data.profile.posts||[]).filter(p => !have.has(p.id))].sort((a,b)=>b.at-a.at).slice(0,60)});
  }
  if(Array.isArray(data.blocked)) BLOCKED = [...new Set([...BLOCKED, ...data.blocked])];
  if(Array.isArray(data.friends)){ FRIENDS = [...new Set([...FRIENDS, ...data.friends])]; saveFriends(); }
  // Historique : on ajoute ce qui manque, sans rien effacer
  const have = new Set(HIST.map(h => h.id));
  const add = (data.history || []).filter(h => h && h.id && !have.has(h.id));
  HIST = [...HIST, ...add].sort((a,b) => b.at - a.at);
  renderHistory(); renderResults();
  if(store){ for(const e of add){ try{ await store.add(e); }catch(err){} } } else lsSave();
  return add.length;
}
function setCode(c){ MYCODE = c; try{ c ? localStorage.setItem(CODE_KEY, c) : localStorage.removeItem(CODE_KEY); }catch(e){} }
let recView = "main";
function renderRec(msg, warn){
  const R = $("rec"); if(!R) return;
  if(!DB){
    if(typeof renderPortable === "function") return renderPortable(R, msg, warn);
    R.innerHTML = `<p>Chargement…</p>`; return;
  }
  if(recView === "enter"){
    R.innerHTML = `<p>Tapez votre code pour récupérer votre historique, vos lieux récents et vos réglages.</p>
      <input id="recIn" placeholder="XXXX-XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false">
      <div class="btns"><button class="go" id="recGo">Récupérer</button><button class="ghost" id="recBack">Annuler</button></div>
      <p class="msg${warn?" warn":""}"></p>`;
    R.querySelector(".msg").textContent = msg || "";
    $("recBack").onclick = () => { recView = "main"; renderRec(); };
    $("recGo").onclick = async () => {
      const c = $("recIn").value; if(cleanCode(c).length !== 16){ renderRec("Le code fait 16 caractères.", true); return; }
      renderRec("Récupération…");
      try{
        const n = await restore(c);
        const pretty = cleanCode(c).match(/.{4}/g).join("-");
        setCode(pretty); recView = "main";
        renderRec(`C'est récupéré ! ${n} sortie${n>1?"s":""} ajoutée${n>1?"s":""} à votre historique.`);
      }catch(e){
        renderRec(e && e.code === "not_found" ? "Code introuvable. Vérifiez chaque caractère." : "Récupération impossible pour l'instant, réessayez.", true);
      }
    };
    return;
  }
  if(MYCODE){
    const when = lastBackup ? `Dernière sauvegarde : ${whenTxt(lastBackup).toLowerCase()}.` : "Sauvegarde automatique à chaque changement.";
    R.innerHTML = `<p>Votre code. Notez-le ou faites une capture d'écran : il permet de tout récupérer sur un autre appareil.</p>
      <div class="code"></div>
      <div class="btns"><button class="go" id="recCopy">Copier</button><button class="ghost" id="recSave">Sauvegarder maintenant</button><button class="ghost" id="recHave">J'ai un autre code</button></div>
      <p class="msg${warn?" warn":""}"></p>
      <p style="margin:10px 0 0">${when} <button class="link" id="recForget">Oublier ce code ici</button></p>`;
    R.querySelector(".code").textContent = MYCODE;
    R.querySelector(".msg").textContent = msg || "";
    $("recCopy").onclick = async () => {
      try{ await navigator.clipboard.writeText(MYCODE); renderRec("Code copié ✓"); }
      catch(e){ const sel = getSelection(), r = document.createRange(); r.selectNodeContents(R.querySelector(".code")); sel.removeAllRanges(); sel.addRange(r); renderRec("Copie bloquée ici : le code est sélectionné, copiez-le à la main."); }
    };
    $("recSave").onclick = async () => { renderRec("Sauvegarde…"); try{ await saveBackup(MYCODE); renderRec("Sauvegardé ✓"); }catch(e){ renderRec("Sauvegarde impossible pour l'instant.", true); } };
    $("recHave").onclick = () => { recView = "enter"; renderRec(); };
    $("recForget").onclick = () => { setCode(""); renderRec("Code oublié sur cet appareil. La sauvegarde reste récupérable avec le code."); };
  } else {
    R.innerHTML = `<p>Créez un code secret pour pouvoir récupérer votre historique, vos lieux et vos réglages si vous changez d'appareil ou perdez vos données.</p>
      <div class="btns"><button class="go" id="recNew">Créer mon code</button><button class="ghost" id="recHave">J'ai déjà un code</button></div>
      <p class="msg${warn?" warn":""}"></p>`;
    R.querySelector(".msg").textContent = msg || "";
    $("recHave").onclick = () => { recView = "enter"; renderRec(); };
    $("recNew").onclick = async () => {
      const c = newCode(); renderRec("Création…");
      try{ await saveBackup(c); setCode(c); renderRec("Code créé et sauvegarde faite ✓"); }
      catch(e){ renderRec("Impossible de créer la sauvegarde pour l'instant.", true); }
    };
  }
}


// ---------- Onglets ----------
function showView(v){
  $("viewExplore").hidden = v !== "explore"; $("viewBlog").hidden = v !== "blog"; $("viewReviews").hidden = v !== "reviews"; $("viewProfile").hidden = v !== "profile";
  if(v === "profile" && typeof renderProfile === "function") renderProfile();
  document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.v === v)));
  $("idea").style.visibility = v === "explore" ? "" : "hidden";
  if(v === "blog") renderBlog();
  if(v === "reviews") renderReviews();
  window.scrollTo(0,0);
}
document.querySelector(".tabs").addEventListener("click", e => { const b = e.target.closest("button"); if(b) showView(b.dataset.v); });

// ---------- Blog ----------
// Chaque personne a un « mur » : walls/<son id>, lisible par tous, modifiable seulement par elle.
// Il contient son profil public (pseudo, avatar, code ami), ses posts et ses réactions.
const AVAS = ["😎","🦊","🐼","🐸","🦄","🐙","🌻","🍩","🚲","🎧","🌈","🐝","🥑","⚡","🌙","🐱"];
let WALLS = {}, RAW_WALLS = {}, FRIENDS = [], BLOCKED = [], HIDDEN = new Set(), MOD = null, blogReady = false, feedMode = "friends", viewing = null;
let composePreset = null, composeOpen = false, composeFrom = null, composeWith = [], editingProfile = false, blogMsg = "";
let wallQueue = Promise.resolve();
const myWall = () => UID ? WALLS[UID] : null;
const wallRef = () => DB.doc("walls/" + UID);
const friendDocRef = () => DB.doc("data/users/" + UID + "/profile");
function saveWall(w){
  WALLS[UID] = {...w, ...derived(w), updatedAt:Date.now()}; groupCache = null;
  const snap = JSON.parse(JSON.stringify(WALLS[UID]));
  renderBlog();
  wallQueue = wallQueue.then(() => wallRef().set(snap)).catch(() => { blogMsg = "Enregistrement impossible pour l'instant."; renderBlog(); });
  scheduleBackup();
  return wallQueue;
}
function saveFriends(){ if(DB && UID) friendDocRef().set({friends:FRIENDS, blocked:BLOCKED}).catch(()=>{}); scheduleBackup(); renderBlog(); syncDerived(); }
function byCode(code){
  // le mur le plus récent qui porte ce code
  return Object.values(WALLS).filter(w => w && w.code === code).sort((a,b) => (b.updatedAt||0)-(a.updatedAt||0))[0] || null;
}
function newFriendCode(){
  const taken = new Set(Object.values(WALLS).map(w => w.code));
  let c; do{ c = Array.from(crypto.getRandomValues(new Uint8Array(6)), x => ALPH[x % ALPH.length]).join(""); }while(taken.has(c));
  return c;
}
// ---------- Modération : contenus masqués, personnes bloquées ----------
// Les murs sont filtrés dès leur arrivée : fil, avis, potes… n'affichent jamais ce qui est masqué ou bloqué.
function moderate(walls){
  const out = {};
  Object.entries(walls).forEach(([uid, w]) => {
    if(!w) return;
    if(uid === UID){ out[uid] = w; return; }
    if(BLOCKED.includes(uid) || HIDDEN.has("user:" + uid)) return;
    out[uid] = {...w, posts:(w.posts||[]).filter(p => !HIDDEN.has(`post:${uid}:${p.id}`)),
      comments:(w.comments||[]).filter(c => !HIDDEN.has(`comment:${uid}:${c.id}`))};
  });
  return out;
}
function remoderate(){ WALLS = moderate({...RAW_WALLS, ...(UID && WALLS[UID] ? {[UID]:WALLS[UID]} : {})}); groupCache = null; renderBlog(); renderReviews(); }
const REPORT_REASONS = [["spam","Spam, pub"],["insulte","Insultant"],["inapproprie","Inapproprié"],["faux","Faux lieu"]];
async function reportContent(target, reason){
  HIDDEN.add(target); remoderate();           // disparaît tout de suite pour soi
  try{ if(MOD) await MOD.report(target, reason); }catch(e){}
}
function blockUser(uid){
  if(!uid || uid === UID || BLOCKED.includes(uid)) return;
  const w = RAW_WALLS[uid];
  BLOCKED = [...BLOCKED, uid];
  if(w && w.code) FRIENDS = FRIENDS.filter(c => c !== w.code);
  if(w && viewing === w.code) viewing = null;
  saveFriends(); remoderate();
}
function unblockUser(uid){ BLOCKED = BLOCKED.filter(x => x !== uid); saveFriends(); remoderate(); }

async function initBlog(){
  try{ const f = await friendDocRef().get(); if(f.exists){ const d = f.data(); if(Array.isArray(d.friends)) FRIENDS = d.friends; if(Array.isArray(d.blocked)) BLOCKED = d.blocked; } }catch(e){}
  DB.collection("walls").onSnapshot(async snap => {
    const next = {}; snap.docs.forEach(d => { next[d.id] = d.data(); });
    // garder notre version locale si une écriture est en cours
    if(WALLS[UID] && next[UID] && (WALLS[UID].updatedAt||0) > (next[UID].updatedAt||0)) next[UID] = WALLS[UID];
    if(MOD){ const h = await MOD.hidden(); h.forEach(t => HIDDEN.add(t)); }
    RAW_WALLS = next; WALLS = moderate(next); blogReady = true; groupCache = null; renderBlog(); renderReviews(); if(!$("viewExplore").hidden) renderResults();
  }, () => { blogReady = true; blogMsg = "Le blog n'est pas disponible pour l'instant."; renderBlog(); });
}

function safePhoto(p){ return typeof p === "string" && p.length < 200000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p) ? p : ""; }
function avaInner(w){ const ph = w && safePhoto(w.photo); return ph ? `<img src="${ph}" alt="">` : esc((w && w.avatar) || "❔"); }
function resizePhoto(file){ return resizeImage(file, 256, 60000, true); }
function resizeImage(file, S, maxLen, square){
  return new Promise((res, rej) => {
    if(!file || !/^image\//.test(file.type)) return rej(new Error("type"));
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas"), ctx = c.getContext("2d");
        const W = img.naturalWidth, H = img.naturalHeight;
        if(square){
          c.width = c.height = S;
          const side = Math.min(W, H);
          ctx.fillStyle = "#fff"; ctx.fillRect(0,0,S,S);
          ctx.drawImage(img, (W-side)/2, (H-side)/2, side, side, 0, 0, S, S);
        } else {
          const k = Math.min(1, S / Math.max(W, H));
          c.width = Math.round(W*k); c.height = Math.round(H*k);
          ctx.fillStyle = "#fff"; ctx.fillRect(0,0,c.width,c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
        }
        let q = 0.82, out = c.toDataURL("image/jpeg", q);
        while(out.length > maxLen && q > 0.35){ q -= 0.1; out = c.toDataURL("image/jpeg", q); }
        res(out);
      };
      img.onerror = () => rej(new Error("decode"));
      img.src = fr.result;
    };
    fr.onerror = () => rej(new Error("read"));
    fr.readAsDataURL(file);
  });
}
function nameOf(code){ const w = byCode(code); return w ? w.pseudo || "Quelqu'un" : "Quelqu'un"; }

function renderBlog(){
  if($("viewBlog").hidden) return;
  const me = myWall();
  // Profil
  const M = $("blogMe");
  if(!DB || !UID){ M.innerHTML = `<div class="card"><p class="small" style="margin:0">${dbState === "wait" ? "Connexion au serveur…" : "Le blog a besoin du serveur de Pas l'temps, injoignable pour l'instant. Réessayez plus tard."}</p></div>`; ["blogFriends","blogCompose","blogFeed"].forEach(i => $(i).innerHTML = ""); return; }
  if(!blogReady){ M.innerHTML = `<div class="card"><p class="small" style="margin:0">Chargement…</p></div>`; return; }
  if(!me || !me.code || editingProfile){
    const cur = me || {};
    M.innerHTML = `<div class="card"><b style="font-size:18px">${me && me.code ? "Modifier mon profil" : "Crée ton profil"}</b>
      <p class="small" style="margin:4px 0 12px">Choisis un pseudo et un avatar. Ils seront visibles par tes potes.</p>
      <div class="photorow"><span class="ava" id="avaPrev"></span>
        <div class="btns"><label class="go" style="cursor:pointer">📷 Choisir une photo<input type="file" id="photoIn" accept="image/*" hidden></label><button class="ghost" id="photoDel" hidden>Retirer</button></div></div>
      <p class="small" style="margin:0 0 8px">Ou un avatar :</p>
      <div class="avapick" id="avaPick">${AVAS.map(a => `<button data-a="${a}" aria-pressed="${a===(cur.avatar||AVAS[0])}">${a}</button>`).join("")}</div>
      <input class="field" id="pseudoIn" maxlength="24" placeholder="Ton pseudo">
      <div class="btns"><button class="go" id="profSave">${me && me.code ? "Enregistrer" : "Créer mon profil"}</button>${me && me.code ? `<button class="ghost" id="profCancel">Annuler</button>` : ""}</div>
      <p class="small"></p></div>`;
    $("pseudoIn").value = cur.pseudo || PROFILE.name || "";
    M.querySelector(".small:last-child").textContent = blogMsg; 
    let ava = cur.avatar || AVAS[0], photo = safePhoto(cur.photo);
    const prev = () => { $("avaPrev").innerHTML = avaInner({avatar:ava, photo}); $("photoDel").hidden = !photo; };
    prev();
    $("avaPick").onclick = e => { const b = e.target.closest("button"); if(!b) return; ava = b.dataset.a; photo = ""; $("avaPick").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x===b))); prev(); };
    $("photoIn").onchange = async e => {
      const f = e.target.files && e.target.files[0]; if(!f) return;
      const msg = M.querySelector(".small:last-child"); msg.textContent = "Préparation de la photo…";
      try{ photo = await resizePhoto(f); msg.textContent = ""; prev(); }
      catch(err){ msg.textContent = "Cette image ne peut pas être lue. Essaie une autre photo (JPEG ou PNG)."; }
      e.target.value = "";
    };
    $("photoDel").onclick = () => { photo = ""; prev(); };
    $("profSave").onclick = () => {
      const p = $("pseudoIn").value.trim().slice(0,24);
      if(!p){ blogMsg = "Il faut un pseudo."; renderBlog(); return; }
      blogMsg = ""; editingProfile = false;
      saveWall({...(me||{}), code:(me && me.code) || newFriendCode(), pseudo:p, avatar:ava, photo, posts:(me && me.posts)||[], reacts:(me && me.reacts)||{}});
    };
    if($("profCancel")) $("profCancel").onclick = () => { editingProfile = false; renderBlog(); };
    $("blogFriends").innerHTML = $("blogCompose").innerHTML = $("blogFeed").innerHTML = "";
    return;
  }
  M.innerHTML = `<div class="card"><div class="me"><button class="ava" id="meAva" aria-label="Modifier mon profil">${avaInner(me)}</button>
    <div class="who"><b></b><span>Mon code ami : <span class="fcode">${esc(me.code)}</span></span></div></div>
    <div class="btns" style="margin-top:12px"><button class="go" id="shareProf">Partager mon profil</button><button class="ghost" id="editProf">Modifier</button></div>
    <p class="small" id="meMsg"></p></div>`;
  M.querySelector(".who b").textContent = me.pseudo;
  $("meMsg").textContent = blogMsg;
  $("meAva").onclick = $("editProf").onclick = () => { editingProfile = true; renderBlog(); };
  $("shareProf").onclick = async () => {
    const txt = `Ajoute-moi sur « Pas l'temps » ! Mon code ami : ${me.code}`;
    try{ if(navigator.share){ await navigator.share({text:txt}); return; } }catch(e){ if(e && e.name === "AbortError") return; }
    try{ await navigator.clipboard.writeText(txt); blogMsg = "Copié ✓ Colle-le à tes potes."; }
    catch(e){ blogMsg = `Donne ce code à tes potes : ${me.code}`; }
    renderBlog();
  };

  // Potes
  const F = $("blogFriends");
  F.innerHTML = `<div class="card"><b style="font-size:18px">Mes potes</b>
    <div class="friends" id="frList" style="margin-top:10px"></div>
    <div id="addBox" hidden style="margin-top:10px"><input class="field" id="frIn" maxlength="8" placeholder="Code ami (6 caractères)" autocapitalize="characters" autocomplete="off" spellcheck="false" style="text-transform:uppercase;letter-spacing:.08em;font-weight:700">
      <div class="btns"><button class="go" id="frAdd">Ajouter</button><button class="ghost" id="frCancel">Annuler</button></div></div>
    <p class="small" id="frMsg"></p>${BLOCKED.length ? `<p class="small">🚫 Bloqué·es (touche pour débloquer) :</p><div class="tagpick" id="blkList" style="margin:6px 0 0"></div>` : ""}</div>`;
  if($("blkList")) BLOCKED.forEach(uid => {
    const b = document.createElement("button"); b.className = "chip";
    b.textContent = ((RAW_WALLS[uid] && RAW_WALLS[uid].pseudo) || "Quelqu'un") + " ✕";
    b.onclick = () => unblockUser(uid);
    $("blkList").appendChild(b);
  });
  const list = $("frList");
  FRIENDS.forEach(c => {
    const w = byCode(c), b = document.createElement("button"); b.className = "friend";
    b.innerHTML = `<span class="ava sm">${avaInner(w)}</span><span></span>`;
    b.lastChild.textContent = w ? w.pseudo : c;
    b.onclick = () => { viewing = c; renderBlog(); $("blogFeed").scrollIntoView({behavior:"smooth"}); };
    list.appendChild(b);
  });
  const add = document.createElement("button"); add.className = "friend add";
  add.innerHTML = `<span class="ava sm">＋</span><span>Ajouter</span>`;
  add.onclick = () => { $("addBox").hidden = false; $("frIn").focus(); };
  list.appendChild(add);
  $("frCancel").onclick = () => { $("addBox").hidden = true; };
  $("frAdd").onclick = () => {
    const c = cleanCode($("frIn").value);
    const msg = $("frMsg");
    if(c.length !== 6){ msg.textContent = "Un code ami fait 6 caractères."; return; }
    if(c === me.code){ msg.textContent = "C'est ton propre code 😄"; return; }
    if(FRIENDS.includes(c)){ msg.textContent = "Déjà dans tes potes."; return; }
    const w = byCode(c);
    if(!w){ msg.textContent = "Aucun profil avec ce code. Vérifie-le avec ton pote."; return; }
    FRIENDS = [...FRIENDS, c]; saveFriends();
  };

  renderStats();
  renderCompose();
  renderFeed();
}

function renderCompose(){
  const C = $("blogCompose"), me = myWall(); if(!me || !me.code || $("viewBlog").hidden) return;
  if(!composeOpen){
    C.innerHTML = `<button class="go" id="newPost" style="width:100%;padding:14px;font-size:16px;margin-bottom:14px">✏️ Raconter une sortie</button>`;
    $("newPost").onclick = () => { composeOpen = true; composeWith = []; renderCompose(); };
    return;
  }
  const opts = HIST.slice(0,30);
  C.innerHTML = `<div class="card"><b style="font-size:18px">Nouvelle sortie</b>
    <p class="small" style="margin:4px 0 10px">Choisis un lieu de ton historique ou écris-le.</p>
    <select class="field" id="cpFrom"><option value="">✍️ Écrire un autre lieu</option>${opts.map(h => `<option value="${esc(h.id)}">${esc(h.n)} · ${esc(whenTxt(h.at))}</option>`).join("")}</select>
    <input class="field" id="cpPlace" maxlength="80" placeholder="Nom du lieu">
    <div class="rate" id="cpRate" aria-label="Ta note">${[1,2,3,4,5].map(n => `<button type="button" data-n="${n}" aria-label="${n} étoile${n>1?"s":""}">★</button>`).join("")}<span>Ta note (facultatif)</span></div>
    <textarea class="field" id="cpText" maxlength="500" placeholder="C'était comment ?"></textarea>
    <input class="field" id="cpHours" maxlength="40" placeholder="🕐 Horaires vus (facultatif, ex. 7h–19h)">
    <div class="btns" style="margin-bottom:12px"><label class="ghost" style="cursor:pointer">📷 Ajouter une photo<input type="file" id="cpPhoto" accept="image/*" hidden></label><button class="ghost" id="cpPhotoDel" hidden>Retirer la photo</button></div>
    <img class="pic" id="cpPrev" alt="" hidden style="width:100%;border-radius:16px;margin-bottom:12px">
    ${FRIENDS.length ? `<p class="small" style="margin:0 0 6px">Avec qui ?</p><div class="tagpick" id="cpWith"></div>` : ""}
    <div class="btns"><button class="go" id="cpPost">Publier</button><button class="ghost" id="cpCancel">Annuler</button></div>
    <p class="small" id="cpMsg"></p></div>`;
  const sel = $("cpFrom"), place = $("cpPlace");
  const sync = () => { const h = HIST.find(x => x.id === sel.value); place.hidden = !!h; };
  if(composePreset){ sel.value = ""; place.value = composePreset.name; }
  else if(composeFrom && HIST.some(h => h.id === composeFrom)) sel.value = composeFrom; else if(opts[0]) sel.value = opts[0].id;
  let cpRating = 0;
  const paintRate = () => { $("cpRate").querySelectorAll("button").forEach(b => b.classList.toggle("on", +b.dataset.n <= cpRating)); $("cpRate").querySelector("span").textContent = cpRating ? ["","Bof","Moyen","Bien","Très bien","Génial !"][cpRating] : "Ta note (facultatif)"; };
  $("cpRate").onclick = e => { const b = e.target.closest("button"); if(!b) return; cpRating = cpRating === +b.dataset.n ? 0 : +b.dataset.n; paintRate(); };
  sel.onchange = sync; sync();
  const W = $("cpWith");
  if(W) FRIENDS.forEach(c => {
    const b = document.createElement("button"); b.className = "chip"; b.setAttribute("aria-pressed", String(composeWith.includes(c)));
    const w = byCode(c); b.textContent = (w ? w.avatar + " " + w.pseudo : c);
    b.onclick = () => { composeWith = composeWith.includes(c) ? composeWith.filter(x => x !== c) : [...composeWith, c]; b.setAttribute("aria-pressed", String(composeWith.includes(c))); };
    W.appendChild(b);
  });
  let cpPic = "";
  $("cpPhoto").onchange = async e => {
    const f = e.target.files && e.target.files[0]; if(!f) return;
    $("cpMsg").textContent = "Préparation de la photo…";
    try{ cpPic = await resizeImage(f, 720, 90000); $("cpPrev").src = cpPic; $("cpPrev").hidden = false; $("cpPhotoDel").hidden = false; $("cpMsg").textContent = ""; }
    catch(err){ $("cpMsg").textContent = "Cette image ne peut pas être lue. Essaie une autre photo."; }
    e.target.value = "";
  };
  $("cpPhotoDel").onclick = () => { cpPic = ""; $("cpPrev").hidden = true; $("cpPhotoDel").hidden = true; };
  $("cpCancel").onclick = () => { composeOpen = false; composeFrom = null; composePreset = null; renderCompose(); };
  $("cpPost").onclick = () => {
    const h = HIST.find(x => x.id === sel.value);
    const name = h ? h.n : place.value.trim();
    const text = $("cpText").value.trim().slice(0,500);
    if(!name){ $("cpMsg").textContent = "Indique le lieu."; return; }
    const g = h && Object.values(MOODS).flatMap(m => m.groups).find(g => g.l === h.q);
    const pre = !h && composePreset && norm(composePreset.name) === norm(name) ? composePreset : null;
    const post = {id:"p"+Date.now().toString(36)+Math.random().toString(36).slice(2,5), at:Date.now(),
      place:name.slice(0,80), addr:h ? (h.addr||"").split(",").slice(-1)[0].trim() : pre ? pre.addr || "" : "", emoji:g ? g.em : (h && MOODS[h.mood] ? MOODS[h.mood].e : pre ? pre.em : "📍"), rating:cpRating,
      text, with:composeWith.slice(0,10), hours:$("cpHours").value.trim().slice(0,40),
      pid:h ? (h.pid||"") : pre ? pre.pid || "" : "", lat:h && h.lat != null ? h.lat : pre && pre.lat != null ? pre.lat : null, lng:h && h.lng != null ? h.lng : pre && pre.lng != null ? pre.lng : null, photo:!!cpPic};
    composeOpen = false; composeFrom = null; composePreset = null; composeWith = []; feedMode = "friends"; viewing = null;
    if(cpPic){ PHOTOS[UID + "/" + post.id] = cpPic; DB.doc("walls/" + UID + "/photos/" + post.id).set({data:cpPic}).catch(() => {}); }
    saveWall({...me, posts:[post, ...(me.posts||[])].slice(0,60)});
  };
}

function renderFeed(){
  const Fd = $("blogFeed"), me = myWall(); if(!me) return;
  // Réactions : chaque mur stocke ses propres réactions { "codeAuteur:idPost": emoji }
  const counts = {};
  Object.entries(WALLS).forEach(([uid,w]) => Object.entries((w && w.reacts) || {}).forEach(([k,e]) => {
    counts[k] = counts[k] || {}; counts[k][e] = (counts[k][e]||0) + 1;
  }));
  // Un seul mur par code (le plus récent)
  const walls = {}; Object.entries(WALLS).forEach(([uid,w]) => { if(w && w.code && (!walls[w.code] || (w.updatedAt||0) > (walls[w.code].updatedAt||0))) walls[w.code] = {...w, _uid:uid}; });
  let posts = [];
  Object.values(walls).forEach(w => (w.posts||[]).forEach(p => posts.push({...p, author:w})));
  const cms = {};
  Object.values(walls).forEach(w => (w.comments||[]).forEach(c => { (cms[c.k] = cms[c.k] || []).push({...c, author:w}); }));
  if(viewing) posts = posts.filter(p => p.author.code === viewing || (p.with||[]).includes(viewing));
  else if(feedMode === "friends") posts = posts.filter(p => p.author.code === me.code || FRIENDS.includes(p.author.code) || (p.with||[]).includes(me.code));
  posts.sort((a,b) => b.at - a.at); posts = posts.slice(0,80);

  let head = "";
  if(viewing){
    const w = byCode(viewing);
    head = `<div class="viewing"><span class="ava sm">${avaInner(w)}</span><b></b>${!FRIENDS.includes(viewing) && viewing !== me.code ? `<button class="go" id="vAdd">Ajouter</button>` : ""}${viewing !== me.code ? `<button class="ghost" id="vBlock" aria-label="Bloquer">🚫</button>` : ""}<button class="ghost" id="vBack">Retour</button></div>`;
  } else {
    head = `<div class="seg feedseg" id="feedSeg"><button data-v="friends" aria-pressed="${feedMode==="friends"}">👥 Mes potes</button><button data-v="all" aria-pressed="${feedMode==="all"}">🌍 Tout le monde</button></div>`;
  }
  Fd.innerHTML = head;
  if(viewing){
    Fd.querySelector(".viewing b").textContent = nameOf(viewing);
    const vw = byCode(viewing);
    if(vw && Array.isArray(vw.badges) && vw.badges.length){ const sp = document.createElement("div"); sp.className = "mini-b"; sp.textContent = vw.badges.map(id => (BADGES.find(b => b.id === id)||{}).e || "").join(""); Fd.querySelector(".viewing b").appendChild(sp); }
    $("vBack").onclick = () => { viewing = null; renderBlog(); };
    if($("vBlock")) $("vBlock").onclick = () => { const w = byCode(viewing); if(w && confirm(`Bloquer ${w.pseudo || "cette personne"} ? Tu ne verras plus ses posts, avis et commentaires.`)) blockUser(Object.keys(WALLS).find(k => WALLS[k] === w)); };
    if($("vAdd")) $("vAdd").onclick = () => { FRIENDS = [...FRIENDS, viewing]; saveFriends(); };
  } else {
    $("feedSeg").onclick = e => { const b = e.target.closest("button"); if(!b) return; feedMode = b.dataset.v; renderFeed(); };
  }
  if(!posts.length){
    const d = document.createElement("div"); d.className = "emptyfeed";
    d.innerHTML = `<div>🌱</div><p>${feedMode === "friends" && !viewing ? "Rien encore ici. Raconte ta première sortie ou ajoute des potes avec leur code." : "Pas encore de sortie."}</p>`;
    Fd.appendChild(d); return;
  }
  posts.forEach(p => {
    const el = document.createElement("article"); el.className = "card post";
    const key = p.author.code + ":" + p.id, c = counts[key] || {}, mine = (me.reacts||{})[key];
    el.innerHTML = `<div class="ph"><span class="ava sm">${avaInner(p.author)}</span><div><button class="nm"></button><time>${esc(whenTxt(p.at))}</time></div></div>
      <div class="pl"><span class="e">${ICONS.ico(p.emoji||"📍", 30)}</span><div><b></b>${p.addr?`<small></small>`:""}</div></div>
      ${p.rating?`<p style="margin:-2px 0 10px">${starsHTML(p.rating)}</p>`:""}${p.photo?`<img class="pic" alt="">`:""}${p.hours?`<p class="hours"></p>`:""}
      ${p.text?`<p class="tx"></p>`:""}${(p.with||[]).length?`<p class="with"></p>`:""}
      <div class="reacts">${["❤️","😋","🔥"].map(e => `<button data-e="${e}" aria-pressed="${mine===e}">${e} ${c[e]||""}</button>`).join("")}${p.author.code === me.code ? `<button class="del">Supprimer</button>` : `<button class="more" aria-label="Signaler ou bloquer" aria-expanded="false">⋯</button>`}</div>
      <div class="modbox" hidden><p>Signaler ce post :</p><div class="btns">${REPORT_REASONS.map(([k,l]) => `<button class="ghost" data-r="${k}">${l}</button>`).join("")}</div>
        <p style="margin-top:12px">Ne plus voir cette personne :</p><div class="btns"><button class="ghost blk">🚫 Bloquer</button></div></div>`;
    const mb = el.querySelector(".modbox");
    if(mb){
      mb.onclick = e => {
        const b = e.target.closest("button"); if(!b) return;
        if(b.classList.contains("blk")){ blockUser(p.author._uid); return; }
        if(b.dataset.r) reportContent(`post:${p.author._uid}:${p.id}`, b.dataset.r);
      };
    }
    el.querySelector(".nm").textContent = p.author.pseudo || "Quelqu'un";
    el.querySelector(".nm").onclick = () => { viewing = p.author.code; renderBlog(); window.scrollTo({top:$("blogFeed").offsetTop - 20, behavior:"smooth"}); };
    el.querySelector(".pl b").textContent = p.place;
    if(p.addr) el.querySelector(".pl small").textContent = p.addr;
    if(p.text) el.querySelector(".tx").textContent = p.text;
    if(p.hours) el.querySelector(".hours").textContent = "🕐 Horaires vus : " + p.hours;
    if(p.photo) loadPhoto(p.author._uid, p.id, el.querySelector(".pic"));
    el.appendChild(commentsEl(key, cms[key] || [], me));
    if((p.with||[]).length) el.querySelector(".with").textContent = "👥 avec " + p.with.map(nameOf).join(", ");
    el.querySelector(".reacts").onclick = e => {
      const b = e.target.closest("button"); if(!b) return;
      if(b.classList.contains("more")){ mb.hidden = !mb.hidden; b.setAttribute("aria-expanded", String(!mb.hidden)); return; }
      if(b.classList.contains("del")){ if(p.photo) DB.doc("walls/" + UID + "/photos/" + p.id).delete().catch(()=>{}); saveWall({...me, posts:(me.posts||[]).filter(x => x.id !== p.id)}); return; }
      const r = {...(me.reacts||{})};
      if(r[key] === b.dataset.e) delete r[key]; else r[key] = b.dataset.e;
      saveWall({...me, reacts:r});
    };
    Fd.appendChild(el);
  });
}


// ---------- Avis des potes sur les lieux ----------
const norm = t => String(t||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
function kmBetween(a,b){ const R=6371, r=x=>x*Math.PI/180, dLa=r(b.lat-a.lat), dLo=r(b.lng-a.lng); return 2*R*Math.asin(Math.sqrt(Math.sin(dLa/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dLo/2)**2)); }
function reviewsFor(p){
  const me = myWall(); if(!me || !me.code) return [];
  const out = [], seen = new Set();
  Object.values(WALLS).forEach(w => {
    if(!w || !w.code || seen.has(w.code) || !(w.code === me.code || FRIENDS.includes(w.code))) return;
    seen.add(w.code);
    (w.posts||[]).forEach(po => {
      const same = (po.pid && po.pid === p.id) ||
        (norm(po.place) === norm(p.name) && (po.lat == null || kmBetween({lat:po.lat,lng:po.lng}, p) < 0.4));
      if(same) out.push({...po, author:w});
    });
  });
  return out.sort((a,b) => b.at - a.at);
}

// ---------- Favoris et « À tester » ----------
let LISTS = {fav:{}, todo:{}}, savedTab = "fav";
try{ const l = JSON.parse(localStorage.getItem("pasltemps.lists") || "null"); if(l && l.fav && l.todo) LISTS = l; }catch(e){}
function saveLists(){
  try{ localStorage.setItem("pasltemps.lists", JSON.stringify(LISTS)); }catch(e){}
  if(DB && UID) DB.doc("data/users/" + UID + "/lists").set(JSON.parse(JSON.stringify(LISTS))).catch(()=>{});
  scheduleBackup(); renderSaved();
}
async function initLists(){
  try{
    const d = await DB.doc("data/users/" + UID + "/lists").get();
    if(d.exists){ const x = d.data(); ["fav","todo"].forEach(k => { LISTS[k] = {...(x[k]||{}), ...LISTS[k]}; }); }
    try{ localStorage.setItem("pasltemps.lists", JSON.stringify(LISTS)); }catch(e){}
    renderSaved(); renderResults();
  }catch(e){}
}
function toggleList(k, p){
  if(LISTS[k][p.id]) delete LISTS[k][p.id];
  else LISTS[k][p.id] = {id:p.id, name:p.name, addr:p.addr||"", lat:p.lat, lng:p.lng, em:p.em||"📍", h:p.h||260, g:p.g||"", url:p.url||"", stay:p.stay||10, at:Date.now()};
  saveLists();
}
function renderSaved(){
  const L = $("savedList"); if(!L) return;
  document.querySelectorAll("#savedSeg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === savedTab)));
  const items = Object.values(LISTS[savedTab]).sort((a,b) => b.at - a.at);
  L.innerHTML = "";
  if(!items.length){ L.innerHTML = `<p class="hist empty" style="margin:0;color:var(--soft);font-size:15px">${savedTab === "fav" ? "Touche ⭐ sur un lieu pour le garder ici." : "Touche 📌 sur un lieu repéré pour le tester plus tard."}</p>`; return; }
  items.forEach(x => {
    const r = document.createElement("div"); r.className = "srow";
    const km = pos ? kmBetween(pos, x) : null, walk = km != null ? travelOf(km*1000) : null;
    r.innerHTML = `<span class="e">${ICONS.ico(x.em, 28)}</span><div class="t"><b></b><small></small></div><a class="go" target="_blank" rel="noopener" href="${dirUrl(x)}">${TR().e} Je pars</a><button class="x" aria-label="Retirer">✕</button>`;
    r.querySelector("b").textContent = x.name;
    r.querySelector("small").textContent = walk != null ? (km < 30 ? `${walk} min ${TR().way}` : "loin d'ici") + " · " + (x.addr||"").split(",")[0] : (x.addr||"").split(",")[0];
    r.querySelector(".go").onclick = () => { const w = walk || 5; const h = logVisit({...x, g:x.g}); startTimer({...x, walk:w, stay:x.stay||10}, h, Math.max(T, 2*w + (x.stay||10))); };
    r.querySelector(".x").onclick = () => { delete LISTS[savedTab][x.id]; saveLists(); renderResults(); };
    L.appendChild(r);
  });
}
$("savedSeg").addEventListener("click", e => { const b = e.target.closest("button"); if(!b) return; savedTab = b.dataset.v; renderSaved(); });

// ---------- Radar ----------
function radarEl(){
  if(!pos) return null;
  const uniq = new Map(); allLoaded().forEach(p => { if(!uniq.has(p.id)) uniq.set(p.id, p); });
  const items = [...uniq.values()]; if(!items.length) return null;
  const tm = TR(), leg = maxLeg();
  const rOf = m => Math.max(0, m - tm.over) * tm.speed / tm.detour;        // minutes de trajet → mètres
  const maxD = Math.max(150, rOf(leg), ...items.map(p => p.dist)) * 1.06, k = 146 / maxD;
  const cosL = Math.cos(pos.lat * Math.PI / 180);
  let svg = `<svg viewBox="-160 -160 320 320" role="img" aria-label="Plan des lieux autour de vous, en couleur selon la distance">`;
  // zones colorées, de la plus lointaine à la plus proche
  [...BANDS].reverse().forEach(b => {
    const r = rOf(Math.min(b.max, 1) * leg) * k;
    if(r > 4) svg += `<circle r="${r.toFixed(1)}" fill="${b.c}" fill-opacity=".07" stroke="${b.c}" stroke-opacity=".55" stroke-width="1.5" stroke-dasharray="4 5"/>`;
  });
  BANDS.forEach(b => {
    const m = Math.min(b.max, 1) * leg, r = rOf(m) * k;
    if(r > 16 && r <= 152) svg += `<text class="rl" x="4" y="${(-r + 11).toFixed(1)}" fill="${b.c}">${Math.round(m)} min</text>`;
  });
  svg += `<text class="rl" x="0" y="-152" text-anchor="middle">N</text>`;
  items.forEach(p => {
    const x = (p.lng - pos.lng) * 111320 * cosL * k, y = -(p.lat - pos.lat) * 110540 * k, b = bandOf(p.walk);
    svg += `<g class="pt" data-id="${esc(p.id)}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})"><title>${esc(p.name)} · ${p.walk} min aller · ${fmtDur(2*p.walk + p.stay)} au total</title><circle r="13" style="stroke:${b.c};stroke-width:2.5"/>${ICONS.has(p.em) ? ICONS.ico(p.em, 18).replace("<svg ", '<svg x="-9" y="-9" ') : `<text text-anchor="middle" dy="4.5">${p.em}</text>`}</g>`;
  });
  svg += `<circle class="me" r="7"/><circle r="12" fill="none" stroke="var(--acc)" stroke-opacity=".35" stroke-width="3"/></svg>`;
  const d = document.createElement("div"); d.className = "radar";
  const legend = BANDS.map((b, i) => {
    const lo = i ? Math.round(BANDS[i-1].max * leg) : 0, hi = Math.round(Math.min(b.max, 1) * leg);
    return `<span><i style="background:${b.c}"></i>${b.l} <small>${i < 3 ? `${lo}–${hi} min` : `+ de ${lo} min`}</small></span>`;
  }).join("");
  d.innerHTML = `<h3>${ICONS.ico("compass", 20)} Autour de vous <small>touchez un point</small></h3>${svg}<div class="bands">${legend}</div><p class="bnote">Temps de trajet aller ${esc(tm.way)}. Le retour est compté aussi.</p>`;
  d.querySelector("svg").addEventListener("click", e => {
    const g = e.target.closest(".pt"); if(!g) return;
    const el = document.getElementById("p-" + g.dataset.id.replace(/[^\w-]/g,""));
    if(el){ el.classList.add("open"); el.scrollIntoView({behavior:"smooth", block:"center"}); }
  });
  return d;
}

// ---------- Chrono « Je pars » ----------
let TIMER = null, timerTick = null, vibrated = false;
try{ TIMER = JSON.parse(localStorage.getItem("pasltemps.timer") || "null"); }catch(e){}
function saveTimer(){ try{ TIMER ? localStorage.setItem("pasltemps.timer", JSON.stringify(TIMER)) : localStorage.removeItem("pasltemps.timer"); }catch(e){} }
function startTimer(p, h, total){
  TIMER = {start:Date.now(), T: total || T, walk:Math.max(1, p.walk||5), mode:SET.travel || "walk", name:p.name, em:p.em||"📍", hid:h ? h.id : null};
  vibrated = false; saveTimer(); renderTimer();
}
function stopTimer(done){
  if(done && TIMER && TIMER.hid) patch(TIMER.hid, {done:true});
  TIMER = null; saveTimer(); renderTimer();
}
const mmss = s => { s = Math.abs(Math.round(s)); return Math.floor(s/60) + ":" + String(s%60).padStart(2,"0"); };
function renderTimer(){
  const box = $("timer");
  if(!TIMER){ box.hidden = true; document.body.classList.remove("timing"); clearInterval(timerTick); timerTick = null; return; }
  if(!timerTick) timerTick = setInterval(renderTimer, 1000);
  box.hidden = false; document.body.classList.add("timing");
  const el = (Date.now() - TIMER.start)/1000, total = TIMER.T*60, remain = total - el, walkS = TIMER.walk*60;
  let phase, sub, cls = "";
  const tv = TRAVEL[TIMER.mode] || TRAVEL.walk;
  if(el < walkS){ phase = tv.e + " En route"; sub = `Arrivée dans ~${Math.ceil((walkS-el)/60)} min`; }
  else if(remain > walkS){ phase = "⏱️ Sur place"; sub = `Repars dans ${Math.ceil((remain-walkS)/60)} min`; }
  else if(remain > 0){ phase = "🏃 C'est l'heure de repartir !"; sub = `${TIMER.walk} min ${tv.of} pour rentrer`; cls = "back";
    if(!vibrated){ vibrated = true; try{ navigator.vibrate && navigator.vibrate([200,100,200]); }catch(e){} } }
  else { phase = "⏰ Temps écoulé"; sub = `Tu dépasses de ${Math.ceil(-remain/60)} min`; cls = "late"; }
  box.className = "timer " + cls;
  box.innerHTML = `<div class="tin"><div class="top"><span class="e">${ICONS.ico(TIMER.em, 28)}</span><div class="mid"><b></b><span></span></div><div class="clock">${remain < 0 ? "+" : ""}${mmss(remain)}</div></div>
    <div class="bar"><i style="width:${Math.min(100, el/total*100).toFixed(1)}%"></i></div>
    <div class="acts"><button class="ok" id="tDone">✓ Je suis rentré·e</button><button id="tStop">Arrêter</button></div></div>`;
  box.querySelector(".mid b").textContent = phase + " · " + TIMER.name;
  box.querySelector(".mid span").textContent = sub;
  $("tDone").onclick = () => stopTimer(true);
  $("tStop").onclick = () => stopTimer(false);
}

// ---------- Stats, badges et défis ----------
const BADGES = [
  {id:"first", e:"🎉", n:"Première pause", t:c => c.done.length >= 1},
  {id:"boul", e:"🥖", n:"Mitron", t:c => (c.byQ["Boulangeries"]||0) >= 5},
  {id:"cafe", e:"☕", n:"Caféinomane", t:c => c.done.filter(h => /Caf|thé/.test(h.q||"")).length >= 5},
  {id:"air", e:"🌳", n:"Bol d'air", t:c => c.done.filter(h => h.mood === "air" || /Parc|vert/.test(h.q||"")).length >= 5},
  {id:"cult", e:"📚", n:"Curieux", t:c => c.done.filter(h => h.mood === "culture").length >= 3},
  {id:"explo", e:"🧭", n:"Explorateur", t:c => c.distinct >= 10},
  {id:"s3", e:"🔥", n:"En série", t:c => c.best >= 3},
  {id:"s7", e:"💎", n:"Inarrêtable", t:c => c.best >= 7},
  {id:"pals", e:"👥", n:"Bande de potes", t:c => FRIENDS.length >= 3},
  {id:"blog", e:"✍️", n:"Blogueur", t:c => c.posts.length >= 5},
  {id:"team", e:"🤝", n:"En équipe", t:c => c.posts.filter(p => (p.with||[]).length).length >= 3},
  {id:"globe", e:"✈️", n:"Globe-trotteur", t:c => c.far}
];
const CHALLENGES = [
  {t:"Fais 3 pauses cette semaine", f:c => [c.wDone.length, 3]},
  {t:"Découvre un lieu où tu n'es jamais allé·e", f:c => [c.wDone.some(h => !c.before.has(h.pid || h.n)) ? 1 : 0, 1]},
  {t:"Prends l'air : un parc ou un espace vert", f:c => [c.wDone.some(h => h.mood === "air" || /Parc|vert/.test(h.q||"")) ? 1 : 0, 1]},
  {t:"Raconte une sortie en taguant un pote", f:c => [c.wPosts.some(p => (p.with||[]).length) ? 1 : 0, 1]},
  {t:"Teste une rubrique que tu n'as jamais faite", f:c => [c.wDone.some(h => h.q && !c.beforeQ.has(h.q)) ? 1 : 0, 1]},
  {t:"Fais une pause culture : librairie, musée, monument…", f:c => [c.wDone.some(h => h.mood === "culture") ? 1 : 0, 1]},
  {t:"Raconte 2 sorties sur le blog", f:c => [c.wPosts.length, 2]}
];
const dayKey = t => { const d = new Date(t); return d.getFullYear()*10000 + (d.getMonth()+1)*100 + d.getDate(); };
function weekStart(){ const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - ((d.getDay()+6)%7)); return d.getTime(); }
const weekNo = () => Math.floor((weekStart()/864e5 + 3) / 7);
function computeStats(w){
  const done = HIST.filter(h => h.done), posts = (w && w.posts) || [];
  const byQ = {}; done.forEach(h => { byQ[h.q||"?"] = (byQ[h.q||"?"]||0) + 1; });
  const places = {}; done.forEach(h => { const k = h.pid || h.n; places[k] = places[k] || {n:h.n, c:0}; places[k].c++; });
  const days = [...new Set(done.map(h => dayKey(h.at)))].sort();
  let best = 0, run = 0, prev = null;
  days.forEach(d => { const dt = new Date(Math.floor(d/10000), Math.floor(d/100)%100 - 1, d%100).getTime(); run = prev != null && Math.round((dt - prev)/864e5) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = dt; });
  const today = new Date(); today.setHours(0,0,0,0);
  const cur = prev != null && Math.round((today.getTime() - prev)/864e5) <= 1 ? run : 0;
  const m0 = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
  const ws = weekStart();
  const wDone = done.filter(h => h.at >= ws), older = done.filter(h => h.at < ws);
  const top = Object.values(places).sort((a,b) => b.c - a.c)[0];
  const far = done.some(h => h.lat != null && done.some(o => o.lat != null && kmBetween(h, o) > 100));
  return {done, posts, byQ, distinct:Object.keys(places).length, best, cur, month:done.filter(h => h.at >= m0).length, top, far,
    wDone, wPosts:posts.filter(p => p.at >= ws), before:new Set(older.map(h => h.pid || h.n)), beforeQ:new Set(older.map(h => h.q))};
}
function derived(w){
  const c = computeStats(w), ch = CHALLENGES[weekNo() % CHALLENGES.length], [a,b] = ch.f(c);
  return {badges:BADGES.filter(x => x.t(c)).map(x => x.id), challenge:{week:weekNo(), done:a >= b}};
}
function syncDerived(){
  const w = UID && WALLS[UID]; if(!w || !w.code){ return; }
  const d = derived(w);
  if(JSON.stringify(d.badges) !== JSON.stringify(w.badges||[]) || JSON.stringify(d.challenge) !== JSON.stringify(w.challenge||null)) saveWall(w);
  else renderBlog();
}
function renderStats(){
  const B = $("blogStats"), me = myWall(); if(!B || !me || !me.code) { if(B) B.innerHTML = ""; return; }
  const c = computeStats(me), ch = CHALLENGES[weekNo() % CHALLENGES.length], [a,b] = ch.f(c);
  const doneFriends = FRIENDS.map(byCode).filter(w => w && w.challenge && w.challenge.week === weekNo() && w.challenge.done);
  B.innerHTML = `<div class="card chal"><b style="font-size:14px;color:var(--soft)">🏆 Défi de la semaine</b>
      <div class="big"></div>
      <div class="prog"><i style="width:${Math.min(100, a/b*100)}%"></i></div>
      <p class="small">${a >= b ? "Réussi ✓ Bravo !" : `${Math.min(a,b)}/${b}`}${doneFriends.length ? ` · Réussi aussi par ${doneFriends.map(w => esc(w.pseudo)).join(", ")}` : ""}</p></div>
    <div class="card"><b style="font-size:18px">Mes stats</b>
      <div class="stats"><div><b>${c.done.length}</b><span>pauses faites</span></div><div><b>${c.month}</b><span>ce mois-ci</span></div><div><b>${c.cur}🔥</b><span>jours d'affilée</span></div>
        <div><b>${c.distinct}</b><span>lieux différents</span></div><div><b>${c.posts.length}</b><span>posts</span></div><div><b>${FRIENDS.length}</b><span>potes</span></div></div>
      ${c.top ? `<p class="small" style="margin:0 0 12px">💛 Ton lieu préféré : <b class="topn"></b> (${c.top.c} fois)</p>` : ""}
      <b style="font-size:15px">Badges</b>
      <div class="badges" style="margin-top:8px">${BADGES.map(x => `<div class="bdg${x.t(c) ? "" : " off"}"><i>${x.e}</i>${esc(x.n)}</div>`).join("")}</div></div>`;
  B.querySelector(".big").textContent = ch.t;
  if(c.top) B.querySelector(".topn").textContent = c.top.n;
}

// ---------- Photos et commentaires des posts ----------
const PHOTOS = {};
function loadPhoto(uid, id, img){
  const k = uid + "/" + id;
  const show = d => { const ph = safePhoto(d); if(ph) img.src = ph; else img.remove(); };
  if(PHOTOS[k]) return show(PHOTOS[k]);
  DB.doc("walls/" + uid + "/photos/" + id).get().then(sn => { const d = sn.exists ? sn.data().data : ""; PHOTOS[k] = d; show(d); }).catch(() => img.remove());
}
const openComments = new Set();
function commentsEl(key, list, me){
  const box = document.createElement("div"); box.className = "comments";
  list.sort((a,b) => a.at - b.at);
  const all = openComments.has(key), shown = all ? list : list.slice(-2);
  if(list.length > shown.length){ const m = document.createElement("button"); m.className = "link"; m.style.marginBottom = "8px"; m.textContent = `Voir les ${list.length} commentaires`; m.onclick = () => { openComments.add(key); renderFeed(); }; box.appendChild(m); }
  shown.forEach(c => {
    const r = document.createElement("div"); r.className = "cm";
    r.innerHTML = `<span class="ava sm">${avaInner(c.author)}</span><div><b></b><span class="t"></span>${c.author.code === me.code ? `<button class="rm">supprimer</button>` : `<button class="rm rp">signaler</button>`}</div>`;
    r.querySelector("b").textContent = c.author.pseudo || "Quelqu'un";
    r.querySelector(".t").textContent = c.text;
    const rm = r.querySelector(".rm");
    if(rm) rm.onclick = rm.classList.contains("rp")
      ? () => { if(confirm("Signaler ce commentaire ? Il sera masqué pour toi, et pour tout le monde s'il est signalé plusieurs fois.")) reportContent(`comment:${c.author._uid}:${c.id}`, "inapproprie"); }
      : () => saveWall({...me, comments:(me.comments||[]).filter(x => x.id !== c.id)});
    box.appendChild(r);
  });
  const f = document.createElement("form"); f.className = "cform";
  f.innerHTML = `<input maxlength="280" placeholder="Commenter…" aria-label="Commenter"><button>Envoyer</button>`;
  f.onsubmit = e => {
    e.preventDefault(); const t = f.querySelector("input").value.trim(); if(!t) return;
    openComments.add(key);
    saveWall({...me, comments:[...(me.comments||[]), {id:"c"+Date.now().toString(36), k:key, text:t.slice(0,280), at:Date.now()}].slice(-100)});
  };
  box.appendChild(f);
  return box;
}


// ---------- Avis ----------
let rvScope = "all", rvSort = "top", rvOpen = new Set();
function starsHTML(n){ n = Math.round(n); return `<span class="stars" aria-label="${n} sur 5">${[1,2,3,4,5].map(i => i <= n ? "★" : `<span class="off">★</span>`).join("")}</span>`; }
function reviewGroups(scope){
  const me = myWall();
  const walls = {}; Object.entries(WALLS).forEach(([uid,w]) => { if(w && w.code && (!walls[w.code] || (w.updatedAt||0) > (walls[w.code].updatedAt||0))) walls[w.code] = {...w, _uid:uid}; });
  const groups = [];
  Object.values(walls).forEach(w => {
    if(scope === "friends" && !(me && (w.code === me.code || FRIENDS.includes(w.code)))) return;
    (w.posts||[]).forEach(po => {
      if(!po.place) return;
      let g = groups.find(x => (po.pid && x.pid === po.pid) ||
        (x.key === norm(po.place) && (po.lat == null || x.lat == null || kmBetween({lat:po.lat,lng:po.lng}, x) < 0.4)));
      if(!g){ g = {key:norm(po.place), name:po.place, em:po.emoji||"📍", addr:po.addr||"", pid:po.pid||"", lat:po.lat, lng:po.lng, reviews:[]}; groups.push(g); }
      if(!g.pid && po.pid) g.pid = po.pid;
      if(g.lat == null && po.lat != null){ g.lat = po.lat; g.lng = po.lng; }
      g.reviews.push({...po, author:w});
    });
  });
  groups.forEach(g => {
    g.reviews.sort((a,b) => b.at - a.at);
    const r = g.reviews.filter(x => x.rating);
    g.rated = r.length; g.avg = r.length ? r.reduce((s,x) => s + x.rating, 0) / r.length : 0;
    g.last = g.reviews[0].at; g.id = "rv-" + (g.pid || g.key + (g.lat != null ? g.lat.toFixed(3) : ""));
    g.dist = pos && g.lat != null ? kmBetween(pos, g) : null;
  });
  return groups;
}
let groupCache = null, groupCacheAt = 0;
function findGroup(p){
  if(!groupCache || Date.now() - groupCacheAt > 2000){ groupCache = reviewGroups("all"); groupCacheAt = Date.now(); }
  return groupCache.find(g => (g.pid && g.pid === p.id) || (g.key === norm(p.name) && (g.lat == null || kmBetween(g, p) < 0.4))) || null;
}
function renderReviews(){
  if($("viewReviews").hidden) return;
  groupCache = null;
  document.querySelectorAll("#rvScope button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === rvScope)));
  document.querySelectorAll("#rvSort button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === rvSort)));
  const L = $("rvList"); L.innerHTML = "";
  if(!DB || !UID){ L.innerHTML = `<div class="emptyfeed"><div>⭐</div><p>${dbState === "wait" ? "Connexion au serveur…" : "Les avis ont besoin du serveur de Pas l'temps, injoignable pour l'instant."}</p></div>`; return; }
  if(!blogReady){ L.innerHTML = `<p class="status">Chargement…</p>`; return; }
  const q = norm($("rvQ").value);
  let gs = reviewGroups(rvScope).filter(g => !q || g.key.includes(q) || norm(g.addr).includes(q));
  if(rvSort === "top") gs.sort((a,b) => (b.avg - a.avg) || (b.rated - a.rated) || (b.last - a.last));
  else if(rvSort === "recent") gs.sort((a,b) => b.last - a.last);
  else if(rvSort === "most") gs.sort((a,b) => b.reviews.length - a.reviews.length || b.last - a.last);
  else if(rvSort === "near"){
    if(!pos){ L.innerHTML = `<p class="status">Indique où tu es dans l'onglet Explorer pour trier par distance.</p>`; }
    gs.sort((a,b) => (a.dist ?? 1e9) - (b.dist ?? 1e9));
  }
  if(!gs.length){
    const d = document.createElement("div"); d.className = "emptyfeed";
    d.innerHTML = `<div>🌟</div><p>${q ? "Aucun avis pour cette recherche." : rvScope === "friends" ? "Tes potes n'ont encore rien noté." : "Aucun avis pour l'instant. Raconte une sortie dans le Blog et donne ta note !"}</p>`;
    L.appendChild(d); return;
  }
  const me = myWall();
  gs.slice(0,60).forEach(g => {
    const el = document.createElement("div"); el.className = "rvp" + (rvOpen.has(g.id) ? " open" : "");
    const distTxt = g.dist != null ? (g.dist < 30 ? ` · ${travelOf(g.dist*1000)} min ${TR().way}` : " · loin d'ici") : "";
    el.innerHTML = `<button aria-expanded="${rvOpen.has(g.id)}"><span class="emo">${ICONS.ico(g.em, 30)}</span><span class="t"><b></b><small></small>${g.avg ? starsHTML(g.avg) : ""}</span>
      <span class="score">${g.avg ? `<b>${g.avg.toFixed(1).replace(".",",")}</b><span>${g.rated} note${g.rated>1?"s":""}</span>` : `<b>—</b><span>pas noté</span>`}</span></button>
      <div class="body"></div>`;
    el.querySelector(".t b").textContent = g.name;
    el.querySelector(".t small").textContent = `${g.reviews.length} avis${g.addr ? " · " + g.addr : ""}${distTxt}`;
    el.querySelector("button").onclick = () => { rvOpen.has(g.id) ? rvOpen.delete(g.id) : rvOpen.add(g.id); renderReviews(); };
    if(rvOpen.has(g.id)){
      const B = el.querySelector(".body");
      if(g.rated){
        const cnt = [0,0,0,0,0,0]; g.reviews.forEach(r => { if(r.rating) cnt[r.rating]++; });
        [5,4,3,2,1].forEach(n => { const d = document.createElement("div"); d.className = "dist"; d.innerHTML = `${n}★<i><u style="width:${(cnt[n]/g.rated*100).toFixed(0)}%"></u></i>${cnt[n]}`; B.appendChild(d); });
      }
      const hr = g.reviews.find(r => r.hours);
      if(hr){ const p = document.createElement("p"); p.className = "small"; p.textContent = `🕐 Horaires signalés : ${hr.hours} (${hr.author.pseudo || "quelqu'un"}, ${whenTxt(hr.at).toLowerCase()})`; B.appendChild(p); }
      g.reviews.forEach(r => {
        const d = document.createElement("div"); d.className = "rv1";
        d.innerHTML = `<span class="ava sm">${avaInner(r.author)}</span><div class="c"><div class="h"><b></b><time>${esc(whenTxt(r.at))}${r.author._uid !== UID ? ` · <button class="rm rp">signaler</button>` : ""}</time></div>${r.rating ? starsHTML(r.rating) : ""}${r.text ? `<p></p>` : ""}${r.photo ? `<img class="pic" alt="">` : ""}</div>`;
        d.querySelector(".h b").textContent = r.author.pseudo || "Quelqu'un";
        if(r.text) d.querySelector("p").textContent = r.text;
        const rp = d.querySelector(".rp"); if(rp) rp.onclick = () => { if(confirm("Signaler cet avis ? Il sera masqué pour toi, et pour tout le monde s'il est signalé plusieurs fois.")) reportContent(`post:${r.author._uid}:${r.id}`, "inapproprie"); };
        if(r.photo) loadPhoto(r.author._uid, r.id, d.querySelector(".pic"));
        B.appendChild(d);
      });
      const acts = document.createElement("div"); acts.className = "btns"; acts.style.marginTop = "10px";
      if(g.lat != null) acts.innerHTML += `<a class="go" target="_blank" rel="noopener" href="${dirUrl(g)}">${TR().e} Je pars</a>`;
      if(me && me.code) acts.innerHTML += `<button class="ghost give">✍️ Donner mon avis</button>`;
      B.appendChild(acts);
      const go = acts.querySelector(".go");
      if(go) go.onclick = () => { const w = g.dist != null ? travelOf(g.dist*1000) : 5; const p = {id:g.pid || g.id, name:g.name, em:g.em, addr:g.addr, lat:g.lat, lng:g.lng, g:"", url:""}; const h = logVisit(p); startTimer({...p, walk:w}, h, Math.max(T, 2*w + 10)); };
      const give = acts.querySelector(".give");
      if(give) give.onclick = () => { composePreset = {name:g.name, pid:g.pid, lat:g.lat, lng:g.lng, em:g.em, addr:g.addr}; composeOpen = true; composeFrom = null; showView("blog"); renderCompose(); setTimeout(() => $("blogCompose").scrollIntoView({behavior:"smooth"}), 50); };
    }
    L.appendChild(el);
  });
}
$("rvScope").addEventListener("click", e => { const b = e.target.closest("button"); if(!b) return; rvScope = b.dataset.v; renderReviews(); });
$("rvSort").addEventListener("click", e => { const b = e.target.closest("button"); if(!b) return; rvSort = b.dataset.v; renderReviews(); });
$("rvQ").addEventListener("input", () => renderReviews());

// ---------- Choisis pour moi ----------
// Choix au hasard, pondéré : l'heure qu'il est, la distance, les favoris, et ce qu'on n'a pas fait récemment.
const HOUR_FIT = [
  {re:/Boulang/, h:[[6,11,3],[15,18,2]]},
  {re:/Caf|thé/, h:[[7,11,2],[14,18,2.5]]},
  {re:/pouce|Restaurant/, h:[[11,14.5,3],[18.5,21.5,2.5]]},
  {re:/Glacier/, h:[[13,19,2.5]]},
  {re:/Parc|vert|marcher/, h:[[7,20,1.6]]},
  {re:/Musée|Biblioth|Librair/, h:[[10,18,1.6]]},
  {re:/sport/, h:[[6,9.5,2],[17,21,2]]}
];
function hourBoost(g, hr){
  const f = HOUR_FIT.find(x => x.re.test(g)); if(!f) return 1;
  const m = f.h.find(([a,b]) => hr >= a && hr < b); return m ? m[2] : .7;
}
const MOMENT = hr => hr < 11 ? "ce matin" : hr < 14.5 ? "à cette heure-ci" : hr < 18 ? "cet après-midi" : "ce soir";
function pickForMe(list){
  const d = new Date(), hr = d.getHours() + d.getMinutes()/60;
  const recent = new Set(HIST.slice(0,12).map(h => h.pid));
  const scored = list.map(p => {
    let w = hourBoost(p.g, hr) * (1.4 - Math.min(1, 2*p.walk/T) * .8);
    const o = HOURS.forVisit(p.oh, p.walk, p.stay);
    if(o.level === "closed") w *= .01; else if(o.level === "warn") w *= .4; else if(o.level === "ok") w *= 1.2;
    if(LISTS.todo[p.id]) w *= 2.2; else if(LISTS.fav[p.id]) w *= 1.5;
    if(isPreferred(MOODS[M].groups.find(g => g.l === p.g))) w *= 1.8;
    if(recent.has(p.id)) w *= .25;
    if(p.id === pickedId) w *= .05;
    return {p, w};
  });
  let r = Math.random() * scored.reduce((s,x) => s + x.w, 0);
  const hit = scored.find(x => (r -= x.w) <= 0) || scored[0];
  const p = hit.p, free = Math.max(0, T - 2*p.walk - p.stay);
  const why = LISTS.todo[p.id] ? "tu l'avais noté à tester, c'est le moment" :
    recent.has(p.id) ? "une valeur sûre" :
    hourBoost(p.g, hr) > 1.5 ? `parfait ${MOMENT(hr)}` :
    !HIST.some(h => h.pid === p.id) ? "tu n'y es encore jamais allé·e" : "ça change un peu";
  return {p, txt:`${p.name} : ${why}. ${fmtDur(2*p.walk + p.stay)} en tout (${p.walk} min ${TR().way} à l'aller et au retour)${free ? `, il te restera ${fmtDur(free)}` : ""}.`};
}
$("ideaBtn").addEventListener("click", () => {
  const list = allLoaded(); if(!list.length) return;
  const {p, txt} = pickForMe(list);
  pickedId = p.id; $("ideaTxt").textContent = txt;
  renderResults();
  const el = document.getElementById("p-" + p.id.replace(/[^\w-]/g,""));
  if(el) el.scrollIntoView({behavior:"smooth", block:"center"});
});

// ---------- Historique ----------
let HIST = [], store = null, showAll = false, DB = null, UID = null, dbState = "wait";
const RETRY = new Map(); // écritures à renvoyer quand la connexion revient (id → fonction)
const LS_KEY = "pasltemps.history";
const lsLoad = () => { try{ return JSON.parse(localStorage.getItem(LS_KEY)||"[]"); }catch(e){ return []; } };
const lsSave = () => { try{ localStorage.setItem(LS_KEY, JSON.stringify(HIST.slice(0,300))); }catch(e){} };

let initTries = 0;
async function initHistory(){
  try{
    const conn = await PLT.connect();
    const db = conn && conn.db, user = conn && conn.user;
    MOD = conn;
    const uid = user ? await user.id() : null;
    if(db) DB = db;
    UID = uid; dbState = db && uid ? "ok" : "none";
    // Blog, avis et code de récupération n'apparaissent que si le serveur répond
    document.body.classList.toggle("social-on", dbState === "ok");
    if(db && uid){ initBlog(); initLists(); }
    if(db && uid){
      const col = db.doc("data/users/" + uid + "/profile").collection("history");
      store = { add: e => col.doc(e.id).set(e), set: (id, e) => col.doc(id).set(e), remove: id => col.doc(id).delete() };
      col.orderBy("at","desc").limit(300).onSnapshot(snap => {
        if(!snap.docs.length && HIST.length){ HIST.forEach(e => store.add(e).catch(()=>{})); return; } // première connexion : on envoie l'historique local
        const pending = HIST.filter(h => RETRY.has(h.id)), ids = new Set(snap.docs.map(d => d.id));
        HIST = [...pending.filter(h => !ids.has(h.id)), ...snap.docs.map(d => ({...d.data(), id:d.id}))].sort((a,b) => b.at - a.at);
        renderHistory(); renderResults();
        lsSave();
      }, () => { store = null; HIST = lsLoad(); renderHistory(); });
      return;
    }
  }catch(e){}
  dbState = "none";
  // Serveur configuré mais injoignable ou saturé : nouvel essai un peu plus tard
  if(initTries++ < 3 && (window.PASLTEMPS_CONFIG || {}).apiBase !== undefined) setTimeout(() => { if(!DB) initHistory(); }, 20000 * initTries);
  renderHistory(); renderRec(); renderBlog(); renderReviews();
}
async function write(id, fn){
  lsSave();
  if(store){ try{ await fn(); RETRY.delete(id); }catch(e){ RETRY.set(id, fn); } }
  scheduleBackup();
}
addEventListener("online", () => RETRY.forEach((fn, id) => write(id, fn)));
function logVisit(p){
  const e = {id:"h"+Date.now().toString(36)+Math.random().toString(36).slice(2,6), at:Date.now(),
    n:p.name, q:p.g, pid:p.id, addr:p.addr, url:p.url||"", mood:M, T, done:false, note:"",
    lat:+p.lat.toFixed(4), lng:+p.lng.toFixed(4)};
  HIST.unshift(e); renderHistory();
  write(e.id, () => store.add(e));
  syncDerived();
  return e;
}
function patch(id, p){ const e = HIST.find(h => h.id === id); if(!e) return; Object.assign(e, p); renderHistory(); renderResults(); write(id, () => store.set(id, HIST.find(h => h.id === id))); syncDerived(); }
function removeEntry(id){ HIST = HIST.filter(h => h.id !== id); renderHistory(); renderResults(); write(id, () => store.remove(id)); }
function whenTxt(t){
  const d = new Date(t), now = new Date(), day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 864e5), h = `${d.getHours()}h${String(d.getMinutes()).padStart(2,"0")}`;
  if(diff === 0) return "Aujourd'hui " + h; if(diff === 1) return "Hier " + h;
  return d.toLocaleDateString("fr-FR", {day:"numeric", month:"short"}) + " " + h;
}
function renderHistory(){
  const L = $("histList"); L.innerHTML = "";
  const done = HIST.filter(h => h.done).length;
  $("histCount").textContent = HIST.length ? `${done} pause${done>1?"s":""} faite${done>1?"s":""}` : "";
  if(!HIST.length){ L.innerHTML = `<p class="empty">Rien pour l'instant. Quand vous touchez « Je pars », le lieu s'ajoute ici et vous pourrez le marquer comme fait.</p>`; return; }
  (showAll ? HIST : HIST.slice(0,8)).forEach(h => {
    const el = document.createElement("div");
    el.className = "entry" + (h.done ? " done" : "");
    const mood = MOODS[h.mood];
    let near = "";
    if(pos && h.lat != null){
      const R=6371, r=x=>x*Math.PI/180, dLa=r(h.lat-pos.lat), dLo=r(h.lng-pos.lng);
      const km = 2*R*Math.asin(Math.sqrt(Math.sin(dLa/2)**2+Math.cos(r(pos.lat))*Math.cos(r(h.lat))*Math.sin(dLo/2)**2));
      near = km < 1.5 ? " · près d'ici" : km < 50 ? ` · à ${Math.round(km)} km d'ici` : " · ailleurs";
    }
    el.innerHTML = `<div class="row"><strong></strong><time>${whenTxt(h.at)}</time></div>
      <div class="sub">${mood ? ICONS.ico(mood.e, 16) + " " : ""}${esc(h.q||"")} · ${fmtDur(h.T)}${near}</div>
      <input type="text" placeholder="Un souvenir, une note… (facultatif)" maxlength="120">
      <div class="acts"><button class="tog${h.done?" on":""}">${h.done ? "Fait ✓" : "Marquer comme fait"}</button>${h.url?`<a class="ghost" style="font-size:14px;padding:4px 10px" target="_blank" rel="noopener" href="${esc(h.url)}">Site web</a>`:""}<button class="share">Raconter</button><button class="del">Supprimer</button></div>`;
    el.querySelector("strong").textContent = h.n;
    el.querySelector(".share").onclick = () => { composeFrom = h.id; composeOpen = true; showView("blog"); renderCompose(); $("blogCompose").scrollIntoView({behavior:"smooth"}); };
    const inp = el.querySelector("input"); inp.value = h.note || "";
    inp.addEventListener("change", () => { const v = inp.value.trim(); if(v !== (h.note||"")) patch(h.id, {note:v}); });
    inp.addEventListener("keydown", ev => { if(ev.key === "Enter") inp.blur(); });
    el.querySelector(".tog").onclick = () => patch(h.id, {done: !h.done});
    el.querySelector(".del").onclick = () => removeEntry(h.id);
    L.appendChild(el);
  });
  if(HIST.length > 8){
    const b = document.createElement("button"); b.className = "link"; b.style.fontSize = "15px";
    b.textContent = showAll ? "Voir moins" : `Voir tout (${HIST.length})`;
    b.onclick = () => { showAll = !showAll; renderHistory(); };
    L.appendChild(b);
  }
}

// ---------- Démarrage ----------
renderTravel();
document.querySelectorAll(".tabico").forEach(i => i.innerHTML = ICONS.ico(i.dataset.i, 26));
renderMoods();
if(RECENTS[0]){ pos = {lat:RECENTS[0].lat, lng:RECENTS[0].lng}; posLabel = RECENTS[0].label; geoState = "ok"; }
HIST = lsLoad();
renderWhere(); renderHistory(); renderSaved(); renderTimer(); search(); locate(false); initHistory();

// Hors connexion
function renderOnline(){ $("offline").hidden = navigator.onLine !== false; }
addEventListener("online", () => { renderOnline(); if(pos && Object.values(LOADED).some(x => x.state === "err")) search(); });
addEventListener("offline", renderOnline);
renderOnline();

// Installation (PWA)
let installEvt = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; renderInstall(); });
addEventListener("appinstalled", () => { installEvt = null; renderInstall(); });
function renderInstall(){
  const B = $("install"); if(!B) return;
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if(standalone){ B.innerHTML = `<p style="margin:0">C'est installé ✓ Pas l'temps s'ouvre depuis votre écran d'accueil.</p>`; return; }
  if(installEvt){
    B.innerHTML = `<p>Ajoutez Pas l'temps à votre écran d'accueil : elle s'ouvre en plein écran, comme une vraie appli.</p><div class="btns"><button class="go" id="installGo">📲 Installer</button></div>`;
    $("installGo").onclick = async () => { installEvt.prompt(); try{ await installEvt.userChoice; }catch(e){} installEvt = null; renderInstall(); };
    return;
  }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  B.innerHTML = ios
    ? `<ol class="install-steps"><li>Touchez le bouton <b>Partager</b> de Safari</li><li>Puis <b>Sur l'écran d'accueil</b></li></ol>`
    : `<ol class="install-steps"><li>Ouvrez le menu du navigateur (⋮)</li><li>Puis <b>Installer l'application</b> ou <b>Ajouter à l'écran d'accueil</b></li></ol>`;
}
renderInstall();
if("serviceWorker" in navigator && location.protocol !== "file:"){
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
