# Flow Chart — Trash Management — Image Generation Prompt

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
TRASH MANAGEMENT for a self-hosted NAS file manager called
"Imaginary Storage NAS Dashboard" — covering Move-to-Trash, List Trash,
Restore, Permanent Delete, and Empty Trash. White background, strictly
monochrome. NO colors, NO fills, NO shadows.

Aspect ratio 1:1.414 (A4 PORTRAIT). Render at 1754×2480 px so all labels
remain crisp when printed on A4 paper.

Notation (standard ANSI flow chart shapes):
- Start / End:    rounded "stadium" shape (capsule)
- Process step:   rectangle
- Decision:       diamond, with labels on outgoing arrows
- Input/Output:   parallelogram
- Connector:      small circle when arrows merge
- Flow:           solid arrow with arrowhead

Storage layout (note the structure used inside the flow):
  ~/.imaginary/trash/
    files/<name>             — moved file or directory
    info/<name>.info         — sidecar with original path + deleted_at

Flow direction: top to bottom.

Steps:

  1. (Start)        "Start"
  2. (I/O)          "User triggers trash action
                     (delete / list / restore /
                      permanent delete / empty)"
  3. (Process)      "Validate session;
                     fork() + setuid()"
  4. (Process)      "Ensure ~/.imaginary/trash/files
                     and ~/.imaginary/trash/info exist
                     (mkdir -p)"
  5. (Decision)     "Operation?"
       Branches: Move-to-Trash / List / Restore /
                 Permanent Delete / Empty Trash

  ─── MOVE-TO-TRASH branch ─────────────────────
  6M. (Process)     "Compute target name; if
                     trash/files/<name> exists,
                     append '.1', '.2', ... until
                     unique"
  7M. (Process)     "rename(src_path,
                     trash/files/<unique>)"
  8M. (Process)     "Write trash/info/<unique>.info:
                     • path=<original>
                     • deleted_at=<ISO8601>"
  9M. → join to step 16

  ─── LIST branch ──────────────────────────────
  6L. (Process)     "readdir(trash/info/);
                     for each .info, parse
                     path + deleted_at;
                     stat trash/files/<name>"
  7L. (Process)     "Build JSON array
                     [{name, path, deleted_at, size}]"
  8L. → join to step 16

  ─── RESTORE branch ───────────────────────────
  6R. (Process)     "Read trash/info/<name>.info
                     to get original path"
  7R. (Decision)    "Original parent dir exists?"
       No  ▶  (Process) "Return 409 Conflict
                          (parent missing)" →
                (End) "End — error"
       Yes ▶  Continue.
  8R. (Decision)    "Destination already exists?"
       Yes ▶  (Process) "Return 409 Conflict
                          (collision)" →
                (End) "End — error"
       No  ▶  Continue.
  9R. (Process)     "rename(trash/files/<name>,
                     <original_path>)"
 10R. (Process)     "unlink trash/info/<name>.info"
 11R. → join to step 16

  ─── PERMANENT DELETE branch ──────────────────
  6P. (Process)     "unlink trash/files/<name>
                     (rm -rf if directory)"
  7P. (Process)     "unlink trash/info/<name>.info"
  8P. → join to step 16

  ─── EMPTY TRASH branch ───────────────────────
  6E. (Process)     "readdir(trash/files/);
                     for each entry: unlink
                     (or rm -rf for dirs)"
  7E. (Process)     "readdir(trash/info/);
                     unlink each .info"
  8E. → join to step 16

 15. (Connector)    "(merge point)"
 16. (Decision)     "errno == 0?"
        No  ▶  (Process) "fs_error(res, errno)
                          → JSON error" →
                (End) "End — error"
        Yes ▶  Continue.
 17. (Process)      "Send 200 OK
                     (with JSON if applicable)"
 18. (End)          "End — success"

Layout rules:
- Single vertical spine for steps 1–5 and 15–18.
- Five operation branches arranged as short vertical sub-flows that
  merge at the connector before the errno check.
- If branches don't fit side-by-side, stack them vertically — do NOT
  widen the canvas.
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
- Branch labels (operation names, Yes/No): 22 px, italic, beside arrows.
- Diagram title at top center:
        "Flow Chart — Trash Management"
  (44 px, Aptos sans-serif).

Style constraints:
- Strict black-and-white. No colored fills or strokes.
- Hand-drawn sketch quality, clean and professional, NOT cartoonish.
- NO emoji, NO icons, NO 3D, NO shadows.
- Outer thin black border framing the canvas (3 px).
- White background only.
```

## Iteration hints
- Five branches don't fit → "stack branches vertically; use a connector
  circle to rejoin to the errno-check spine"
- Restore conflict checks missing → "include the two decision diamonds
  in the Restore branch: 'Original parent dir exists?' and 'Destination
  already exists?'"
- Storage layout missing → "if helpful, draw a small note off to the
  side showing the trash/files and trash/info directory layout"
- Legend missing → "add the Legend box bottom-left in key:value format"
