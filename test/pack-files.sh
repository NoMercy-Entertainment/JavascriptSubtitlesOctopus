#!/bin/sh
# The published package must carry every file the default configuration
# loads: src/subtitles-octopus.js defaults fallbackFont to default.woff2.
set -e
cd "$(dirname "$0")/.."
mkdir -p dist/js
for f in subtitles-octopus.js subtitles-octopus-worker.js COPYRIGHT default.woff2; do
    [ -f "dist/js/$f" ] || : > "dist/js/$f"
done
if npm pack --dry-run 2>&1 | grep 'dist/js/default.woff2' > /dev/null; then
    echo "PASS: npm pack lists dist/js/default.woff2"
else
    echo "FAIL: npm pack does not list dist/js/default.woff2"
    exit 1
fi
