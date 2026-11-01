# Zero-to-Launch Boilerplate

A production-minded full-stack starter with authentication already wired end to end.

| Layer    | Stack                                                                 |
| -------- | --------------------------------------------------------------------- |
| Backend  | FastAPI, SQLAlchemy 2.0, Pydantic v2, PyJWT, bcrypt                   |
| Database | SQLite by default, PostgreSQL by changing one env var                 |
| Frontend | Vite, React 19, React Router, Tailwind CSS v4 (dark mode), Axios, sonner, lucide-react |
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
alembic upgrade head               # create/upgrade the database schema
uvicorn app.main:app --reload
```

The API is now on <http://localhost:8000>. The app and Alembic both load the project-root `.env`
automatically (real environment variables take precedence).

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
        Mem[("Access token<br/>in memory only")]
        Jar[("Refresh token<br/>HttpOnly cookie")]
        UI <--> Mem
    end

    subgraph Backend["FastAPI (uvicorn :8000)"]
        R["api/auth.py<br/>/register /login /refresh<br/>/logout /me /change-password"]
        AD["api/admin.py<br/>require_role(admin)"]
        W["api/ws.py<br/>/api/ws"]
        D["api/deps.py<br/>get_db · get_current_user<br/>require_role"]
        S["core/security.py<br/>bcrypt · PyJWT"]
        M["models + schemas<br/>SQLAlchemy · Pydantic"]
        R --> D --> S
        AD --> D
        W --> D
        R --> M
    end

    DB[("SQLite<br/>or PostgreSQL")]
    A["Alembic<br/>migrations"]

    UI -- "Axios + Bearer token<br/>(CORS: localhost, credentials)" --> R
    UI -- "useWebSocket<br/>(token in first message)" --> W
    Jar -. "sent only to /api/auth/*" .-> R
    M --> DB
    A -- "alembic upgrade head" --> DB
```

### Request flow

1. **Register:** the React form validates input, then sends `POST /api/auth/register` (JSON).
   The backend hashes the password with bcrypt and returns a `UserResponse`. A duplicate email returns **409**.
2. **Login:** sends `POST /api/auth/login` with `URLSearchParams` (`username`, `password`), the OAuth2 password form.
   The backend returns a 15-minute **access token** in JSON and sets a 7-day **refresh token** cookie.
3. **Authenticated calls:** an Axios interceptor adds `Authorization: Bearer <access token>`.
   `get_current_user` decodes the JWT and loads the user.
4. **Silent refresh:** if any call returns **401**, the interceptor calls `POST /api/auth/refresh`
   once, even when several requests fail together. It stores the new access token and retries the
   original request. If the refresh itself fails, the session is cleared and protected routes redirect to `/login`.
5. **Page load:** `AuthContext` calls `/api/auth/refresh` before rendering, so a reload or a new tab
   restores the session without asking for the password.
6. **Logout:** `POST /api/auth/logout` clears the cookie on the server response, and the in-memory token is dropped.

### Token and session model

| Token   | Lifetime | Where it lives                                   | Readable by JS? |
| ------- | -------- | ------------------------------------------------ | --------------- |
| Access  | 15 min   | JS module memory (`src/lib/axios.js`)            | Yes, but never persisted |
| Refresh | 7 days   | Cookie: `HttpOnly; Secure; SameSite=Lax; Path=/api/auth` | **No**          |

- **XSS:** injected scripts cannot read the refresh token, and the access token is never stored
  anywhere persistent.
- **CSRF:** `SameSite=Lax` stops cross-site POSTs from carrying the cookie, and CORS only allows localhost
  or the origins in `CORS_ORIGINS`. `/refresh` returns a token in the response body, which other
  origins cannot read.
- **Rotation:** every successful `/refresh` issues a fresh refresh cookie, so an active user stays signed in indefinitely.
  A user who is idle for 7 days must log in again.
- **Limitation:** refresh tokens are stateless JWTs. Logout deletes the browser's cookie, but a
  refresh token that was already stolen stays valid until it expires. If you need server-side revocation
  ("log out everywhere"), store each token's `jti` in a table and check it in `/refresh`.
- **Same-site requirement:** the SPA and API must be on the same site for the cookie to be sent,
  for example `localhost:5173` with `localhost:8000`. Mixing `localhost` and `127.0.0.1` will not work.
  In production, serve both under one domain (e.g. `app.example.com` + `api.example.com`).

### Roles (RBAC)

