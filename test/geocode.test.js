// Recherche d'adresse : Base Adresse Nationale d'abord, Nominatim en secours (réponses simulées)
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

function load(routes){
  const calls = [];
  const fetch = async url => {
    calls.push(url);
    const r = routes.find(([re]) => re.test(url));
    const body = r ? r[1] : null;
    return {ok: !!body, status: body ? 200 : 503, json: async () => body};
  };
  const ctx = {window: {}, fetch, AbortController, setTimeout, clearTimeout, navigator: {onLine: true}, localStorage: {getItem(){ return null; }, setItem(){}}, console, URL};
  vm.runInNewContext(fs.readFileSync(__dirname + "/../public/js/places.js", "utf8"), ctx);
  return {P: ctx.window.PLACES, calls};
}
const feat = (type, name, extra) => ({geometry: {coordinates: [2.35, 48.85]}, properties: {type, name, score: 0.9, postcode: "75004", city: "Paris", ...extra}});

test("une adresse française passe par la BAN, sans Nominatim", async () => {
  const {P, calls} = load([[/geocodage|api-adresse/, {features: [feat("housenumber", "12 Rue de Rivoli")]}]]);
  const r = await P.geocode("12 rue de Rivoli Paris");
  assert.equal(r[0].label, "12 Rue de Rivoli, 75004 Paris");
  assert.ok(!calls.some(u => u.includes("nominatim")));
});

test("une ville : la commune de la BAN", async () => {
  const {P} = load([[/geocodage/, {features: [feat("municipality", "Lyon", {postcode: "69001"})]}]]);
  assert.equal((await P.geocode("Lyon"))[0].label, "Lyon (69001)");
});

test("« Bruxelles » ne devient pas « Rue de Bruxelles » : Nominatim prend le relais", async () => {
  const {P, calls} = load([
    [/geocodage/, {features: [feat("street", "Rue de Bruxelles", {city: "Lille"})]}],
    [/nominatim/, [{lat: "50.85", lon: "4.35", address: {city: "Bruxelles"}, display_name: "Bruxelles"}]]]);
  const r = await P.geocode("Bruxelles");
  assert.equal(r[0].label, "Bruxelles");
  assert.ok(calls.some(u => u.includes("nominatim")));
});

test("BAN en panne : on essaie la deuxième adresse de la BAN", async () => {
  const {P} = load([[/api-adresse/, {features: [feat("municipality", "Nantes", {postcode: "44000"})]}]]);
  assert.equal((await P.geocode("Nantes"))[0].label, "Nantes (44000)");
});

test("code postal présent dans plusieurs pays : celui d'où l'on est", async () => {
  const shard = {"75004": [[48.86, 2.35, "Paris", 40, "fr"], [48.9, 8.7, "Pforzheim", 12, "de"]]};
  const route = [[/index\.json/, {cell:0.05, bbox:[40,-10,60,30], pcShards:true, sels:[]}], [/pc\/75\.json/, shard]];
  const near = async pos => { const {P} = load(route); return P.geocode("75004", pos); };
  const paris = await near({lat:48.85, lng:2.34});
  assert.deepEqual(paris.map(x => x.label), ["75004 Paris"]);
  const de = await near({lat:48.8, lng:8.6});
  assert.deepEqual(de.map(x => x.label), ["75004 Pforzheim (DE)"]);
});

test("hors de France : le pays est indiqué, et Photon prend le relais si Nominatim ne répond pas", async () => {
  const {P} = load([[/photon/, {features:[{geometry:{coordinates:[13.4, 52.52]}, properties:{name:"Berlin", countrycode:"DE"}}]}]]);
  const r = await P.geocode("Berlin");
  assert.equal(r[0].label, "Berlin, DE");
});
