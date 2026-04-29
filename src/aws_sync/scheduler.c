#include <dirent.h>
#include <fcntl.h>
#include <pthread.h>
#include <pwd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>

#include "cJSON.h"
#include "aws_sync.h"
#include "auth/auth.h"

#define SCHEDULER_TICK_SEC      60
#define SYNC_TIMEOUT_SEC        (15 * 60)   /* per-run timeout */
#define LASTRUN_SUMMARY_BYTES   4096

static pthread_t g_thread;
static volatile int g_should_stop = 0;
static int g_thread_started = 0;

/* ---------------------------------------------------------------------- */
/* Shared sync runner — used by both the scheduler and the manual run     */
/* handler.                                                               */
/* ---------------------------------------------------------------------- */

static int read_text(const char *path, char **out, size_t *out_len) {
  FILE *f = fopen(path, "rb");
  if (!f) return -1;
  fseek(f, 0, SEEK_END);
  long sz = ftell(f);
  fseek(f, 0, SEEK_SET);
  if (sz < 0 || sz > 64 * 1024) { fclose(f); return -1; }
  char *buf = malloc((size_t)sz + 1);
  if (!buf) { fclose(f); return -1; }
  size_t got = fread(buf, 1, (size_t)sz, f);
  fclose(f);
  buf[got] = '\0';
  *out = buf;
  *out_len = got;
  return 0;
}

/* Atomic JSON file write — temp + fsync + rename.  The scheduler (and the
 * NOPRIV /aws-sync/run worker) runs as root, so after rename we chown back
 * to the owning user, otherwise the user's own GET (which runs in a
 * priv-dropped fork) can no longer read its config. */
static int write_atomic(const char *path, const char *content, size_t len,
                        mode_t mode, uid_t uid, gid_t gid) {
  char tmppath[1024];
  if (snprintf(tmppath, sizeof(tmppath), "%s.tmp.%d", path, (int)getpid())
      >= (int)sizeof(tmppath))
    return -1;
  int fd = open(tmppath, O_WRONLY | O_CREAT | O_TRUNC, mode);
  if (fd < 0) return -1;
  if (uid != (uid_t)-1) {
    /* fchown the temp before rename so there's no window of root ownership. */
    if (fchown(fd, uid, gid) < 0) {
      close(fd);
      unlink(tmppath);
      return -1;
    }
  }
  ssize_t w = write(fd, content, len);
  fsync(fd);
  close(fd);
  if (w != (ssize_t)len) { unlink(tmppath); return -1; }
  if (rename(tmppath, path) < 0) { unlink(tmppath); return -1; }
  return 0;
}

/* Format a unix-time as ISO 8601 UTC into a 32-byte buffer. */
static void iso8601(time_t t, char out[32]) {
  struct tm tm;
  gmtime_r(&t, &tm);
  strftime(out, 32, "%Y-%m-%dT%H:%M:%SZ", &tm);
}

/* Build the env array for the child.  Caller frees each strdup'd slot.
 * `home` is used to add <home>/.local/bin to PATH (pip-user aws installs). */
static char **build_env(const char *access_key, const char *secret_key,
                        const char *region, const char *home) {
  char **envp = calloc(7, sizeof(char *));
  if (!envp) return NULL;
  size_t bsz = 1024;
  char *e0 = malloc(bsz), *e1 = malloc(bsz), *e2 = malloc(bsz), *e3 = malloc(bsz),
       *e4 = malloc(bsz), *e5 = malloc(bsz);
  if (!e0 || !e1 || !e2 || !e3 || !e4 || !e5) {
    free(e0); free(e1); free(e2); free(e3); free(e4); free(e5); free(envp);
    return NULL;
  }
  snprintf(e0, bsz, "AWS_ACCESS_KEY_ID=%s",     access_key ? access_key : "");
  snprintf(e1, bsz, "AWS_SECRET_ACCESS_KEY=%s", secret_key ? secret_key : "");
  snprintf(e2, bsz, "AWS_DEFAULT_REGION=%s",    region ? region : "us-east-1");
  /* Cover distro pkg, pip-system, pip-user, snap, and the AWS CLI v2
   * standalone install location.  execvp will walk this looking for `aws`. */
  if (home && home[0])
    snprintf(e3, bsz,
             "PATH=%s/.local/bin:/usr/local/bin:/usr/bin:/bin:/snap/bin:"
             "/usr/local/aws-cli/v2/current/bin",
             home);
  else
    snprintf(e3, bsz,
             "PATH=/usr/local/bin:/usr/bin:/bin:/snap/bin:"
             "/usr/local/aws-cli/v2/current/bin");
  snprintf(e4, bsz, "HOME=%s", home && home[0] ? home : "/tmp");
  snprintf(e5, bsz, "LANG=C.UTF-8");
  envp[0] = e0; envp[1] = e1; envp[2] = e2; envp[3] = e3;
  envp[4] = e4; envp[5] = e5; envp[6] = NULL;
  return envp;
}

