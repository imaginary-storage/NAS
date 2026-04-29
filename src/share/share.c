/*
 * File-sharing module — registry I/O, libacl-based access enforcement,
 * and the full /share/... HTTP surface.  Registry lives at
 * SHARE_REGISTRY_PATH (root-owned, world-readable JSON).  Recipient access
 * is enforced by POSIX ACLs at the kernel layer; the registry checks here
 * are belt-and-suspenders.
 */

#define _GNU_SOURCE
#include <sys/types.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <sys/acl.h>
#include <acl/libacl.h>
#include <dirent.h>
#include <errno.h>
#include <fcntl.h>
#include <ftw.h>
#include <pwd.h>
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#include "share.h"
#include "auth/auth.h"
#include "utils/utils.h"
#include "cJSON.h"

#define SHARE_CONTENT_MAX (64 * 1024)

/* ---------------------------------------------------------------------- */
/* Misc helpers                                                            */
/* ---------------------------------------------------------------------- */

/* For NOPRIV handlers (running as root): re-derive the username from the
 * active_session cookie since the AUTH macro doesn't pass it through. */
static int auth_user_from_cookie(HttpRequest *req, char user_out[128]) {
  const char *cookie = chttp_header(req, "Cookie");
  char sid[65] = "", claimed[128] = "";
  if (!parse_active_session_cookie(cookie, sid, claimed) ||
      validate_session(sid, user_out, 128) < 0 ||
      strcmp(claimed, user_out) != 0) {
    user_out[0] = '\0';
    return -1;
  }
  return 0;
}

/* For DEFINE_AUTH_ROUTE handlers (running in a fork that has already
 * setuid'd to the authenticated user): the cookie was validated before the
 * fork, so trust the current uid.  We can't reread ./sessions/ here — it's
 * mode 0700 root-owned, and the forked-as-user process gets EACCES. */
static int current_username(char user_out[128]) {
  struct passwd *pw = getpwuid(getuid());
  if (!pw) { user_out[0] = '\0'; return -1; }
  strncpy(user_out, pw->pw_name, 127);
  user_out[127] = '\0';
  return 0;
}

static void send_err(HttpResponse *res, int status, const char *msg) {
  chttp_set_status(res, status);
  char buf[256];
  snprintf(buf, sizeof(buf), "{\"error\":\"%s\"}", msg);
  chttp_send_json(res, buf);
}

/* sh_<32 hex chars>.  Uses /dev/urandom. */
static int gen_share_id(char out[40]) {
  unsigned char raw[16];
  int fd = open("/dev/urandom", O_RDONLY);
  if (fd < 0) return -1;
  ssize_t r = read(fd, raw, sizeof(raw));
  close(fd);
  if (r != (ssize_t)sizeof(raw)) return -1;
  memcpy(out, "sh_", 3);
  for (int i = 0; i < 16; i++)
    snprintf(out + 3 + i * 2, 3, "%02x", raw[i]);
  out[35] = '\0';
  return 0;
}

static int safe_share_id(const char *id) {
  if (!id) return 0;
  size_t n = strlen(id);
  if (n != 35) return 0;
  if (strncmp(id, "sh_", 3) != 0) return 0;
  for (size_t i = 3; i < n; i++) {
    char c = id[i];
    if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))) return 0;
  }
  return 1;
}

/* ---------------------------------------------------------------------- */
/* Registry I/O                                                            */
/* ---------------------------------------------------------------------- */

/* Atomic write — temp + fsync + rename.  Stays root-owned (mode 0644). */
static int write_atomic(const char *path, const char *content, size_t len) {
  char tmppath[1024];
  if (snprintf(tmppath, sizeof(tmppath), "%s.tmp.%d", path, (int)getpid())
      >= (int)sizeof(tmppath))
    return -1;
  int fd = open(tmppath, O_WRONLY | O_CREAT | O_TRUNC, 0644);
  if (fd < 0) return -1;
  ssize_t w = write(fd, content, len);
  fsync(fd);
  close(fd);
  if (w != (ssize_t)len) { unlink(tmppath); return -1; }
  if (rename(tmppath, path) < 0) { unlink(tmppath); return -1; }
  return 0;
}

/* Returns a fresh cJSON object with a top-level "shares" array.  If the
 * file is missing or malformed, returns an empty registry (caller saves to
 * heal it).  Caller must cJSON_Delete. */
static cJSON *registry_load(void) {
  FILE *f = fopen(SHARE_REGISTRY_PATH, "rb");
  cJSON *obj = NULL;
  if (f) {
    fseek(f, 0, SEEK_END);
    long sz = ftell(f);
    fseek(f, 0, SEEK_SET);
    if (sz > 0 && sz < 4 * 1024 * 1024) {
      char *buf = malloc((size_t)sz + 1);
      if (buf) {
        size_t got = fread(buf, 1, (size_t)sz, f);
        buf[got] = '\0';
        obj = cJSON_ParseWithLength(buf, got);
        free(buf);
      }
    }
    fclose(f);
  }
  if (!obj || !cJSON_IsObject(obj)) {
    if (obj) cJSON_Delete(obj);
    obj = cJSON_CreateObject();
    cJSON_AddItemToObject(obj, "shares", cJSON_CreateArray());
  } else if (!cJSON_GetObjectItem(obj, "shares")) {
    cJSON_AddItemToObject(obj, "shares", cJSON_CreateArray());
  }
  return obj;
}

