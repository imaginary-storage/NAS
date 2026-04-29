#include <errno.h>
#include <fcntl.h>
#include <pthread.h>
#include <pwd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <time.h>
#include <unistd.h>

#include "cJSON.h"
#include "aws_sync.h"
#include "auth/auth.h"
#include "utils/utils.h"

/* Resolve <home>/.imaginary/config/aws-sync.json — caller's home (handler) or
 * a specific user's home (scheduler).  Returns 0 on success. */
static int config_path_for_username(const char *username, char *out, size_t n) {
  struct passwd pw_buf, *pw;
  char buf[1024];
  if (getpwnam_r(username, &pw_buf, buf, sizeof(buf), &pw) != 0 || !pw)
    return -1;
  if (snprintf(out, n, "%s/.imaginary/config/aws-sync.json", pw->pw_dir) >= (int)n)
    return -1;
  return 0;
}

/* Returns 0 on success, -1 on failure (errno preserved by caller). */
static int read_file(const char *path, char **buf_out, size_t *len_out) {
  FILE *f = fopen(path, "rb");
  if (!f) return -1;
  fseek(f, 0, SEEK_END);
  long sz = ftell(f);
  fseek(f, 0, SEEK_SET);
  if (sz < 0 || sz > 64 * 1024) { fclose(f); errno = EFBIG; return -1; }
  char *buf = malloc((size_t)sz + 1);
  if (!buf) { fclose(f); errno = ENOMEM; return -1; }
  size_t got = fread(buf, 1, (size_t)sz, f);
  fclose(f);
  buf[got] = '\0';
  *buf_out = buf;
  *len_out = got;
  return 0;
}

/* Atomically replace the config file: write to <path>.tmp.<pid>, fsync, rename.
 * Same idiom we use for session files — concurrent readers never see a half-
 * written file. */
static int write_atomic(const char *path, const char *content, size_t len) {
  char tmppath[600];
  if (snprintf(tmppath, sizeof(tmppath), "%s.tmp.%d", path, (int)getpid())
      >= (int)sizeof(tmppath))
    return -1;
  int fd = open(tmppath, O_WRONLY | O_CREAT | O_TRUNC, 0600);
  if (fd < 0) return -1;
  ssize_t w = write(fd, content, len);
  fsync(fd);
  close(fd);
  if (w != (ssize_t)len) { unlink(tmppath); return -1; }
  if (rename(tmppath, path) < 0) { unlink(tmppath); return -1; }
  return 0;
}

/* Ensure <home>/.imaginary/config exists, mode 0700/0700.  Run as the user. */
static int ensure_config_dir(void) {
  mkdir(".imaginary", 0700);
  mkdir(".imaginary/config", 0700);
  return 0;
}

/* Strip credential fields from a config object — used in GET responses. */
static void redact_creds(cJSON *cfg) {
  cJSON *ak = cJSON_GetObjectItem(cfg, "accessKeyId");
  if (ak && cJSON_IsString(ak) && ak->valuestring && ak->valuestring[0])
    cJSON_ReplaceItemInObject(cfg, "accessKeyId", cJSON_CreateString("***"));
  cJSON *sk = cJSON_GetObjectItem(cfg, "secretAccessKey");
  if (sk && cJSON_IsString(sk) && sk->valuestring && sk->valuestring[0])
    cJSON_ReplaceItemInObject(cfg, "secretAccessKey", cJSON_CreateString("***"));
}

/* Validate a parsed config.  Returns NULL on ok, otherwise an error string. */
static const char *validate_config(cJSON *cfg) {
  cJSON *folder = cJSON_GetObjectItem(cfg, "folder");
  cJSON *bucket = cJSON_GetObjectItem(cfg, "bucket");
  cJSON *region = cJSON_GetObjectItem(cfg, "region");
  cJSON *interval = cJSON_GetObjectItem(cfg, "intervalMinutes");

  if (!cJSON_IsString(folder) || !folder->valuestring[0]) return "folder required";
  if (!safe_path(folder->valuestring))                    return "folder unsafe";
  if (!cJSON_IsString(bucket) || !bucket->valuestring[0]) return "bucket required";
  if (!cJSON_IsString(region) || !region->valuestring[0]) return "region required";
  if (interval && !cJSON_IsNumber(interval))              return "intervalMinutes must be a number";
  return NULL;
}

