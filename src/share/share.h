#ifndef SHARE_H
#define SHARE_H

#include "chttp.h"

#define SHARE_REGISTRY_DIR  "/var/lib/imaginary"
#define SHARE_REGISTRY_PATH "/var/lib/imaginary/shares.json"

/* Initialise the registry on server start.  Creates SHARE_REGISTRY_DIR
 * (mode 0755, root-owned) and an empty shares.json if absent.  Must be
 * called before any other share_* function.  Returns 0 on success. */
int share_init(void);

/* Run one expiry-sweep tick: revoke every share whose expires_at has passed.
 * Idempotent.  Called by sweeper.c. */
void share_sweep_once(void);

/* Control plane (NOPRIV — root). */
void handle_share_create_impl(HttpRequest *req, HttpResponse *res);
void handle_share_revoke_impl(HttpRequest *req, HttpResponse *res);

/* Read-side listings (AUTH — recipient/sharer fork). */
void handle_share_list_incoming_impl(HttpRequest *req, HttpResponse *res);
void handle_share_list_outgoing_impl(HttpRequest *req, HttpResponse *res);
void handle_share_list_users_impl(HttpRequest *req, HttpResponse *res);

/* Data plane (AUTH — recipient fork; ACL enforces). */
void handle_share_fs_list_impl(HttpRequest *req, HttpResponse *res);
void handle_share_fs_stat_impl(HttpRequest *req, HttpResponse *res);
void handle_share_fs_read_impl(HttpRequest *req, HttpResponse *res);
void handle_share_fs_write_impl(HttpRequest *req, HttpResponse *res);
void handle_share_fs_mkdir_impl(HttpRequest *req, HttpResponse *res);
void handle_share_fs_delete_impl(HttpRequest *req, HttpResponse *res);
void handle_share_fs_download_impl(HttpRequest *req, HttpResponse *res);
void handle_share_fs_upload_impl(HttpRequest *req, HttpResponse *res);

#endif
