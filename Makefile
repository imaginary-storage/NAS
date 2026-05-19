CC      := gcc

VERSION := $(shell cat VERSION 2>/dev/null || echo 0.0.0)
GIT_SHA := $(shell git rev-parse --short HEAD 2>/dev/null || echo unknown)
BUILD_AT := $(shell date -u +%Y-%m-%dT%H:%M:%SZ)

CFLAGS  := -Wall -Wextra -I src -I lib -I vendor \
           -DIMAGINARY_VERSION=\"$(VERSION)\" \
           -DIMAGINARY_GIT_SHA=\"$(GIT_SHA)\" \
           -DIMAGINARY_BUILD_AT=\"$(BUILD_AT)\"
LDFLAGS := -lpthread -lpam -lacl

SRC_DIR    := src
LIB_DIR    := lib
VENDOR_DIR := vendor
BUILD_DIR  := build
OUT_DIR    := dist
TARGET     := $(OUT_DIR)/server

SRCS := $(shell find $(SRC_DIR) $(LIB_DIR) $(VENDOR_DIR) -name '*.c')
OBJS := $(patsubst %.c, $(BUILD_DIR)/%.o, $(SRCS))
DEPS := $(OBJS:.o=.d)

.PHONY: all clean run compdb

all: $(TARGET)

$(TARGET): $(OBJS) | $(OUT_DIR)
	$(CC) $(OBJS) $(LDFLAGS) -o $@

$(BUILD_DIR)/%.o: %.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -MMD -MP -c $< -o $@

# Files that bake version macros into their object code must be rebuilt
# whenever VERSION changes — otherwise `bump.sh patch && make` is a no-op
# and the running binary still reports the old version.
$(BUILD_DIR)/src/routes/version.o: VERSION

$(OUT_DIR):
	mkdir -p $@

-include $(DEPS)

clean:
	rm -rf $(BUILD_DIR) $(OUT_DIR)

run: all
	./$(TARGET)

compdb:
	python3 -c "\
import json, os; root=os.getcwd(); srcs=open('/dev/stdin').read().split();\
db=[{'directory':root,'command':'gcc $(CFLAGS) -c '+f+' -o /dev/null','file':os.path.join(root,f)} for f in sorted(srcs)];\
open('compile_commands.json','w').write(json.dumps(db,indent=2))" <<< "$(SRCS)"
