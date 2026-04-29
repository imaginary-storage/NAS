# Auth hardening — better authentication setup

## Context

Today's auth model:

- PAM-based login (`POST /login`), maps to a real OS user.
- Sessions are flat files under `./sessions/session_<hex64>`, mode `0644`,
  no expiry recorded, no last-access tracking, no rotation.
- Cookie: `active_session=<token>/<username>; HttpOnly; Path=/; SameSite=Lax`
  — no `Secure` flag, no `Max-Age`, no CSRF protection on state-changing
  routes.
- `/login` has no rate limiting / lockout. `fork_and_run()` drops privileges
  per request, which ties auth tightly to local system users.
- No second factor, no device binding, no audit trail.

Constraint: the **fork+setuid model is fundamental** to this app — every
authenticated handler runs as the OS user. Any auth replacement must still
resolve to a local system user (something `getpwnam()` recognises) so that
`setuid()`/`setgid()` work. That rules out a pure SaaS-style IDP unless we
keep a 1:1 mapping to `/etc/passwd`.

This plan ranks options by disruption and recommends a phased path.

---

## Option 1 — Harden the existing PAM + file-session design (recommended v1)

Cheapest, biggest immediate win. No architectural change. Touches
`src/auth/session.c`, `src/auth/auth.c`, the login handler, and a small
amount of `lib/chttp.c` for cookie attributes.

### 1.1 Session file format

Today the session file holds just the username (or similar). Extend it to a
small key=value record:

```
username=alice
created_at=1735689600
last_access=1735690000
expires_at=1735776000
client_ip=10.0.0.4
user_agent_hash=<sha256-12hex>
csrf_secret=<hex32>
```

- Mode `0600` (not `0644`). `sessions/` dir already 0700.
- Atomic write (temp + rename) on update so concurrent requests don't see
  partial files.
- `last_access` updated lazily — once per N seconds per session — to avoid a
  write on every request.

### 1.2 Expiry + sliding window

- `expires_at = created_at + ABSOLUTE_TTL` (e.g. 7 days hard cap).
- On each successful auth, if `now + IDLE_TTL < expires_at`, do nothing;
  otherwise extend `expires_at = min(now + IDLE_TTL, created_at + ABSOLUTE_TTL)`.
  Idle TTL e.g. 24 h, absolute cap e.g. 7 d.
- Expired sessions: file deleted on access, request rejected with 401.
- Background sweep on server start (and once per hour) to GC expired files.

### 1.3 Cookie attributes

Today: `active_session=…; HttpOnly; Path=/; SameSite=Lax`.

Add:

- `Secure` — set whenever the server is built/run with `TLS=1`.
- `Max-Age=<absolute_ttl_seconds>` — so browsers drop the cookie when the
  session would have expired anyway.
