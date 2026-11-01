# Zero-to-Launch Boilerplate

A production-minded full-stack starter with authentication already wired end to end.

| Layer    | Stack                                                                 |
| -------- | --------------------------------------------------------------------- |
| Backend  | FastAPI, SQLAlchemy 2.0, Pydantic v2, PyJWT, bcrypt                   |
| Database | SQLite by default, PostgreSQL by changing one env var                 |
| Frontend | Vite, React 19, React Router, Tailwind CSS v4, Axios, lucide-react    |
| Ops      | Docker Compose (backend + nginx-served frontend + optional Postgres)  |

---

## 1. One-command setup (Docker Compose)

Requires [Docker](https://docs.docker.com/get-docker/) with Compose v2.20+.

```bash
cp .env.example .env && docker compose up --build
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env; docker compose up --build
```

| URL                                | What                              |
| ---------------------------------- | --------------------------------- |
| <http://localhost:5173>            | App (register, login, dashboard)  |
| <http://localhost:5173/preview>    | UI component gallery              |
| <http://localhost:8000/docs>       | Interactive API docs (Swagger)    |

Stop with `Ctrl+C`, or `docker compose down`. Add `-v` to also wipe the database volume.

> **Before deploying**, set `SECRET_KEY` in `.env` to a long random value:
> `python -c "import secrets; print(secrets.token_urlsafe(64))"`.
> The API refuses to start with the default key when `ENVIRONMENT=production`.

---

## 2. Manual local setup (Python venv + Vite)

Requirements: **Python 3.11+** and **Node 20.19+ or 22.12+**.

```bash
cp .env.example .env
```

### Backend (terminal 1)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --env-file ../.env
```

The API is now on <http://localhost:8000>. Tables are created automatically on startup.

Run the tests:

```bash
pytest
```

### Frontend (terminal 2)

```bash
cd frontend
npm install
npm run dev                        # http://localhost:5173
```

Other scripts: `npm run build`, `npm run preview`, `npm run lint`.
Set `VITE_API_URL` if the API is not at `http://localhost:8000`.

---

## 3. Architecture

```mermaid
flowchart LR
    subgraph Browser
        UI["React SPA<br/>(Vite + Tailwind)"]
        Mem[("JWT in memory<br/>(never in storage)")]
        UI <--> Mem
    end

    subgraph Backend["FastAPI (uvicorn :8000)"]
        R["api/auth.py<br/>/register /login /me"]
        D["api/deps.py<br/>get_db · get_current_user"]
        S["core/security.py<br/>bcrypt · PyJWT"]
        M["models + schemas<br/>SQLAlchemy · Pydantic"]
        R --> D --> S
        R --> M
    end

    DB[("SQLite<br/>or PostgreSQL")]

    UI -- "Axios + Bearer token<br/>(CORS: localhost)" --> R
    M --> DB
```

### Request flow

1. **Register:** the React form validates input, then sends `POST /api/auth/register` (JSON).
   The backend hashes the password with bcrypt and returns a `UserResponse`. A duplicate email returns **409**.
2. **Login:** sends `POST /api/auth/login` with `URLSearchParams` (`username`, `password`), the OAuth2 password form.
   The backend returns a `Token` (signed HS256 JWT plus `expires_in`).
3. **Authenticated calls:** an Axios interceptor adds `Authorization: Bearer <token>`.
   `get_current_user` decodes the JWT and loads the user. A **401** clears the client session.

### Frontend auth model

- The JWT lives **only in memory**: a module variable in `src/lib/axios.js`, mirrored in
  React state by `AuthContext`. It is never written to `localStorage`, `sessionStorage`, or
  cookies, so injected scripts cannot read it from storage.
- Consequence: **refreshing the page signs you out.** This is intentional. Adding a refresh-token
  flow with an HttpOnly cookie is the standard next step if you need persistent sessions.
- The session also ends automatically when the token's `expires_in` elapses.

### Directory structure

```
.
├── .cursor/rules/stack.mdc         # AI coding rules for this stack
├── docker-compose.yml              # backend, frontend, optional `db` (postgres profile)
├── .env.example                    # copy to .env (never commit .env)
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt            # runtime deps
│   ├── requirements-dev.txt        # + pytest, httpx2
│   ├── app/
│   │   ├── main.py                 # FastAPI app, CORS, routers, lifespan (create tables)
│   │   ├── api/
│   │   │   ├── auth.py             # /register, /login, /me
│   │   │   └── deps.py             # DB session + current-user dependencies
│   │   ├── core/
│   │   │   ├── config.py           # env-driven settings
│   │   │   └── security.py         # bcrypt hashing, JWT encode/decode
│   │   ├── db/
│   │   │   ├── base.py             # DeclarativeBase
│   │   │   └── session.py          # engine (SQLite/Postgres), SessionLocal, get_db
│   │   ├── models/user.py          # User ORM model
│   │   └── schemas/                # UserCreate, UserResponse, Token
│   └── tests/                      # pytest suite (auth, JWT, CORS)
└── frontend/
    ├── Dockerfile                  # node build stage -> nginx runtime
    ├── nginx.conf                  # SPA fallback routing
    ├── tailwind.config.js          # theme (loaded via @config in index.css)
    ├── postcss.config.js           # @tailwindcss/postcss
    └── src/
        ├── App.jsx                 # routes
        ├── lib/
        │   ├── axios.js            # API client, in-memory token, interceptors
        │   ├── apiError.js         # FastAPI error -> readable message
        │   └── validation.js       # client-side form rules
        ├── context/AuthContext.jsx # login / register / logout / fetchCurrentUser
        ├── components/
        │   ├── ui/                 # Button, Input, Modal, Alert (+ index.js barrel)
        │   ├── ProtectedRoute.jsx  # redirects to /login without a token
        │   ├── Navbar.jsx
        │   └── AuthLayout.jsx
        └── pages/                  # Login, Register, Dashboard, Preview
```

### Routes

| Path          | Access    | Purpose                                     |
| ------------- | --------- | ------------------------------------------- |
| `/login`      | public    | Sign in                                     |
| `/register`   | public    | Create account (auto-signs in on success)   |
| `/dashboard`  | protected | User info + navbar with logout              |
| `/preview`    | public    | UI component gallery (`/components` aliases here) |

---

## 4. UI component library

Import from `src/components/ui`:

```jsx
import { Alert, Button, Input, Modal } from '../components/ui'

<Button variant="primary | secondary | danger | outline" size="sm | md | lg"
        icon={Plus} loading loadingText="Saving…" fullWidth>Save</Button>

<Input label="Email" type="email" required hint="We never share it." error={errors.email} />

<Alert variant="success | error | warning" title="Optional title" onDismiss={() => {}}>
  Message
</Alert>

<Modal open={open} onClose={() => setOpen(false)} title="Delete project?" size="sm | md | lg"
       footer={<Button variant="danger">Delete</Button>}>
  Body content
</Modal>
```

`Modal` renders in a portal, closes on backdrop click, the × button, or `Escape`, traps focus, and
restores focus on close. Open `/preview` to see every variant and state.

---

## 5. Switching from SQLite to PostgreSQL

The backend only reads `DATABASE_URL`, so switching databases is a configuration change, not a code change.

1. **Install the driver.** Uncomment the line in `backend/requirements.txt`:

   ```text
   psycopg[binary]>=3.2
   ```

2. **Point `DATABASE_URL` at Postgres** in `.env`. The `postgresql+psycopg://` scheme is required:

   ```bash
   # With the bundled Docker Postgres (hostname is the compose service name `db`)
   DATABASE_URL=postgresql+psycopg://app:app@db:5432/app

   # With Postgres running on your machine (manual setup)
   DATABASE_URL=postgresql+psycopg://app:app@localhost:5432/app

   # Managed (Neon, Supabase, RDS, Tiger Cloud, ...): usually requires SSL
   DATABASE_URL=postgresql+psycopg://user:pass@host:5432/dbname?sslmode=require
   ```

   The user, password, and database name for the bundled container come from
   `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` in `.env`.

3. **Start it.**
   - Docker: `docker compose --profile postgres up --build` (starts the `db` service; the backend waits for it to be healthy).
   - Manual: `pip install -r requirements.txt`, then restart uvicorn.

Tables are created on startup via `Base.metadata.create_all`. Existing SQLite data is **not**
migrated. For schema changes in a real project, add [Alembic](https://alembic.sqlalchemy.org/).

---

## 6. API reference

All routes are prefixed with `/api` and return typed Pydantic models.

| Method | Path                 | Body                                    | Returns          |
| ------ | -------------------- | --------------------------------------- | ---------------- |
| POST   | `/api/auth/register` | JSON `{ email, password, full_name? }`  | `UserResponse` (201) |
| POST   | `/api/auth/login`    | Form `username` (email), `password`     | `Token`          |
| GET    | `/api/auth/me`       | Header `Authorization: Bearer <token>`  | `UserResponse`   |
| GET    | `/api/health`        | none                                    | `HealthResponse` |

```bash
curl -X POST localhost:8000/api/auth/register -H "Content-Type: application/json" \
  -d '{"email":"me@example.com","password":"supersecret"}'

curl -X POST localhost:8000/api/auth/login \
  -d "username=me@example.com&password=supersecret"
```

---

## 7. Configuration

All settings come from environment variables (see `.env.example`).

| Variable                      | Default                     | Purpose                                   |
| ----------------------------- | --------------------------- | ----------------------------------------- |
| `SECRET_KEY`                  | dev-only placeholder        | JWT signing key                           |
| `ENVIRONMENT`                 | `development`               | `production` enforces a real `SECRET_KEY` |
| `JWT_ALGORITHM`               | `HS256`                     | JWT algorithm                             |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60`                        | Token lifetime                            |
| `DATABASE_URL`                | `sqlite:///./data/app.db`   | SQLAlchemy URL (SQLite or Postgres)       |
| `CORS_ORIGINS`                | empty                       | Extra comma-separated allowed origins     |
| `VITE_API_URL`                | `http://localhost:8000`     | API URL used by the frontend              |
| `BACKEND_PORT` / `FRONTEND_PORT` | `8000` / `5173`          | Host ports in Docker                      |

CORS always allows `http(s)://localhost:<any port>` and `127.0.0.1`.

---

## 8. What is never committed

`.gitignore` files at the root, in `backend/`, and in `frontend/` exclude:

- **Secrets:** `.env`, `.env.*` (only `.env.example` is tracked), `*.pem`, `*.key`
- **Local databases:** `*.db`, `sqlite.db`, `*.sqlite3`, `backend/data/`
- **Environments and builds:** `venv/`, `.venv/`, `node_modules/`, `dist/`, `__pycache__/`
