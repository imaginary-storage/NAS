#pragma once
#include "chttp.h"

void handle_version(HttpRequest *req, HttpResponse *res);
void handle_healthz(HttpRequest *req, HttpResponse *res);