static int registry_save(cJSON *reg) {
  char *txt = cJSON_PrintUnformatted(reg);
  if (!txt) return -1;
  int rc = write_atomic(SHARE_REGISTRY_PATH, txt, strlen(txt));
  free(txt);
  return rc;
}

static cJSON *find_share(cJSON *reg, const char *id) {
  cJSON *arr = cJSON_GetObjectItem(reg, "shares");
  cJSON *it;
  cJSON_ArrayForEach(it, arr) {
    cJSON *jid = cJSON_GetObjectItem(it, "id");
    if (cJSON_IsString(jid) && strcmp(jid->valuestring, id) == 0)
      return it;
  }
  return NULL;
}

static const char *jstr(cJSON *o, const char *k) {
  cJSON *v = cJSON_GetObjectItem(o, k);
  return cJSON_IsString(v) ? v->valuestring : "";
}

static int jbool(cJSON *o, const char *k) {
  cJSON *v = cJSON_GetObjectItem(o, k);
  return cJSON_IsTrue(v);
}

static double jnum(cJSON *o, const char *k) {
  cJSON *v = cJSON_GetObjectItem(o, k);
  return cJSON_IsNumber(v) ? v->valuedouble : 0;
}

/* ---------------------------------------------------------------------- */
/* libacl helpers                                                          */
/* ---------------------------------------------------------------------- */

/* Set / overwrite the named-user ACL entry on `path` for `uid`.  `perms` is
 * the OR of the standard r/w/x bits (use S_IRUSR / S_IWUSR / S_IXUSR for
 * portability — only the bottom three matter).  `acl_type` is
 * ACL_TYPE_ACCESS (for the file's effective ACL) or ACL_TYPE_DEFAULT (for
 * a directory's default ACL inherited by new children). */
static int set_user_acl(const char *path, uid_t uid, mode_t perms,
                        acl_type_t acl_type) {
  acl_t acl = acl_get_file(path, acl_type);
  if (!acl) {
    if (errno == ENODATA && acl_type == ACL_TYPE_DEFAULT) {
      /* No default ACL yet — start from the access ACL as a base. */
      acl = acl_get_file(path, ACL_TYPE_ACCESS);
    }
    if (!acl) return -1;
  }

  /* Find or create entry for this uid. */
  acl_entry_t entry;
  int rc = acl_get_entry(acl, ACL_FIRST_ENTRY, &entry);
  int found = 0;
  while (rc == 1) {
    acl_tag_t tag;
    if (acl_get_tag_type(entry, &tag) == 0 && tag == ACL_USER) {
      uid_t *q = (uid_t *)acl_get_qualifier(entry);
      if (q && *q == uid) { found = 1; if (q) acl_free(q); break; }
      if (q) acl_free(q);
    }
    rc = acl_get_entry(acl, ACL_NEXT_ENTRY, &entry);
  }
  if (!found && acl_create_entry(&acl, &entry) < 0) {
    acl_free(acl); return -1;
  }
  acl_set_tag_type(entry, ACL_USER);
  acl_set_qualifier(entry, &uid);

  acl_permset_t pset;
  acl_get_permset(entry, &pset);
  acl_clear_perms(pset);
  if (perms & S_IRUSR) acl_add_perm(pset, ACL_READ);
  if (perms & S_IWUSR) acl_add_perm(pset, ACL_WRITE);
  if (perms & S_IXUSR) acl_add_perm(pset, ACL_EXECUTE);
  acl_set_permset(entry, pset);

  if (acl_calc_mask(&acl) < 0) { acl_free(acl); return -1; }
  if (acl_valid(acl) < 0) { acl_free(acl); return -1; }
  int sr = acl_set_file(path, acl_type, acl);
  acl_free(acl);
  return sr;
}

/* Remove the named-user ACL entry for `uid` on `path`, both ACCESS and
 * DEFAULT (the latter only on directories — silently ignored if absent). */
static int remove_user_acl(const char *path, uid_t uid) {
  acl_type_t types[2] = {ACL_TYPE_ACCESS, ACL_TYPE_DEFAULT};
  for (int t = 0; t < 2; t++) {
    acl_t acl = acl_get_file(path, types[t]);
    if (!acl) continue;
    acl_entry_t entry;
    int rc = acl_get_entry(acl, ACL_FIRST_ENTRY, &entry);
    int dirty = 0;
    while (rc == 1) {
      acl_tag_t tag;
      acl_get_tag_type(entry, &tag);
      int del = 0;
      if (tag == ACL_USER) {
        uid_t *q = (uid_t *)acl_get_qualifier(entry);
        if (q && *q == uid) del = 1;
        if (q) acl_free(q);
      }
      if (del) {
        acl_delete_entry(acl, entry);
        dirty = 1;
        rc = acl_get_entry(acl, ACL_FIRST_ENTRY, &entry);
      } else {
        rc = acl_get_entry(acl, ACL_NEXT_ENTRY, &entry);
      }
    }
    if (dirty) {
      acl_calc_mask(&acl);
      acl_set_file(path, types[t], acl);
    }
    acl_free(acl);
  }
  return 0;
}

/* nftw context — lifecycle confined to one tree walk, single-threaded. */
static uid_t  g_walk_uid;
static mode_t g_walk_perms;
static int    g_walk_failures;
static int    g_walk_op;   /* 0 = apply, 1 = remove */

