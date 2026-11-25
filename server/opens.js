// Fissa Fissa — « C'était bien ouvert ? » : résumé des réponses des visiteurs pour un lieu.
// Rien n'est publié en dessous de 3 réponses du même avis (une par personne), et elles ne comptent que 180 jours.
"use strict";
const KEEP = 180 * 864e5, MIN = 3;
// votes : [{ok: 1 | 0, at}] → {s: "ok" | "doubt", n, day} ou null
function openLevel(votes, now = Date.now()){
  const v = (votes || []).filter(x => x.at > now - KEEP && x.at <= now + 60000);
  const yes = v.filter(x => x.ok), no = v.filter(x => !x.ok);
  const out = (s, l) => ({s, n: l.length, day: new Date(Math.max(...l.map(x => x.at))).toISOString().slice(0, 10)});
  if(no.length >= MIN && no.length > yes.length) return out("doubt", no);
  if(yes.length >= MIN && yes.length >= 2 * no.length) return out("ok", yes);
  return null;
}
module.exports = { openLevel, KEEP };
