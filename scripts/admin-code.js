#!/usr/bin/env node
// Fabrique l'empreinte de ton code administrateur personnel, sur TON ordinateur.
// Usage : node scripts/admin-code.js
// Le code est tapé sans s'afficher et n'est écrit nulle part ; seule l'empreinte s'affiche,
// à coller dans le secret GitHub ADMIN_CODE_HASH (voir README, « Espace admin »).
"use strict";
const { hashCode, checkCode } = require("../server/admin");

function ask(question){
  return new Promise(ok => {
    const stdin = process.stdin;
    process.stdout.write(question);
    if(!stdin.isTTY){ let s = ""; stdin.on("data", d => s += d).on("end", () => ok(s.split("\n")[0])); return; }
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding("utf8");
    let s = "", done = false;
    // les touches peuvent arriver une par une ou en paquet (copier-coller, terminal intégré) : on lit caractère par caractère
    const on = chunk => {
      for(const c of String(chunk)){
        if(done) return;
        if(c === "\r" || c === "\n"){ done = true; stdin.setRawMode(false); stdin.pause(); stdin.off("data", on); process.stdout.write("\n"); ok(s); }
        else if(c === "\u0003"){ process.stdout.write("\n"); process.exit(1); }
        else if(c === "\u007f" || c === "\b"){ if(s){ s = s.slice(0, -1); process.stdout.write("\b \b"); } }
        else if(c >= " "){ s += c; process.stdout.write("•"); }     // un point par caractère : on voit qu'on tape
      }
    };
    stdin.on("data", on);
  });
}

(async () => {
  const a = await ask("Ton code administrateur (12 caractères au moins) : ");
  if(a.length < 12){ console.error("Trop court : choisis au moins 12 caractères (une phrase de passe, c'est très bien)."); process.exit(1); }
  if(process.stdin.isTTY){
    const b = await ask("Encore une fois : ");
    if(a !== b){ console.error("Les deux codes ne sont pas identiques."); process.exit(1); }
  }
  const h = await hashCode(a);
  if(!(await checkCode(a, h))){ console.error("Vérification impossible."); process.exit(1); }
  console.log("\nEmpreinte à coller dans le secret GitHub ADMIN_CODE_HASH :\n\n" + h + "\n");
})();