/* GET /aws-sync — return current user's config with creds redacted. */
void handle_aws_sync_get_impl(HttpRequest *req, HttpResponse *res) {
  (void)req;
  /* We're inside a user-priv fork; getuid() == real user. */
  struct passwd pw_buf, *pw;
  char buf[1024];
  if (getpwuid_r(getuid(), &pw_buf, buf, sizeof(buf), &pw) != 0 || !pw) {
    chttp_set_status(res, 500);
    chttp_send_json(res, "{\"error\":\"User lookup failed\"}");
    return;
  }
  char path[1024];
  if (config_path_for_username(pw->pw_name, path, sizeof(path)) < 0) {
    chttp_set_status(res, 500);
    chttp_send_json(res, "{\"error\":\"Path build failed\"}");
    return;
  }

  char *content = NULL;
  size_t len = 0;
  if (read_file(path, &content, &len) < 0) {
    /* Distinguish "no config yet" (return defaults) from a real read failure
     * — the latter can mask serious bugs (e.g. file became root-owned).      */
    if (errno != ENOENT) {
      char ebuf[1280];
      snprintf(ebuf, sizeof(ebuf),
               "{\"error\":\"Cannot read config: %s\",\"errno\":%d,\"path\":\"%s\"}",
               strerror(errno), errno, path);
      chttp_set_status(res, 500);
      chttp_send_json(res, ebuf);
      return;
    }
    cJSON *empty = cJSON_CreateObject();
    cJSON_AddBoolToObject(empty, "enabled", 0);
    cJSON_AddStringToObject(empty, "folder", "");
    cJSON_AddStringToObject(empty, "bucket", "");
    cJSON_AddStringToObject(empty, "prefix", "");
    cJSON_AddStringToObject(empty, "region", "us-east-1");
    cJSON_AddStringToObject(empty, "accessKeyId", "");
    cJSON_AddStringToObject(empty, "secretAccessKey", "");
    cJSON_AddStringToObject(empty, "storageClass", "DEEP_ARCHIVE");
    cJSON_AddNumberToObject(empty, "intervalMinutes", 5);
    cJSON_AddNullToObject(empty, "lastRun");
    chttp_send_cjson(res, empty);
    cJSON_Delete(empty);
    return;
  }

  cJSON *cfg = cJSON_ParseWithLength(content, len);
  free(content);
  if (!cfg) {
    chttp_set_status(res, 500);
    chttp_send_json(res, "{\"error\":\"Config malformed\"}");
    return;
  }
  redact_creds(cfg);
  chttp_send_cjson(res, cfg);
  cJSON_Delete(cfg);
}

/* PUT /aws-sync — replace config.  Body is JSON. */
void handle_aws_sync_put_impl(HttpRequest *req, HttpResponse *res) {
  if (!req->body || req->body_len == 0) {
    chttp_set_status(res, 400);
    chttp_send_json(res, "{\"error\":\"Body required\"}");
    return;
  }
  cJSON *body = cJSON_ParseWithLength(req->body, req->body_len);
  if (!body) {
    chttp_set_status(res, 400);
    chttp_send_json(res, "{\"error\":\"Invalid JSON\"}");
    return;
  }
  const char *err = validate_config(body);
  if (err) {
    char ebuf[256];
    snprintf(ebuf, sizeof(ebuf), "{\"error\":\"%s\"}", err);
    cJSON_Delete(body);
    chttp_set_status(res, 400);
    chttp_send_json(res, ebuf);
    return;
  }

  struct passwd pw_buf, *pw;
  char nbuf[1024];
  if (getpwuid_r(getuid(), &pw_buf, nbuf, sizeof(nbuf), &pw) != 0 || !pw) {
    cJSON_Delete(body);
    chttp_set_status(res, 500);
    chttp_send_json(res, "{\"error\":\"User lookup failed\"}");
    return;
  }
  char path[1024];
  if (config_path_for_username(pw->pw_name, path, sizeof(path)) < 0) {
    cJSON_Delete(body);
    chttp_set_status(res, 500);
    chttp_send_json(res, "{\"error\":\"Path build failed\"}");
    return;
  }

  /* Preserve any existing lastRun if the body doesn't supply one — the user
   * shouldn't lose status info just by saving config. */
  if (!cJSON_GetObjectItem(body, "lastRun")) {
    char *prev_buf = NULL;
    size_t prev_len = 0;
    if (read_file(path, &prev_buf, &prev_len) == 0) {
      cJSON *prev = cJSON_ParseWithLength(prev_buf, prev_len);
      if (prev) {
        cJSON *lr = cJSON_DetachItemFromObject(prev, "lastRun");
        if (lr) cJSON_AddItemToObject(body, "lastRun", lr);
        cJSON_Delete(prev);
      }
      free(prev_buf);
    }
  }

  ensure_config_dir();

  char *out = cJSON_PrintUnformatted(body);
  cJSON_Delete(body);
  if (!out) {
    chttp_set_status(res, 500);
    chttp_send_json(res, "{\"error\":\"Serialization failed\"}");
    return;
  }
  if (write_atomic(path, out, strlen(out)) < 0) {
    int e = errno;
    free(out);
    fs_error(res, e);
    return;
  }
  free(out);
  chttp_send_json(res, "{\"message\":\"saved\"}");
}