Every user has a `role` column (`"user"` by default, `Role` enum in `app/models/user.py`).
`GET /api/auth/me` returns it, and `PUT /api/auth/me` rejects any attempt to set it (`422`).
Guard routes with `require_role` from `app/api/deps.py`:

```python
from app.api.deps import AdminUser, require_role
from app.models.user import Role

# Whole router: every route needs admin (see app/api/admin.py)
router = APIRouter(prefix="/admin", dependencies=[Depends(require_role(Role.ADMIN))])

# Single route, with the user injected
@router.delete("/posts/{post_id}")
def delete_post(post_id: int, admin: AdminUser): ...

# Any of several roles
@router.get("/reports")
def reports(user: Annotated[User, Depends(require_role("moderator", Role.ADMIN))]): ...
```

Unauthenticated requests get `401`; authenticated users without the role get `403`.
Promote a user from the command line (from `backend/`):

```bash
python -m app.cli set-role you@example.com admin
# Docker: docker compose exec backend python -m app.cli set-role you@example.com admin
```

### Realtime (WebSockets)

`/api/ws` (in `app/api/ws.py`) speaks JSON messages typed in `app/schemas/ws.py`:

| Direction | Message | Meaning |
| --------- | ------- | ------- |
| client → server | `{"type":"auth","token":"<access token>"}` | Must be the first message, within 10 s |
| server → client | `{"type":"connected","user":{id,email,role}}` | Authenticated |
| client → server | `{"type":"ping"}` | Server answers `{"type":"pong","server_time":...}` |
| client → server | `{"type":"echo","data":...}` | Server echoes `data` back |
| server → client | `{"type":"error","detail":...}` | Malformed message (connection stays open) |

A missing, invalid, or expired token closes the socket with code **4401**. The token goes in a
message, not in `?token=` in the URL, because servers and proxies write URLs to their access logs.

On the frontend, `useWebSocket()` (`src/lib/useWebSocket.js`) manages the connection. It sends the
in-memory access token and pings every 25 s. Dropped connections are retried with exponential
backoff (1 s up to 30 s, with jitter), and the hook reconnects immediately when the browser comes
back online. A `4401` close triggers one token refresh before reconnecting. The Navbar dot shows
the status: green means live, amber means connecting, red means offline.

```jsx
const { status, lastMessage, send } = useWebSocket({ onMessage: (msg) => console.log(msg) })
send({ type: 'echo', data: 'hello' })
```

The socket stays open after the access token it authenticated with expires. If an action needs fresh
authorization, check it per message.

### Directory structure

```
.
├── .cursor/rules/stack.mdc         # AI coding rules for this stack
├── docker-compose.yml              # backend, frontend, optional `db` (postgres profile)
├── .env.example                    # copy to .env (never commit .env)
├── backend/
│   ├── Dockerfile                  # runs `alembic upgrade head` before uvicorn
│   ├── requirements.txt            # runtime deps
│   ├── requirements-dev.txt        # + pytest, httpx2
│   ├── alembic.ini                 # Alembic config (no DB URL; see env.py)
│   ├── alembic/
│   │   ├── env.py                  # uses Base.metadata + DATABASE_URL from app.core.config
│   │   └── versions/               # migration scripts
│   ├── app/
│   │   ├── main.py                 # FastAPI app, CORS, routers
│   │   ├── cli.py                  # `python -m app.cli set-role <email> <role>`
│   │   ├── api/
│   │   │   ├── auth.py             # /register, /login, /refresh, /logout, /me, /change-password
│   │   │   ├── admin.py            # example admin-only router (require_role)
│   │   │   ├── ws.py               # authenticated WebSocket endpoint /api/ws
│   │   │   └── deps.py             # DB session, current user, require_role
│   │   ├── core/
│   │   │   ├── config.py           # env-driven settings (+ loads .env)
│   │   │   └── security.py         # bcrypt hashing, access/refresh JWTs
│   │   ├── db/
│   │   │   ├── base.py             # DeclarativeBase
│   │   │   └── session.py          # engine (SQLite/Postgres), SessionLocal, get_db
│   │   ├── models/user.py          # User ORM model + Role enum
│   │   └── schemas/                # user, token, and WebSocket message models
│   └── tests/                      # pytest: auth, cookies, CORS, profile, RBAC, WebSocket, migrations
└── frontend/
    ├── Dockerfile                  # node build stage -> nginx runtime
    ├── nginx.conf                  # SPA fallback routing
    ├── tailwind.config.js          # theme (loaded via @config in index.css)
    ├── postcss.config.js           # @tailwindcss/postcss
    └── src/
        ├── App.jsx                 # routes
        ├── lib/
        │   ├── axios.js            # API client, in-memory token, silent refresh + retry
        │   ├── apiError.js         # FastAPI error -> readable message
        │   ├── validation.js       # client-side form rules
        │   ├── theme.js            # theme storage + <html> class helpers
        │   └── useWebSocket.js     # authenticated socket with auto-reconnect
        ├── context/
        │   ├── AuthContext.jsx     # session restore, login / register / logout, profile + password
        │   └── ThemeContext.jsx    # light / dark / system, persisted in localStorage
        ├── components/
        │   ├── ui/                 # Button, Input, Modal, Alert (+ index.js barrel)
        │   ├── AppLayout.jsx       # Sidebar + Navbar + <main><Outlet/></main>
        │   ├── Sidebar.jsx         # fixed column on desktop, slide-over drawer on mobile
        │   ├── Navbar.jsx          # hamburger, live status, theme toggle, user + logout
        │   ├── ConnectionStatus.jsx # WebSocket status dot
        │   ├── ThemeToggle.jsx     # Sun/Moon menu: Light, Dark, System
        │   ├── ProtectedRoute.jsx  # redirects to /login without a token
        │   └── AuthLayout.jsx      # centered card for login/register
        └── pages/                  # Login, Register, Dashboard, Settings, Preview
```

