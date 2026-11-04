// Prix des restaurants et bars : Google Places (réponses simulées), coupé sans clé, plafond quotidien
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { createServer } = require("../server/server");
const { openStore } = require("../server/store");

async function start(opts){
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push(JSON.parse(init.body));
    return {ok: true, json: async () => ({places: [
      {location: {latitude: 48.9, longitude: 2.4}, priceLevel: "PRICE_LEVEL_EXPENSIVE"},
      {location: {latitude: 48.8567, longitude: 2.3523}, priceLevel: "PRICE_LEVEL_MODERATE", priceRange: {startPrice: {currencyCode: "EUR", units: "10"}, endPrice: {currencyCode: "EUR", units: "20"}}}]})};
  };
  const srv = createServer(openStore(":memory:"), {rateLimit: false, sendMail: null, fetchFn, ...opts});
  await new Promise(ok => srv.listen(0, "127.0.0.1", ok));
  const post = b => fetch(`http://127.0.0.1:${srv.address().port}/api/price`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(b)}).then(r => r.json());
  return {srv, post, calls};
}
const item = id => ({id, name: "Chez Paul", lat: 48.8566, lng: 2.3522});

test("sans clé Google : service coupé", async () => {
  const {srv, post} = await start({googleKey: ""});
  assert.deepEqual(await post({items: [item("osm:1")]}), {off: true});
  srv.close();
});

test("avec clé : le lieu le plus proche, niveau et fourchette", async () => {
  const {srv, post, calls} = await start({googleKey: "k"});
  const r = await post({items: [item("osm:1")], lang: "de"});
  assert.deepEqual(r.prices["osm:1"], {level: 2, from: 10, to: 20, cur: "EUR"});
  assert.equal(calls[0].textQuery, "Chez Paul");
  assert.equal(calls[0].languageCode, "de");
  srv.close();
});

test("plafond du jour : au-delà, service coupé", async () => {
  const {srv, post, calls} = await start({googleKey: "k", googleDailyMax: 2});
  const r = await post({items: [item("a"), item("b"), item("c")]});
  assert.equal(Object.keys(r.prices).length, 2);
  assert.deepEqual(await post({items: [item("d")]}), {off: true, quota: true});
  assert.equal(calls.length, 2);
  srv.close();
});

// ---------- Prix de la communauté ----------
const { communityLevel } = require("../server/prices");

test("niveau de la communauté : médiane, seulement à partir de 3 réponses", () => {
  assert.equal(communityLevel([1, 2]), null);
  assert.deepEqual(communityLevel([1, 1, 3]), {lvl: 1, n: 3});
  assert.deepEqual(communityLevel([2, 3, 3, 1]), {lvl: 3, n: 4});        // médiane 2,5 → €€€
  assert.deepEqual(communityLevel([2, 2, 1, 1]), {lvl: 2, n: 4});        // médiane 1,5 → €€
  assert.equal(communityLevel([0, 4, 9, 1]), null);                      // réponses hors gamme ignorées
});

test("prix de la communauté : une réponse par personne, publiés à 3, effacés avec le compte", async () => {
  const store = openStore(":memory:");
  const srv = createServer(store, {rateLimit: false});
  await new Promise(ok => srv.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${srv.address().port}`;
  try{
    const who = [];
    for(let i = 0; i < 3; i++) who.push(await (await fetch(base + "/api/session", {method: "POST"})).json());
    const vote = (w, body) => fetch(base + "/api/price/vote", {method: "POST", headers: {Authorization: "Bearer " + w.token, "Content-Type": "application/json"}, body: JSON.stringify(body)});
    const community = ids => fetch(base + "/api/price/community?ids=" + ids).then(r => r.json());
    // sans compte : refusé ; valeurs bizarres : refusées
    assert.equal((await fetch(base + "/api/price/vote", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({place: "osm:n1", lvl: 1})})).status, 401);
    assert.equal((await vote(who[0], {place: "osm:n1", lvl: 7})).status, 400);
    assert.equal((await vote(who[0], {place: "<script>", lvl: 1})).status, 400);
    // la même personne qui répond deux fois ne compte qu'une fois (la dernière réponse)
    await vote(who[0], {place: "osm:n1", lvl: 3});
    await vote(who[0], {place: "osm:n1", lvl: 1});
    await vote(who[1], {place: "osm:n1", lvl: 1});
    assert.deepEqual((await community("osm:n1")).prices, {});          // 2 réponses : pas encore publié
    const r = await (await vote(who[2], {place: "osm:n1", lvl: 2})).json();
    assert.deepEqual(r.community, {lvl: 1, n: 3});
    assert.deepEqual((await community("osm:n1,osm:n2")).prices, {"osm:n1": {lvl: 1, n: 3}});
    // retirer sa réponse (lvl 0)
    await vote(who[2], {place: "osm:n1", lvl: 0});
    assert.deepEqual((await community("osm:n1")).prices, {});
    // suppression du compte : ses réponses partent avec
    await vote(who[2], {place: "osm:n1", lvl: 2});
    await store.deleteAccount(who[0].uid);
    assert.deepEqual(store.votesFor("osm:n1").sort(), [1, 2]);
  } finally { srv.close(); }
});
