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
