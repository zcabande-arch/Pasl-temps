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
npm test   # tests du serveur
```

## Mettre en ligne

### Option 1 — Appli complète (recommandé)

N'importe quel hébergeur qui accepte Docker, avec un **disque persistant** monté sur `/data` :

```bash
docker build -t pas-ltemps .
docker run -p 8080:8080 -v pasltemps-data:/data pas-ltemps
```

- **Render** : New → Blueprint → choisir ce dépôt (le fichier `render.yaml` configure tout, disque compris).
- **Fly.io, Railway, un VPS…** : même image, penser au volume `/data`.

L'appli doit être servie en **HTTPS** pour la géolocalisation et l'installation sur téléphone (c'est le cas par défaut sur ces hébergeurs).

### Option 2 — GitHub Pages (explorer seulement, gratuit)

1. Fusionner dans `main`, puis **Settings → Pages → Source : GitHub Actions**.
2. L'appli est publiée sur **https://zcabande-arch.github.io/Pasl-temps/**

Sans serveur, l'exploration, le chrono, les favoris et l'historique fonctionnent (stockés sur le téléphone).
Le blog, les avis et le code de récupération ont besoin du serveur : pour les activer,
indiquer son adresse dans `public/config.js` (`apiBase: "https://mon-serveur.example"`).

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
| `server/server.js` | Serveur : fichiers de l'appli + API, règles d'accès |
| `server/store.js` | Base de données SQLite |

> Après une modification des fichiers de `public/`, incrémenter `VERSION` dans `public/sw.js` pour que les téléphones récupèrent la nouvelle version.

## Vie privée

- Pas de compte, pas d'e-mail : chaque appareil reçoit un identifiant anonyme.
- L'historique et les listes sont privés. Le profil du blog, les posts et les avis sont visibles par les autres utilisateurs.
- La sauvegarde est chiffrée sur l'appareil avec le code de récupération : le serveur ne peut pas la lire.
- Votre position GPS n'est envoyée qu'à OpenStreetMap, pour chercher les lieux autour. Le serveur ne connaît que les lieux où vous êtes allé·e.

Données des lieux © les contributeurs d'OpenStreetMap, licence ODbL.
