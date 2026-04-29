#pragma once
#include "chttp.h"

/*
 * AWS Sync — write-only Glacier-style archive of one folder per user.
 *
 * - Per-user config at <home>/.imaginary/config/aws-sync.json (mode 0600).
 * - Single scheduler thread, spawned at server start, scans all users'
 *   configs every minute and shells out to `aws s3 sync` as the user when
 *   the next-run time has elapsed.
 * - Routes (registered in main.c, all DEFINE_AUTH_ROUTE-wrapped) read and
 *   write only the calling user's config.
 */

/* Route handler implementations (called from main.c via DEFINE_AUTH_ROUTE). */
void handle_aws_sync_get_impl(HttpRequest *req, HttpResponse *res);
void handle_aws_sync_put_impl(HttpRequest *req, HttpResponse *res);
void handle_aws_sync_delete_impl(HttpRequest *req, HttpResponse *res);
void handle_aws_sync_run_impl(HttpRequest *req, HttpResponse *res);

/* Start / stop the background scheduler thread. */
void aws_sync_scheduler_start(void);
void aws_sync_scheduler_stop(void);
