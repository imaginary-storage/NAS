# Imaginary Storage (NAS)

A self-hosted, high-performance Network Attached Storage (NAS) solution featuring a security-first C backend and a modern React frontend.

## 🚀 Overview

Imaginary Storage is designed for users who want absolute control over their data without sacrificing a modern "Google Drive-like" experience. Unlike traditional NAS software that runs as a single monolithic process, Imaginary Storage leverages the Linux process model to provide hardware-level isolation between users.

### Key Features
- **Security-First Process Model:** Every request forks and drops privileges to the authenticated OS user.
- **Resumable Chunked Uploads:** 4MB chunking with SHA-256 verification and `localStorage` persistence.
- **POSIX ACL Sharing:** Share files and folders with other system users using native Linux kernel permissions.
- **Full Trash System:** Safely delete, restore, and empty items with metadata preservation.
- **AWS Glacier Sync:** Automated, per-user archival to S3/Glacier with a background scheduler.
- **Admin Suite:** Root-only management of Linux users and physical disk mounting/formatting.

---

## 🏗️ Architecture

### Backend: The "Fork-per-Request" Model
The backend is built using a custom minimalist HTTP framework (`chttp`). To ensure absolute data security:
1. The main server process starts as `root`.
2. Upon matching an authenticated route, the server calls `fork()`.
3. The child process calls `initgroups()`, `setgid()`, and `setuid()` to become the logged-in user.
4. The handler executes within the child, naturally restricted by the OS filesystem permissions.
5. This eliminates the risk of "cross-user" data leakage common in single-process multi-user systems.

### Frontend: Modern SPA
- **Framework:** React 19 + TypeScript.
- **Styling:** Tailwind CSS v4.
- **State:** Redux Toolkit for complex filesystem and upload management.
- **Upload Engine:** A custom sequential queue manager handling hashing, session negotiation, and exponential backoff retries.

---

## 📂 Project Structure

```text
├── lib/               # Custom C HTTP framework (chttp)
├── src/
│   ├── main.c         # Entry point & route registration
│   ├── auth/          # PAM auth & session management
│   ├── fs/            # Filesystem handlers (list, upload, trash)
│   ├── share/         # Cross-user sharing (POSIX ACLs)
│   ├── admin/         # User/Disk management (root-only)
│   └── aws_sync/      # S3/Glacier backup scheduler
├── frontend/          # React SPA (Vite + TS)
├── scripts/           # Integration tests and CLI tools
├── vendor/            # cJSON, sha256 (no external deps)
└── poc/               # Proof-of-concept HTML for upload testing
```

---

## 🛠️ Getting Started

### Prerequisites
- **OS:** Linux (required for PAM, setuid, and POSIX ACLs).
- **Compiler:** GCC with `make`.
- **Dependencies:** `libpam0g-dev`, `libacl1-dev`.
- **Node.js:** v20+ (for frontend).

### Build & Run

1. **Build the Backend:**
   ```bash
   make
   ```

2. **Build the Frontend:**
   ```bash
   cd frontend
   npm install
   npm run build
   ```

3. **Start the Server:**
   ```bash
   ./run server
   ```
   *Note: The server must run as sudo to perform privilege drops and PAM authentication.*

---

## 🔒 Security Model

- **Authentication:** Uses system PAM (Pluggable Authentication Modules). Any local Linux user can log in.
- **Sessions:** Token-based sessions stored in root-owned `./sessions/` with 0700 permissions.
- **Filesystem:** The server never "simulates" permissions. It *becomes* the user, meaning standard Linux permissions (`rwx`) and ACLs are the final authority.
- **Sanitization:** All paths are sanitized to prevent `..` traversal. Filenames are restricted to safe characters to prevent shell injection.

---

## 🧪 Testing

The project includes a suite of API integration tests:
```bash
./scripts/runtests.sh <username> <password>
```
This script verifies the full lifecycle: login, mkdir, upload, stat, rename, move, and trash.

---

## 📜 License
*Proprietary / Internal Use*
