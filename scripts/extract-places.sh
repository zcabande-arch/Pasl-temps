#!/usr/bin/env bash
# Fissa Fissa — télécharge des régions OpenStreetMap (Geofabrik) et garde les lieux utiles à l'appli.
# Usage : scripts/extract-places.sh <dossier> "europe/france:fr europe/germany:de asia:" [région obligatoire]
#   région:code pays (vide pour un continent entier : le pays vient alors de l'adresse de chaque lieu)
# Écrit <dossier>/<région>.geojsonseq.gz et <dossier>/args.txt (arguments pour scripts/build-places.js).
set -o pipefail
OUT="$1"; REGIONS="$2"; MUST="$3"
mkdir -p "$OUT"
ARGS=""
for rc in $REGIONS; do
  r="${rc%%:*}"; cc="${rc##*:}"; f="${r//\//-}"
  if ! curl -fsSL --retry 3 --retry-delay 20 -o "$f.osm.pbf" "https://download.geofabrik.de/$r-latest.osm.pbf"; then
    rm -f "$f.osm.pbf"
    if [ "$r" = "$MUST" ]; then echo "::error::$r non téléchargé"; exit 1; fi
    echo "::warning::$r non téléchargé, ignoré cette semaine"; continue
  fi
  osmium tags-filter "$f.osm.pbf" \
    nwr/shop=bakery,pastry,ice_cream,mall,department_store,farm,gift,souvenir,books,supermarket,convenience,greengrocer,organic,butcher,cheese,seafood,deli,wine,alcohol,frozen_food \
    nwr/amenity=cafe,fast_food,food_court,ice_cream,restaurant,marketplace,place_of_worship,library,bar,pub,biergarten \
    nwr/leisure=park,garden,nature_reserve,common,track,fitness_centre,sports_centre \
    nwr/tourism=picnic_site,viewpoint,attraction,museum,gallery \
    nwr/historic=monument,castle \
    -o "$f.lieux.pbf" \
  && osmium export "$f.lieux.pbf" -f geojsonseq -a type,id --geometry-types=point,linestring,polygon -o - | gzip -1 > "$OUT/$f.geojsonseq.gz" \
  || { rm -f "$f.osm.pbf" "$f.lieux.pbf" "$OUT/$f.geojsonseq.gz"; [ "$r" = "$MUST" ] && exit 1; echo "::warning::$r illisible, ignoré"; continue; }
  rm -f "$f.osm.pbf" "$f.lieux.pbf"
  ARGS="$ARGS $cc:$OUT/$f.geojsonseq.gz"
  echo "$r (${cc:-continent}) : $(du -h "$OUT/$f.geojsonseq.gz" | cut -f1)"
done
echo "$ARGS" > "$OUT/args.txt"
