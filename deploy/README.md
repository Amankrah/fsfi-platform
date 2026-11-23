# Deploying the FSFI platform at fsfvi.ai

Single Ubuntu host behind nginx: the API (FastAPI, uvicorn) on 127.0.0.1:8010 and the web app (Next.js) on
127.0.0.1:3010, both under systemd. nginx serves `https://fsfvi.ai`, forwards `/api/` to the API and everything else to
the web app, so the browser talks to one origin.

## 1. DNS

At the DNS host, point `fsfvi.ai` and `www.fsfvi.ai` (A records) to the server's public IP. Wait until
`dig +short fsfvi.ai` returns it.

## 2. If fsfvi.ai is already listed in another nginx site

Remove `fsfvi.ai` from the `server_name` lines of any other site on the host, so that this file alone serves it, then
`sudo nginx -t && sudo systemctl reload nginx`. The other site keeps its own certificate; this platform gets a separate
one in step 6.

## 3. System user and code

```bash
sudo adduser --system --group --home /opt/fsfi-platform fsfi
sudo -u fsfi git clone https://github.com/<owner>/fsfi-platform.git /opt/fsfi-platform/app
```

## 4. API

```bash
cd /opt/fsfi-platform/app/backend
sudo -u fsfi python3.13 -m venv .venv
sudo -u fsfi .venv/bin/pip install -r requirements.txt
sudo -u fsfi .venv/bin/python -m pytest -q          # optional check; masking tests skip without private files
```

The synthetic demonstration countries are generated into `backend/data/countries/` on first start.

## 5. Web app

`NEXT_PUBLIC_API_URL` is read at build time, so set it for the build:

```bash
cd /opt/fsfi-platform/app/frontend
sudo -u fsfi npm ci
sudo -u fsfi env NEXT_PUBLIC_API_URL=https://fsfvi.ai/api npm run build
```

## 6. Services, nginx and TLS

```bash
sudo cp /opt/fsfi-platform/app/deploy/systemd/fsfi-platform-*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now fsfi-platform-api fsfi-platform-web
curl -s http://127.0.0.1:8010/api/health

sudo cp /opt/fsfi-platform/app/deploy/nginx/fsfvi.ai.conf /etc/nginx/sites-available/fsfvi.ai
sudo ln -sf /etc/nginx/sites-available/fsfvi.ai /etc/nginx/sites-enabled/fsfvi.ai
sudo nginx -t && sudo systemctl reload nginx
sudo certbot certonly --webroot -w /var/www/html -d fsfvi.ai -d www.fsfvi.ai
# uncomment the two 443 server blocks in /etc/nginx/sites-available/fsfvi.ai, then:
sudo nginx -t && sudo systemctl reload nginx
```

Check `https://fsfvi.ai` and `https://fsfvi.ai/api/health`.

## Updating

```bash
cd /opt/fsfi-platform/app && sudo -u fsfi git pull
cd backend && sudo -u fsfi .venv/bin/pip install -r requirements.txt
cd ../frontend && sudo -u fsfi npm ci && sudo -u fsfi env NEXT_PUBLIC_API_URL=https://fsfvi.ai/api npm run build
sudo systemctl restart fsfi-platform-api fsfi-platform-web
```
