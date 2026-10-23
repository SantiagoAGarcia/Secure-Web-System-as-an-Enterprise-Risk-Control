# Deployment Runbook: AWS EC2 Ubuntu 24.04

This runbook documents the step-by-step procedure for deploying the Enterprise Risk Lab secure web system on an AWS EC2 instance.

### Instance Parameters
- Cloud Provider: AWS EC2
- Operating System: Ubuntu 24.04 LTS
- Instance Type: t3.micro
- Elastic Public IP: 52.45.225.80
- Duck DNS Subdomain: santiago-risk.duckdns.org
- SSH User: ubuntu
- Private SSH Key: labsuser.pem (or vockey.pem)
- Backend Auth0 Domain: dev-pex0h55z20dwvyvt.us.auth0.com
- Backend API Audience: https://enterprise-risk-api

---

## Auth0 Pre-Deployment Checklist

Before accessing the deployed web application, configure the Auth0 dashboard:
1. Navigate to Applications -> Applications -> Enterprise Risk Lab Frontend.
2. Under the Settings tab, add the public HTTPS URLs:
   - Allowed Callback URLs: http://localhost:5173, https://santiago-risk.duckdns.org
   - Allowed Logout URLs: http://localhost:5173, https://santiago-risk.duckdns.org
   - Allowed Web Origins: http://localhost:5173, https://santiago-risk.duckdns.org
3. Click Save Changes.

---

## Step 1: SSH Access and Server Hardening

Connect from your local workstation using your private key:
```bash
# On Linux/macOS restrict key permissions:
chmod 400 labsuser.pem

# SSH connection to the Elastic IP:
ssh -i labsuser.pem ubuntu@52.45.225.80
```

1. Update the operating system packages:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. Configure the UFW firewall:
   Allow only ports 22 (SSH), 80 (HTTP), and 443 (HTTPS). Port 8080 must never be publicly exposed. In addition, verify that the AWS Security Group allows inbound traffic on ports 22, 80, and 443 only.
   ```bash
   sudo ufw default deny incoming
   sudo ufw default allow outgoing
   sudo ufw allow 22/tcp comment 'SSH'
   sudo ufw allow 80/tcp comment 'HTTP (Certbot & Redirection)'
   sudo ufw allow 443/tcp comment 'HTTPS TLS'
   sudo ufw enable
   sudo ufw status verbose
   ```

---

## Step 2: Duck DNS Dynamic DNS Setup

Duck DNS maps the subdomain `santiago-risk.duckdns.org` to Elastic IP `52.45.225.80`.

1. Create the update script:
   Note: Replace `YOUR_DUCKDNS_TOKEN_HERE` directly in the terminal. Never commit this token to Git.
   ```bash
   mkdir -p ~/duckdns
   cat << 'EOF' > ~/duckdns/duck.sh
   #!/bin/bash
   echo url="https://www.duckdns.org/update?domains=santiago-risk&token=YOUR_DUCKDNS_TOKEN_HERE&ip=52.45.225.80" | curl -o ~/duckdns/duck.log -K -
   EOF

   chmod 700 ~/duckdns/duck.sh
   ```

2. Execute manually and verify the log output:
   ```bash
   ~/duckdns/duck.sh
   cat ~/duckdns/duck.log
   # Output must be: OK
   ```

3. Schedule recurring updates with cron:
   ```bash
   crontab -e
   ```
   Append the following entry:
   ```cron
   */5 * * * * ~/duckdns/duck.sh >/dev/null 2>&1
   ```

4. Verify DNS resolution:
   ```bash
   nslookup santiago-risk.duckdns.org
   # Must resolve to 52.45.225.80
   ```

---

## Step 3: Install Required Packages and Runtimes

```bash
sudo apt update
sudo apt install -y apache2 certbot python3-certbot-apache openjdk-21-jre curl dnsutils
```

---

## Step 4: Transfer Build Artifacts from Local Workstation

From the project root on your local workstation (PowerShell or Bash):

