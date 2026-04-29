#include <errno.h>
#include <grp.h>
#include <pwd.h>
#include <security/pam_appl.h>
#include <security/pam_misc.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/select.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

#include "auth.h"

struct pam_creds {
  const char *password;
};

static int pam_conv_func(int num_msg, const struct pam_message **msg,
                         struct pam_response **resp, void *appdata_ptr) {
  struct pam_creds *c = appdata_ptr;
  struct pam_response *r = calloc(num_msg, sizeof(*r));
  if (!r)
    return PAM_CONV_ERR;
  for (int i = 0; i < num_msg; i++) {
    if (msg[i]->msg_style == PAM_PROMPT_ECHO_OFF ||
        msg[i]->msg_style == PAM_PROMPT_ECHO_ON) {
      r[i].resp = strdup(c->password);
    }
  }
  *resp = r;
  return PAM_SUCCESS;
}

int authenticate_pam(const char *username, const char *password) {
  struct pam_creds creds = {.password = password};
  struct pam_conv conv = {pam_conv_func, &creds};
  pam_handle_t *pamh = NULL;
  int ret = pam_start("login", username, &conv, &pamh);
  if (ret != PAM_SUCCESS)
    return -1;
  ret = pam_authenticate(pamh, 0);
  pam_end(pamh, ret);
  return (ret == PAM_SUCCESS) ? 0 : -1;
}

int fork_and_run(HttpRequest *req, HttpResponse *res,
                 RouteHandler handler, const char *username) {
  /* Look up user info before forking (use reentrant variant). */
  struct passwd pw_buf, *pw;
  char pw_strbuf[1024];
  if (getpwnam_r(username, &pw_buf, pw_strbuf, sizeof(pw_strbuf), &pw) != 0 ||
      !pw) {
    chttp_set_status(res, 500);
    chttp_send_json(res, "{\"error\":\"System user account not found\"}");
    return -1;
  }

  /*
   * Use a pipe so the parent can detect child exit without SIGALRM/signals.
   * The write-end is inherited by the child; when _exit() closes it, the
   * parent's select() sees EOF on the read-end.
   */
  int pipefd[2];
  if (pipe(pipefd) < 0) {
    chttp_set_status(res, 503);
    chttp_send_json(res, "{\"error\":\"Service temporarily unavailable\"}");
    return -1;
  }

  int client_fd = req->fd;

  pid_t pid = fork();
  if (pid < 0) {
    close(pipefd[0]);
    close(pipefd[1]);
    chttp_set_status(res, 503);
    chttp_send_json(res, "{\"error\":\"Service temporarily unavailable\"}");
    return -1;
  }

  /* ------------------------------------------------------------------ */
  /* Child process                                                        */
  /* ------------------------------------------------------------------ */
  if (pid == 0) {
    close(pipefd[0]); /* child does not read from pipe */

    /* Release the listening socket — child must not accept connections. */
    if (g_server_fd >= 0)
      close(g_server_fd);

/* Convenience: send an error response from the child and exit. */
#define CHILD_ERR(http_code, json_msg)                                         \
  do {                                                                         \
    HttpResponse _er;                                                          \
    memset(&_er, 0, sizeof(_er));                                              \
    _er.status = (http_code);                                                  \
    chttp_send_json(&_er, (json_msg));                                         \
    chttp_write_response(client_fd, &_er);                                     \
    close(client_fd);                                                          \
    close(pipefd[1]);                                                          \
    _exit(1);                                                                  \
  } while (0)

    /* Drop supplementary groups first. */
    if (initgroups(username, pw->pw_gid) < 0)
      CHILD_ERR(500,
                "{\"error\":\"Failed to initialise supplementary groups\"}");

    /* Set GID before UID — once root is surrendered GID cannot be changed. */
    if (setgid(pw->pw_gid) < 0)
      CHILD_ERR(500, "{\"error\":\"Failed to set process group\"}");

    if (setuid(pw->pw_uid) < 0)
      CHILD_ERR(500, "{\"error\":\"Failed to set process user\"}");

    /* Verify privilege drop is irreversible (skip if user is root). */
    if (pw->pw_uid != 0 && setuid(0) == 0)
      CHILD_ERR(500, "{\"error\":\"Privilege drop verification failed\"}");

    /* Change to user's home directory; fall back to /tmp on failure. */
    if (chdir(pw->pw_dir) < 0)
      chdir("/tmp");

    /* Run the actual request handler. */
    HttpResponse child_res;
    memset(&child_res, 0, sizeof(child_res));
    child_res.status = 200;
    handler(req, &child_res);

    /* Write response to client then tear down. */
    chttp_write_response(client_fd, &child_res);
    close(client_fd);
    close(pipefd[1]); /* EOF on pipe — signals parent we are done */
    _exit(0);

#undef CHILD_ERR
  }

  /* ------------------------------------------------------------------ */
  /* Parent process                                                       */
  /* ------------------------------------------------------------------ */
  close(pipefd[1]); /* parent does not write to pipe */

  /* Wait for child to finish (pipe read-end gets EOF on child exit). */
  fd_set rfds;
  FD_ZERO(&rfds);
  FD_SET(pipefd[0], &rfds);
  struct timeval tv = {.tv_sec = FORK_HANDLER_TIMEOUT_SEC, .tv_usec = 0};

  int sel;
  do {
    sel = select(pipefd[0] + 1, &rfds, NULL, NULL, &tv);
  } while (sel < 0 && errno == EINTR);

  close(pipefd[0]);

  int timed_out = (sel <= 0);
  if (timed_out) {
    /* Child is hung — kill it unconditionally. */
    kill(pid, SIGKILL);
  }

  /* Always reap to prevent zombies. */
  int wstatus;
  waitpid(pid, &wstatus, 0);

  if (timed_out) {
    /* Child never wrote a response; write the gateway-timeout ourselves. */
    HttpResponse err_res;
    memset(&err_res, 0, sizeof(err_res));
    err_res.status = 504;
    chttp_send_json(&err_res, "{\"error\":\"Request handler timed out\"}");
    chttp_write_response(client_fd, &err_res);
    chttp_response_free(&err_res);
  }

  /*
   * Set status to 0 — the sentinel that tells connection_thread the response
   * has already been written to the socket and chttp_write_response must be
   * skipped.
   */
  res->status = 0;
  return 0;
}