static int walk_cb(const char *fpath, const struct stat *st, int typeflag,
                   struct FTW *ftwbuf) {
  (void)typeflag; (void)ftwbuf;
  if (g_walk_op == 0) {
    /* Apply: directories get default ACL too. */
    if (set_user_acl(fpath, g_walk_uid, g_walk_perms, ACL_TYPE_ACCESS) < 0)
      g_walk_failures++;
    if (S_ISDIR(st->st_mode)) {
      mode_t dperms = g_walk_perms;
      if (set_user_acl(fpath, g_walk_uid, dperms, ACL_TYPE_DEFAULT) < 0)
        g_walk_failures++;
    }
  } else {
    remove_user_acl(fpath, g_walk_uid);
  }
  return 0;
}

static int apply_dir_acl_recursive(const char *root, uid_t uid, mode_t perms) {
  g_walk_uid = uid; g_walk_perms = perms; g_walk_failures = 0; g_walk_op = 0;
  if (nftw(root, walk_cb, 64, FTW_PHYS) < 0) return -1;
  return g_walk_failures == 0 ? 0 : -1;
}

static int remove_dir_acl_recursive(const char *root, uid_t uid) {
  g_walk_uid = uid; g_walk_failures = 0; g_walk_op = 1;
  if (nftw(root, walk_cb, 64, FTW_PHYS) < 0) return -1;
  return 0;
}

/* Walk parent dirs of `path` up to '/' and add a `u:<uid>:--x` ACL entry on
 * each.  Idempotent — set_user_acl overwrites existing entries.  We never
 * remove these on revoke (harmless `--x` only, possibly shared). */
static int apply_parent_traversal(const char *path, uid_t uid) {
  char buf[1024];
  if (snprintf(buf, sizeof(buf), "%s", path) >= (int)sizeof(buf)) return -1;
  for (;;) {
    char *slash = strrchr(buf, '/');
    if (!slash || slash == buf) break;
    *slash = '\0';
    if (set_user_acl(buf, uid, S_IXUSR, ACL_TYPE_ACCESS) < 0) {
      /* Best-effort — many parents won't be writeable as root only,
       * which is fine; we ignore individual failures so long as the leaf
       * succeeded. */
    }
  }
  return 0;
}

/* ---------------------------------------------------------------------- */
/* Apply / revoke for a whole share                                        */
/* ---------------------------------------------------------------------- */

static int apply_share_acls(const char *src, uid_t uid, const char *kind,
                            const char *mode) {
  mode_t perms = 0;
  if (strcmp(kind, "file") == 0) {
    /* file is RO only — enforced earlier */
    perms = S_IRUSR;
    if (set_user_acl(src, uid, perms, ACL_TYPE_ACCESS) < 0) return -1;
  } else {
    perms = S_IRUSR | S_IXUSR;
    if (strcmp(mode, "rw") == 0) perms |= S_IWUSR;
    if (apply_dir_acl_recursive(src, uid, perms) < 0) return -1;
  }
  apply_parent_traversal(src, uid);
  return 0;
}

static void revoke_share_acls(const char *src, uid_t uid, const char *kind) {
  if (strcmp(kind, "file") == 0)
    remove_user_acl(src, uid);
  else
    remove_dir_acl_recursive(src, uid);
  /* Parent traversal entries left in place — harmless and may be reused. */
}

/* ---------------------------------------------------------------------- */
/* Validation                                                              */
/* ---------------------------------------------------------------------- */

static int valid_recipient(const char *uname, const char *sharer,
                           uid_t *out_uid) {
  if (!uname || !*uname) return 0;
  if (strcmp(uname, "root") == 0) return 0;
  if (strcmp(uname, sharer) == 0) return 0;
  struct passwd *pw = getpwnam(uname);
  if (!pw) return 0;
  if (pw->pw_uid < 1000) return 0;
  *out_uid = pw->pw_uid;
  return 1;
}

static int sharer_owns(const char *path, const char *sharer, struct stat *st) {
  struct passwd *pw = getpwnam(sharer);
  if (!pw) return 0;
  if (stat(path, st) != 0) return 0;
  return st->st_uid == pw->pw_uid;
}

/* ---------------------------------------------------------------------- */
/* Serialise a Share for JSON responses                                    */
/* ---------------------------------------------------------------------- */

static cJSON *share_to_json(cJSON *s) {
  cJSON *out = cJSON_CreateObject();
  cJSON_AddStringToObject(out, "id",          jstr(s, "id"));
  cJSON_AddStringToObject(out, "sharer",      jstr(s, "sharer"));
  cJSON_AddStringToObject(out, "recipient",   jstr(s, "recipient"));
  cJSON_AddStringToObject(out, "source_path", jstr(s, "source_path"));
  cJSON_AddStringToObject(out, "kind",        jstr(s, "kind"));
  cJSON_AddStringToObject(out, "mode",        jstr(s, "mode"));
  cJSON_AddNumberToObject(out, "created_at",  jnum(s, "created_at"));
  cJSON_AddNumberToObject(out, "expires_at",  jnum(s, "expires_at"));
  cJSON_AddBoolToObject  (out, "revoked",     jbool(s, "revoked"));
  /* Stale = source_path no longer reachable.  Best-effort stat. */
  struct stat st;
  cJSON_AddBoolToObject(out, "stale", stat(jstr(s, "source_path"), &st) != 0);
  return out;
}

/* ---------------------------------------------------------------------- */
/* Authorization helpers for data-plane handlers                           */
/* ---------------------------------------------------------------------- */

/* Returns the share for (id, recipient=user) when active and not revoked,
 * else writes an HTTP error to res and returns NULL.  Caller MUST cJSON_Delete
 * the returned registry handle (passed back via *reg_out). */
