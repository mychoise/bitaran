# Asva Wholesale — backend

REST API for a wholesale distributor: managers plan each salesman's day and
issue van stock; salesmen visit shops on a route, sell (cash or credit),
collect payments, take returns and photos; managers reconcile the day. Shops
log in to see their balance and statement.

NestJS 12 · PostgreSQL · Drizzle ORM · Jest + Supertest. All money is integer
**paisa**; all business dates are **Nepal dates** (Asia/Kathmandu, Gregorian).

- [Requirements](#requirements)
- [Setup](#setup)
- [Environment variables](#environment-variables)
- [Database: migrations and seed](#database-migrations-and-seed)
- [Running](#running)
- [Testing](#testing)
- [Docker](#docker)
- [API conventions](#api-conventions)
- [Security model](#security-model)
- [File storage (Cloudinary)](#file-storage-cloudinary)
- [Known limitations](#known-limitations)

## Requirements

- Node.js 24 or newer
- PostgreSQL 15 or newer (the compose file uses 17)

## Setup

```bash
npm ci
cp .env.example .env        # then edit it: see below
createdb AsvaWholesale       # the app's database
createdb AsvaWholesale_test  # the tests' database; its name must end in _test
npm run db:migrate
npm run seed                 # optional demo data
npm run start:dev
```

The API is then on `http://localhost:3000/api/v1`, and its OpenAPI docs on
`http://localhost:3000/docs`.

## Environment variables

Validated at startup (`src/config/env.validation.ts`); the app refuses to
start and lists every problem if any is wrong. `.env.example` has them all.

| Variable | Default | Notes |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `production` or `test`. In `production` the docs are off. |
| `PORT` | `3000` | |
| `LOG_LEVEL` | `info` (`silent` under test) | pino levels. Authorization and cookie headers are redacted. |
| `DATABASE_URL` | — **required** | `postgres://` or `postgresql://` URL. |
| `TEST_DATABASE_URL` | — | Required when `NODE_ENV=test`; must differ from `DATABASE_URL`. |
| `JWT_SECRET` | — **required** | At least 32 characters. `openssl rand -hex 32`. |
| `JWT_EXPIRY` | `1d` | Access-token lifetime (`ms` format: `12h`, `7d`, …). |
| `CORS_ORIGINS` | empty | Browser origins allowed to call the API, comma-separated, each exactly `scheme://host[:port]`. Empty means no cross-origin access. The mobile app does not need CORS; a web admin app does. |
| `TRUST_PROXY` | `false` | Behind a reverse proxy or load balancer, set the number of hops (e.g. `1`) or the proxies' addresses. Otherwise every client appears to come from the proxy and shares one login rate limit. |
| `STORAGE_DRIVER` | `local` | `cloudinary` (production), `local` (files under `LOCAL_STORAGE_PATH`) or `memory`. |
| `LOCAL_STORAGE_PATH` | `./uploads` | Only for `local`. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | — | Required when `STORAGE_DRIVER=cloudinary`. |
| `PHOTO_EXIF_MAX_SKEW_MINUTES` | `10` | Visit photos whose camera time is further off than this from the server clock are flagged (never rejected). |
| `PHOTO_MAX_DISTANCE_M` | `150` | Visit photos taken further than this from the shop's saved location are flagged. |

**For production**, at least: `NODE_ENV=production`, a strong `JWT_SECRET`,
`STORAGE_DRIVER=cloudinary` with its credentials, `CORS_ORIGINS` if a browser
app calls the API, and `TRUST_PROXY` if it sits behind a proxy.

## Database: migrations and seed

Migrations are SQL files in `drizzle/`, generated from the schema in
`src/database/schema/`.

```bash
npm run db:migrate     # apply pending migrations to DATABASE_URL
npm run db:generate    # after changing the schema: write a new migration
npm run db:studio      # browse the database
```

All migrations so far are already applied to the development database.
`db:migrate` is safe to run again; it applies only what is pending. The test
database is migrated automatically at the start of every test run. From a
build (as in Docker) the same script is `node dist/database/migrate.js`.

```bash
npm run seed
```

Seeds one demo business (owner, manager, two salesmen, a route with three
shops, five products) and prints the logins. It refuses to run if the
database already has a business. Demo passwords: owner `Owner@12345`,
manager `Manager@12345`, salesmen `Salesman@12345`, shops `Shop@12345`
(emails such as `owner@asva.test`, `salesman1@asva.test`, `shop1@asva.test`).
From a build: `node dist/database/seed/run-seed.js`.

## Running

```bash
npm run start:dev      # watch mode
npm run build && npm run start:prod   # compiled, as in production
```

- API base path: `/api/v1`
- Health check (no auth, checks the database): `GET /api/v1/health`
- OpenAPI docs: `GET /docs` (JSON at `/docs-json`), only when
  `NODE_ENV` is not `production`.

## Testing

```bash
npm test               # all unit and e2e tests (needs TEST_DATABASE_URL)
npm run test:cov       # with coverage
npm test -- test/sales # one file
npm run typecheck
npm run lint
npm run format
```

The e2e tests run the real app against the test database, emptying every
table before each test. As a guard, they refuse to touch any database whose
name does not end in `_test`. File storage is always the in-memory driver;
tests never reach Cloudinary or the disk.

Worth knowing about:

- `test/full-day.e2e-spec.ts`: a whole day through the API: plan, start,
  visit, credit and cash sales, a cheque with a photo, a damaged return,
  close, reconcile. Then it checks the shop balance, stock levels and the
  shortage report.
- `test/route-walk.e2e-spec.ts`: calls every registered route (read from the
  OpenAPI document, so new routes are included automatically) as owner,
  manager, salesman, shop and anonymous. It fails if any response contains a
  password hash, if a salesman or shop response contains a cost price, or if
  any route never answers successfully.

## Docker

`Dockerfile` builds a production image; `docker-compose.yml` runs it with
PostgreSQL.

```bash
JWT_SECRET=$(openssl rand -hex 32) docker compose up --build
docker compose run --rm api node dist/database/seed/run-seed.js   # optional
```

- A one-off `migrate` service applies migrations before the API starts.
- The API listens on `localhost:3000` (`API_PORT` to change it). Postgres is
  published only on `127.0.0.1:5433`.
- Compose passes the variables in the table above through from your shell, or
  from a `.env` file next to the compose file. The defaults are
  `NODE_ENV=production` and `STORAGE_DRIVER=local`, with files kept in the
  `uploads` volume.
- The image runs as the unprivileged `node` user, and has a `HEALTHCHECK` on
  `/api/v1/health`.

## API conventions

- **Auth:** `POST /auth/staff/login` or `POST /auth/shop/login` returns an
  access token; send it as `Authorization: Bearer <token>`. Every route needs
  a token unless it is marked public (login, health).
- **Roles:** staff are `owner`, `manager` or `salesman`; shops are a separate
  kind of user. Salesmen see only their own plans, sales, payments, expenses
  and reports. Shops see only themselves.
- **Errors** always look like
  `{ "error": { "code": "SALE_NOT_FOUND", "message": "…", "details": [] } }`.
  `code` is stable and meant for clients to branch on.
- **Money** is integer paisa (1 rupee = 100 paisa), never floats.
- **Dates** are `YYYY-MM-DD` Nepal dates; timestamps are ISO 8601 in UTC.
- **Idempotency:** `POST /sales` and `POST /payments` require an
  `Idempotency-Key` header. Retrying with the same key returns the original
  result (`200` with `Idempotent-Replayed: true`) instead of a duplicate.
- **Lists** take `page` and `limit` (max 100) and return
  `{ data, page, limit, total }`.
- **Uploads** are `multipart/form-data`. Only JPEG, PNG and WebP are
  accepted, judged by content, up to 10 MB each.

## Security model

- **Tenancy:** every business-owned table carries `business_id`. Every query
  filters it by the business in the caller's token, directly or through a
  parent row checked in the same request. Another business's IDs behave as
  if they did not exist (`404`).
- **Tokens:** the auth guard reloads the user (or shop) from the database on
  every request. A deactivated user, shop or business is locked out at once,
  and a token cannot claim a different role or business than the database
  has.
- **Secrets:** password hashes (argon2) are never returned. Cost prices are
  shown only to owners and managers. Both rules are enforced by the
  route-walk test.
- **Rate limits:** login is limited to 5 attempts a minute per IP, per route.
  Upload routes (payments, expenses, visit photos) are limited to 20 a minute
  per user, per route. Exceeding a limit returns `429 TOO_MANY_REQUESTS`.
- **Request limits:** JSON and form bodies are capped at 256 KB (larger ones
  return `413`). Multipart uploads are limited to 10 MB per image, with
  limits on how many files and text fields one request can carry.
- **HTTP:** helmet's security headers are on, and CORS is an explicit
  allow-list (`CORS_ORIGINS`). The OpenAPI docs are not served in production.
- **Consistency:** every write that touches more than one table runs in one
  transaction, with row locks in a fixed order (plan, shop, sale, products,
  invoice counter). Uploaded files cannot join a transaction, so they are
  deleted again if the database write fails.

## File storage (Cloudinary)

Images (visit photos, payment images, expense receipts, PAN cards, product
images, logos) go through `StorageService`. `STORAGE_DRIVER` picks the driver:

| Driver       | Use                                                            |
| ------------ | -------------------------------------------------------------- |
| `cloudinary` | Production. Needs `CLOUDINARY_CLOUD_NAME`, `_API_KEY`, `_API_SECRET`. |
| `local`      | Development without Cloudinary. Files under `LOCAL_STORAGE_PATH`. |
| `memory`     | Tests (always; the test app forces it). Never touches disk or network. |

- Everything is uploaded to Cloudinary as `type: authenticated`, so nothing
  is publicly reachable. These images include cheques, PAN cards and payment
  screenshots: never change this to a public `upload` type.
- The database stores only the key, `{businessId}/{category}/{uuid}`, never a
  URL. Clients fetch images from `GET /api/v1/files/{key}`. That route checks
  the caller is staff of the business that owns the key, and streams the file
  through the backend. Cloudinary signed URLs do not expire, so they are
  never handed out.
- Check your credentials against the real account. This uploads, reads back
  and deletes one small test image:

  ```bash
  npm run storage:verify-cloudinary
  ```

> **Watch your Cloudinary usage.** Free plans have limits on storage,
> bandwidth and monthly transformations/credits. Every image view is fetched
> from Cloudinary by the server, so bandwidth grows with how often staff open
> images, not just with uploads. Check the usage page in the Cloudinary
> console regularly. Upgrade, or prune old images, before you reach the
> limit; past it, uploads and reads start failing.

## Known limitations

Deliberate gaps, or decisions still open:

- **No refresh tokens:** only access tokens (`JWT_EXPIRY`). Refresh tokens
  need a table, which does not exist yet. A password reset does not revoke
  tokens already issued; they keep working until they expire. (Deactivating
  a user does take effect at once.)
- **Missing index:** the reports on payments by business and time scan the
  payments table. Recommended:
  `CREATE INDEX idx_payments_business_received ON payments (business_id, received_at)`.
  Measured at 27k payments: 3–4 ms per query without the index, 1–2 ms with
  it. The gap grows with the table. Not added yet.
- **Cartons** are converted to pieces with the product's *current*
  `units_per_carton`; stock lines and sale lines do not store their piece
  count.
- **Shortage values** in analytics use current prices, not the prices on the
  day.
- **Expenses** are edited in place, with no history of earlier values.
- **Payments** do not record who confirmed or bounced them, or when.
- **Cancelled sales:** a manager can still cancel a sale after its day has
  been reconciled.
- **Duplicate images** are recognised only when byte-for-byte identical, and
  only for payment images and visit photos, not expense receipts. The check
  is across all businesses. Its only effect is that an identical file cannot
  be uploaded twice.
- **Months** in summaries are Gregorian calendar months, not Bikram Sambat.
- **Cloudinary:** `npm run storage:verify-cloudinary` has not yet been run
  against the production Cloudinary account.
