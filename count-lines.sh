#!/bin/bash

# Script pour compter les lignes de code dans le répertoire legacy
# Usage: ./count-lines.sh

LEGACY_DIR="./legacy"

if [ ! -d "$LEGACY_DIR" ]; then
    echo "❌ Le répertoire '$LEGACY_DIR' n'existe pas"
    exit 1
fi

echo "📊 Comptage des lignes de code - Répertoire: $LEGACY_DIR"
echo "============================================================"
echo ""

# Exclure les répertoires non-pertinents
EXCLUDE_PATTERN="\.venv|__pycache__|\.git|node_modules|\.pytest_cache|\.egg-info"

echo "📁 Lignes de code par type de fichier:"
echo ""

# Tableau pour stocker les totaux par extension
declare -A totals
grand_total=0

# Trouver tous les fichiers et compter les lignes par extension
find "$LEGACY_DIR" -type f | grep -v -E "$EXCLUDE_PATTERN" | while read file; do
    # Obtenir l'extension
    ext="${file##*.}"

    # Compter les lignes du fichier
    lines=$(wc -l < "$file" 2>/dev/null || echo 0)

    # Stocker dans un fichier temporaire
    echo "$ext:$lines" >> /tmp/code_count.tmp
done

# Traiter les résultats
if [ -f /tmp/code_count.tmp ]; then
    cat /tmp/code_count.tmp | awk -F: '
    {
        ext = $1
        lines = $2
        total[ext] += lines
        grand_total += lines
    }
    END {
        # Trier et afficher
        for (ext in total) {
            printf "  %-15s: %8d lignes\n", ext, total[ext]
        }
    }' | sort -t: -k2 -rn

    rm /tmp/code_count.tmp
fi

echo ""
echo "============================================================"

# Total du code source uniquement (sans .venv)
total=$(find "$LEGACY_DIR" -type f | grep -v -E "$EXCLUDE_PATTERN" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')

echo ""
echo "🎯 Total du code source: $total lignes"
echo ""

# Statistiques par répertoire principal
echo "📂 Répartition par répertoire principal:"
echo ""

find "$LEGACY_DIR" -maxdepth 1 -type d ! -name "legacy" ! -name ".venv" | sort | while read dir; do
    dir_name=$(basename "$dir")
    lines=$(find "$dir" -type f | grep -v -E "$EXCLUDE_PATTERN" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
    if [ ! -z "$lines" ] && [ "$lines" != "0" ]; then
        printf "  %-30s: %8s lignes\n" "$dir_name" "$lines"
    fi
done

echo ""
