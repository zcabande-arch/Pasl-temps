// Pas l'temps — page Profil : photo, prénom, âge, genre, endroits préférés, code de récupération.
// Tout est gardé sur l'appareil (PROFILE, saveProfile et PREF_TYPES sont dans app.js).
(function(){
  let savedTimer = null;
  function saved(){
    const el = $("pSaved"); if(!el) return;
    el.textContent = tx("Enregistré ✓");
    clearTimeout(savedTimer); savedTimer = setTimeout(() => { el.textContent = ""; }, 1600);
  }
  function hello(){
    const n = (PROFILE.name || "").trim();
    $("pHello").innerHTML = n ? `${tx("Bonjour")} <em></em>` : tx("Bonjour");
    if(n) $("pHello").querySelector("em").textContent = n;
    renderBrand();
  }
  function photo(){
    const ph = PROFILE.photo && /^data:image\/(jpeg|png|webp);base64,/.test(PROFILE.photo) ? PROFILE.photo : "";
    $("pPhoto").innerHTML = ph ? `<img src="${ph}" alt="${tx("Ta photo de profil")}">` : ICONS.ico("user", 44);
  }

  window.renderProfile = function(){
    photo(); hello();
    if(document.activeElement !== $("pName")) $("pName").value = PROFILE.name || "";
    if(document.activeElement !== $("pAge")) $("pAge").value = PROFILE.age || "";
    document.querySelectorAll("#pGender button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === PROFILE.gender)));
    $("pPrefs").innerHTML = PREF_TYPES.map(t =>
      `<button data-k="${t.k}" aria-pressed="${PROFILE.prefs.includes(t.k)}">${ICONS.ico(t.ico, 22)}<span>${esc(t.l)}</span></button>`).join("");
    renderRec();
  };

  $("pName").addEventListener("input", () => { PROFILE.name = $("pName").value.trim().slice(0, 30); saveProfile(); hello(); saved(); });
  $("pAge").addEventListener("input", () => {
    const a = parseInt($("pAge").value, 10);
    PROFILE.age = a >= 10 && a <= 110 ? String(a) : ""; saveProfile(); saved(); renderMoods();
  });
  $("pGender").addEventListener("click", e => {
    const b = e.target.closest("button"); if(!b) return;
    PROFILE.gender = PROFILE.gender === b.dataset.v ? "" : b.dataset.v;   // toucher à nouveau pour retirer
    saveProfile(); renderProfile(); saved();
  });
  $("pPrefs").addEventListener("click", e => {
    const b = e.target.closest("button"); if(!b) return;
    const k = b.dataset.k;
    PROFILE.prefs = PROFILE.prefs.includes(k) ? PROFILE.prefs.filter(x => x !== k) : [...PROFILE.prefs, k];
    saveProfile(); b.setAttribute("aria-pressed", String(PROFILE.prefs.includes(k)));
    renderMoods(); renderResults(); saved();
  });
  $("pPhotoIn").addEventListener("change", async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = ""; if(!f) return;
    try{ PROFILE.photo = await resizeImage(f, 256, 60000, true); saveProfile(); photo(); saved(); }
    catch(err){ $("pSaved").textContent = tx("Cette image ne peut pas être lue. Essaie une autre photo."); }
  });

  // ---------- Code de récupération sans serveur ----------
  // Le code contient les données elles-mêmes (compressées) : profil, réglages, favoris, lieux récents, historique.
  // La photo n'y est pas (trop lourde). On peut le copier, l'envoyer, ou partager un lien qui le contient.
  const b64u = bytes => { let s = ""; for(let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
  const unb64u = str => Uint8Array.from(atob(str.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
  async function squeeze(bytes, fmt, mode){
    const cs = mode === "in" ? new CompressionStream(fmt) : new DecompressionStream(fmt);
    return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(cs)).arrayBuffer());
  }
  function portableData(){
    return {v:1, me:{name:PROFILE.name, age:PROFILE.age, gender:PROFILE.gender, prefs:PROFILE.prefs}, settings:SET, lists:LISTS,
      recents:RECENTS.slice(0, 5),
      history:HIST.slice(0, 60).map(({id,at,n,q,pid,mood,T,done,note,lat,lng}) => ({id,at,n,q,pid,mood,T,done,note,lat,lng}))};
  }
  async function makeCode(){
    const raw = new TextEncoder().encode(JSON.stringify(portableData()));
    if(window.CompressionStream){ try{ return "PLT1." + b64u(await squeeze(raw, "deflate-raw", "in")); }catch(e){} }
    return "PLT0." + b64u(raw);
  }
  async function readCode(text){
    const m = /PLT([01])\.([A-Za-z0-9_-]+)/.exec(String(text || "").trim());
    if(!m) throw new Error("format");
    let bytes = unb64u(m[2]);
    if(m[1] === "1") bytes = await squeeze(bytes, "deflate-raw", "out");
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if(!data || data.v !== 1) throw new Error("format");
    return data;
  }
  const linkFor = code => location.origin + location.pathname + "#r=" + code;

  let pView = "main", lastCode = "";
  window.renderPortable = async function(R, msg, warn){
    if(pView === "enter"){
      R.innerHTML = `<p>${tx("Colle ici ton code (ou le lien) de récupération :")}</p>
        <textarea class="field codebox" id="pcIn" rows="4" placeholder="PLT1.…" autocomplete="off" spellcheck="false"></textarea>
        <div class="btns"><button class="go" id="pcGo">${tx("Récupérer")}</button><button class="ghost" id="pcBack">${tx("Annuler")}</button></div>
        <p class="msg${warn ? " warn" : ""}"></p>`;
      R.querySelector(".msg").textContent = msg || "";
      $("pcBack").onclick = () => { pView = "main"; renderRec(); };
      $("pcGo").onclick = async () => {
        try{ const n = await applyBackupData(await readCode($("pcIn").value)); pView = "main"; renderProfile();
          renderRec(tx(n > 1 ? "C'est récupéré ✓ {n} sorties ajoutées à ton historique." : "C'est récupéré ✓ {n} sortie ajoutée à ton historique.", {n})); }
        catch(e){ renderRec(tx("Ce code n'est pas reconnu. Vérifie qu'il est complet."), true); }
      };
      return;
    }
    R.innerHTML = `<p>${tx("Ton code contient ton profil, tes réglages, tes favoris et ton historique. Garde-le (ou envoie-le toi) pour tout retrouver sur un autre appareil. Ta photo n'y est pas.")}</p>
      <textarea class="field codebox" id="pcOut" rows="3" readonly>${tx("Création…")}</textarea>
      <div class="btns"><button class="go" id="pcShare">${tx("Envoyer le lien")}</button><button class="ghost" id="pcCopy">${tx("Copier le code")}</button><button class="ghost" id="pcHave">${tx("J'ai un code")}</button></div>
      <p class="msg${warn ? " warn" : ""}"></p>`;
    R.querySelector(".msg").textContent = msg || "";
    $("pcHave").onclick = () => { pView = "enter"; renderRec(); };
    lastCode = await makeCode();
    if(!$("pcOut")) return;
    $("pcOut").value = lastCode;
    $("pcCopy").onclick = async () => {
      try{ await navigator.clipboard.writeText(lastCode); R.querySelector(".msg").textContent = tx("Code copié ✓ Garde-le dans tes notes."); }
      catch(e){ $("pcOut").select(); R.querySelector(".msg").textContent = tx("Le code est sélectionné : copie-le à la main."); }
    };
    $("pcShare").onclick = async () => {
      const url = linkFor(lastCode);
      try{ if(navigator.share){ await navigator.share({title:tx("Pas l'temps : mon code de récupération"), text:tx("Ouvre ce lien pour retrouver mon profil Pas l'temps :"), url}); return; } }
      catch(e){ if(e && e.name === "AbortError") return; }
      try{ await navigator.clipboard.writeText(url); R.querySelector(".msg").textContent = tx("Lien copié ✓ Envoie-le toi par message ou par mail."); }
      catch(e){ $("pcOut").value = url; $("pcOut").select(); R.querySelector(".msg").textContent = tx("Le lien est sélectionné : copie-le à la main."); }
    };
  };

  // Ouverture d'un lien de récupération (…#r=PLT1.…) : on propose de tout récupérer
  const m = /[#&]r=(PLT[01]\.[A-Za-z0-9_-]+)/.exec(location.hash);
  if(m){
    history.replaceState(null, "", location.pathname + location.search);
    setTimeout(async () => {
      if(!confirm(tx("Récupérer le profil, les favoris et l'historique contenus dans ce lien ?"))) return;
      try{ const n = await applyBackupData(await readCode(m[1])); showView("profile");
        renderRec(tx(n > 1 ? "C'est récupéré ✓ {n} sorties ajoutées à ton historique." : "C'est récupéré ✓ {n} sortie ajoutée à ton historique.", {n})); }
      catch(e){ alert(tx("Ce lien de récupération n'est pas reconnu.")); }
    }, 2300);
  }
})();
