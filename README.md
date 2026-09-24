# Pas l'temps ⏱️

**10, 20, 30 minutes devant vous ? Pas l'temps trouve à pied ce qui tient dans votre pause.**

On choisit son temps (10 à 60 min) et son envie (manger, prendre l'air, shopping, culture, se poser, bouger) :
l'appli liste les lieux autour dont **l'aller-retour à pied + le temps sur place** tient dans la pause.

- 🧭 **Explorer** : lieux classés par rubrique, radar « autour de vous », site web, itinéraire à pied
- 🕐 **Ouvert à ton arrivée** : « Ouvert · jusqu'à 19h30 », « Ferme dans 10 min », « Fermé · ouvre demain à 9h » (horaires OpenStreetMap), filtre « Ouverts seulement »
- 🎲 **Choisis pour moi** : un tirage qui tient compte de l'heure, de la distance, de vos lieux « à tester » et de ce que vous avez déjà fait
- ⏱️ **Chrono « Je pars »** : en route → sur place → « c'est l'heure de repartir ! » (avec vibration)
- ⭐ **Mes lieux** (favoris, à tester) et **Déjà fait** (historique avec notes)
- 📝 **Blog** : profil, code ami, potes, sorties avec photo, note et commentaires, réactions, stats, badges et défi de la semaine
- 🌟 **Avis** : tous les lieux notés par la communauté
- 🔑 **Code de récupération** : sauvegarde chiffrée (AES-GCM) pour tout retrouver sur un autre appareil
- 🛡️ **Modération** : signaler un post, un commentaire ou un avis, bloquer quelqu'un ; masquage automatique après 3 signalements, page de modération
- 🎨 Style « Crème » et 6 autres thèmes, mode sombre, format mobile / tablette / grand écran,
  **installable** sur le téléphone et utilisable **hors connexion**

Les lieux et adresses viennent d'**OpenStreetMap** (Overpass et Nominatim) : gratuit, sans clé d'API.

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
| `public/js/places.js` | Recherche de lieux et d'adresses (OpenStreetMap) |
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

> Après une modification des fichiers de `public/`, incrémenter `VERSION` dans `public/sw.js` pour que les téléphones récupèrent la nouvelle version.

## Vie privée

- Pas de compte, pas d'e-mail : chaque appareil reçoit un identifiant anonyme.
- L'historique et les listes sont privés. Le profil du blog, les posts et les avis sont visibles par les autres utilisateurs.
- La sauvegarde est chiffrée sur l'appareil avec le code de récupération : le serveur ne peut pas la lire.
- Votre position GPS n'est envoyée qu'à OpenStreetMap, pour chercher les lieux autour. Le serveur ne connaît que les lieux où vous êtes allé·e.

Données des lieux © les contributeurs d'OpenStreetMap, licence ODbL.
