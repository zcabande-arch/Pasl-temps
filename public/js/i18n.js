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
    // --- Filtres, partage, retour à heure fixe, météo, premier lancement ---
    "{s} sur place": "{s} on site", "🌙 ouvert tard": "🌙 open late", "Envoyer à un pote": "Send to a friend",
    "On va là ? {n} ({a}), à {w} min {way}.": "Shall we go? {n} ({a}), {w} min {way}.", "voir la carte": "see map",
    "Lien copié ✓": "Link copied ✓", "Copie ce message :": "Copy this message:",
    "Ouverts à ton arrivée": "Open when you arrive", "♿ Accessible": "♿ Accessible",
    "Rien ne correspond à tes filtres ici.": "Nothing here matches your filters.", "Chercher un lieu par son nom": "Search a place by name",
    "pizza": "pizza", "burgers": "burgers", "kebab": "kebab", "sushis": "sushi", "crêpes": "crêpes", "sandwichs": "sandwiches",
    "français": "French", "italien": "Italian", "japonais": "Japanese", "chinois": "Chinese", "indien": "Indian", "thaï": "Thai",
    "vietnamien": "Vietnamese", "libanais": "Lebanese", "mexicain": "Mexican", "végétarien": "vegetarian", "salades": "salads",
    "thé": "tea", "glaces": "ice cream", "nouilles": "noodles", "asiatique": "Asian", "régional": "regional", "fruits de mer": "seafood",
    "grec": "Greek", "turc": "Turkish", "coréen": "Korean", "espagnol": "Spanish", "marocain": "Moroccan", "africain": "African",
    "petit-déj": "breakfast",
    "⏰ Je dois être rentré·e à": "⏰ I need to be back by", "Revenir au choix en minutes": "Back to choosing minutes",
    "✦ Retour à {h}": "✦ Back by {h}", "Cette heure est déjà passée.": "That time has already passed.",
    "Moins de 10 min : là, t'as vraiment pas l'temps !": "Under 10 min: you really have no time!",
    "Je cherche pour 4 h au maximum.": "I search for 4 hours at most.", "C'est l'heure de rentrer !": "Time to head back!",
    "🌧️ Il pleut ({t}°) : pense à « Culture » ou « Au calme »": "🌧️ It's raining ({t}°): try “Culture” or “Chill out”",
    "🌧️ Il pleut ({t}°) : les lieux couverts d'abord": "🌧️ It's raining ({t}°): indoor places first",
    "☀️ {t}°, beau temps : profite du dehors": "☀️ {t}°, lovely weather: enjoy the outdoors",
    "à l'abri de la pluie": "out of the rain", "parfait avec ce soleil": "perfect in this sunshine",
    "Un peu de temps devant toi ?": "Got a bit of time?",
    "Dis combien : 10 minutes, 2 heures, ou l'heure à laquelle tu dois être rentré·e.": "Say how much: 10 minutes, 2 hours, or the time you need to be back.",
    "On trouve ce qui tient dedans": "We find what fits",
    "Boulangerie, parc, musée… autour de toi, avec l'aller, le temps sur place et le retour.": "Bakery, park, museum… around you, counting the trip there, the time on site and the trip back.",
    "Tu pars, on chronomètre": "You go, we keep time",
    "Touche « Je pars » : l'appli te prévient quand il faut repartir pour être à l'heure.": "Tap “Let's go”: the app tells you when to head back to be on time.",
    "Et toi, c'est quoi ton prénom ?": "And what's your first name?",
    "Il reste sur ton appareil. Tu peux aussi le laisser vide.": "It stays on your device. You can also leave it empty.",
    "Passer": "Skip", "C'est parti": "Let's go", "Suivant": "Next",
    "Boire un verre": "Grab a drink", "Bars, pubs, cafés": "Bars, pubs, cafés", "Bars": "Bars", "Pubs, brasseries": "Pubs & beer gardens",
    "Cafés": "Cafés", "Bars, pubs": "Bars & pubs", "bar": "bar", "pub": "pub",
    "L'abus d'alcool est dangereux pour la santé. À consommer avec modération.": "Excessive drinking is dangerous for your health. Drink responsibly.",
    "Faire les courses": "Groceries", "Courses": "Groceries", "Supermarchés, épiceries, primeurs": "Supermarkets, corner shops, greengrocers",
    "Supermarchés": "Supermarkets", "Supérettes, épiceries": "Corner shops & grocers", "Primeurs, bio": "Greengrocers & organic",
    "Boucheries, fromageries, poissonneries": "Butchers, cheese & fish shops", "Cavistes": "Wine shops",
    "supermarché": "supermarket", "supérette": "convenience store", "primeur": "greengrocer", "boucherie": "butcher", "caviste": "wine shop",
    "🚫 Signaler": "🚫 Report", "Signalé fermé par toi": "Reported closed by you", "Signaler un problème": "Report a problem",
    "🚫 Fermé définitivement": "🚫 Permanently closed", "🕐 Fermé alors qu'il est indiqué ouvert": "🕐 Closed although shown as open",
    "📍 Pas à cet endroit, ou n'existe pas": "📍 Not here, or doesn't exist", "Merci !": "Thank you!",
    "Noté : pour toi, ce lieu est affiché fermé pendant 30 jours.": "Noted: this place will show as closed for you for 30 days.",
    "Noté : ce lieu n'apparaît plus dans tes résultats.": "Noted: this place no longer appears in your results.",
    "Pour corriger pour tout le monde :": "To fix it for everyone:", "Prévenir l'équipe": "Tell the team", "Corriger sur OpenStreetMap": "Fix it on OpenStreetMap",
    "Une correction sur OpenStreetMap arrive dans l'appli au plus tard le lundi suivant.": "A fix on OpenStreetMap reaches the app by the following Monday at the latest.",
    "Annuler mon signalement": "Undo my report", "Lieu à corriger : {n}": "Place to fix: {n}", "Lieu": "Place", "Adresse": "Address", "Problème": "Problem",
    "Lieux que tu as signalés": "Places you reported", "Réafficher": "Show again",
    "Aucun. Dans la fiche d'un lieu, « 🚫 Signaler » le retire de tes résultats s'il est fermé.": "None. In a place's details, “🚫 Report” removes it from your results if it's closed.",
    "Nous contacter": "Contact us", "Un bug": "A bug", "Une idée": "An idea", "Un lieu à corriger": "A place to fix", "Je suis commerçant·e": "I run a shop", "Mes données": "My data",
    "Une question, un bug, une idée ? Écris-nous sur la page du projet.": "A question, a bug, an idea? Write to us on the project page.",
    "Nous écrire": "Write to us", "Une question, un bug, une idée ? On lit tous les messages.": "A question, a bug, an idea? We read every message.",
    "Copier": "Copy", "Copié ✓": "Copied ✓",
    "Favori": "Favourite",
    "Sauvegardé sur ton compte, sur tous tes appareils.": "Saved to your account, on all your devices.", "Ton compte": "Your account", "Connecté·e avec": "Signed in as", "Me déconnecter": "Sign out", "Supprimer mon compte": "Delete my account",
    "Ton profil, tes favoris et ton historique sont sauvegardés : connecte-toi avec la même adresse sur un autre appareil pour tout retrouver.": "Your profile, favourites and history are saved: sign in with the same address on another device to get everything back.",
    "Te déconnecter sur cet appareil ? Ce qui est sur le téléphone reste là.": "Sign out on this device? What's on the phone stays there.",
    "Supprimer ton compte et tout ce qui est sauvegardé en ligne ? C'est définitif. Ce qui est sur ce téléphone reste là.": "Delete your account and everything saved online? This is permanent. What's on this phone stays there.",
    "Suppression impossible pour l'instant. Réessaie dans une minute.": "Can't delete right now. Try again in a minute.",
    "C'est envoyé à": "Sent to", "Ouvre l'e-mail sur cet appareil et touche « Me connecter ». Pas reçu ? Regarde dans les spams.": "Open the email on this device and tap “Sign in”. Nothing? Check your spam folder.",
    "Changer d'adresse ou renvoyer": "Change address or resend",
    "Retrouve ton profil, tes favoris et ton historique sur tous tes appareils. Pas de mot de passe : on t'envoie un lien par e-mail.": "Get your profile, favourites and history on all your devices. No password: we email you a link.",
    "ton@adresse.fr": "you@example.com", "Recevoir le lien": "Get the link", "J'ai un ancien code de récupération": "I have an old recovery code", "Envoi…": "Sending…",
    "Cette adresse n'a pas l'air valide.": "This address doesn't look valid.", "Trop de demandes : réessaie dans un moment.": "Too many requests: try again later.",
    "La connexion par e-mail n'est pas encore active.": "Email sign-in isn't active yet.", "L'e-mail n'a pas pu partir. Réessaie dans une minute.": "The email couldn't be sent. Try again in a minute.",
    "Ce lien a expiré ou a déjà servi. Demande un nouveau lien ci-dessous.": "This link has expired or was already used. Ask for a new one below.",
    "Connexion impossible pour l'instant. Réessaie dans une minute.": "Can't sign in right now. Try again in a minute.",
    "Tape ici le code à 6 chiffres reçu par e-mail. Pas reçu ? Regarde dans les spams.": "Type the 6-digit code from the email here. Nothing? Check your spam folder.",
    "Valider": "Confirm", "Vérification…": "Checking…", "Code incorrect. Vérifie les 6 chiffres.": "Wrong code. Check the 6 digits.",
    "Code expiré ou trop d'essais : redemande un code.": "Code expired or too many tries: ask for a new one.",
    "Préparation de ton profil…": "Setting up your profile…", "Ton prénom pour le blog": "Your first name for the blog",
    "C'est celui de ton profil : tes potes le verront. Tu pourras ajouter une photo dans Profil.": "It's the one from your profile: your friends will see it. You can add a photo in Profile.",
    "Modifier dans Profil": "Edit in Profile",
    "Rappels": "Reminders",
    "Sur iPhone et iPad : ajoute d'abord Pas l'temps à l'écran d'accueil (Partager → Sur l'écran d'accueil), puis ouvre-la depuis l'icône pour activer les rappels.": "On iPhone and iPad: first add Pas l'temps to your Home Screen (Share → Add to Home Screen), then open it from the icon to turn on reminders.",
    "Ce navigateur ne permet pas les notifications.": "This browser doesn't support notifications.",
    "Les notifications sont bloquées pour Pas l'temps. Autorise-les dans les réglages du téléphone, puis reviens ici.": "Notifications are blocked for Pas l'temps. Allow them in your phone's settings, then come back here.",
    "Une petite notification si tu n'as pas ouvert l'appli depuis 3 jours : « T'as pas l'temps ? »": "A little notification if you haven't opened the app for 3 days: “No time?”",
    "Non merci": "No thanks", "Tous les 3 jours": "Every 3 days", "vers {h} h": "around {h}:00",
    "Sans autorisation, pas de rappel.": "Without permission, no reminders.",
    "C'est noté ✓ Premier rappel dans 3 jours si tu n'ouvres pas l'appli d'ici là.": "Done ✓ First reminder in 3 days if you don't open the app before then.",
    "Activation impossible pour l'instant. Réessaie plus tard.": "Can't turn it on right now. Try again later.",
    "🔔": "🔔", "Active les notifications": "Turn on notifications", "Autoriser": "Allow", "Plus tard": "Later",
    ": on te prévient quand il est l'heure de repartir, et on te fait signe tous les 3 jours.": ": we'll tell you when it's time to head back, and check in every 3 days.",
    "🏃 C'est l'heure de repartir de {n} : {m} min {of} pour rentrer à l'heure.": "🏃 Time to leave {n}: {m} min {of} to get back on time.",
    "⏰ Ta pause est finie : il est l'heure d'être rentré·e !": "⏰ Your break is over: time to be back!",
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