/* DELETE /aws-sync — remove the config file. */
void handle_aws_sync_delete_impl(HttpRequest *req, HttpResponse *res) {
  (void)req;
  struct passwd pw_buf, *pw;
  char nbuf[1024];
  if (getpwuid_r(getuid(), &pw_buf, nbuf, sizeof(nbuf), &pw) != 0 || !pw) {
    chttp_set_status(res, 500);
    chttp_send_json(res, "{\"error\":\"User lookup failed\"}");
    return;
  }
  char path[1024];
  if (config_path_for_username(pw->pw_name, path, sizeof(path)) < 0) {
    chttp_set_status(res, 500);
    chttp_send_json(res, "{\"error\":\"Path build failed\"}");
    return;
  }
  if (unlink(path) < 0 && errno != ENOENT) {
    fs_error(res, errno);
    return;
  }
  chttp_send_json(res, "{\"message\":\"cleared\"}");
}

/* Internal — used by the scheduler too.  Run one sync for `username` whose
 * config is at `path`.  Updates the lastRun block atomically. */
void aws_sync_run_one_for_user(const char *username, const char *path);

/* Worker thread payload — owned by the spawned thread, freed when it exits. */
typedef struct {
  char username[128];
  char path[1024];
} RunArgs;

static void *run_worker(void *arg) {
  RunArgs *ra = (RunArgs *)arg;
  aws_sync_run_one_for_user(ra->username, ra->path);
  free(ra);
  return NULL;
}

/* POST /aws-sync/run — kick off a sync for the calling user.
 *
 * Registered as DEFINE_NOPRIV_AUTH_ROUTE so the handler runs as root in the
 * main process: we need root to fork-and-setuid via auth_fork_exec_as_user().
 * The actual aws s3 sync runs in a detached pthread, so this returns 202
 * immediately rather than blocking the connection for minutes. */
void handle_aws_sync_run_impl(HttpRequest *req, HttpResponse *res) {
  /* Re-derive username from the active_session cookie — NOPRIV macros don't
   * pass it through. */
  const char *cookie_hdr = chttp_header(req, "Cookie");
  char sid[65] = "", claimed[128] = "", username[128] = "";
  if (!parse_active_session_cookie(cookie_hdr, sid, claimed) ||
      validate_session(sid, username, sizeof(username)) < 0 ||
      strcmp(claimed, username) != 0) {
    chttp_set_status(res, 401);
    chttp_send_json(res, "{\"error\":\"Unauthorized\"}");
    return;
  }

  char path[1024];
  if (config_path_for_username(username, path, sizeof(path)) < 0) {
    chttp_set_status(res, 500);
    chttp_send_json(res, "{\"error\":\"Path build failed\"}");
    return;
  }

  /* Verify config exists & is enabled before spinning up the worker. */
  char *cbuf = NULL;
  size_t clen = 0;
  if (read_file(path, &cbuf, &clen) < 0) {
    chttp_set_status(res, 404);
    chttp_send_json(res, "{\"error\":\"No config\"}");
    return;
  }
  cJSON *cfg = cJSON_ParseWithLength(cbuf, clen);
  free(cbuf);
  if (!cfg) {
    chttp_set_status(res, 500);
    chttp_send_json(res, "{\"error\":\"Config malformed\"}");
    return;
  }
  cJSON *en = cJSON_GetObjectItem(cfg, "enabled");
  int enabled = en && cJSON_IsTrue(en);
  cJSON_Delete(cfg);
  if (!enabled) {
    chttp_set_status(res, 409);
    chttp_send_json(res, "{\"error\":\"Sync is disabled\"}");
    return;
  }

  RunArgs *ra = calloc(1, sizeof(*ra));
  if (!ra) {
    chttp_set_status(res, 500);
    chttp_send_json(res, "{\"error\":\"Out of memory\"}");
    return;
  }
  strncpy(ra->username, username, sizeof(ra->username) - 1);
  strncpy(ra->path,     path,     sizeof(ra->path) - 1);

  pthread_t tid;
  if (pthread_create(&tid, NULL, run_worker, ra) != 0) {
    free(ra);
    chttp_set_status(res, 503);
    chttp_send_json(res, "{\"error\":\"Failed to spawn worker\"}");
    return;
  }
  pthread_detach(tid);

  chttp_set_status(res, 202);
  chttp_send_json(res, "{\"message\":\"sync started\"}");
}
