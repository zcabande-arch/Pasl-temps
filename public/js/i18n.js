// Pas l'temps — langues. Le français est la langue de référence : chaque texte de l'appli est écrit en français
// et traduit à l'affichage avec tx("texte", {variables}). Réglage « Langue » : auto (langue de l'appareil), fr ou en.
// Les textes fixes de la page (index.html) sont traduits au chargement par translateDom().
(function(){
  let pref = "auto";
  try{ pref = JSON.parse(localStorage.getItem("pasltemps.settings") || "{}").lang || "auto"; }catch(e){}
  const device = /^fr\b/i.test((navigator.languages && navigator.languages[0]) || navigator.language || "fr") ? "fr" : "en";
  const lang = pref === "fr" || pref === "en" ? pref : device;

  const EN = {
    // --- Page ---
    "Bonjour,": "Hi,", "t'as pas l'temps": "got no time", "Réglages": "Settings",
    "📴 Hors connexion : vos lieux et votre historique restent accessibles.": "📴 Offline: your places and history are still here.",
    "✦ Ta pause, tout près": "✦ Your break, close by", "J'ai": "I've got", "On fait quoi ?": "What shall we do?",
    "Temps disponible": "Time available", "Moyen de transport": "Getting there", "Envie de…": "In the mood for…", "Envie": "Mood",
    "📍 Où es-tu ?": "📍 Where are you?", "Adresse, code postal ou ville": "Address, postcode or town", "Chercher": "Search",
    "🎲 Choisis pour moi": "🎲 Pick for me", "Mes lieux": "My places", "⭐ Favoris": "⭐ Favourites", "📌 À tester": "📌 To try",
    "Déjà fait": "Done already", "Chargement…": "Loading…",
    "Changer la photo": "Change photo", "✦ Ton profil": "✦ Your profile", "Bonjour": "Hi", "Tout reste sur ton appareil.": "Everything stays on your device.",
    "Toi": "You", "Prénom": "First name", "Ton prénom": "Your first name", "Âge": "Age", "Ton âge": "Your age", "Genre": "Gender",
    "Femme": "Woman", "Homme": "Man", "Non binaire": "Non-binary", "Tes endroits préférés": "Places you love",
    "Ils passent en premier dans les résultats et « Choisis pour moi » les favorise.": "They come first in results and “Pick for me” favours them.",
    "Endroits préférés": "Places you love", "Code de récupération": "Recovery code",
    "Tes données et ta vie privée": "Your data and privacy", "Mentions légales": "Legal notice",
    "Explorer": "Explore", "Avis": "Reviews", "Profil": "Profile",
    "Couleurs": "Colours", "Apparence": "Appearance", "☀️ Clair": "☀️ Light", "🌙 Sombre": "🌙 Dark", "Format d'affichage": "Display size",
    "Tablette": "Tablet", "Ordi": "Computer", "Activées": "On", "Désactivées": "Off", "Installer l'appli": "Install the app",
    "Langue": "Language", "Pas l'temps · Données des lieux ©": "Pas l'temps · Place data ©", "les contributeurs d'OpenStreetMap": "OpenStreetMap contributors",
    "Mentions légales · Confidentialité · Conditions": "Legal · Privacy · Terms", "Terminé": "Done",
    // --- Envies, rubriques, recherches ---
    "Manger": "Eat", "Prendre l'air": "Get some air", "Galerie marchande": "Shopping", "Culture": "Culture",
    "Se poser au calme": "Chill out", "Au calme": "Chill out", "Bouger": "Move",
    "Boulangeries, cafés, snacks": "Bakeries, cafés, snacks", "Parcs, jardins, points de vue": "Parks, gardens, viewpoints",
    "Galeries, marchés, cadeaux": "Malls, markets, gifts", "Musées, librairies, monuments": "Museums, bookshops, monuments",
    "Salons de thé, parcs": "Tea rooms, parks", "Parcs, salles de sport": "Parks, gyms",
    "Boulangeries": "Bakeries", "Cafés, salons de thé": "Cafés & tea rooms", "Sur le pouce": "Quick bites", "Glaciers": "Ice cream",
    "Restaurants": "Restaurants", "Parcs, jardins": "Parks & gardens", "Espaces verts, points de vue": "Green spaces & viewpoints",
    "Centres commerciaux, grands magasins": "Malls & department stores", "Marchés": "Markets", "Cadeaux, souvenirs": "Gifts & souvenirs",
    "Librairies": "Bookshops", "Monuments, curiosités": "Monuments & sights", "Bibliothèques": "Libraries", "Musées": "Museums",
    "Galeries d'art": "Art galleries", "Salons de thé, cafés": "Tea rooms & cafés", "Parcs": "Parks",
    "Parcs pour marcher ou courir": "Parks for walking or running", "Salles de sport": "Gyms",
    "Nature, points de vue": "Nature & viewpoints", "Shopping": "Shopping", "Monuments": "Monuments", "Sport": "Sport",
    "boulangerie": "bakery", "café": "café", "snack": "snack", "glacier": "ice cream", "restaurant": "restaurant", "parc": "park",
    "espace vert": "green space", "centre commercial": "shopping centre", "marché": "market", "boutique cadeaux": "gift shop",
    "librairie": "bookshop", "monument": "monument", "bibliothèque": "library", "musée": "museum", "galerie d'art": "art gallery",
    "salon de thé": "tea room", "salle de sport": "gym", " à proximité": " nearby",
    // --- Transport, distances ---
    "À pied": "Walk", "Vélo": "Bike", "Voiture": "Car", "à pied": "on foot", "à vélo": "by bike", "en voiture": "by car",
    "de marche": "walking", "de vélo": "cycling", "de route": "driving",
    "Tout près": "Very close", "Proche": "Close", "Un peu loin": "A bit far", "Juste à temps": "Just in time",
    // --- Résultats ---
    " minutes": " minutes", " heure": " hour", " heures": " hours",
    "Localisation en cours…": "Finding your location…",
    "Tape une adresse ou une ville ci-dessus pour voir les lieux autour.": "Type an address or town above to see what's around.",
    "Lieux où aller, en profiter et revenir {way} tient dans tes {d}.": "Places you can get to, enjoy and come back from {way}, all within {d}.",
    "Il te faut au moins {t} : {s} sur place, plus le trajet.": "You need at least {t}: {s} there, plus the trip.",
    "Passer à {t}": "Switch to {t}",
    "{d}, c'est court pour ça. Choisis un peu plus de temps.": "{d} is a bit short for that. Pick a little more time.",
    "Ouverts seulement": "Open only", "à ton arrivée": "when you arrive", "Dans tes préférences": "In the places you love",
    "Chercher « {q} » sur la carte": "Search “{q}” on the map",
    "Le service de carte est chargé, je réessaie…": "The map service is busy, trying again…", "Recherche…": "Searching…",
    "Réessayer": "Try again", "Tout est fermé à cette heure-ci.": "Everything's closed at this time.",
    "Rien d'assez proche pour {d}.": "Nothing close enough for {d}.", "Voir moins": "Show less",
    "Voir plus ({n}), jusqu'à {m} min {way}": "Show more ({n}), up to {m} min {way}",
    "{d} {way}, retour compris": "{d} {way}, return trip included", "Je cherche autour de toi…": "Looking around you…",
    "{n} lieux à portée": "{n} places in reach", "{n} lieu à portée": "{n} place in reach", "Rien à portée": "Nothing in reach",
    " : essaie ": ": try ", " ou ": " or ", "plus de temps": "more time", "le vélo": "the bike", "la voiture": "the car",
    "Pas de connexion internet.": "No internet connection.",
    "Trop de recherches d'un coup, réessaie dans une minute.": "Too many searches at once, try again in a minute.",
    "Le service de carte (OpenStreetMap, gratuit) est surchargé en ce moment. Réessaie dans une minute.": "The map service (OpenStreetMap, free) is overloaded right now. Try again in a minute.",
    "La recherche n'a pas été comprise par le service de carte.": "The map service didn't understand the search.",
    "Recherche impossible pour l'instant.": "Search isn't possible right now.",
    "fait {n}×": "done {n}×", "{d} au total": "{d} in total", "{w} min aller · {s} sur place · {w} min retour": "{w} min there · {s} on site · {w} min back",
    "⚡ le plus proche": "⚡ closest",
    "{e} Aller {w} min · ⏱️ Sur place {s} minimum · {e} Retour {w} min =": "{e} There {w} min · ⏱️ On site {s} minimum · {e} Back {w} min =",
    "il te restera {d}": "you'll have {d} left", "♿ accessible": "♿ wheelchair accessible", "Je pars": "Let's go", "À tester": "To try", "Site web": "Website",
    // --- Lieu ---
    "Localisation…": "Locating…", "Position GPS indisponible ici : tape une adresse ou une ville.": "GPS unavailable here: type an address or town.",
    "ma position": "my location", "Autour de": "Around", "🛰️ Ma position": "🛰️ My location", "Je cherche…": "Searching…",
    "Code postal {q} introuvable. Vérifie les 5 chiffres, ou ajoute la ville.": "Postcode {q} not found. Check the 5 digits, or add the town.",
    "Adresse introuvable. Essaie avec la ville, par exemple « rue X, Lyon » ou un code postal.": "Address not found. Try adding the town, e.g. “rue X, Lyon”, or a postcode.",
    "Lequel ?": "Which one?",
    "La recherche d'adresse ne répond pas pour l'instant. Réessaie dans une minute, ou touche « Ma position ».": "Address search isn't responding right now. Try again in a minute, or tap “My location”.",
    // --- Réglages ---
    "Crème": "Cream", "Lavande": "Lavender", "Menthe": "Mint", "Pêche": "Peach", "Océan": "Ocean", "Bonbon": "Candy", "Soleil": "Sunshine",
    "Mobile": "Mobile", "Ordi (grand écran)": "Computer (large screen)",
    "Choisi selon la taille de l'écran : {l} en ce moment.": "Chosen from the screen size: {l} right now.",
    "Cet écran est trop petit : l'affichage reste en format mobile.": "This screen is too small: the display stays in mobile size.",
    "C'est installé ✓ Pas l'temps s'ouvre depuis votre écran d'accueil.": "Installed ✓ Pas l'temps opens from your home screen.",
    "Ajoutez Pas l'temps à votre écran d'accueil : elle s'ouvre en plein écran, comme une vraie appli.": "Add Pas l'temps to your home screen: it opens full screen, like a real app.",
    "📲 Installer": "📲 Install",
    "<li>Touchez le bouton <b>Partager</b> de Safari</li><li>Puis <b>Sur l'écran d'accueil</b></li>": "<li>Tap Safari's <b>Share</b> button</li><li>Then <b>Add to Home Screen</b></li>",
    "<li>Ouvrez le menu du navigateur (⋮)</li><li>Puis <b>Installer l'application</b> ou <b>Ajouter à l'écran d'accueil</b></li>": "<li>Open the browser menu (⋮)</li><li>Then <b>Install app</b> or <b>Add to Home screen</b></li>",
    // --- Mes lieux, radar, chrono ---
    "Touche ⭐ sur un lieu pour le garder ici.": "Tap ⭐ on a place to keep it here.",
    "Touche 📌 sur un lieu repéré pour le tester plus tard.": "Tap 📌 on a place you spotted to try it later.",
    "Retirer": "Remove", "loin d'ici": "far from here", "{w} min aller · {d} au total": "{w} min there · {d} in total",
    "+ de {m} min": "over {m} min", "Autour de toi": "Around you", "touche un point": "tap a dot",
    "Plan des lieux autour de toi, en couleur selon la distance": "Map of places around you, coloured by distance",
    "Temps de trajet aller {way}. Le retour est compté aussi.": "One-way travel time {way}. The trip back is counted too.",
    "En route": "On the way", "Arrivée dans ~{m} min": "Arriving in ~{m} min", "⏱️ Sur place": "⏱️ There",
    "Repars dans {m} min": "Head back in {m} min", "🏃 C'est l'heure de repartir !": "🏃 Time to head back!",
    "{m} min {of} pour rentrer": "{m} min {of} to get back", "⏰ Temps écoulé": "⏰ Time's up", "Tu dépasses de {m} min": "You're {m} min over",
    "✓ Je suis rentré·e": "✓ I'm back", "Arrêter": "Stop",
    // --- Choisis pour moi ---
    "ce matin": "this morning", "à cette heure-ci": "right now", "cet après-midi": "this afternoon", "ce soir": "this evening",
    "tu l'avais noté à tester, c'est le moment": "you saved it to try, now's the time", "une valeur sûre": "a safe bet",
    "parfait {m}": "perfect {m}", "tu n'y es encore jamais allé·e": "you've never been", "ça change un peu": "something a bit different",
    " : ": ": ", "{d} en tout ({w} min {way} à l'aller et au retour)": "{d} in total ({w} min {way} each way)",
    // --- Historique ---
    "Aujourd'hui": "Today", "Hier": "Yesterday", "{n} pauses faites": "{n} breaks done", "{n} pause faite": "{n} break done",
    "Rien pour l'instant. Quand tu touches « Je pars », le lieu s'ajoute ici et tu pourras le marquer comme fait.": "Nothing yet. When you tap “Let's go”, the place is added here and you can mark it as done.",
    "près d'ici": "nearby", "à {k} km d'ici": "{k} km away", "ailleurs": "elsewhere",
    "Un souvenir, une note… (facultatif)": "A memory, a note… (optional)", "Fait ✓": "Done ✓", "Marquer comme fait": "Mark as done",
    "Raconter": "Share", "Supprimer": "Delete", "Voir tout ({n})": "See all ({n})",
    // --- Profil ---
    "Enregistré ✓": "Saved ✓", "Ta photo de profil": "Your profile photo",
    "Cette image ne peut pas être lue. Essaie une autre photo.": "This image can't be read. Try another photo.",
    "Colle ici ton code (ou le lien) de récupération :": "Paste your recovery code (or link) here:",
    "Récupérer": "Restore", "Annuler": "Cancel",
    "C'est récupéré ✓ {n} sorties ajoutées à ton historique.": "Restored ✓ {n} outings added to your history.",
    "C'est récupéré ✓ {n} sortie ajoutée à ton historique.": "Restored ✓ {n} outing added to your history.",
    "Ce code n'est pas reconnu. Vérifie qu'il est complet.": "This code isn't recognised. Check it's complete.",
    "Ton code contient ton profil, tes réglages, tes favoris et ton historique. Garde-le (ou envoie-le toi) pour tout retrouver sur un autre appareil. Ta photo n'y est pas.": "Your code holds your profile, settings, favourites and history. Keep it (or send it to yourself) to get everything back on another device. Your photo isn't included.",
    "Création…": "Creating…", "Envoyer le lien": "Send the link", "Copier le code": "Copy the code", "J'ai un code": "I have a code",
    "Code copié ✓ Garde-le dans tes notes.": "Code copied ✓ Keep it in your notes.",
    "Le code est sélectionné : copie-le à la main.": "The code is selected: copy it by hand.",
    "Pas l'temps : mon code de récupération": "Pas l'temps: my recovery code",
    "Ouvre ce lien pour retrouver mon profil Pas l'temps :": "Open this link to restore my Pas l'temps profile:",
    "Lien copié ✓ Envoie-le toi par message ou par mail.": "Link copied ✓ Send it to yourself by message or email.",
    "Le lien est sélectionné : copie-le à la main.": "The link is selected: copy it by hand.",
    "Récupérer le profil, les favoris et l'historique contenus dans ce lien ?": "Restore the profile, favourites and history in this link?",
    "Ce lien de récupération n'est pas reconnu.": "This recovery link isn't recognised.",
    "On n'a pas l'temps ?": "No time?", "On n'a pas l'temps <em></em> ?": "No time, <em></em>?",
    // --- Horaires ---
    "Ouvert 24h/24": "Open 24/7", "Ferme à {h}, juste après ton arrivée": "Closes at {h}, just after you arrive",
    "Ferme dans {m} min": "Closes in {m} min", "Ouvert · jusqu'à {h}": "Open · until {h}", "Fermé": "Closed",
    "à {h}": "at {h}", "demain à {h}": "tomorrow at {h}", "{d} à {h}": "{d} at {h}",
    "Fermé à ton arrivée · rouvre {w}": "Closed when you arrive · reopens {w}", "Fermé · ouvre {w}": "Closed · opens {w}"
  };

  function tx(s, v){
    let r = lang === "en" && Object.prototype.hasOwnProperty.call(EN, s) ? EN[s] : s;
    if(v) r = r.replace(/\{(\w+)\}/g, (m, k) => k in v ? v[k] : m);
    return r;
  }
  // Textes fixes de la page : nœuds de texte et attributs (placeholder, aria-label, title)
  function translateDom(root){
    if(lang === "fr" || !root) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {acceptNode: n =>
      n.parentNode && /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT});
    const nodes = []; while(w.nextNode()) nodes.push(w.currentNode);
    nodes.forEach(n => {
      const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(n.nodeValue);
      if(m[2] && Object.prototype.hasOwnProperty.call(EN, m[2])) n.nodeValue = m[1] + EN[m[2]] + m[3];
    });
    root.querySelectorAll("[placeholder],[aria-label],[title]").forEach(el => ["placeholder", "aria-label", "title"].forEach(a => {
      const v = el.getAttribute(a); if(v && Object.prototype.hasOwnProperty.call(EN, v)) el.setAttribute(a, EN[v]);
    }));
  }
  document.documentElement.lang = lang;
  window.I18N = {lang, pref, tx, translateDom};
  window.tx = tx;
  translateDom(document.body);
})();
