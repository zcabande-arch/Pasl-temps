// Connexion par e-mail : lien à usage unique, un compte par adresse, plusieurs appareils, suppression
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { createServer } = require("../server/server");
const { openStore } = require("../server/store");

const sent = [];
let srv, base;
test.before(async () => {
  srv = createServer(openStore(":memory:"), {rateLimit:false, sendMail: async m => { sent.push(m); }, appOrigins:["https://app.example"]});
  await new Promise(ok => srv.listen(0, "127.0.0.1", ok));
  base = `http://127.0.0.1:${srv.address().port}`;
});
test.after(() => srv.close());

const post = (url, body, token) => fetch(base + url, {method:"POST", headers:{"Content-Type":"application/json", ...(token ? {Authorization:"Bearer " + token} : {})}, body:JSON.stringify(body)});
const tokenOf = m => /#login=([A-Za-z0-9_-]+)/.exec(m.text)[1];
async function login(email, deviceToken){
  assert.equal((await post("/api/login/start", {email, back:"https://app.example/Pasl-temps/", lang:"fr"})).status, 200);
  return (await post("/api/login/verify", {token: tokenOf(sent[sent.length - 1])}, deviceToken)).json();
}

test("envoie un lien vers l'appli et refuse une autre adresse de retour", async () => {
  assert.equal((await post("/api/login/start", {email:"pas-une-adresse", back:"https://app.example/"})).status, 400);
  assert.equal((await post("/api/login/start", {email:"a@b.fr", back:"https://pirate.example/"})).status, 400);
  assert.equal((await post("/api/login/start", {email:"Zoe@Mail.FR ", back:"https://app.example/Pasl-temps/"})).status, 200);
  const m = sent[sent.length - 1];
  assert.equal(m.to, "zoe@mail.fr");
  assert.match(m.text, /^[\s\S]*https:\/\/app\.example\/Pasl-temps\/#login=/);
  assert.match(m.subject, /Pas l'temps/);
});

test("le lien ne sert qu'une fois ; le compte garde les données de l'appareil", async () => {
  const dev = await (await post("/api/session", {})).json();
  await fetch(base + "/api/doc?path=" + encodeURIComponent(`data/users/${dev.uid}/lists`), {method:"PUT", headers:{Authorization:"Bearer " + dev.token, "Content-Type":"application/json"}, body:JSON.stringify({fav:{x:1}})});
  await post("/api/login/start", {email:"lea@mail.fr", back:"https://app.example/"});
  const t = tokenOf(sent[sent.length - 1]);
  const a = await (await post("/api/login/verify", {token:t}, dev.token)).json();
  assert.equal(a.uid, dev.uid, "le compte de l'appareil devient celui de l'adresse");
  assert.equal(a.email, "lea@mail.fr");
  assert.equal((await post("/api/login/verify", {token:t})).status, 400, "lien déjà utilisé");
  // un autre appareil retrouve le même compte et ses données
  const b = await login("lea@mail.fr");
  assert.equal(b.uid, dev.uid);
  const lists = await (await fetch(base + "/api/doc?path=" + encodeURIComponent(`data/users/${b.uid}/lists`), {headers:{Authorization:"Bearer " + b.token}})).json();
  assert.deepEqual(lists.data, {fav:{x:1}});
  const acc = await (await fetch(base + "/api/account", {headers:{Authorization:"Bearer " + b.token}})).json();
  assert.equal(acc.email, "lea@mail.fr");
});

test("supprimer le compte efface ses données et ses sessions", async () => {
  const a = await login("max@mail.fr");
  const h = {Authorization:"Bearer " + a.token, "Content-Type":"application/json"};
  await fetch(base + "/api/doc?path=" + encodeURIComponent(`data/users/${a.uid}/me`), {method:"PUT", headers:h, body:JSON.stringify({name:"Max"})});
  assert.equal((await fetch(base + "/api/account", {method:"DELETE", headers:h})).status, 200);
  assert.equal((await fetch(base + "/api/account", {headers:h})).status, 401, "la session ne marche plus");
  const again = await login("max@mail.fr");
  assert.notEqual(again.uid, a.uid, "nouvelle connexion = compte neuf, vide");
  const me = await (await fetch(base + "/api/doc?path=" + encodeURIComponent(`data/users/${again.uid}/me`), {headers:{Authorization:"Bearer " + again.token}})).json();
  assert.equal(me.exists, false);
});

test("sans service d'e-mail, la connexion est indisponible", async () => {
  const s2 = createServer(openStore(":memory:"), {rateLimit:false, sendMail:null, appOrigins:["https://app.example"]});
  await new Promise(ok => s2.listen(0, "127.0.0.1", ok));
  try{
    const r = await fetch(`http://127.0.0.1:${s2.address().port}/api/login/start`, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email:"a@b.fr", back:"https://app.example/"})});
    assert.equal(r.status, 503);
  } finally { s2.close(); }
});