int fork_and_stream(HttpRequest *req, HttpResponse *res,
                    RouteHandler handler, const char *username) {
  struct passwd pw_buf, *pw;
  char pw_strbuf[1024];
  if (getpwnam_r(username, &pw_buf, pw_strbuf, sizeof(pw_strbuf), &pw) != 0 ||
      !pw) {
    chttp_set_status(res, 500);
    chttp_send_json(res, "{\"error\":\"System user account not found\"}");
    return -1;
  }

  int pipefd[2];
  if (pipe(pipefd) < 0) {
    chttp_set_status(res, 503);
    chttp_send_json(res, "{\"error\":\"Service temporarily unavailable\"}");
    return -1;
  }

  int client_fd = req->fd;

  pid_t pid = fork();
  if (pid < 0) {
    close(pipefd[0]);
    close(pipefd[1]);
    chttp_set_status(res, 503);
    chttp_send_json(res, "{\"error\":\"Service temporarily unavailable\"}");
    return -1;
  }

  if (pid == 0) {
    close(pipefd[0]);
    if (g_server_fd >= 0) close(g_server_fd);

#define SCHILD_ERR(http_code, json_msg)                                        \
  do {                                                                         \
    HttpResponse _er;                                                          \
    memset(&_er, 0, sizeof(_er));                                              \
    _er.status = (http_code);                                                  \
    chttp_send_json(&_er, (json_msg));                                         \
    chttp_write_response(client_fd, &_er);                                     \
    chttp_response_free(&_er);                                                 \
    close(client_fd);                                                          \
    close(pipefd[1]);                                                          \
    _exit(1);                                                                  \
  } while (0)

    if (initgroups(username, pw->pw_gid) < 0)
      SCHILD_ERR(500, "{\"error\":\"Failed to initialise supplementary groups\"}");
    if (setgid(pw->pw_gid) < 0)
      SCHILD_ERR(500, "{\"error\":\"Failed to set process group\"}");
    if (setuid(pw->pw_uid) < 0)
      SCHILD_ERR(500, "{\"error\":\"Failed to set process user\"}");
    if (pw->pw_uid != 0 && setuid(0) == 0)
      SCHILD_ERR(500, "{\"error\":\"Privilege drop verification failed\"}");
    if (chdir(pw->pw_dir) < 0) chdir("/tmp");

    HttpResponse child_res;
    memset(&child_res, 0, sizeof(child_res));
    child_res.status = 200;
    handler(req, &child_res);

    chttp_write_response(client_fd, &child_res);
    chttp_response_free(&child_res);
    close(client_fd);
    close(pipefd[1]);
    _exit(0);

#undef SCHILD_ERR
  }

  /* Parent: wait up to FORK_STREAM_TIMEOUT_SEC for the upload to complete. */
  close(pipefd[1]);

  fd_set rfds;
  FD_ZERO(&rfds);
  FD_SET(pipefd[0], &rfds);
  struct timeval tv = {.tv_sec = FORK_STREAM_TIMEOUT_SEC, .tv_usec = 0};

  int sel;
  do {
    sel = select(pipefd[0] + 1, &rfds, NULL, NULL, &tv);
  } while (sel < 0 && errno == EINTR);

  close(pipefd[0]);

  int timed_out = (sel <= 0);
  if (timed_out) kill(pid, SIGKILL);

  int wstatus;
  waitpid(pid, &wstatus, 0);

  if (timed_out) {
    HttpResponse err_res;
    memset(&err_res, 0, sizeof(err_res));
    err_res.status = 504;
    chttp_send_json(&err_res, "{\"error\":\"Upload timed out\"}");
    chttp_write_response(client_fd, &err_res);
    chttp_response_free(&err_res);
  }

  res->status = 0;
  return 0;
}