static cJSON *resolve_share_for_recipient(cJSON **reg_out,
                                          const char *id, const char *user,
                                          int writing, HttpResponse *res) {
  if (!safe_share_id(id)) {
    send_err(res, 400, "Invalid share id");
    return NULL;
  }
  cJSON *reg = registry_load();
  cJSON *s = find_share(reg, id);
  if (!s) {
    cJSON_Delete(reg);
    send_err(res, 404, "Share not found");
    return NULL;
  }
  if (jbool(s, "revoked")) {
    cJSON_Delete(reg);
    send_err(res, 410, "Share revoked");
    return NULL;
  }
  double exp = jnum(s, "expires_at");
  if (exp > 0 && (time_t)exp <= time(NULL)) {
    cJSON_Delete(reg);
    send_err(res, 410, "Share expired");
    return NULL;
  }
  if (strcmp(jstr(s, "recipient"), user) != 0) {
    cJSON_Delete(reg);
    send_err(res, 403, "Not your share");
    return NULL;
  }
  if (writing && strcmp(jstr(s, "mode"), "rw") != 0) {
    cJSON_Delete(reg);
    send_err(res, 403, "Read-only share");
    return NULL;
  }
  *reg_out = reg;
  return s;
}

/* Build absolute path = source_path[/subpath], rejecting `..` traversal. */
static int build_share_path(cJSON *share, const char *subpath,
                            char *out, size_t out_size) {
  const char *src = jstr(share, "source_path");
  const char *kind = jstr(share, "kind");
  if (!subpath || !*subpath || strcmp(subpath, ".") == 0) {
    if (snprintf(out, out_size, "%s", src) >= (int)out_size) return -1;
    return 0;
  }
  if (!safe_path(subpath)) return -1;
  /* Subpath only makes sense for directory shares. */
  if (strcmp(kind, "dir") != 0) return -1;
  if (snprintf(out, out_size, "%s/%s", src, subpath) >= (int)out_size)
    return -1;
  return 0;
}

/* ---------------------------------------------------------------------- */
/* Control plane: POST /share                                              */
/* ---------------------------------------------------------------------- */

void handle_share_create_impl(HttpRequest *req, HttpResponse *res) {
  char user[128];
  if (auth_user_from_cookie(req, user) < 0) {
    send_err(res, 401, "Unauthorized");
    return;
  }
  if (!req->body || req->body_len == 0) {
    send_err(res, 400, "Empty body");
    return;
  }
  cJSON *body = cJSON_ParseWithLength(req->body, req->body_len);
  if (!body) {
    send_err(res, 400, "Malformed JSON");
    return;
  }

  const char *src       = jstr(body, "source");
  const char *recipient = jstr(body, "recipient");
  const char *kind_in   = jstr(body, "kind");
  const char *mode_in   = jstr(body, "mode");
  cJSON *jexp = cJSON_GetObjectItem(body, "expires_at");
  time_t expires_at = cJSON_IsNumber(jexp) ? (time_t)jexp->valuedouble : 0;

  if (!*src || src[0] != '/' || !safe_path(src)) {
    cJSON_Delete(body); send_err(res, 400, "Invalid source"); return;
  }
  if (strcmp(kind_in, "file") != 0 && strcmp(kind_in, "dir") != 0) {
    cJSON_Delete(body); send_err(res, 400, "Invalid kind"); return;
  }
  if (strcmp(mode_in, "ro") != 0 && strcmp(mode_in, "rw") != 0) {
    cJSON_Delete(body); send_err(res, 400, "Invalid mode"); return;
  }
  if (strcmp(kind_in, "file") == 0 && strcmp(mode_in, "rw") == 0) {
    cJSON_Delete(body); send_err(res, 400, "Files are read-only"); return;
  }

  uid_t recipient_uid;
  if (!valid_recipient(recipient, user, &recipient_uid)) {
    cJSON_Delete(body); send_err(res, 400, "Invalid recipient"); return;
  }

  struct stat st;
  if (!sharer_owns(src, user, &st)) {
    cJSON_Delete(body); send_err(res, 403, "You do not own this path"); return;
  }
  /* kind must match the type on disk. */
  int is_dir = S_ISDIR(st.st_mode);
  if ((is_dir && strcmp(kind_in, "dir") != 0) ||
      (!is_dir && strcmp(kind_in, "file") != 0)) {
    cJSON_Delete(body); send_err(res, 400, "Kind mismatch"); return;
  }

  /* Reject duplicate non-revoked share for (sharer, recipient, source). */
  cJSON *reg = registry_load();
  cJSON *arr = cJSON_GetObjectItem(reg, "shares");
  cJSON *it;
  cJSON_ArrayForEach(it, arr) {
    if (jbool(it, "revoked")) continue;
    if (strcmp(jstr(it, "sharer"), user) == 0 &&
        strcmp(jstr(it, "recipient"), recipient) == 0 &&
        strcmp(jstr(it, "source_path"), src) == 0) {
      cJSON_Delete(reg); cJSON_Delete(body);
      send_err(res, 409, "Share already exists"); return;
    }
  }

  char id[40];
  if (gen_share_id(id) < 0) {
    cJSON_Delete(reg); cJSON_Delete(body);
    send_err(res, 500, "ID generation failed"); return;
  }

  /* Apply ACLs first — if this fails we don't persist the share entry. */
  if (apply_share_acls(src, recipient_uid, kind_in, mode_in) < 0) {
    /* Best-effort cleanup of any partial ACL state. */
    if (strcmp(kind_in, "dir") == 0)
      remove_dir_acl_recursive(src, recipient_uid);
    else
      remove_user_acl(src, recipient_uid);
    cJSON_Delete(reg); cJSON_Delete(body);
    send_err(res, 500, "Failed to apply ACL"); return;
  }

  cJSON *entry = cJSON_CreateObject();
  cJSON_AddStringToObject(entry, "id",          id);
  cJSON_AddStringToObject(entry, "sharer",      user);
  cJSON_AddStringToObject(entry, "recipient",   recipient);
  cJSON_AddStringToObject(entry, "source_path", src);
  cJSON_AddStringToObject(entry, "kind",        kind_in);
  cJSON_AddStringToObject(entry, "mode",        mode_in);
  cJSON_AddNumberToObject(entry, "created_at",  (double)time(NULL));
  cJSON_AddNumberToObject(entry, "expires_at",  (double)expires_at);
  cJSON_AddBoolToObject  (entry, "revoked",     0);
  cJSON_AddItemToArray(arr, entry);

  if (registry_save(reg) < 0) {
    /* Roll the ACL back so we don't leak access without a registry record. */
    if (strcmp(kind_in, "dir") == 0)
      remove_dir_acl_recursive(src, recipient_uid);
    else
      remove_user_acl(src, recipient_uid);
    cJSON_Delete(reg); cJSON_Delete(body);
    send_err(res, 500, "Failed to write registry"); return;
  }

  cJSON_Delete(body);
  cJSON *out = share_to_json(entry);
  cJSON_Delete(reg);
  chttp_set_status(res, 201);
  chttp_send_cjson(res, out);
  cJSON_Delete(out);
}