test("la connexion par e-mail marche aussi avec la base Cloudflare D1", async () => {
  const fs = require("node:fs"), path = require("node:path");
  const { DatabaseSync } = require("node:sqlite");
  const { d1Store } = require("../worker/store-d1");
  const db = new DatabaseSync(":memory:");
  db.exec(fs.readFileSync(path.join(__dirname, "..", "server", "schema.sql"), "utf8"));
  const d1 = {prepare(sql){ const st = db.prepare(sql); return {bind(...a){ return {
    run: async () => st.run(...a), first: async () => st.get(...a) ?? null, all: async () => ({results: st.all(...a)})}; }}; }};
  const mails = [];
  const s3 = createServer(d1Store(d1), {rateLimit:false, sendMail: async m => { mails.push(m); }, appOrigins:["https://app.example"]});
  await new Promise(ok => s3.listen(0, "127.0.0.1", ok));
  const b3 = `http://127.0.0.1:${s3.address().port}`;
  try{
    const p = (u, body) => fetch(b3 + u, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)});
    assert.equal((await p("/api/login/start", {email:"d1@mail.fr", back:"https://app.example/"})).status, 200);
    const r = await (await p("/api/login/verify", {token: tokenOf(mails[0])})).json();
    assert.equal(r.email, "d1@mail.fr");
    const acc = await (await fetch(b3 + "/api/account", {headers:{Authorization:"Bearer " + r.token}})).json();
    assert.equal(acc.email, "d1@mail.fr");
  } finally { s3.close(); }
});

test("envoi par Gmail : appelle le script Google avec la clé et suit sa redirection", async () => {
  const http = require("node:http");
  const { webhookMailer } = require("../server/mail");
  let got = null;
  const g = http.createServer((req, res) => {
    if(req.url === "/exec"){ let b = ""; req.on("data", c => b += c).on("end", () => { got = JSON.parse(b); res.writeHead(302, {Location: "/echo"}); res.end(); }); return; }
    res.writeHead(200, {"Content-Type": "application/json"}); res.end(JSON.stringify({ok: got && got.key === "k1"}));
  });
  await new Promise(ok => g.listen(0, "127.0.0.1", ok));
  try{
    const u = `http://127.0.0.1:${g.address().port}/exec`;
    await webhookMailer(u, "k1")({to:"a@b.fr", subject:"S", html:"<b>h</b>", text:"t"});
    assert.deepEqual(got, {key:"k1", to:"a@b.fr", subject:"S", html:"<b>h</b>", text:"t"});
    await assert.rejects(webhookMailer(u, "mauvaise")({to:"a@b.fr", subject:"S", html:"", text:""}));
  } finally { g.close(); }
});

test("code à 6 chiffres (appli installée) : bon code, mauvais code, 5 essais au plus", async () => {
  const codeOf = m => /\n(\d{6})\n/.exec(m.text)[1];
  await post("/api/login/start", {email:"ipad@mail.fr", back:"https://app.example/"});
  const m = sent[sent.length - 1], code = codeOf(m);
  assert.match(m.subject, new RegExp("^" + code));
  const wrong = code === "000000" ? "111111" : "000000";
  assert.equal((await post("/api/login/verify", {email:"ipad@mail.fr", code:wrong})).status, 400);
  const ok = await (await post("/api/login/verify", {email:" IPAD@mail.fr", code})).json();
  assert.equal(ok.email, "ipad@mail.fr");
  assert.ok(ok.token);
  assert.equal((await post("/api/login/verify", {email:"ipad@mail.fr", code})).status, 400, "code déjà utilisé");
  // 5 mauvais essais : même le bon code ne marche plus
  await post("/api/login/start", {email:"ipad@mail.fr", back:"https://app.example/"});
  const c2 = codeOf(sent[sent.length - 1]), bad = c2 === "123456" ? "654321" : "123456";
  for(let i = 0; i < 5; i++) await post("/api/login/verify", {email:"ipad@mail.fr", code:bad});
  const r = await post("/api/login/verify", {email:"ipad@mail.fr", code:c2});
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error, "expired");
});
