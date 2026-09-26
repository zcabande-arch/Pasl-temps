// Pas l'temps — premier lancement : 3 écrans pour comprendre l'appli, puis le prénom (facultatif).
// Ne s'affiche qu'une fois, et jamais pour quelqu'un qui a déjà un prénom ou un historique.
(function(){
  const KEY = "pasltemps.onboarded";
  let seen = true; try{ seen = !!localStorage.getItem(KEY); }catch(e){}
  const mark = () => { try{ localStorage.setItem(KEY, "1"); }catch(e){} };
  if(seen) return;
  if(PROFILE.name || HIST.length){ mark(); return; }

  const STEPS = [
    {ico:"chair", t:tx("Un peu de temps devant toi ?"), p:tx("Dis combien : 10 minutes, 2 heures, ou l'heure à laquelle tu dois être rentré·e.")},
    {ico:"pin",   t:tx("On trouve ce qui tient dedans"), p:tx("Boulangerie, parc, musée… autour de toi, avec l'aller, le temps sur place et le retour.")},
    {ico:"walk",  t:tx("Tu pars, on chronomètre"), p:tx("Touche « Je pars » : l'appli te prévient quand il faut repartir pour être à l'heure.")},
    {ico:"user",  t:tx("Et toi, c'est quoi ton prénom ?"), p:tx("Il reste sur ton appareil. Tu peux aussi le laisser vide."), name:true}
  ];
  let i = 0;
  const box = document.createElement("div");
  box.id = "onb"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-labelledby", "onbT");
  function render(){
    const s = STEPS[i], last = i === STEPS.length - 1;
    box.innerHTML = `<button class="skip link">${tx("Passer")}</button>
      <div class="art">${ICONS.ico(s.ico, 120)}</div>
      <h2 id="onbT"></h2><p></p>
      ${s.name ? `<input class="field" id="onbName" maxlength="30" autocomplete="given-name" placeholder="${tx("Ton prénom")}" enterkeyhint="done">` : ""}
      <div class="dots">${STEPS.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div>
      <button class="go next">${last ? tx("C'est parti") : tx("Suivant")}</button>`;
    box.querySelector("h2").textContent = s.t; box.querySelector("p").textContent = s.p;
    box.querySelector(".skip").onclick = finish;
    box.querySelector(".next").onclick = () => { if(last) finish(); else { i++; render(); } };
    const inp = box.querySelector("#onbName");
    if(inp){ inp.addEventListener("keydown", e => { if(e.key === "Enter") finish(); }); setTimeout(() => inp.focus(), 250); }
    else box.querySelector(".next").focus();
  }
  function finish(){
    const inp = box.querySelector("#onbName"), n = inp ? inp.value.trim().slice(0, 30) : "";
    if(n){ PROFILE.name = n; saveProfile(); renderBrand(); }
    mark();
    box.classList.add("out"); setTimeout(() => { box.remove(); if(typeof renderPushAsk === "function") renderPushAsk(); }, 400);
  }
  render();
  // juste après l'écran « Bonjour »
  setTimeout(() => { document.body.appendChild(box); requestAnimationFrame(() => box.classList.add("in")); }, document.getElementById("splash") ? 2050 : 0);
})();