### Routes

| Path          | Access    | Purpose                                     |
| ------------- | --------- | ------------------------------------------- |
| `/login`      | public    | Sign in                                     |
| `/register`   | public    | Create account (auto-signs in on success)   |
| `/dashboard`  | protected | User info, inside `AppLayout`               |
| `/settings`   | protected | Update profile (name, email) and change password |
| `/preview`    | public    | UI component gallery, inside `AppLayout` (`/components` aliases here; shows "Sign in" when logged out) |

`AppLayout` is a layout route: put new pages under it in `App.jsx`, wrap protected ones in
`<ProtectedRoute />`, and add them to `NAV_ITEMS` in `Sidebar.jsx`.

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

### Dark mode

- Tailwind v4 uses the **class strategy**: `@custom-variant dark (&:where(.dark, .dark *));` in
  `src/index.css`. Any `dark:` utility applies when `<html>` has the `dark` class.
- `ThemeContext` stores `light`, `dark`, or `system` in `localStorage` (`theme` key). It follows the
  OS setting live when set to `system`.
- A tiny inline script in `index.html` applies the saved theme **before first paint**, so dark mode
  doesn't flash white on load.

```jsx
const { theme, resolvedTheme, setTheme } = useTheme()  // theme: user choice; resolvedTheme: 'light' | 'dark'
```

### Toasts

`<Toaster />` (sonner) is mounted once in `App.jsx` and follows the resolved theme. Call it from anywhere:

```jsx
import { toast } from 'sonner'

toast.success('Saved')
toast.error('Incorrect email or password.', { id: 'login-error' })  // same id replaces instead of stacking
toast('Moved to trash', { action: { label: 'Undo', onClick: restore } })
toast.promise(save(), { loading: 'Saving…', success: 'Saved', error: 'Failed' })
```

Login and register failures, and a session that expires mid-use, are reported as toasts.
Field-level validation messages stay inline under each input.

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
   - Docker: `docker compose --profile postgres up --build`. This starts the `db` service; the backend waits
     for it to be healthy, then runs `alembic upgrade head` automatically.
   - Manual: `pip install -r requirements.txt`, then `alembic upgrade head`, then restart uvicorn.

The same migration files run on SQLite and Postgres. Existing SQLite *data* is **not** copied over.

---

## 6. Database migrations (Alembic)

The schema is owned by Alembic; the app never creates tables itself. Run commands from `backend/`:

```bash
alembic upgrade head                                  # apply all pending migrations
alembic revision --autogenerate -m "add posts table"  # after editing/adding models
alembic downgrade -1                                  # roll back the last migration
alembic current                                       # show the DB's revision
alembic upgrade head --sql                            # print SQL without running it
```

Workflow for a schema change:

1. Add or edit a model in `app/models/`. New model modules must be imported in `app/models/__init__.py`.
2. Run `alembic revision --autogenerate -m "describe change"` and **review** the generated file in `alembic/versions/`.
3. Run `alembic upgrade head`, then commit the model and the migration together.

