// Pas l'temps — envoi des e-mails de connexion depuis la boîte Gmail de l'appli (Google Apps Script, gratuit).
// À coller sur https://script.google.com (connecté·e avec pasltempssav@gmail.com), puis :
// Déployer → Nouveau déploiement → Application Web → Exécuter en tant que : moi · Accès : Tout le monde.
// L'adresse du déploiement va dans le secret GitHub MAIL_WEBHOOK_URL, et CLE dans MAIL_WEBHOOK_KEY.
// Limite Google : environ 100 e-mails par jour.
const CLE = "REMPLACER_PAR_LA_CLE";

function doPost(e){
  let d = {};
  try{ d = JSON.parse(e.postData.contents); }catch(err){ return reponse({ok:false, error:"bad_body"}); }
  if(d.key !== CLE) return reponse({ok:false, error:"forbidden"});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.to || "")) return reponse({ok:false, error:"bad_to"});
  MailApp.sendEmail({to: d.to, subject: String(d.subject || "").slice(0, 200), htmlBody: d.html || "", body: d.text || "", name: "Pas l'temps"});
  return reponse({ok:true});
}
function reponse(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