```powershell
# 1. Copy the backend executable JAR
scp -i labsuser.pem backend/target/enterprise-risk-api-0.0.1-SNAPSHOT.jar ubuntu@52.45.225.80:/home/ubuntu/

# 2. Copy the production frontend static build directory
scp -i labsuser.pem -r frontend/dist ubuntu@52.45.225.80:/home/ubuntu/

# 3. Copy deployment service and virtual host configurations
scp -i labsuser.pem deployment/enterprise-risk-api.service ubuntu@52.45.225.80:/home/ubuntu/
scp -i labsuser.pem deployment/enterprise-risk.conf ubuntu@52.45.225.80:/home/ubuntu/
```

---

## Step 5: Configure and Deploy the Backend Service

In the remote SSH session (`ubuntu@52.45.225.80`):

1. Create a dedicated low-privilege system user and install the artifact:
   ```bash
   sudo mkdir -p /opt/enterprise-risk-api
   sudo useradd --system --no-create-home --shell /bin/false riskapi || true
   sudo mv /home/ubuntu/enterprise-risk-api-0.0.1-SNAPSHOT.jar /opt/enterprise-risk-api/app.jar
   sudo chown -R riskapi:riskapi /opt/enterprise-risk-api
   sudo chmod 500 /opt/enterprise-risk-api/app.jar
   ```

2. Install and enable the systemd unit:
   ```bash
   sudo mv /home/ubuntu/enterprise-risk-api.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now enterprise-risk-api
   ```

3. Verify service status and local health endpoint:
   ```bash
   sudo systemctl status enterprise-risk-api
   curl -i http://127.0.0.1:8080/actuator/health
   # Returns HTTP 200 with {"status":"UP",...}
   ```

---

## Step 6: Configure Apache HTTP Server and Reverse Proxy

1. Deploy the frontend assets to the web root:
   ```bash
   sudo mkdir -p /var/www/enterprise-risk-frontend
   sudo rm -rf /var/www/enterprise-risk-frontend/*
   sudo cp -r /home/ubuntu/dist/* /var/www/enterprise-risk-frontend/
   sudo chown -R www-data:www-data /var/www/enterprise-risk-frontend
   sudo chmod -R 755 /var/www/enterprise-risk-frontend
   ```

2. Enable required Apache modules:
   ```bash
   sudo a2enmod ssl proxy proxy_http rewrite headers
   ```

3. Activate the VirtualHost site and reload Apache:
   ```bash
   sudo mv /home/ubuntu/enterprise-risk.conf /etc/apache2/sites-available/
   sudo a2ensite enterprise-risk.conf
   sudo a2dissite 000-default.conf || true
   sudo apachectl configtest
   # Output must state: Syntax OK
   sudo systemctl reload apache2
   ```

---

## Step 7: Request TLS Certificate with Let's Encrypt (Certbot)

1. Obtain and configure the certificate:
   ```bash
   sudo certbot --apache -d santiago-risk.duckdns.org
   ```
   - Provide your administrative email address.
   - Agree to the Terms of Service.
   - Choose to automatically redirect HTTP traffic to HTTPS.

2. Verify automated renewal simulation:
   ```bash
   sudo certbot renew --dry-run
   # Must complete successfully with: all simulated renewals succeeded
   ```

---

## Step 8: Verification and Audit Commands

Execute these validation procedures to verify enterprise risk controls:

1. Confirm port 8080 is blocked from the internet:
   From an external client machine:
   ```bash
   curl -m 5 http://santiago-risk.duckdns.org:8080
   # Must time out or fail with connection refused
   ```

2. Inspect the TLS Certificate with OpenSSL:
   ```bash
   openssl s_client -connect santiago-risk.duckdns.org:443 -servername santiago-risk.duckdns.org
   ```

3. Review centralized service audit logs:
   ```bash
   sudo journalctl -u enterprise-risk-api -n 50 --no-pager
   ```

4. Complete browser end-to-end verification:
   - Navigate to `https://santiago-risk.duckdns.org`.
   - Verify the HTTPS padlock and certificate validity.
   - Sign in through Auth0 and click "Call protected API".
   - Collect evidence artifacts into the `docs/` directory.
