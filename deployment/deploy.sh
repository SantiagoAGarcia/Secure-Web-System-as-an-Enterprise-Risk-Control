#!/bin/bash
set -e

echo "=== 1. Installing prerequisites ==="
sudo apt update
sudo apt install -y apache2 certbot python3-certbot-apache openjdk-21-jre

echo "=== 2. Setting up backend service directory ==="
sudo mkdir -p /opt/enterprise-risk-api
if ! id "riskapi" &>/dev/null; then
    sudo useradd --system --no-create-home riskapi
fi

if [ -f "enterprise-risk-api-0.0.1-SNAPSHOT.jar" ]; then
    sudo cp enterprise-risk-api-0.0.1-SNAPSHOT.jar /opt/enterprise-risk-api/app.jar
elif [ -f "backend/target/enterprise-risk-api-0.0.1-SNAPSHOT.jar" ]; then
    sudo cp backend/target/enterprise-risk-api-0.0.1-SNAPSHOT.jar /opt/enterprise-risk-api/app.jar
fi
sudo chown -R riskapi:riskapi /opt/enterprise-risk-api

echo "=== 3. Installing systemd service ==="
sudo cp deployment/enterprise-risk-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now enterprise-risk-api

echo "=== 4. Setting up Apache frontend and reverse proxy ==="
sudo mkdir -p /var/www/enterprise-risk-frontend
if [ -d "frontend/dist" ]; then
    sudo cp -r frontend/dist/* /var/www/enterprise-risk-frontend/
elif [ -d "dist" ]; then
    sudo cp -r dist/* /var/www/enterprise-risk-frontend/
fi

sudo a2enmod ssl proxy proxy_http rewrite headers
sudo cp deployment/enterprise-risk.conf /etc/apache2/sites-available/
sudo a2ensite enterprise-risk.conf
sudo apachectl configtest
sudo systemctl reload apache2

echo "=== 5. Verification ==="
echo "Local actuator health check:"
curl -I http://127.0.0.1:8080/actuator/health || true

echo ""
echo "Next step: Run certbot for TLS certificate:"
echo "sudo certbot --apache -d santiago-risk.duckdns.org"
echo "sudo certbot renew --dry-run"
