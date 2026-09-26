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

// Contenu de l'e-mail de connexion (français ou anglais)
function loginMail(link, lang, code){
  const en = lang === "en";
  const subject = en ? `${code} is your Pas l'temps code` : `${code} est ton code Pas l'temps`;
  const intro = en ? "Type this code in the Pas l'temps app to sign in (valid 20 minutes):"
    : "Tape ce code dans l'appli Pas l'temps pour te connecter (valable 20 minutes) :";
  const or = en ? "Using Pas l'temps in your browser? You can also just tap the button."
    : "Tu utilises Pas l'temps dans ton navigateur ? Tu peux aussi toucher le bouton.";
  const btn = en ? "Sign in" : "Me connecter";
  const ignore = en ? "Didn't ask for this? Just ignore this email: nothing will happen."
    : "Tu n'as rien demandé ? Ignore simplement cet e-mail : il ne se passera rien.";
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

module.exports = { brevoMailer, webhookMailer, mailerFrom, loginMail };
