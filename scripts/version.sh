#!/usr/bin/env bash
# Pone un número de versión (?v=) a los CSS/JS de cada página para saltarse la caché del navegador.
# Correr antes de cada commit que toque docs/assets/.
set -euo pipefail
cd "$(dirname "$0")/.."
v=$(date +%Y%m%d%H%M%S)
find docs -name index.html -exec sed -i -E "s#(assets/[a-z]+\.(js|css))(\?v=[0-9]+)?\"#\1?v=$v\"#g" {} +
echo "versión $v"
