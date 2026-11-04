// Fissa Fissa — premier lancement : 3 écrans pour comprendre l'appli, puis un petit questionnaire (tout facultatif) :
// prénom, âge, moyen de transport, temps habituel, endroits préférés. L'appli s'ouvre ensuite déjà réglée.
// Ne s'affiche qu'une fois, et jamais pour quelqu'un qui a déjà un prénom ou un historique.
(function(){
  const KEY = "pasltemps.onboarded";
  let seen = true; try{ seen = !!localStorage.getItem(KEY); }catch(e){}
  const mark = () => { try{ localStorage.setItem(KEY, "1"); }catch(e){} };
  if(seen) return;
  if(PROFILE.name || HIST.length){ mark(); return; }

  const STEPS = [
    {img:"icons/logo.png", t:tx("Un peu de temps devant toi ?"), p:tx("Dis combien : 10 minutes, 2 heures, ou l'heure à laquelle tu dois être rentré·e.")},
    {ico:"pin",   t:tx("On trouve ce qui tient dedans"), p:tx("Boulangerie, parc, musée… autour de toi, avec l'aller, le temps sur place et le retour.")},
    {ico:"walk",  t:tx("Tu pars, on chronomètre"), p:tx("Touche « Je pars » : l'appli te prévient quand il faut repartir pour être à l'heure.")},
    {ico:"user",  t:tx("Et toi, c'est quoi ton prénom ?"), p:tx("Il reste sur ton appareil. Tu peux aussi le laisser vide."), name:true},
    {ico:"smile", t:tx("Quel âge as-tu ?"), p:tx("Pour ne te proposer que des endroits adaptés. Tu peux aussi le laisser vide."), age:true},
    {ico:"walk",  t:tx("Tu te déplaces comment ?"), p:tx("On calcule les trajets avec. Tu pourras changer à tout moment."), pick:"travel"},
    {ico:"clock", t:tx("Tu as souvent combien de temps ?"), p:tx("Ce sera le temps proposé quand tu ouvres l'appli."), pick:"time"},
    {ico:"heart", t:tx("Tes endroits préférés ?"), p:tx("Ils passeront en premier. Choisis-en autant que tu veux."), pick:"prefs", sm:true}
  ];
  // Réponses gardées d'un écran à l'autre, appliquées à la fin (ou dès « Passer »)
  const A = {name:"", age:"", travel:"", time:0, prefs:[]};
  const TIME_CHOICES = [10, 20, 30, 45, 60, 90, 120];
  function choices(kind){
    if(kind === "travel") return Object.keys(TRAVEL).map(k => ({v:k, ico:TRAVEL[k].ico, l:TRAVEL[k].l, on:A.travel === k}));
    if(kind === "time") return TIME_CHOICES.map(t => ({v:String(t), ico:"clock", l:fmtDur(t), on:A.time === t}));
    return PREF_TYPES.map(t => ({v:t.k, ico:t.ico, l:t.l, on:A.prefs.includes(t.k)}));
  }
  let i = 0;
  const box = document.createElement("div");
  box.id = "onb"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-labelledby", "onbT");
  function render(){
    const s = STEPS[i], last = i === STEPS.length - 1;
    box.innerHTML = `<button class="skip link">${tx("Passer")}</button>
      <div class="art${s.img ? " logo" : ""}${s.sm ? " sm" : ""}">${s.img ? `<img src="${s.img}" alt="Fissa Fissa">` : ICONS.ico(s.ico, s.sm ? 64 : 120)}</div>
      <h2 id="onbT"></h2><p></p>
      ${s.name ? `<input class="field" id="onbName" maxlength="30" autocomplete="given-name" placeholder="${tx("Ton prénom")}" enterkeyhint="done">` : ""}
      ${s.age ? `<input class="field" id="onbAge" type="number" inputmode="numeric" min="10" max="110" placeholder="${tx("Ton âge")}" enterkeyhint="done">` : ""}
      ${s.pick ? `<div class="pprefs onbpick${s.pick === "prefs" ? "" : " one"}" role="group" aria-labelledby="onbT">${choices(s.pick).map(c =>
        `<button data-v="${esc(c.v)}" aria-pressed="${c.on}">${ICONS.ico(c.ico, 22)}<span>${esc(c.l)}</span></button>`).join("")}</div>` : ""}
      <div class="dots">${STEPS.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div>
      <button class="go next">${last ? tx("C'est parti") : tx("Suivant")}</button>`;
    box.querySelector("h2").textContent = s.t; box.querySelector("p").textContent = s.p;
    box.querySelector(".skip").onclick = finish;
    const next = () => { keep(); if(last) finish(); else { i++; render(); } };
    box.querySelector(".next").onclick = next;
    const pick = box.querySelector(".onbpick");
    if(pick) pick.onclick = e => {
      const b = e.target.closest("button"); if(!b) return;
      const v = b.dataset.v;
      if(s.pick === "prefs"){ A.prefs = A.prefs.includes(v) ? A.prefs.filter(x => x !== v) : [...A.prefs, v]; b.setAttribute("aria-pressed", String(A.prefs.includes(v))); return; }
      // un seul choix : toucher à nouveau pour retirer, sinon on passe à la question suivante
      if(s.pick === "travel") A.travel = A.travel === v ? "" : v;
      else A.time = A.time === +v ? 0 : +v;
      pick.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b && (s.pick === "travel" ? A.travel : String(A.time)) === v)));
      if(b.getAttribute("aria-pressed") === "true") setTimeout(next, 280);
    };
    const inp = box.querySelector("#onbName") || box.querySelector("#onbAge");
    if(inp){
      if(inp.id === "onbName") inp.value = A.name; else inp.value = A.age;
      inp.addEventListener("keydown", e => { if(e.key === "Enter") next(); }); setTimeout(() => inp.focus(), 250);
    }
    else box.querySelector(".next").focus();
  }
  // Note la réponse de l'écran affiché (champ texte)
  function keep(){
    const n = box.querySelector("#onbName"); if(n) A.name = n.value.trim().slice(0, 30);
    const g = box.querySelector("#onbAge");
    if(g){ const a = parseInt(g.value, 10); A.age = a >= 10 && a <= 110 ? String(a) : ""; }
  }
  function finish(){
    keep();
    if(A.name) PROFILE.name = A.name;
    if(A.age) PROFILE.age = A.age;
    if(A.prefs.length) PROFILE.prefs = A.prefs;
    if(A.name || A.age || A.prefs.length){ saveProfile(); renderBrand(); renderMoods(); }
    // Mêmes gestes que sur l'écran principal : la recherche se met à jour toute seule
    if(A.travel){ const b = document.querySelector(`#travelSeg button[data-v="${A.travel}"]`); if(b) b.click(); }
    if(A.time){
      SET.time = A.time; saveSet();
      const b = document.querySelector(`#dial button[data-t="${A.time}"]`); if(b) b.click();
    }
    mark();
    box.classList.add("out"); setTimeout(() => { box.remove(); if(typeof renderPushAsk === "function") renderPushAsk(); }, 400);
  }
  render();
  // juste après l'écran « Bonjour »
  setTimeout(() => { document.body.appendChild(box); requestAnimationFrame(() => box.classList.add("in")); }, document.getElementById("splash") ? 2050 : 0);
})();
