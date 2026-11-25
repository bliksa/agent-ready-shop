#!/usr/bin/env bash
# Smoke-test the plugin endpoints against a running store.
#   BASE=http://localhost:8080 bash test/smoke.sh
set -u
BASE="${BASE:-http://localhost:8080}"
pass=0; fail=0

check() { # name url expected_substring
  body=$(curl -s "$BASE$2")
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$2")
  if [ "$code" = "200" ] && echo "$body" | grep -qi "$3"; then
    echo "  ✓ $1 ($code)"; pass=$((pass+1))
  else
    echo "  ✗ $1 ($code) — expected '$3'"; fail=$((fail+1))
  fi
}

echo "Testing $BASE"
check "llms.txt"          "/llms.txt"                              "machine-readable"
check "manifest"          "/.well-known/agent-shop.json"           "agent-ready-shop"
check "products API"      "/wp-json/agent-shop/v1/products"        "currency"
check "openapi"           "/wp-json/agent-shop/v1/openapi.json"    "openapi"
check "rate-limit advert" "/.well-known/agent-shop.json"           "rate_limits"

echo ""
echo "Checkout gate (expect 402 without Pro license):"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/wp-json/agent-shop/v1/checkout" -H 'Content-Type: application/json' -d '{"items":[{"sku":"WIDGET-1"}]}')
[ "$code" = "402" ] && { echo "  ✓ checkout gated (402)"; pass=$((pass+1)); } || { echo "  ✗ checkout returned $code (expected 402)"; fail=$((fail+1)); }

echo ""
echo "$pass passed, $fail failed"
[ "$fail" = "0" ]
