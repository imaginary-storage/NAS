# Flow Chart — File System Operations — Image Generation Prompt

## Print/sizing baseline
- Output size: 1754 × 2480 px (A4 PORTRAIT @ 300 DPI). Diagram grows
  vertically; do not widen horizontally.
- Aspect ratio: 1 : √2 (portrait)
- Body font: ≥ 32 px in source
- Title font: ≥ 60 px in source
- Stroke width: 3–4 px

## Style
- Hand-drawn / sketchy B&W (Excalidraw / whiteboard)
- Strictly black and white — no colors, no fills
- **Font family: Aptos** (sans-serif) for ALL text. No other font.

## Prompt

```
A clean black-and-white Flow Chart in a hand-drawn sketch style (thin
slightly-wobbly strokes, like Excalidraw / whiteboard), depicting
FILE SYSTEM OPERATIONS for a self-hosted NAS file manager called
"Imaginary Storage NAS Dashboard" — the common path for browse, read,
write, mkdir, rename, move, copy, and download requests. White
background, strictly monochrome. NO colors, NO fills, NO shadows.

Aspect ratio 1:1.414 (A4 PORTRAIT). Render at 1754×2480 px so all labels
remain crisp when printed on A4 paper.

Notation (standard ANSI flow chart shapes):
- Start / End:    rounded "stadium" shape (capsule)
- Process step:   rectangle
- Decision:       diamond, with labels on outgoing arrows
- Input/Output:   parallelogram
- Connector:      small circle when arrows merge
- Flow:           solid arrow with arrowhead

Flow direction: top to bottom; error branches exit to the right.

Steps:

  1. (Start)        "Start"
  2. (I/O)          "User triggers fs action in UI
                     (browse / read / write / upload /
                      download / mkdir / rename /
                      move / copy)"
  3. (Process)      "Frontend api/filesystem.ts:
                     build /fs/* HTTP request
                     with path query / JSON body"
  4. (Process)      "Server: validate active_session
                     cookie → fork() + setuid(uid)
                     + chdir(home)"
  5. (Process)      "Handler: extract path param;
                     call safe_path(path)"
  6. (Decision)     "Path safe?
                     (rejects '..', absolute paths)"
        No  ▶  (Process) "Return 400 Bad Request" →
                (Process) "fs_error → JSON error" →
                (End) "End — error"
        Yes ▶  Continue.
  7. (Decision)     "Operation type?"
       Branch values:
         • Browse / Stat
         • Read content
         • Write content
         • Upload (simple)
         • Download
         • Mkdir
         • Rename / Move / Copy

  ─── BROWSE / STAT branch ──────────────────────
  8B. (Process)     "opendir + readdir loop;
                     stat() each entry;
                     build cJSON array"
  9B. (Process)     "Return JSON list / metadata"
 10B. → join to step 13

  ─── READ-CONTENT branch ───────────────────────
  8R. (Decision)    "File size ≤ 64 KB?"
       No  ▶  (Process) "Return 413 Payload Too Large" →
              (End) "End — error"
       Yes ▶  Continue.
  9R. (Process)     "fopen(path, 'rb');
                     read into buffer;
                     return text body"
 10R. → join to step 13

  ─── WRITE-CONTENT branch ──────────────────────
  8W. (Process)     "fopen(path, 'wb');
                     fwrite(req body);
                     fclose"
  9W. (Process)     "Return 200 OK"
 10W. → join to step 13

  ─── UPLOAD-SIMPLE branch ──────────────────────
  8U. (Process)     "parse_multipart(req body)"
  9U. (Process)     "Save to dest path
                     (overwrite if exists)"
 10U. → join to step 13

  ─── DOWNLOAD branch ──────────────────────────
  8D. (Process)     "open(path, O_RDONLY);
                     STREAM_GET response:
                     sendfile / read+write loop"
  9D. → join to step 13

  ─── MKDIR branch ─────────────────────────────
  8M. (Process)     "mkdir(path, 0755)
                     with -p semantics"
  9M. → join to step 13

  ─── RENAME / MOVE / COPY branch ──────────────
  8N. (Decision)    "rename or copy?"
        Rename/Move ▶ (Process) "rename(from, to)"
        Copy        ▶ (Process) "open both;
                                  read/write loop;
                                  preserve mode"
  9N. → join to step 13

 12. (Connector)    "(merge point)"
 13. (Decision)     "errno == 0?"
        No  ▶  (Process) "fs_error(res, errno)
                          → 404 / 403 / 500" →
                (End) "End — error"
        Yes ▶  Continue.
 14. (Process)      "Send response (JSON or stream)"
 15. (Process)      "Child _exit(); parent reaps"
 16. (End)          "End — success"

Layout rules:
- Single tall vertical column for the spine (steps 1–7, then 12–16).
- Operation branches (Browse / Read / Write / Upload / Download / Mkdir /
  Rename) are SHORT vertical sub-flows that all merge back at step 12
  via a connector circle.
- If the seven branches don't fit horizontally, stack them as a tall
  series of small "branch blocks" — do NOT widen the canvas.
- Arrows must visibly TOUCH shape edges — no floating gaps.

Legend box (small rectangle in the bottom-LEFT corner, thin black
border, heading "Legend" centered at top inside).

Format: KEY : VALUE (definition-list style). Vertically aligned, ":"
separator.

    Start / End      :   [tiny capsule]
    Process          :   [tiny rectangle]
    Decision         :   [tiny diamond]
    Input / Output   :   [tiny parallelogram]
    Connector        :   [tiny small circle]
    Flow             :   [tiny solid arrow →]

Legend text size 22–26 px.

Typography:
- Step text: 24–28 px, centered.
- Decision text: 24 px, centered.
- Branch labels: 22 px, italic, beside arrows.
- Diagram title at top center:
        "Flow Chart — File System Operations"
  (44 px, Aptos sans-serif).

Style constraints:
- Strict black-and-white. No colored fills or strokes.
- Hand-drawn sketch quality, clean and professional, NOT cartoonish.
- NO emoji, NO icons, NO 3D, NO shadows.
- Outer thin black border framing the canvas (3 px).
- White background only.
```

## Iteration hints
- Branches don't fit → "stack branches vertically rather than widening
  the canvas; use a connector circle to rejoin to the spine"
- Wrong shape used → "decisions = diamond, processes = rectangle,
  start/end = capsule, I/O = parallelogram"
- Errno branch missing → "add the 'errno == 0?' decision at step 13
  with a fs_error path leading to an Error end"
- Legend missing → "add the Legend box bottom-left in key:value format"
