# Pas l'temps ⏱️

**10, 20, 30 minutes devant vous ? Pas l'temps trouve à pied ce qui tient dans votre pause.**

On choisit son temps (10 à 60 min) et son envie (manger, prendre l'air, shopping, culture, se poser, bouger) :
l'appli liste les lieux autour dont **l'aller-retour (à pied, à vélo ou en voiture) + le temps sur place** tient dans la pause.

- 🧭 **Explorer** : lieux classés par rubrique, radar « autour de vous », site web, itinéraire à pied
- 🕐 **Ouvert à ton arrivée** : « Ouvert · jusqu'à 19h30 », « Ferme dans 10 min », « Fermé · ouvre demain à 9h » (horaires OpenStreetMap), filtre « Ouverts seulement »
- 🎲 **Choisis pour moi** : un tirage qui tient compte de l'heure, de la distance, de vos lieux « à tester » et de ce que vous avez déjà fait
- ⏱️ **Chrono « Je pars »** : en route → sur place → « c'est l'heure de repartir ! » (avec vibration)
- ⭐ **Mes lieux** (favoris, à tester) et **Déjà fait** (historique avec notes)
- 📝 **Blog** : profil, code ami, potes, sorties avec photo, note et commentaires, réactions, stats, badges et défi de la semaine
- 🌟 **Avis** : tous les lieux notés par la communauté
- 🔑 **Code de récupération** : sauvegarde chiffrée (AES-GCM) pour tout retrouver sur un autre appareil
- 🛡️ **Modération** : signaler un post, un commentaire ou un avis, bloquer quelqu'un ; masquage automatique après 3 signalements, page de modération
- 👤 **Profil** : photo, prénom, âge, genre, endroits préférés (mis en avant dans les résultats) ; écran d'accueil « Bonjour, t'as pas l'temps *Prénom* »
- 🔑 **Code de récupération sans serveur** : un code (ou un lien) qui contient le profil, les réglages, les favoris et l'historique
- 🎨 Style « Crème » et 6 autres thèmes, mode sombre, format mobile / tablette / grand écran,
  **installable** sur le téléphone et utilisable **hors connexion**
- ⏰ **« Je dois être rentré·e à… »** : une heure de retour au lieu d'une durée, le temps se recalcule tout seul
- 🔎 **Filtres** : ouverts à l'arrivée (automatique le soir), accessibles en fauteuil, type de cuisine, recherche par nom
- 🌧️ **Météo** (Open-Meteo) : sous la pluie les lieux couverts d'abord, au soleil le dehors est favorisé
- 🗺️ **Radar** : toucher un point ouvre le lieu ; les lieux collés sont regroupés en bulles
- 📤 **Envoyer un lieu à un pote**, 👋 accueil en 3 écrans au premier lancement, 🏝️ Outre-mer couvert par les tuiles
- 🇬🇧 **Français et anglais** (réglage « Langue », auto = langue de l'appareil)
- ⚖️ **Mentions légales**, confidentialité, conditions d'utilisation et crédits (`public/legal.html`), avec un bouton « Tout effacer »
- 🖼️ Illustrations maison (aucune image sous droits) et polices hébergées avec l'appli (aucune requête vers Google)

Les lieux et adresses viennent d'**OpenStreetMap** : gratuit, sans clé d'API.

**Recherche rapide par tuiles** : chaque semaine, le workflow « Construire les lieux » télécharge
OpenStreetMap France, garde les ~450 000 lieux utiles (avec horaires, site, téléphone) et les découpe
en tuiles d'environ 5 km, publiées sur la branche `places`. L'appli ne charge que les 1 à 4 tuiles
autour de soi (≈ 0,2 à 0,8 s), puis les garde sur l'appareil. Le service Overpass ne sert qu'en dehors
de la France. Les adresses tapées sont cherchées dans la Base Adresse Nationale (service public libre),
Nominatim ne sert qu'en secours (étranger, noms de lieux).

## Lancer l'appli

Il faut **Node.js 22.13 ou plus récent**. Aucune dépendance à installer.

```bash
npm start
# puis ouvrir http://localhost:8080
```

Les données (profils, posts, avis, sauvegardes) sont enregistrées dans `data/pasltemps.db` (SQLite).
Variables d'environnement : `PORT` (8080), `HOST` (0.0.0.0), `DATA_DIR` (`./data`),
`ADMIN_TOKEN` (code de la page de modération, sans lui elle est désactivée), `REPORT_THRESHOLD` (3).

## Modération

- Dans l'appli, chacun peut **signaler** un post (bouton ⋯), un commentaire ou un avis, et **bloquer** une personne.
- Un contenu signalé par `REPORT_THRESHOLD` personnes différentes (3 par défaut) est **masqué automatiquement** pour tout le monde.
- La page **`/admin.html`** (avec le code `ADMIN_TOKEN`) liste les signalements : masquer, rétablir ou bannir l'auteur
  (son profil et ses posts sont supprimés, il ne peut plus publier).

```bash
npm test   # tests du serveur, de D1 et des horaires
```

## Mettre en ligne (gratuit)

L'appli est publiée sur **GitHub Pages** et le serveur (blog, avis, modération, sauvegardes)
sur **Cloudflare Workers + D1**, deux offres gratuites, sans carte bancaire.

### 1. L'appli : GitHub Pages

**Settings → Pages → Build and deployment → Deploy from a branch** : branche principale, dossier `/ (root)`.
L'appli est sur **https://zcabande-arch.github.io/Pasl-temps/** (la page d'accueil redirige vers `public/`).

### 2. Le serveur : Cloudflare (une seule fois, ~10 min)

1. Créer un compte gratuit sur [cloudflare.com](https://dash.cloudflare.com/sign-up),
   puis ouvrir **Workers & Pages** une fois (Cloudflare y crée votre adresse `….workers.dev`).
2. **Clé d'accès** : icône de profil → **Profile → API Tokens → Create Token** →
   modèle **Edit Cloudflare Workers** → **+ Add more** : `Account` · `D1` · `Edit` →
   Account Resources : votre compte → **Continue to summary → Create Token** → copier la clé.
3. **Account ID** : dans **Workers & Pages**, colonne de droite (ou dans l'adresse de la page, après `dash.cloudflare.com/`).
4. Dans GitHub : **Settings → Secrets and variables → Actions → New repository secret**, créer :
   - `CLOUDFLARE_API_TOKEN` : la clé de l'étape 2
   - `CLOUDFLARE_ACCOUNT_ID` : l'identifiant de l'étape 3
   - `ADMIN_TOKEN` : un code secret de votre choix, pour la page de modération `admin.html`
5. **Actions → Publier l'API (Cloudflare, gratuit) → Run workflow.**

Le workflow crée la base, publie le serveur, puis **branche l'appli dessus tout seul**
(il écrit l'adresse dans `public/config.js`). Il se relance à chaque modification du serveur.

### Autre possibilité : un serveur Node / Docker

Le même serveur tourne aussi avec Node.js (`npm start`) ou Docker, chez n'importe quel hébergeur
avec un **disque persistant** monté sur `/data` :

```bash
docker build -t pas-ltemps .
docker run -p 8080:8080 -v pasltemps-data:/data -e ADMIN_TOKEN=… pas-ltemps
```

Sur Render : New → Blueprint → ce dépôt (`render.yaml`, offre payante pour le disque).
Mettre ensuite son adresse dans `public/config.js` (`apiBase`).

## Installer sur le téléphone

- **iPhone (Safari)** : bouton Partager → **Sur l'écran d'accueil**
- **Android (Chrome)** : menu ⋮ → **Installer l'application** (ou Réglages ⚙️ → **Installer**)

## Fichiers

| Fichier | Rôle |
|---|---|
| `public/index.html` | La page de l'appli |
| `public/css/app.css` | Styles et thèmes |
| `public/js/app.js` | L'appli (explorer, chrono, blog, avis, réglages…) |
| `public/js/places.js` | Recherche de lieux (tuiles, Overpass en secours) et d'adresses (BAN, Nominatim en secours) |
| `public/js/i18n.js` | Traductions (français → anglais) et réglage de langue |
| `public/legal.html` | Mentions légales, confidentialité, conditions, crédits |
| `scripts/build-covers.js` | Fabrique les illustrations des envies (`public/img/moods/*.svg`) |
| `scripts/build-places.js` | Fabrique les tuiles de lieux (workflow hebdomadaire) |
| `public/js/hours.js` | Horaires d'ouverture : ouvert ou fermé à l'arrivée |
| `public/js/icons.js` | Petits dessins au trait (à la place des emojis) |
| `public/admin.html` | Page de modération |
| `public/js/api.js` | Échanges avec le serveur (compte anonyme par appareil) |
| `public/config.js` | Adresse du serveur, si l'appli est publiée ailleurs |
| `public/sw.js` | Service worker : fonctionnement hors connexion |
| `server/core.js` | L'API : règles d'accès, modération, anti-spam (commune à Node et Cloudflare) |
| `server/server.js` | Serveur Node : fichiers de l'appli + API |
| `server/store.js` | Base SQLite (Node) |
| `server/schema.sql`, `server/queries.js` | Schéma et requêtes, communs à SQLite et D1 |
| `worker/` | Version Cloudflare Workers (base D1) |
| `wrangler.toml` | Configuration Cloudflare |

> Après une modification des fichiers de `public/`, augmenter le numéro de version aux trois endroits : `VERSION` dans `public/sw.js`, `APP_VERSION` dans `public/js/app.js` et `app-version` dans `public/index.html` (un test le vérifie).

## Vie privée

- Pas de compte, pas d'e-mail : chaque appareil reçoit un identifiant anonyme.
- L'historique et les listes sont privés. Le profil du blog, les posts et les avis sont visibles par les autres utilisateurs.
- La sauvegarde est chiffrée sur l'appareil avec le code de récupération : le serveur ne peut pas la lire.
- Votre position GPS n'est envoyée qu'à OpenStreetMap, pour chercher les lieux autour. Le serveur ne connaît que les lieux où vous êtes allé·e.

Données des lieux © les contributeurs d'OpenStreetMap, licence ODbL.