/* ---------------------------------------------------------------------- */
/* Control plane: DELETE /share/:share_id                                  */
/* ---------------------------------------------------------------------- */

void handle_share_revoke_impl(HttpRequest *req, HttpResponse *res) {
  char user[128];
  if (auth_user_from_cookie(req, user) < 0) {
    send_err(res, 401, "Unauthorized"); return;
  }
  const char *id = chttp_path_param(req, "share_id");
  if (!safe_share_id(id)) {
    send_err(res, 400, "Invalid share id"); return;
  }

  cJSON *reg = registry_load();
  cJSON *s = find_share(reg, id);
  if (!s) {
    cJSON_Delete(reg); send_err(res, 404, "Share not found"); return;
  }
  if (strcmp(jstr(s, "sharer"), user) != 0) {
    cJSON_Delete(reg); send_err(res, 403, "Not your share"); return;
  }
  if (jbool(s, "revoked")) {
    cJSON_Delete(reg); chttp_send_json(res, "{\"message\":\"already revoked\"}");
    return;
  }

  struct passwd *pw = getpwnam(jstr(s, "recipient"));
  if (pw)
    revoke_share_acls(jstr(s, "source_path"), pw->pw_uid, jstr(s, "kind"));

  cJSON_ReplaceItemInObject(s, "revoked", cJSON_CreateBool(1));
  cJSON_AddNumberToObject(s, "revoked_at", (double)time(NULL));
  if (registry_save(reg) < 0) {
    cJSON_Delete(reg); send_err(res, 500, "Failed to write registry"); return;
  }
  cJSON_Delete(reg);
  chttp_send_json(res, "{\"message\":\"revoked\"}");
}

/* ---------------------------------------------------------------------- */
/* Read-side: GET /share/incoming|outgoing|users                           */
/* ---------------------------------------------------------------------- */

static void list_filtered(HttpRequest *req, HttpResponse *res,
                          const char *field, const char *match_user) {
  (void)req;
  cJSON *reg = registry_load();
  cJSON *arr = cJSON_GetObjectItem(reg, "shares");
  cJSON *out = cJSON_CreateArray();
  cJSON *it;
  cJSON_ArrayForEach(it, arr) {
    if (jbool(it, "revoked")) continue;
    double exp = jnum(it, "expires_at");
    if (exp > 0 && (time_t)exp <= time(NULL)) continue;
    if (strcmp(jstr(it, field), match_user) != 0) continue;
    cJSON_AddItemToArray(out, share_to_json(it));
  }
  cJSON_Delete(reg);
  cJSON *resp = cJSON_CreateObject();
  cJSON_AddItemToObject(resp, "shares", out);
  chttp_send_cjson(res, resp);
  cJSON_Delete(resp);
}

void handle_share_list_incoming_impl(HttpRequest *req, HttpResponse *res) {
  (void)req;
  char user[128];
  if (current_username(user) < 0) {
    send_err(res, 401, "Unauthorized"); return;
  }
  list_filtered(req, res, "recipient", user);
}

void handle_share_list_outgoing_impl(HttpRequest *req, HttpResponse *res) {
  (void)req;
  char user[128];
  if (current_username(user) < 0) {
    send_err(res, 401, "Unauthorized"); return;
  }
  list_filtered(req, res, "sharer", user);
}

void handle_share_list_users_impl(HttpRequest *req, HttpResponse *res) {
  (void)req;
  char user[128];
  if (current_username(user) < 0) {
    send_err(res, 401, "Unauthorized"); return;
  }
  cJSON *arr = cJSON_CreateArray();
  setpwent();
  struct passwd *pw;
  while ((pw = getpwent()) != NULL) {
    if (pw->pw_uid < 1000) continue;
    if (strcmp(pw->pw_name, user) == 0) continue;
    cJSON *u = cJSON_CreateObject();
    cJSON_AddStringToObject(u, "username", pw->pw_name);
    cJSON_AddNumberToObject(u, "uid", (double)pw->pw_uid);
    cJSON_AddItemToArray(arr, u);
  }
  endpwent();
  cJSON *resp = cJSON_CreateObject();
  cJSON_AddItemToObject(resp, "users", arr);
  chttp_send_cjson(res, resp);
  cJSON_Delete(resp);
}

