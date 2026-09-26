// Pas l'temps — envoi des e-mails de connexion.
// Au choix : la boîte Gmail de l'appli via un petit script Google (scripts/gmail-envoi.gs, ~100 e-mails/jour),
// ou Brevo (300 e-mails/jour).
// Utilisé par le serveur Node et par le Worker Cloudflare (fetch est disponible partout).
"use strict";

// → fonction sendMail({to, subject, html, text}) ; lève une erreur si Brevo refuse
function brevoMailer(apiKey, from){
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from || "");
  const sender = m ? {name: m[1] || "Pas l'temps", email: m[2]} : {name: "Pas l'temps", email: from};
  return async function sendMail({to, subject, html, text}){
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {"api-key": apiKey, "Content-Type": "application/json", "Accept": "application/json"},
      body: JSON.stringify({sender, to: [{email: to}], subject, htmlContent: html, textContent: text})
    });
    if(!r.ok) throw new Error("brevo " + r.status + " " + (await r.text()).slice(0, 200));
  };
}

// Gmail via Google Apps Script : l'adresse du script déployé + la clé partagée
function webhookMailer(url, key){
  return async function sendMail({to, subject, html, text}){
    const r = await fetch(url, {method: "POST", redirect: "follow", headers: {"Content-Type": "text/plain;charset=utf-8"},
      body: JSON.stringify({key, to, subject, html, text})});
    let d = null; try{ d = JSON.parse(await r.text()); }catch(e){}
    if(!r.ok || !d || !d.ok) throw new Error("webhook " + r.status + " " + (d && d.error || ""));
  };
}
// Le service d'envoi configuré (null si aucun)
function mailerFrom(env){
  if(env.MAIL_WEBHOOK_URL && env.MAIL_WEBHOOK_KEY) return webhookMailer(env.MAIL_WEBHOOK_URL, env.MAIL_WEBHOOK_KEY);
  if(env.BREVO_API_KEY) return brevoMailer(env.BREVO_API_KEY, env.MAIL_FROM || "Pas l'temps <pasltempssav@gmail.com>");
  return null;
}

// Contenu de l'e-mail de connexion, dans la langue de l'appli (français par défaut)
const MAILS = {
  fr: {subject: "{code} est ton code Pas l'temps", intro: "Tape ce code dans l'appli Pas l'temps pour te connecter (valable 20 minutes) :",
       or: "Tu utilises Pas l'temps dans ton navigateur ? Tu peux aussi toucher le bouton.", btn: "Me connecter",
       ignore: "Tu n'as rien demandé ? Ignore simplement cet e-mail : il ne se passera rien."},
  en: {subject: "{code} is your Pas l'temps code", intro: "Type this code in the Pas l'temps app to sign in (valid 20 minutes):",
       or: "Using Pas l'temps in your browser? You can also just tap the button.", btn: "Sign in",
       ignore: "Didn't ask for this? Just ignore this email: nothing will happen."},
  es: {subject: "{code} es tu código de Pas l'temps", intro: "Escribe este código en la app Pas l'temps para iniciar sesión (válido 20 minutos):",
       or: "¿Usas Pas l'temps en el navegador? También puedes tocar el botón.", btn: "Iniciar sesión",
       ignore: "¿No lo has pedido tú? Ignora este correo: no pasará nada."},
  de: {subject: "{code} ist dein Pas l'temps-Code", intro: "Gib diesen Code in der Pas l'temps-App ein, um dich anzumelden (20 Minuten gültig):",
       or: "Nutzt du Pas l'temps im Browser? Du kannst auch einfach auf den Button tippen.", btn: "Anmelden",
       ignore: "Nicht angefordert? Ignoriere diese E-Mail einfach: Es passiert nichts."},
  it: {subject: "{code} è il tuo codice Pas l'temps", intro: "Scrivi questo codice nell'app Pas l'temps per accedere (valido 20 minuti):",
       or: "Usi Pas l'temps nel browser? Puoi anche toccare il pulsante.", btn: "Accedi",
       ignore: "Non l'hai chiesto tu? Ignora questa email: non succederà nulla."},
  pt: {subject: "{code} é o seu código Pas l'temps", intro: "Digite este código no app Pas l'temps para entrar (válido por 20 minutos):",
       or: "Está usando Pas l'temps no navegador? Você também pode tocar no botão.", btn: "Entrar",
       ignore: "Não pediu isso? Ignore este email: nada vai acontecer."},
  nl: {subject: "{code} is je Pas l'temps-code", intro: "Typ deze code in de Pas l'temps-app om in te loggen (20 minuten geldig):",
       or: "Gebruik je Pas l'temps in je browser? Je kunt ook gewoon op de knop tikken.", btn: "Inloggen",
       ignore: "Niet aangevraagd? Negeer deze e-mail gewoon: er gebeurt niets."}
};
function loginMail(link, lang, code){
  const M = MAILS[lang] || MAILS.fr;
  const subject = M.subject.replace("{code}", code), {intro, or, btn, ignore} = M;
  const esc = s => s.replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1C1512">
<p style="font-size:22px;font-weight:bold;margin:0 0 12px">Pas l'temps</p>
<p style="font-size:16px;line-height:1.5">${esc(intro)}</p>
<p style="font-size:34px;font-weight:bold;letter-spacing:8px;margin:16px 0 24px">${esc(code)}</p>
<p style="font-size:14px;color:#7A6E63">${esc(or)}</p>
<p style="margin:16px 0 24px"><a href="${esc(link)}" style="background:#E1140A;color:#fff;text-decoration:none;padding:14px 26px;border-radius:999px;font-weight:bold;font-size:16px">${esc(btn)}</a></p>
<p style="font-size:13px;color:#7A6E63">${esc(ignore)}</p></div>`;
  return {subject, html, text: `${intro}\n\n${code}\n\n${or}\n${link}\n\n${ignore}`};
}

module.exports = { brevoMailer, webhookMailer, mailerFrom, loginMail, MAILS };
