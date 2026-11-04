// Fissa Fissa — profil administrateur personnel.
// Pour entrer dans l'espace admin, il faut LES DEUX :
//  1. être connecté·e à l'appli avec l'adresse e-mail administrateur (ADMIN_EMAIL, connexion par lien ou code e-mail) ;
//  2. donner son code personnel, dont le serveur ne garde qu'une empreinte (ADMIN_CODE_HASH, secret Cloudflare).
// L'empreinte est un PBKDF2-SHA-256 salé : « pbkdf2$<itérations>$<sel>$<empreinte> » (base64url).
// Elle se fabrique sur son propre ordinateur avec : node scripts/admin-code.js
// (100 000 itérations : le maximum accepté par Cloudflare Workers.)
"use strict";
const ITER = 100000;
const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = s => Uint8Array.from(atob(String(s).replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

async function derive(code, salt, iter){
  const key = await crypto.subtle.importKey("raw", enc.encode(String(code).normalize("NFC")), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({name: "PBKDF2", hash: "SHA-256", salt, iterations: iter}, key, 256));
}
// → « pbkdf2$100000$sel$empreinte »
async function hashCode(code, {iter = ITER, salt} = {}){
  salt = salt || crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${iter}$${b64u(salt)}$${b64u(await derive(code, salt, iter))}`;
}
// Le code correspond-il à l'empreinte ? (comparaison en temps constant)
async function checkCode(code, stored){
  const m = /^pbkdf2\$(\d{1,7})\$([A-Za-z0-9_-]{8,})\$([A-Za-z0-9_-]{20,})$/.exec(String(stored || "").trim());
  if(!m || typeof code !== "string" || code.length < 1 || code.length > 200) return false;
  const iter = Math.min(+m[1], ITER), want = unb64u(m[3]), got = await derive(code, unb64u(m[2]), iter);
  if(got.length !== want.length) return false;
  let diff = 0; for(let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}

module.exports = { hashCode, checkCode, ITER };