static void free_env(char **envp) {
  if (!envp) return;
  for (int i = 0; envp[i]; i++) free(envp[i]);
  free(envp);
}

/* Run one sync for `username` whose config lives at `path`.  Updates the
 * lastRun block in the config atomically. */
void aws_sync_run_one_for_user(const char *username, const char *path) {
  char *cbuf = NULL;
  size_t clen = 0;
  if (read_text(path, &cbuf, &clen) < 0) return;
  cJSON *cfg = cJSON_ParseWithLength(cbuf, clen);
  free(cbuf);
  if (!cfg) return;

  cJSON *folder_j = cJSON_GetObjectItem(cfg, "folder");
  cJSON *bucket_j = cJSON_GetObjectItem(cfg, "bucket");
  cJSON *prefix_j = cJSON_GetObjectItem(cfg, "prefix");
  cJSON *region_j = cJSON_GetObjectItem(cfg, "region");
  cJSON *ak_j     = cJSON_GetObjectItem(cfg, "accessKeyId");
  cJSON *sk_j     = cJSON_GetObjectItem(cfg, "secretAccessKey");
  cJSON *cls_j    = cJSON_GetObjectItem(cfg, "storageClass");

  if (!cJSON_IsString(folder_j) || !cJSON_IsString(bucket_j)) {
    cJSON_Delete(cfg);
    return;
  }

  const char *folder = folder_j->valuestring;
  const char *bucket = bucket_j->valuestring;
  const char *prefix = (cJSON_IsString(prefix_j) ? prefix_j->valuestring : "");
  const char *region = (cJSON_IsString(region_j) ? region_j->valuestring : "us-east-1");
  const char *ak     = (cJSON_IsString(ak_j) ? ak_j->valuestring : "");
  const char *sk     = (cJSON_IsString(sk_j) ? sk_j->valuestring : "");
  const char *cls    = (cJSON_IsString(cls_j) ? cls_j->valuestring : "DEEP_ARCHIVE");

  /* Build s3://bucket/prefix destination. */
  char dest[1024];
  if (prefix && prefix[0])
    snprintf(dest, sizeof(dest), "s3://%s/%s", bucket, prefix);
  else
    snprintf(dest, sizeof(dest), "s3://%s", bucket);

  /* Look up the user's home, uid, gid.  Home enriches PATH (pip-user installs
   * put `aws` in <home>/.local/bin).  uid/gid are needed so we can fchown the
   * config file after rewriting it as root — otherwise the user (whose own
   * GET runs in a privilege-dropped fork) loses read access. */
  char home[512] = "";
  uid_t target_uid = (uid_t)-1;
  gid_t target_gid = (gid_t)-1;
  {
    struct passwd pw_buf, *pw;
    char pwbuf[1024];
    if (getpwnam_r(username, &pw_buf, pwbuf, sizeof(pwbuf), &pw) == 0 && pw) {
      strncpy(home, pw->pw_dir, sizeof(home) - 1);
      target_uid = pw->pw_uid;
      target_gid = pw->pw_gid;
    }
  }

  /* argv[0] = "aws" basename — execvp inside auth_fork_exec_as_user searches
   * the PATH we build in build_env(). */
  char *argv[] = {
    (char *)"aws",
    (char *)"s3", (char *)"sync",
    (char *)folder, dest,
    (char *)"--storage-class", (char *)cls,
    (char *)"--delete",
    NULL
  };
  char **envp = build_env(ak, sk, region, home);

  time_t started = time(NULL);
  char summary[LASTRUN_SUMMARY_BYTES];
  int rc = -1;
  if (envp) {
    auth_fork_exec_as_user(username, argv, envp,
                           SYNC_TIMEOUT_SEC,
                           summary, sizeof(summary), &rc);
  } else {
    snprintf(summary, sizeof(summary), "out of memory building env");
  }
  time_t finished = time(NULL);

  free_env(envp);

  /* Patch lastRun back into the config and persist atomically.  We're running
   * as root in the scheduler, so chmod 0600 stays correct. */
  cJSON_DeleteItemFromObject(cfg, "lastRun");
  cJSON *lr = cJSON_CreateObject();
  char ts[32];
  iso8601(started, ts);  cJSON_AddStringToObject(lr, "startedAt",  ts);
  iso8601(finished, ts); cJSON_AddStringToObject(lr, "finishedAt", ts);
  cJSON_AddNumberToObject(lr, "exitCode", rc);
  cJSON_AddStringToObject(lr, "summary",  summary);
  cJSON_AddItemToObject(cfg, "lastRun", lr);

  char *out = cJSON_PrintUnformatted(cfg);
  cJSON_Delete(cfg);
  if (out) {
    write_atomic(path, out, strlen(out), 0600, target_uid, target_gid);
    free(out);
  }
}

