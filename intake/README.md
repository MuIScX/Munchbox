# Munchbox Intake Service

External-facing FastAPI service that receives sale data and writes to the shared MySQL database.

---

## 1. Add to docker-compose.prod.yml

Add the `intake` service block and update `nginx` depends_on:

```yaml
services:

  # --- ADD THIS NEW SERVICE ---
  intake:
    build: ./intake
    container_name: munchbox-intake
    restart: always
    depends_on:
      mysql:
        condition: service_healthy
    environment:
      TZ: Asia/Bangkok
      DATABASE_URL: mysql+pymysql://${MYSQL_USER}:${MYSQL_PASSWORD}@mysql:3306/${MYSQL_DATABASE}
      INTAKE_API_KEY: ${INTAKE_API_KEY}
    volumes:
      - ./backend/app:/app/app   # shares models from backend
    networks:
      - munchbox-net

  # --- UPDATE nginx depends_on ---
  nginx:
    depends_on:
      - frontend
      - backend
      - intake       # add this line
```

---

## 2. Add to nginx.conf

Inside the `server { listen 443 ssl; ... }` block, add after the existing `/api/` location:

```nginx
location /intake/ {
    proxy_pass http://intake:8002/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto https;
}
```

---

## 3. Add to .env

```env
INTAKE_API_KEY=your-strong-random-key-here
```

Generate a strong key:
```bash
openssl rand -hex 32
```

---

## 4. Deploy

```bash
docker-compose -f docker-compose.prod.yml up -d --build intake
```

To also reload nginx so it picks up the new location block:
```bash
docker-compose -f docker-compose.prod.yml restart nginx
```

---

## API Usage

### POST https://munchbox.live/intake/receive

**Headers:**
```
Content-Type: application/json
X-API-Key: your-secret-key
```

**Body:**
```json
{
  "restaurant_id": 5,
  "sale_date": "2025-04-17",
  "items": [
    {"menu_id": 12, "amount": 3},
    {"menu_id": 7,  "amount": 1}
  ]
}
```

> `sale_date` is optional — omit it to use today's date (UTC).

**Response:**
```json
{
  "message": "success",
  "data": {
    "menu_recorded": 2,
    "total_item": 4
  }
}
```

### GET https://munchbox.live/intake/health

Returns `{"status": "healthy"}` — useful for uptime monitoring.

---

## How it works

- The `volumes` mount shares your backend's `app/models/` directly into the intake container
- No model duplication — both services read/write the same MySQL tables
- `restaurant_id` comes from the request body (instead of JWT like the main backend)
- Auth is via `X-API-Key` header checked against `INTAKE_API_KEY` env var
