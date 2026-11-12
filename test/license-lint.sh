#!/bin/sh
# Every license on a "License: A and/or B" line must be registered and checked.
set -e
cd "$(dirname "$0")/.."
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
printf 'Name: sample\nLicense: Expat and/or Zlib\n' > "$tmp/info"
printf 'License: Expat\nfull text here\n' > "$tmp/fulltext"

out="$(awk -f build/license_lint.awk "$tmp/info" "$tmp/fulltext" 2>&1)" && rc=0 || rc=$?
case "$rc:$out" in
    1:*"Missing full text for 'Zlib'"*) echo "PASS: lint reports the missing Zlib text" ;;
    *) echo "FAIL: exit $rc, output: $out"; exit 1 ;;
esac