/* ---------------------------------------------------------------------- */
/* Scheduler thread                                                        */
/* ---------------------------------------------------------------------- */

/* Parse ISO 8601 UTC ("YYYY-MM-DDTHH:MM:SSZ") to time_t.  Returns 0 if
 * unparseable. */
static time_t parse_iso8601(const char *s) {
  if (!s) return 0;
  struct tm tm; memset(&tm, 0, sizeof(tm));
  if (sscanf(s, "%d-%d-%dT%d:%d:%dZ",
             &tm.tm_year, &tm.tm_mon, &tm.tm_mday,
             &tm.tm_hour, &tm.tm_min, &tm.tm_sec) != 6) return 0;
  tm.tm_year -= 1900;
  tm.tm_mon  -= 1;
  return timegm(&tm);
}

/* Decide whether `path` is an enabled config that's due to run. */
static int config_is_due(const char *path, int *interval_min_out) {
  char *buf = NULL;
  size_t len = 0;
  if (read_text(path, &buf, &len) < 0) return 0;
  cJSON *cfg = cJSON_ParseWithLength(buf, len);
  free(buf);
  if (!cfg) return 0;

  int due = 0;
  cJSON *en = cJSON_GetObjectItem(cfg, "enabled");
  if (en && cJSON_IsTrue(en)) {
    cJSON *iv = cJSON_GetObjectItem(cfg, "intervalMinutes");
    int interval = (iv && cJSON_IsNumber(iv)) ? (int)iv->valuedouble : 5;
    if (interval < 1) interval = 1;
    if (interval_min_out) *interval_min_out = interval;

    cJSON *lr = cJSON_GetObjectItem(cfg, "lastRun");
    time_t last = 0;
    if (lr && cJSON_IsObject(lr)) {
      cJSON *fa = cJSON_GetObjectItem(lr, "finishedAt");
      if (cJSON_IsString(fa)) last = parse_iso8601(fa->valuestring);
    }
    time_t now = time(NULL);
    if (last == 0 || now - last >= interval * 60) due = 1;
  }
  cJSON_Delete(cfg);
  return due;
}

/* Iterate over /home entries and check each user's aws-sync.json. */
static void scheduler_tick(void) {
  DIR *home = opendir("/home");
  if (!home) return;
  struct dirent *de;
  while ((de = readdir(home)) != NULL) {
    if (de->d_name[0] == '.') continue;

    char cfg_path[1024];
    if (snprintf(cfg_path, sizeof(cfg_path),
                 "/home/%s/.imaginary/config/aws-sync.json",
                 de->d_name) >= (int)sizeof(cfg_path))
      continue;

    struct stat st;
    if (stat(cfg_path, &st) != 0) continue;

    int interval = 5;
    if (!config_is_due(cfg_path, &interval)) continue;

    /* The directory name doesn't necessarily match a real user — let getpwnam
     * confirm.  This avoids running for orphaned home dirs. */
    struct passwd pw_buf, *pw;
    char nbuf[1024];
    if (getpwnam_r(de->d_name, &pw_buf, nbuf, sizeof(nbuf), &pw) != 0 || !pw)
      continue;

    aws_sync_run_one_for_user(de->d_name, cfg_path);
  }
  closedir(home);
}

static void *scheduler_main(void *arg) {
  (void)arg;
  while (!g_should_stop) {
    scheduler_tick();
    /* Sleep in 1-second slices so stop is responsive. */
    for (int i = 0; i < SCHEDULER_TICK_SEC && !g_should_stop; i++) sleep(1);
  }
  return NULL;
}

void aws_sync_scheduler_start(void) {
  if (g_thread_started) return;
  g_should_stop = 0;
  if (pthread_create(&g_thread, NULL, scheduler_main, NULL) == 0) {
    pthread_detach(g_thread);
    g_thread_started = 1;
  }
}

void aws_sync_scheduler_stop(void) {
  g_should_stop = 1;
}
