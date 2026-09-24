// Pas l'temps — accès au serveur (compte anonyme par appareil + documents).
// Expose window.PLT.connect() → {db, user} ou null si le serveur est injoignable.
(function(){
  const CFG = window.PASLTEMPS_CONFIG || {};
  const BASE = String(CFG.apiBase || "").replace(/\/+$/, "");
  const AUTH_KEY = "pasltemps.auth";
  let auth = null;
  try{ auth = JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); }catch(e){}

  async function call(method, url, body){
    const res = await fetch(BASE + url, {
      method,
      headers: {"Authorization": "Bearer " + auth.token, ...(body ? {"Content-Type": "application/json"} : {})},
      body: body ? JSON.stringify(body) : undefined
    });
    let data = null; try{ data = await res.json(); }catch(e){}
    if(!res.ok) throw {code: (data && data.error) || "http_" + res.status, status: res.status};
    return data;
  }

  // ---------- Écoute des collections : relecture régulière ----------
  const listeners = new Set();
  function refreshAll(){ listeners.forEach(l => l.poll()); }
  let refreshTimer = null;
  function refreshSoon(){ clearTimeout(refreshTimer); refreshTimer = setTimeout(refreshAll, 400); }
  document.addEventListener("visibilitychange", () => { if(document.visibilityState === "visible") refreshAll(); });
  addEventListener("online", refreshAll);

  function snapOf(docs){ return {docs: docs.map(d => ({id: d.id, data: () => d.data}))}; }

  function docRef(p){
    return {
      path: p,
      async get(){ const r = await call("GET", "/api/doc?path=" + encodeURIComponent(p)); return {exists: r.exists, data: () => r.data}; },
      async set(d){ await call("PUT", "/api/doc?path=" + encodeURIComponent(p), d); refreshSoon(); },
      async update(d){ await call("PATCH", "/api/doc?path=" + encodeURIComponent(p), d); refreshSoon(); },
      async delete(){ await call("DELETE", "/api/doc?path=" + encodeURIComponent(p)); refreshSoon(); },
      collection(name){ return colRef(p + "/" + name); }
    };
  }
  function colRef(p, opts){
    opts = {dir: "desc", limit: 300, ...opts};
    const url = () => `/api/list?path=${encodeURIComponent(p)}&dir=${opts.dir}&limit=${opts.limit}`;
    return {
      path: p,
      doc(id){ return docRef(p + "/" + id); },
      orderBy(_field, dir){ return colRef(p, {...opts, dir: dir === "asc" ? "asc" : "desc"}); },
      limit(n){ return colRef(p, {...opts, limit: n}); },
      async get(){ return snapOf((await call("GET", url())).docs); },
      onSnapshot(cb, onErr){
        let last = null, stopped = false, busy = false, failed = false;
        const l = {
          async poll(){
            if(stopped || busy) return; busy = true;
            try{
              const r = await call("GET", url()), sig = JSON.stringify(r.docs);
              if(sig !== last){ last = sig; cb(snapOf(r.docs)); }
            }catch(e){ if(last === null && !failed && onErr){ failed = true; onErr(e); } }
            busy = false;
          }
        };
        listeners.add(l); l.poll();
        const iv = setInterval(() => { if(document.visibilityState === "visible") l.poll(); }, opts.every || 20000);
        return () => { stopped = true; clearInterval(iv); listeners.delete(l); };
      }
    };
  }

  async function connect(){
    try{
      const h = await fetch(BASE + "/api/health", {cache: "no-store"});
      if(!h.ok || !(await h.json()).ok) return null;
      if(!auth || !auth.token){
        const r = await fetch(BASE + "/api/session", {method: "POST"});
        if(!r.ok) return null;
        auth = await r.json();
        try{ localStorage.setItem(AUTH_KEY, JSON.stringify(auth)); }catch(e){}
      } else {
        // Jeton inconnu du serveur (base réinitialisée…) : on repart d'un compte neuf
        try{ await call("GET", "/api/doc?path=" + encodeURIComponent("data/users/" + auth.uid + "/profile")); }
        catch(e){ if(e.status === 401){ try{ localStorage.removeItem(AUTH_KEY); }catch(_){} auth = null; return connect(); } }
      }
      return {
        db: {doc: docRef, collection: colRef},
        user: {id: async () => auth.uid},
        // Modération
        report: (target, reason) => call("POST", "/api/report", {target, reason}),
        hidden: async () => { try{ return (await call("GET", "/api/hidden")).targets || []; }catch(e){ return []; } }
      };
    }catch(e){ return null; }
  }

  window.PLT = {connect};
})();
