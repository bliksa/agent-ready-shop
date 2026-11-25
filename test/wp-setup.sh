#!/bin/sh
# Provision a WooCommerce store and activate Agent Ready Shop. Run via:
#   docker compose run --rm wpcli
set -e

echo "Waiting for WordPress files…"
until wp core is-installed --allow-root 2>/dev/null || wp core version --allow-root 2>/dev/null; do sleep 2; done || true

if ! wp core is-installed --allow-root 2>/dev/null; then
  echo "Installing WordPress core…"
  wp core install --allow-root \
    --url="http://localhost:8080" \
    --title="Agent Ready Demo Store" \
    --admin_user=admin --admin_password=admin --admin_email=admin@example.com \
    --skip-email
fi

echo "Installing + activating WooCommerce…"
wp plugin install woocommerce --activate --allow-root

echo "Activating Agent Ready Shop…"
wp plugin activate agent-ready-shop --allow-root

echo "Setting permalinks (needed for llms.txt / .well-known)…"
wp rewrite structure '/%postname%/' --allow-root
wp rewrite flush --allow-root

echo "Seeding a sample product…"
wp wc product create --name="Sample Widget" --regular_price=29.00 --sku=WIDGET-1 --user=admin --allow-root 2>/dev/null || true

echo ""
echo "Done. Try:"
echo "  http://localhost:8080/llms.txt"
echo "  http://localhost:8080/.well-known/agent-shop.json"
echo "  http://localhost:8080/wp-json/agent-shop/v1/products"
echo "  http://localhost:8080/wp-admin/  (admin / admin) -> Agent Shop"