/* ---------------------------------------------------------------------- */
/* Data plane — runs as recipient via DEFINE_AUTH_ROUTE                    */
/* ---------------------------------------------------------------------- */

static int parse_iso_time(time_t t, char out[32]) {
  struct tm tm;
  gmtime_r(&t, &tm);
  return (int)strftime(out, 32, "%Y-%m-%dT%H:%M:%SZ", &tm);
}

void handle_share_fs_list_impl(HttpRequest *req, HttpResponse *res) {
  char user[128];
  if (current_username(user) < 0) {
    send_err(res, 401, "Unauthorized"); return;
  }
  const char *id = chttp_path_param(req, "share_id");
  cJSON *reg = NULL;
  cJSON *s = resolve_share_for_recipient(&reg, id, user, 0, res);
  if (!s) return;

  const char *sub = chttp_query_param(req, "path");
  char abs[1024];
  if (build_share_path(s, sub, abs, sizeof(abs)) < 0) {
    cJSON_Delete(reg); send_err(res, 400, "Invalid path"); return;
  }

  /* For file shares, /list of "." returns a one-item listing for parity. */
  struct stat st;
  if (stat(abs, &st) != 0) {
    cJSON_Delete(reg); fs_error(res, errno); return;
  }

  cJSON *obj = cJSON_CreateObject();
  cJSON_AddStringToObject(obj, "path", sub && *sub ? sub : ".");
  cJSON *entries = cJSON_AddArrayToObject(obj, "entries");

  if (S_ISDIR(st.st_mode)) {
    DIR *dp = opendir(abs);
    if (!dp) {
      cJSON_Delete(reg); cJSON_Delete(obj);
      fs_error(res, errno); return;
    }
    struct dirent *de;
    while ((de = readdir(dp)) != NULL) {
      if (strcmp(de->d_name, ".") == 0 || strcmp(de->d_name, "..") == 0) continue;
      char full[2048];
      snprintf(full, sizeof(full), "%s/%s", abs, de->d_name);
      struct stat est;
      if (stat(full, &est) != 0) continue;
      char mtime_str[32]; parse_iso_time(est.st_mtime, mtime_str);
      cJSON *e = cJSON_CreateObject();
      cJSON_AddStringToObject(e, "name", de->d_name);
      cJSON_AddStringToObject(e, "type", S_ISDIR(est.st_mode) ? "dir" : "file");
      cJSON_AddNumberToObject(e, "size",
          S_ISDIR(est.st_mode) ? 0 : (double)est.st_size);
      cJSON_AddStringToObject(e, "modified", mtime_str);
      cJSON_AddStringToObject(e, "mime",
          S_ISDIR(est.st_mode) ? "inode/directory" : mime_from_ext(full));
      cJSON_AddItemToArray(entries, e);
    }
    closedir(dp);
  } else {
    /* Single-file share: synthesise a one-entry listing. */
    char mtime_str[32]; parse_iso_time(st.st_mtime, mtime_str);
    const char *base = strrchr(abs, '/');
    base = base ? base + 1 : abs;
    cJSON *e = cJSON_CreateObject();
    cJSON_AddStringToObject(e, "name", base);
    cJSON_AddStringToObject(e, "type", "file");
    cJSON_AddNumberToObject(e, "size", (double)st.st_size);
    cJSON_AddStringToObject(e, "modified", mtime_str);
    cJSON_AddStringToObject(e, "mime", mime_from_ext(abs));
    cJSON_AddItemToArray(entries, e);
  }

  cJSON_Delete(reg);
  chttp_send_cjson(res, obj);
  cJSON_Delete(obj);
}

void handle_share_fs_stat_impl(HttpRequest *req, HttpResponse *res) {
  char user[128];
  if (current_username(user) < 0) {
    send_err(res, 401, "Unauthorized"); return;
  }
  const char *id = chttp_path_param(req, "share_id");
  cJSON *reg = NULL;
  cJSON *s = resolve_share_for_recipient(&reg, id, user, 0, res);
  if (!s) return;
  const char *sub = chttp_query_param(req, "path");
  char abs[1024];
  if (build_share_path(s, sub, abs, sizeof(abs)) < 0) {
    cJSON_Delete(reg); send_err(res, 400, "Invalid path"); return;
  }
  struct stat st;
  if (stat(abs, &st) != 0) {
    cJSON_Delete(reg); fs_error(res, errno); return;
  }
  char mtime_str[32]; parse_iso_time(st.st_mtime, mtime_str);
  char mode_str[8];
  snprintf(mode_str, sizeof(mode_str), "%04o", (unsigned)(st.st_mode & 07777));
  const char *base = strrchr(abs, '/'); base = base ? base + 1 : abs;
  cJSON *obj = cJSON_CreateObject();
  cJSON_AddStringToObject(obj, "name", base);
  cJSON_AddStringToObject(obj, "type", S_ISDIR(st.st_mode) ? "dir" : "file");
  cJSON_AddNumberToObject(obj, "size", (double)st.st_size);
  cJSON_AddStringToObject(obj, "mode", mode_str);
  cJSON_AddNumberToObject(obj, "uid", (double)st.st_uid);
  cJSON_AddStringToObject(obj, "modified", mtime_str);
  cJSON_AddStringToObject(obj, "mime",
      S_ISDIR(st.st_mode) ? "inode/directory" : mime_from_ext(abs));
  cJSON_Delete(reg);
  chttp_send_cjson(res, obj);
  cJSON_Delete(obj);
}

