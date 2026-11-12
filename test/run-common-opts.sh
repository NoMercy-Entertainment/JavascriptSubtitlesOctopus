#!/bin/sh
# run-common.sh must accept -i (as its usage says) and must not run `make`
# while printing its usage.
set -e
cd "$(dirname "$0")/.."
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
printf '#!/bin/sh\necho ran > "%s/make-ran"\n' "$tmp" > "$tmp/make"
chmod +x "$tmp/make"
fail=0

out="$(PATH="$tmp:$PATH" sh -c '. ./run-common.sh -i my-image && echo "IMAGE=$IMAGE"' 2>&1)" || true
case "$out" in
    *"IMAGE=my-image"*) echo "PASS: -i sets IMAGE" ;;
    *) echo "FAIL: -i does not set IMAGE: $out"; fail=1 ;;
esac

PATH="$tmp:$PATH" sh -c '. ./run-common.sh -z' > /dev/null 2>&1 || true
if [ -f "$tmp/make-ran" ]; then
    echo "FAIL: usage ran make"
    fail=1
else
    echo "PASS: usage runs no command"
fi
exit $fail
