// Confiance dans les horaires : on n'affirme « Ouvert » que si c'est vérifié
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const TRUST = require("../public/js/trust");
const H = require("../public/js/hours");
const { openLevel } = require("../server/opens");
const { createServer } = require("../server/server");
const { openStore } = require("../server/store");
const NOW = new Date(2026, 10, 25, 12), OH = "Mo-Su 08:00-20:00";
const L = x => TRUST.level({oh: OH, checked: "", community: null, ...x}, NOW);

test("niveau de confiance", () => {
  assert.equal(L({oh: ""}), "none");
  assert.equal(L({}), "old");
  assert.equal(L({checked: "2024-03-01"}), "old");
  assert.equal(L({checked: "2026-03-01"}), "checked");
  assert.equal(L({checked: "2030-01-01"}), "old");
  assert.equal(L({community: {s: "ok", n: 3, day: "2026-11-01"}}), "visitors");
  assert.equal(L({checked: "2026-03-01", community: {s: "doubt", n: 3, day: "2026-11-01"}}), "doubt");
  assert.equal(L({checked: "2026-11-10", community: {s: "doubt", n: 3, day: "2026-11-01"}}), "checked", "vérifié depuis : doute levé");
});

test("texte : « Ouvert » seulement si vérifié ; « Fermé » et les alertes restent", () => {
  const s = (h, k, m = 0) => TRUST.soften(H.forVisit(OH, 5, 10, new Date(2026, 10, 25, h, m)), k);
  assert.equal(s(12, "checked").say, undefined);
  assert.equal(s(12, "visitors").level, "ok");
  assert.deepEqual(s(12, "old").say, ["Sans doute ouvert · jusqu'à {h}", {h: "20h"}]);
  assert.deepEqual([s(12, "doubt").say[0], s(12, "doubt").level], ["Horaires à confirmer", "warn"]);
  assert.equal(s(19, "old", 30).say, undefined, "« Ferme dans… » gardé");
  for(const k of ["old", "doubt", "checked"]) assert.equal(s(22, k).level, "closed");
});

test("question au retour : seulement si on a eu le temps d'arriver, pour un lieu à horaires", () => {
  const t = {pid: "osm:n1", oh: true, start: 0, walk: 5};
  assert.equal(TRUST.shouldAsk(t, 6 * 60000), true);
  assert.equal(TRUST.shouldAsk(t, 4 * 60000), false);
  assert.equal(TRUST.shouldAsk({...t, oh: false}, 6e6), false);
  assert.equal(TRUST.shouldAsk(null, 6e6), false);
});

test("réponses des visiteurs : 3 du même avis, majorité, 180 jours", () => {
  const now = +NOW, v = (ok, n, days = 1) => Array.from({length: n}, () => ({ok, at: now - days * 864e5}));
  assert.equal(openLevel(v(0, 2), now), null);
  assert.deepEqual(openLevel(v(0, 3), now), {s: "doubt", n: 3, day: new Date(now - 864e5).toISOString().slice(0, 10)});
  assert.equal(openLevel([...v(0, 3), ...v(1, 3)], now), null, "partagé : on ne dit rien");
  assert.equal(openLevel(v(1, 4), now).s, "ok");
  assert.equal(openLevel([...v(1, 4), ...v(0, 3)], now), null);
  assert.equal(openLevel(v(0, 5, 200), now), null, "trop vieux");
});

test("API : une réponse par personne, total seulement, effacée avec le compte", async () => {
  const store = openStore(":memory:"), srv = createServer(store, {rateLimit: false});
  await new Promise(ok => srv.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${srv.address().port}`;
  try{
    const who = []; for(let i = 0; i < 4; i++) who.push(await (await fetch(base + "/api/session", {method: "POST"})).json());
    const vote = (w, body) => fetch(base + "/api/open/vote", {method: "POST", headers: {...(w ? {Authorization: "Bearer " + w.token} : {}), "Content-Type": "application/json"}, body: JSON.stringify(body)});
    const read = async ids => (await (await fetch(base + "/api/open/community?ids=" + ids)).json()).places;
    assert.equal((await vote(null, {place: "osm:n1", ok: 0})).status, 401);
    for(const bad of [{place: "osm:n1", ok: 2}, {place: "osm:n1"}, {place: "<x>", ok: 1}]) assert.equal((await vote(who[0], bad)).status, 400);
    for(let i = 0; i < 5; i++) await vote(who[0], {place: "osm:n1", ok: 0});
    await vote(who[1], {place: "osm:n1", ok: 0});
    assert.deepEqual(await read("osm:n1"), {});
    assert.equal((await (await vote(who[2], {place: "osm:n1", ok: 0})).json()).community.s, "doubt");
    const r = await read("osm:n1,osm:n2");
    assert.deepEqual([Object.keys(r), Object.keys(r["osm:n1"]).sort(), r["osm:n1"].n], [["osm:n1"], ["day", "n", "s"], 3]);
    await vote(who[2], {place: "osm:n1", ok: -1});
    assert.deepEqual(await read("osm:n1"), {});
    await vote(who[3], {place: "osm:n1", ok: 0});
    assert.equal((await read("osm:n1"))["osm:n1"].n, 3);
    await store.deleteAccount(who[0].uid);
    assert.deepEqual(await read("osm:n1"), {});
    store.openPurge(Date.now() + 1);
    assert.equal(store.opensFor(["osm:n1"], 0).length, 0);
  } finally { srv.close(); }
});
