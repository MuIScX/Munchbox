# MunchBox

AI-powered restaurant inventory management with Bayesian demand forecasting and receipt OCR.

**Live:** [munchbox.live](https://www.munchbox.live)

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 |
| Backend | FastAPI (Python) + SQLAlchemy + Alembic |
| Forecasting | Bayesian Time Series Model (PyMC + PyTensor) |
| OCR Pipeline | PaddleOCR (PP-OCRv5) + watchdog file watcher |
| Database | MySQL 8.0 |
| Auth | JWT (HS256) |
| Infra | Docker Compose + Nginx + Let's Encrypt |
| Package Managers | npm (frontend), pip/venv (backend) |

## System Architecture

```
                          +-------------------------+
                          |   Browser               |
                          |   munchbox.live         |
                          +----------+--------------+
                                     |
                          +----------v--------------+
                          |   Nginx (443 / 80)      |
                          |   munchbox.live         |
                          +----------+--------------+
                                     |
               +---------------------+---------------------+
               |                     |                     |
    +----------v----------+  +-------v-------+  +---------v--------+
    |  Frontend           |  |  Backend API  |  |  Intake API      |
    |  Next.js (Docker)   |  |  FastAPI :8001|  |  FastAPI (Docker)|
    |  /                  |  |  /api/*       |  |  /receive        |
    +---------------------+  +-------+-------+  |  /menu/list      |
                                     |          +---------+--------+
                     +---------------+               |
                     |               |               |
          +----------v----+  +-------v-------+       |
          | Bayesian      |  |   MySQL 8.0   <-------+
          | Forecast      |  |   (Docker)    |
          | PyMC + APSched|  +---------------+
          +---------------+

  Scanner (Raspberry Pi / PC):
    scans/incoming/ → PaddleOCR → CSV → Intake API → MySQL
```

## Project Structure

```
Munchbox/
  backend/
    app/
      core/                 JWT auth + config
      db/                   SQLAlchemy session
      models/               ORM models (user, restaurant, ingredient, menu, sale, staff, predict)
      routes/               FastAPI routers (auth, ingredient, menu, sale, report, predict, staff, ...)
      schemas/              Pydantic request/response schemas
      services/
        forecaster.py       Bridge to Bayesian model
        scheduler.py        APScheduler — auto-runs forecast per restaurant
    BayesianTimeSeriesModel/
      src/                  Bayes_Inventory_Imp_v3-2-5_sql.py
    alembic/
      versions/             12 migration files
    requirements.txt
  Frontend/
    munchboxui/
      src/
        app/
          components/       Modals, sidebar, charts, tables
          dashboard/        Overview + KPI
          managemenu/       Menu + recipe CRUD
          managestaff/      Staff management
          updateinventory/  Stock update
          inventorylog/     Ingredient history
          sale-record/      Manual sale entry
          reports/          Sales charts + KPI cards
          predict/          Forecast dashboard
          accuracy/         Prediction accuracy view
          import/           CSV bulk import
          login/ staff-login/
        lib/
          api.js            Axios client (all API calls)
          schema.js         Shared validation
  intake/
    main.py                 FastAPI app — receives POS sales data
    app/models/             Sale + Menu ORM
  nginx.conf
  docker-compose.prod.yml
```

## Features

### Inventory Management
- Ingredient CRUD with stock tracking (decimal quantities + units)
- Category filtering, soft-delete (`is_active`)
- Full audit log via `ingredient_history` (every stock change with staff attribution)
- Manual stock update UI with action type tracking

### Menu & Recipe
- Menu items with type and price
- Recipe builder: link ingredients + amounts per menu item
- Bulk CSV import for menus and recipes
- Soft-delete with `is_active` flag

### Sales & Reports
- Manual sale recording with date override
- POS intake via `/receive` API (external systems POST sale items)
- Sales trend chart + category pie chart (Recharts)
- KPI cards: revenue, top items, daily totals
- Date-range filtered reports

### Bayesian Demand Forecasting
- Per-ingredient forecasts with mean, upper bound (95th), lower bound (5th)
- Configurable forecast window (days ahead) and frequency
- APScheduler runs forecasts automatically at a set time of day
- `predict_set` groups each run — historical sets browsable in UI
- Urgency score + status per ingredient (stock ≥ expected = ok)
- Forecast accuracy tracking: compares predictions against actual sales

### Receipt OCR Intake
- Watchdog monitors `scans/incoming/` for new images
- PaddleOCR extracts text; fuzzy-matches items against recipe list
- Outputs structured CSV → sends to Intake API → recorded in MySQL
- Supports 106 languages (Thai, English, etc.), `.jpg/.png/.pdf`
- Arduino trigger script (`sketch_apr8a.ino`) for physical scanner button

### Staff & Auth
- JWT-based auth (email + password → HS256 token)
- Staff PIN login for tablet/kiosk mode
- Permission levels on `user` (admin) and role on `staff`
- Manager PIN gate for sensitive operations

## Auth Flow

```
User logs in (/api/login)
  → JWT issued: {userId, username, restaurantId, permission, role}
  → All protected routes call decode_token() as a FastAPI Depends
  → restaurantId scopes all queries — no cross-restaurant data leakage

Staff login (/staff-login)
  → PIN-based, returns staff role
  → StaffGateModal guards manager-only actions
```

## Forecast Flow

```
Manual trigger or APScheduler fires
  → /api/predict/generate
  → Queries active ingredients for restaurant
  → run_forecast_job() per ingredient (PyMC Bayesian model)
    → Reads sale_data × recipe for historical demand
    → Returns mean + 95th/5th percentile per day
  → Results saved to predict table (prediction_type=1: daily, 2: summary)
  → PredictSet row records model version + run timestamp
  → Frontend polls /api/predict/report for latest forecast
```

## Database Schema (12 migrations)

**Core tables:**
- `user` — admin accounts with `restaurant_id` foreign key
- `restaurant_info` — name, package, prediction schedule settings
- `ingredient` — stock items with decimal quantities
- `ingredient_history` — full audit log of every stock change
- `menu` — dish catalog with price and type
- `recipe` — many-to-many menu ↔ ingredient with amounts
- `sale_data` — timestamped sale records (menu_id + amount)
- `staff` — kitchen/service staff with role and PIN
- `predict` — daily forecast rows (type 1) + summaries (type 2)
- `predict_set` — one row per forecast run (model version + timestamp)

## Development

```bash
# Backend (port 8001)
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# Frontend (port 3000)
cd Frontend/munchboxui
npm install && npm run dev

# OCR pipeline
cd ../../Intake/Munchbox
pip install -r requirements.txt
python main.py
```

### Environment Variables

**Backend (`backend/.env`):**
```
DATABASE_URL=mysql+pymysql://user:pass@localhost:port/munchbox
MUNCHBOX_DB_CONNECTION=mysql+pymysql://user:pass@localhost:port/munchbox
MUNCHBOX_DEVICE=LOCAL
JWT_SECRET=
```

**Intake (`intake/.env`):**
```
DATABASE_URL=mysql+pymysql://user:pass@localhost:port/munchbox
INTAKE_API_KEY=
```

**Frontend (`Frontend/munchboxui/.env.local`):**
```
NEXT_PUBLIC_API_URL=http://localhost:port
```

## Production

- **Domain:** munchbox.live (www redirect enforced)
- **Deploy:** `docker compose -f docker-compose.prod.yml up -d`
- **TLS:** Let's Encrypt via Nginx (`/etc/letsencrypt` bind mount)
- **Timezone:** Asia/Bangkok (set in all containers + OS)

**Rebuild and redeploy:**
```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --force-recreate
```

## Key Conventions

- **Auth:** `decode_token` Depends on every protected route; `restaurantId` from JWT scopes all queries
- **DB:** SQLAlchemy ORM with `SessionLocal`; raw SQL only in complex forecast accuracy queries
- **Soft delete:** `is_active = 0` on ingredient and menu — never hard-delete
- **Forecaster bridge:** `services/forecaster.py` uses `importlib` to load the dashed-filename Bayesian script
- **Timezone:** All datetimes stored UTC; scheduler and display convert to Asia/Bangkok
- **Intake auth:** API key via `X-API-Key` header (`auth.py` in intake service)
- **Rate limiting:** Nginx limits `/api/*` to 30 req/min, general to 60 req/min per IP