After pulling changes that include new migrations (e.g. the `role` column), run `alembic upgrade head`
before starting the server. Otherwise queries fail with "no such column".

`alembic/env.py` reads `DATABASE_URL` through `app.core.config`, which loads `.env`, so Alembic and the
app always target the same database. SQLite uses batch mode so `ALTER` operations work.
The test suite builds its database from the migrations, and `tests/test_migrations.py` fails if
models and migrations drift apart.

**Database created before Alembic was added?** If you ran an earlier version of this template, your
database already has a `users` table but no migration history. Mark it as current once, instead of upgrading:

```bash
alembic stamp head
# Docker: docker compose run --rm backend alembic stamp head
```

---

## 7. API reference

All routes are prefixed with `/api` and return typed Pydantic models.

| Method | Path                 | Input                                   | Returns          |
| ------ | -------------------- | --------------------------------------- | ---------------- |
| POST   | `/api/auth/register` | JSON `{ email, password, full_name? }`  | `UserResponse` (201) |
| POST   | `/api/auth/login`    | Form `username` (email), `password`     | `Token` + sets refresh cookie |
| POST   | `/api/auth/refresh`  | Refresh cookie                          | `Token` + rotates cookie (401 if missing/invalid) |
| POST   | `/api/auth/logout`   | none                                    | `MessageResponse` + clears cookie |
| GET    | `/api/auth/me`       | Header `Authorization: Bearer <token>`  | `UserResponse` (includes `role`) |
| PUT    | `/api/auth/me`       | Bearer + JSON `{ full_name?, email? }` (partial; other fields → 422) | `UserResponse` (409 if email taken) |
| POST   | `/api/auth/change-password` | Bearer + JSON `{ current_password, new_password }` | `MessageResponse` (400 if current password is wrong) |
| GET    | `/api/admin/users`   | Bearer, **admin role**                  | `list[UserResponse]` (403 for non-admins) |
| WS     | `/api/ws`            | First message `{ type: "auth", token }` | See [Realtime](#realtime-websockets) |
| GET    | `/api/health`        | none                                    | `HealthResponse` |

```bash
curl -X POST localhost:8000/api/auth/register -H "Content-Type: application/json" \
  -d '{"email":"me@example.com","password":"supersecret"}'

# -c/-b keep the refresh cookie between calls (use COOKIE_SECURE=false for plain-http curl)
curl -c jar.txt -X POST localhost:8000/api/auth/login \
  -d "username=me@example.com&password=supersecret"
curl -b jar.txt -c jar.txt -X POST localhost:8000/api/auth/refresh
```

---

## 8. Configuration

All settings come from environment variables (see `.env.example`).

| Variable                      | Default                     | Purpose                                   |
| ----------------------------- | --------------------------- | ----------------------------------------- |
| `SECRET_KEY`                  | dev-only placeholder        | JWT signing key                           |
| `ENVIRONMENT`                 | `development`               | `production` enforces a real `SECRET_KEY` |
| `JWT_ALGORITHM`               | `HS256`                     | JWT algorithm                             |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15`                        | Access token lifetime                     |
| `REFRESH_TOKEN_EXPIRE_DAYS`   | `7`                         | Refresh cookie lifetime                   |
| `COOKIE_SECURE`               | `true`                      | `Secure` flag on the refresh cookie (must be true in production; false only for Safari on http://localhost) |
| `REFRESH_COOKIE_NAME`         | `refresh_token`             | Cookie name                               |
| `DATABASE_URL`                | `sqlite:///./data/app.db`   | SQLAlchemy URL (SQLite or Postgres)       |
| `CORS_ORIGINS`                | empty                       | Extra comma-separated allowed origins     |
| `VITE_API_URL`                | `http://localhost:8000`     | API URL used by the frontend              |
| `BACKEND_PORT` / `FRONTEND_PORT` | `8000` / `5173`          | Host ports in Docker                      |

CORS always allows `http(s)://localhost:<any port>` and `127.0.0.1`.

---

## 9. What is never committed

`.gitignore` files at the root, in `backend/`, and in `frontend/` exclude:

- **Secrets:** `.env`, `.env.*` (only `.env.example` is tracked), `*.pem`, `*.key`
- **Local databases:** `*.db`, `sqlite.db`, `*.sqlite3`, `backend/data/`
- **Environments and builds:** `venv/`, `.venv/`, `node_modules/`, `dist/`, `__pycache__/`