- `SameSite=Strict` for the per-user cookies; keep `Lax` only if we ever
  need cross-site GETs (we don't, currently).

Same applies to per-user `session_<user>=…` cookies from the multi-session
plan.

### 1.4 CSRF protection

Cookies + `SameSite=Lax/Strict` cover most cases, but defence-in-depth on
state-changing routes (POST/PUT/DELETE) is cheap:

- On login, generate `csrf_secret` per session, return it in the JSON
  response body (not a cookie).
- Frontend stores it in memory (Redux `authSlice`) and sends it as
  `X-CSRF-Token` header on every non-GET request.
- Server-side: in `DEFINE_AUTH_ROUTE` wrapper, after session lookup, for
  non-GET methods compare header against `csrf_secret` from the session
  file. Mismatch → 403.
- GETs are exempt (read-only, no state change).

### 1.5 Login rate limiting

In-memory token bucket keyed by `(client_ip, username)`:

- 5 failed attempts → 30 s lockout, exponentially backing off to 15 min.
- Reset on successful login.
- A background tick decays counters; restart wipes state (acceptable).
- This lives in the **parent** process (pre-fork) so it's shared across
  requests.

### 1.6 Session ID rotation

- Rotate the session token on **privilege change** events: successful
  login (already a new token), 2FA upgrade (§ Option 2), and password
  change. The old file is deleted, a new one written, response sets the
  new cookie.
- This kills session-fixation attacks.

### 1.7 Audit log

- Append-only file `~/.imaginary/auth.log` per user (root-readable copy at
  `/var/log/imaginary/auth.log`).
- Records: login success/fail, session create/destroy, 2FA enrol, share
  create/revoke (cross-cut with the share feature).
- Useful for the user + invaluable when something goes wrong.

### 1.8 Logout-everywhere

- `DELETE /sessions` (no id) → wipe all session files for the current user.
- Already trivially supported by the multi-session model — just iterate
  `sessions/` and unlink files whose `username=` matches.

**Estimated effort:** 1–2 days. No new dependencies. No schema migration —
old session files are simply rejected (forces a re-login).

---

## Option 2 — Add a second factor (TOTP via PAM)

Slots in on top of Option 1. Two flavours:

### 2.1 PAM-native (preferred)

Install `libpam-google-authenticator` and add to the PAM stack used by our
service file (e.g. `/etc/pam.d/imaginary`):

```
auth required pam_google_authenticator.so nullok
auth required pam_unix.so
```

`nullok` so users without `~/.google_authenticator` can still log in (lets
us roll out gradually). The existing `pam_authenticate()` call now prompts
for both password and code — we just feed both into our PAM conversation
function.

Frontend changes:

- `LoginForm.tsx` gets a "Authenticator code" field, shown after the user
  submits username+password and the server returns a `needs_totp` hint.
- Or: send all three on first POST and let PAM fail if missing.

Enrolment:

- New page in `SettingsPage.tsx`: `POST /auth/totp/enrol` runs
  `google-authenticator -t -d -f -r 3 -R 30 -W` as the user (forked,
  setuid'd) and returns the `otpauth://` URI. Frontend renders a QR code.
- `DELETE /auth/totp` removes `~/.google_authenticator`.

Pros: zero new auth surface in our code, leverages PAM stack, recovery
codes come for free.

### 2.2 WebAuthn / passkeys (alternative)

Best UX for a small-user NAS, but means writing our own verifier:

- Store credentials in `/var/lib/imaginary/webauthn/<user>.json`.
- Login flow becomes: `POST /auth/webauthn/challenge` →
  client signs → `POST /auth/webauthn/verify` → on success we still
  resolve to a local user and create a session as today.
- Need a small CBOR/COSE library. `libfido2` exists but is overkill for
  server-side verification; a vendored mini-implementation (~500 LoC) is
  more typical.

Recommendation: **TOTP first** (Option 2.1), passkeys later if there's
demand. TOTP is hours of work; WebAuthn is days.

---

## Option 3 — Forward-auth via reverse proxy (bigger change, optional)

Put Caddy or nginx in front, with Authelia or Authentik handling login UI,
MFA, lockout, and (optionally) OIDC for upstream IDPs.

- Proxy authenticates the user, sets `Remote-User: alice` (signed via
  forward-auth headers).
- Our server runs in "trusted-proxy mode": skip PAM, trust the header,
  still `getpwnam(remote_user)` and `setuid`/`setgid` as today.
- Session management moves entirely to Authelia.

Tradeoffs:

- **Pro**: free MFA, OIDC SSO, brute-force protection, beautiful login UI,
  a single login across multiple self-hosted apps on the same domain.
- **Con**: Authelia's user DB must mirror `/etc/passwd` (or use its LDAP
  backend pointed at the host's NSS). Setting that up once is fine; keeping
  it in sync as you `useradd`/`userdel` is the real cost.
- **Con**: now there are two services to operate, and a misconfigured
  proxy can let unauthenticated requests through. We must enforce that the
  app **only** binds to localhost or a private socket the proxy can reach.

Verdict: worth doing once the app is run by more than one household; not
worth the complexity for a single-admin install.

---

## Recommended phased path

1. **Phase 1 (do now):** Option 1 — harden sessions, cookies, add CSRF,
   login rate limiting, expiry, rotation, audit log. Self-contained,
   ~2 days, no new deps.
2. **Phase 2 (next):** Option 2.1 — TOTP via `pam_google_authenticator`
   with a settings-page enrolment flow. ~1 day for the backend handler +
   frontend QR/enrol UI.
3. **Phase 3 (deferred):** Decide between (a) WebAuthn passkeys, or
   (b) forward-auth via Authelia, based on how the deployment grows. Both
   are weeks of work; defer until there's a concrete need.

---

## Notes / open questions

- `sessions/` lives in the working directory today. Should move to
  `/var/lib/imaginary/sessions/` (root-owned, 0700) so it survives a
  rebuild and is consistent with the share registry path.
- `csrf_secret` per session vs. per request: per-session is simpler and
  sufficient against CSRF; per-request would also defeat replay but isn't
  worth the complexity.
- Multi-session cookies (`session_<user>=…`) need the same hardening as
  `active_session` — don't forget them when touching cookie code.
- If we adopt WebAuthn later, the per-user JSON store should sit next to
  `shares.json` under `/var/lib/imaginary/`, written atomically and
  root-owned.