void handle_share_fs_read_impl(HttpRequest *req, HttpResponse *res) {
  char user[128];
  if (current_username(user) < 0) {
    send_err(res, 401, "Unauthorized"); return;
  }
  const char *id = chttp_path_param(req, "share_id");
  cJSON *reg = NULL;
  cJSON *s = resolve_share_for_recipient(&reg, id, user, 0, res);
  if (!s) return;
  const char *sub = chttp_query_param(req, "path");
  char abs[1024];
  if (build_share_path(s, sub, abs, sizeof(abs)) < 0) {
    cJSON_Delete(reg); send_err(res, 400, "Invalid path"); return;
  }
  FILE *f = fopen(abs, "r");
  if (!f) { cJSON_Delete(reg); fs_error(res, errno); return; }
  char *content = malloc(SHARE_CONTENT_MAX + 1);
  if (!content) {
    fclose(f); cJSON_Delete(reg); send_err(res, 500, "OOM"); return;
  }
  size_t n = fread(content, 1, SHARE_CONTENT_MAX, f);
  fclose(f);
  content[n] = '\0';
  cJSON *obj = cJSON_CreateObject();
  cJSON_AddStringToObject(obj, "path", sub && *sub ? sub : ".");
  cJSON_AddStringToObject(obj, "content", content);
  free(content);
  cJSON_Delete(reg);
  chttp_send_cjson(res, obj);
  cJSON_Delete(obj);
}

void handle_share_fs_write_impl(HttpRequest *req, HttpResponse *res) {
  char user[128];
  if (current_username(user) < 0) {
    send_err(res, 401, "Unauthorized"); return;
  }
  const char *id = chttp_path_param(req, "share_id");
  cJSON *reg = NULL;
  cJSON *s = resolve_share_for_recipient(&reg, id, user, 1, res);
  if (!s) return;
  const char *sub = chttp_query_param(req, "path");
  char abs[1024];
  if (build_share_path(s, sub, abs, sizeof(abs)) < 0) {
    cJSON_Delete(reg); send_err(res, 400, "Invalid path"); return;
  }
  FILE *f = fopen(abs, "w");
  if (!f) { cJSON_Delete(reg); fs_error(res, errno); return; }
  size_t written = 0;
  if (req->body && req->body_len > 0)
    written = fwrite(req->body, 1, req->body_len, f);
  fclose(f);
  cJSON_Delete(reg);
  char buf[256];
  snprintf(buf, sizeof(buf), "{\"message\":\"saved\",\"size\":%zu}", written);
  chttp_send_json(res, buf);
}

void handle_share_fs_mkdir_impl(HttpRequest *req, HttpResponse *res) {
  char user[128];
  if (current_username(user) < 0) {
    send_err(res, 401, "Unauthorized"); return;
  }
  const char *id = chttp_path_param(req, "share_id");
  cJSON *reg = NULL;
  cJSON *s = resolve_share_for_recipient(&reg, id, user, 1, res);
  if (!s) return;
  if (!req->body) { cJSON_Delete(reg); send_err(res, 400, "Empty body"); return; }
  cJSON *body = cJSON_ParseWithLength(req->body, req->body_len);
  if (!body) { cJSON_Delete(reg); send_err(res, 400, "Malformed JSON"); return; }
  const char *sub = jstr(body, "path");
  char abs[1024];
  if (build_share_path(s, sub, abs, sizeof(abs)) < 0) {
    cJSON_Delete(body); cJSON_Delete(reg);
    send_err(res, 400, "Invalid path"); return;
  }
  cJSON_Delete(body);
  if (mkdir(abs, 0755) < 0) {
    cJSON_Delete(reg); fs_error(res, errno); return;
  }
  cJSON_Delete(reg);
  chttp_send_json(res, "{\"message\":\"created\"}");
}

void handle_share_fs_delete_impl(HttpRequest *req, HttpResponse *res) {
  char user[128];
  if (current_username(user) < 0) {
    send_err(res, 401, "Unauthorized"); return;
  }
  const char *id = chttp_path_param(req, "share_id");
  cJSON *reg = NULL;
  cJSON *s = resolve_share_for_recipient(&reg, id, user, 1, res);
  if (!s) return;
  const char *sub = chttp_query_param(req, "path");
  char abs[1024];
  if (build_share_path(s, sub, abs, sizeof(abs)) < 0) {
    cJSON_Delete(reg); send_err(res, 400, "Invalid path"); return;
  }
  if (unlink(abs) < 0) {
    cJSON_Delete(reg); fs_error(res, errno); return;
  }
  cJSON_Delete(reg);
  chttp_send_json(res, "{\"message\":\"deleted\"}");
}