int auth_fork_exec_as_user(const char *username,
                           char *const argv[],
                           char *const envp[],
                           int timeout_sec,
                           char *out_tail, size_t tail_size,
                           int *exit_code_out) {
  if (exit_code_out) *exit_code_out = -1;
  if (out_tail && tail_size > 0) out_tail[0] = '\0';

  struct passwd pw_buf, *pw;
  char pw_strbuf[1024];
  if (getpwnam_r(username, &pw_buf, pw_strbuf, sizeof(pw_strbuf), &pw) != 0 ||
      !pw)
    return -1;

  int outpipe[2];
  if (pipe(outpipe) < 0) return -1;

  pid_t pid = fork();
  if (pid < 0) {
    close(outpipe[0]);
    close(outpipe[1]);
    return -1;
  }

  if (pid == 0) {
    /* Child: redirect stdout+stderr to pipe, drop privileges, exec. */
    close(outpipe[0]);
    if (g_server_fd >= 0) close(g_server_fd);

    dup2(outpipe[1], STDOUT_FILENO);
    dup2(outpipe[1], STDERR_FILENO);
    close(outpipe[1]);

    if (initgroups(username, pw->pw_gid) < 0) _exit(126);
    if (setgid(pw->pw_gid) < 0)               _exit(126);
    if (setuid(pw->pw_uid) < 0)               _exit(126);
    if (pw->pw_uid != 0 && setuid(0) == 0)    _exit(126);
    if (chdir(pw->pw_dir) < 0)                chdir("/tmp");

    /* Use execvp so argv[0] is searched against PATH from envp (PATH must be
     * present in envp).  Override the global `environ` pointer first because
     * execvp looks at it.  The cast drops the parameter-level const — safe
     * because we are in the child and about to exec. */
    extern char **environ;
    environ = (char **)envp;
    execvp(argv[0], argv);
    /* exec failed — emit a single line so the parent's tail explains it. */
    fprintf(stderr, "execvp(%s): %s\n", argv[0], strerror(errno));
    _exit(127);
  }

  /* Parent: drain pipe into a tail ring buffer until EOF or timeout. */
  close(outpipe[1]);

  size_t cap = (out_tail && tail_size > 1) ? tail_size - 1 : 0;
  size_t filled = 0;
  int wrapped = 0;
  time_t deadline = (timeout_sec > 0) ? time(NULL) + timeout_sec : 0;
  int timed_out = 0;

  for (;;) {
    fd_set rfds;
    FD_ZERO(&rfds);
    FD_SET(outpipe[0], &rfds);
    struct timeval tv;
    if (deadline) {
      time_t now = time(NULL);
      if (now >= deadline) { timed_out = 1; break; }
      tv.tv_sec  = deadline - now;
      tv.tv_usec = 0;
    } else {
      tv.tv_sec = 60; tv.tv_usec = 0;
    }

    int sel = select(outpipe[0] + 1, &rfds, NULL, NULL, &tv);
    if (sel < 0) {
      if (errno == EINTR) continue;
      break;
    }
    if (sel == 0) continue;

    char buf[4096];
    ssize_t n = read(outpipe[0], buf, sizeof(buf));
    if (n <= 0) break;

    if (cap > 0) {
      /* Append into ring; only the last `cap` bytes survive. */
      for (ssize_t i = 0; i < n; i++) {
        out_tail[filled] = buf[i];
        filled++;
        if (filled >= cap) { filled = 0; wrapped = 1; }
      }
    }
  }
  close(outpipe[0]);

  if (timed_out) kill(pid, SIGKILL);

  int wstatus = 0;
  waitpid(pid, &wstatus, 0);

  if (cap > 0) {
    /* Linearise the ring. */
    if (wrapped) {
      char *tmp = malloc(cap + 1);
      if (tmp) {
        memcpy(tmp,            out_tail + filled, cap - filled);
        memcpy(tmp + cap - filled, out_tail,      filled);
        memcpy(out_tail, tmp, cap);
        out_tail[cap] = '\0';
        free(tmp);
      } else {
        out_tail[filled] = '\0';
      }
    } else {
      out_tail[filled] = '\0';
    }
  }

  if (exit_code_out) {
    if (timed_out)                  *exit_code_out = -1;
    else if (WIFEXITED(wstatus))    *exit_code_out = WEXITSTATUS(wstatus);
    else if (WIFSIGNALED(wstatus))  *exit_code_out = 128 + WTERMSIG(wstatus);
    else                            *exit_code_out = -1;
  }
  return 0;
}
