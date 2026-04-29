/*
 * Periodic sweeper for expired shares.  Mirrors aws_sync's scheduler shape
 * — a single pthread that wakes every SHARE_SWEEP_TICK_SEC and calls
 * share_sweep_once().  share_sweep_once() handles revocation + GC.
 */

#include <pthread.h>
#include <unistd.h>

#include "share.h"

#define SHARE_SWEEP_TICK_SEC 60

static pthread_t g_thread;
static volatile int g_should_stop = 0;
static int g_started = 0;

static void *sweeper_main(void *arg) {
  (void)arg;
  /* One-shot at startup so newly-loaded expired shares get GC'd promptly. */
  share_sweep_once();
  while (!g_should_stop) {
    for (int i = 0; i < SHARE_SWEEP_TICK_SEC && !g_should_stop; i++)
      sleep(1);
    if (!g_should_stop) share_sweep_once();
  }
  return NULL;
}

int share_sweeper_start(void) {
  if (g_started) return 0;
  if (pthread_create(&g_thread, NULL, sweeper_main, NULL) != 0) return -1;
  g_started = 1;
  return 0;
}

void share_sweeper_stop(void) {
  if (!g_started) return;
  g_should_stop = 1;
  pthread_join(g_thread, NULL);
  g_started = 0;
}
