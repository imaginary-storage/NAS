#include "cJSON.h"
#include "chttp.h"
#include "version.h"

#ifndef IMAGINARY_VERSION
#define IMAGINARY_VERSION "0.0.0"
#endif
#ifndef IMAGINARY_GIT_SHA
#define IMAGINARY_GIT_SHA "unknown"
#endif
#ifndef IMAGINARY_BUILD_AT
#define IMAGINARY_BUILD_AT "unknown"
#endif

void handle_version(HttpRequest *req, HttpResponse *res) {
  (void)req;
  cJSON *obj = cJSON_CreateObject();
  cJSON_AddStringToObject(obj, "version",  IMAGINARY_VERSION);
  cJSON_AddStringToObject(obj, "commit",   IMAGINARY_GIT_SHA);
  cJSON_AddStringToObject(obj, "built_at", IMAGINARY_BUILD_AT);
  chttp_send_cjson(res, obj);
}
