# Self-Hosted Platform

This repository can run as a self-hosted content platform with Docker Compose.
It keeps the original static gallery assets, and adds a PostgreSQL-backed API,
an admin page, CRUD for categories/templates/cases, and API keys for external
projects.

## Quick Start

Copy the config file and change the admin password before exposing the service.

```bash
cp config/app.config.example.json config/app.config.json
```

Start the stack:

```bash
docker compose up --build
```

URLs:

- Website: `http://localhost:8080`
- Admin: `http://localhost:8080/admin.html`
- API health: `http://localhost:8080/api/health`

On startup, the API container runs:

```bash
node server/migrate.js
node server/seed.js
node server/index.js
```

The seed step imports:

- `data/cases.json`
- `data/style-library.json`

## Admin Config

Admin login is configured by `config/app.config.json`:

```json
{
  "server": {
    "port": 5003,
    "publicApiRequireKey": false
  },
  "admin": {
    "username": "admin",
    "password": "change-me",
    "sessionSecret": "replace-with-a-long-random-secret"
  }
}
```

Environment variables override the file:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_PASSWORD_HASH`
- `ADMIN_SESSION_SECRET`
- `PUBLIC_API_REQUIRE_KEY`
- `DATABASE_URL`

If `PUBLIC_API_REQUIRE_KEY=true`, public API calls must include:

```http
X-API-Key: agi_xxx
```

## Public API

Read endpoints:

```http
GET /api/v1/categories
GET /api/v1/templates
GET /api/v1/templates/:id
GET /api/v1/cases
GET /api/v1/cases/:id
GET /api/v1/search?q=poster&category=Posters%20%26%20Typography&page=1&pageSize=20
GET /api/v1/site-data
GET /api/v1/style-library
```

Supported case filters:

- `q` or `search`
- `category`
- `style`
- `scene`
- `featured=true`
- `page`
- `pageSize`

## Admin API

Admin login uses an HTTP-only cookie.

```http
POST /api/admin/auth/login
POST /api/admin/auth/logout
GET /api/admin/auth/me
```

CRUD endpoints:

```http
GET    /api/admin/categories
POST   /api/admin/categories
PUT    /api/admin/categories/:value
DELETE /api/admin/categories/:value

GET    /api/admin/templates
POST   /api/admin/templates
PUT    /api/admin/templates/:id
DELETE /api/admin/templates/:id

GET    /api/admin/cases
POST   /api/admin/cases
PUT    /api/admin/cases/:id
DELETE /api/admin/cases/:id
```

API key management:

```http
GET    /api/admin/api-keys
POST   /api/admin/api-keys
DELETE /api/admin/api-keys/:id
```

The raw API key is returned only once when it is created.