void handle_share_fs_download_impl(HttpRequest *req, HttpResponse *res) {
  char user[128];
  if (current_username(user) < 0) {
    send_err(res, 401, "Unauthorized"); return;
  }
  const char *id = chttp_path_param(req, "share_id");
  cJSON *reg = NULL;
  cJSON *s = resolve_share_for_recipient(&reg, id, user, 0, res);
  if (!s) return;
  const char *sub = chttp_query_param(req, "path");
  char abs[1024];
  if (build_share_path(s, sub, abs, sizeof(abs)) < 0) {
    cJSON_Delete(reg); send_err(res, 400, "Invalid path"); return;
  }
  struct stat st;
  if (stat(abs, &st) != 0 || !S_ISREG(st.st_mode)) {
    cJSON_Delete(reg); fs_error(res, errno ? errno : EISDIR); return;
  }
  FILE *f = fopen(abs, "rb");
  if (!f) { cJSON_Delete(reg); fs_error(res, errno); return; }

  const char *base = strrchr(abs, '/'); base = base ? base + 1 : abs;
  char cd[1280];
  snprintf(cd, sizeof(cd), "attachment; filename=\"%s\"", base);
  chttp_set_header(res, "Content-Disposition", cd);
  chttp_set_header(res, "Content-Type", mime_from_ext(abs));

  if (chttp_body_alloc(res, (size_t)st.st_size) < 0) {
    fclose(f); cJSON_Delete(reg); send_err(res, 500, "OOM"); return;
  }
  size_t got = fread(res->body, 1, (size_t)st.st_size, f);
  res->body_len = got;
  fclose(f);
  cJSON_Delete(reg);
}

void handle_share_fs_upload_impl(HttpRequest *req, HttpResponse *res) {
  char user[128];
  if (current_username(user) < 0) {
    send_err(res, 401, "Unauthorized"); return;
  }
  const char *id = chttp_path_param(req, "share_id");
  cJSON *reg = NULL;
  cJSON *s = resolve_share_for_recipient(&reg, id, user, 1, res);
  if (!s) return;
  const char *sub = chttp_query_param(req, "path");
  char abs[1024];
  if (build_share_path(s, sub, abs, sizeof(abs)) < 0) {
    cJSON_Delete(reg); send_err(res, 400, "Invalid path"); return;
  }

  const char *cl_str = chttp_header(req, "Content-Length");
  if (!cl_str) {
    cJSON_Delete(reg); send_err(res, 411, "Content-Length required"); return;
  }
  size_t content_length = (size_t)strtoul(cl_str, NULL, 10);

  FILE *f = fopen(abs, "wb");
  if (!f) { cJSON_Delete(reg); fs_error(res, errno); return; }

  size_t written = 0;
  if (req->body && req->body_len > 0) {
    if (fwrite(req->body, 1, req->body_len, f) != req->body_len) {
      fclose(f); unlink(abs); cJSON_Delete(reg); fs_error(res, errno); return;
    }
    written = req->body_len;
  }

  char chunk[65536];
  while (written < content_length) {
    size_t want = sizeof(chunk);
    if (content_length - written < want) want = content_length - written;
    int r = (int)read(req->fd, chunk, want);
    if (r <= 0) {
      fclose(f); unlink(abs); cJSON_Delete(reg);
      send_err(res, 400, "Upload interrupted"); return;
    }
    if (fwrite(chunk, 1, (size_t)r, f) != (size_t)r) {
      fclose(f); unlink(abs); cJSON_Delete(reg); fs_error(res, errno); return;
    }
    written += (size_t)r;
  }
  fclose(f);
  cJSON_Delete(reg);
  chttp_set_status(res, 201);
  chttp_send_json(res, "{\"message\":\"uploaded\"}");
}

/* ---------------------------------------------------------------------- */
/* Initialisation + sweeper tick                                           */
/* ---------------------------------------------------------------------- */

int share_init(void) {
  if (mkdir(SHARE_REGISTRY_DIR, 0755) < 0 && errno != EEXIST) return -1;
  /* Ensure the file exists with valid empty registry. */
  if (access(SHARE_REGISTRY_PATH, R_OK) < 0 && errno == ENOENT) {
    cJSON *empty = cJSON_CreateObject();
    cJSON_AddItemToObject(empty, "shares", cJSON_CreateArray());
    char *txt = cJSON_PrintUnformatted(empty);
    if (txt) {
      write_atomic(SHARE_REGISTRY_PATH, txt, strlen(txt));
      free(txt);
    }
    cJSON_Delete(empty);
  }
  return 0;
}

void share_sweep_once(void) {
  cJSON *reg = registry_load();
  cJSON *arr = cJSON_GetObjectItem(reg, "shares");
  time_t now = time(NULL);
  int dirty = 0;

  cJSON *it;
  cJSON_ArrayForEach(it, arr) {
    if (jbool(it, "revoked")) continue;
    double exp = jnum(it, "expires_at");
    if (exp <= 0 || (time_t)exp > now) continue;
    /* Expired: remove ACLs + mark revoked. */
    struct passwd *pw = getpwnam(jstr(it, "recipient"));
    if (pw)
      revoke_share_acls(jstr(it, "source_path"), pw->pw_uid, jstr(it, "kind"));
    cJSON_ReplaceItemInObject(it, "revoked", cJSON_CreateBool(1));
    cJSON_AddNumberToObject(it, "revoked_at", (double)now);
    dirty = 1;
  }

  /* GC: drop entries revoked over 30 days ago. */
  for (int i = cJSON_GetArraySize(arr) - 1; i >= 0; i--) {
    cJSON *e = cJSON_GetArrayItem(arr, i);
    if (!jbool(e, "revoked")) continue;
    double rev_at = jnum(e, "revoked_at");
    if (rev_at <= 0) continue;
    if (now - (time_t)rev_at > 30L * 24 * 3600) {
      cJSON_DeleteItemFromArray(arr, i);
      dirty = 1;
    }
  }

  if (dirty) registry_save(reg);
  cJSON_Delete(reg);
}
