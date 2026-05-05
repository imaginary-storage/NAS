# DFD Level 1 — Image Generation Prompt

## Print/sizing baseline
- Output size: 2480 × 1754 px (A4 landscape @ 300 DPI)
- Aspect ratio: √2 : 1 (≈ 1.414)
- Body font: ≥ 32 px in source
- Title font: ≥ 60 px in source
- Stroke width: 3–4 px

## Style
- Hand-drawn / sketchy B&W (Excalidraw / whiteboard)
- Strictly black and white — no colors, no fills
- **Font family: Aptos** (sans-serif) for ALL text — titles, labels,
  annotations, stereotype tags. No other font.

## Prompt

```
A clean black-and-white Data Flow Diagram (DFD) — Level 1 — in a hand-drawn
sketch style (thin slightly-wobbly strokes, like Excalidraw / whiteboard),
for a self-hosted NAS file manager called "Imaginary Storage NAS Dashboard".
White background, strictly monochrome. NO colors, NO fills, NO shadows.

Aspect ratio 1.414:1 (A4 landscape). Render at 2480×1754 px so all labels
remain crisp when printed on A4 paper.

This Level 1 diagram decomposes the single Level-0 process "0 NAS Dashboard
System" into FOUR sub-processes and shows the data stores they read/write.
Keep it lean — only the essentials, no minor side-flows.

Notation (Yourdon/DeMarco DFD style):
- External entities: RECTANGLES (square corners).
- Sub-processes: CIRCLES, each numbered "1.0", "2.0", etc.
- Data stores: open-ended rectangles drawn as a horizontal line above and
  below the label (D1, D2 naming on the left, descriptive name on the
  right).
- Data flows: labeled SOLID ARROWS with open arrowheads. Bidirectional
  exchanges may be drawn as a single double-headed arrow with one combined
  label to keep the diagram clean.

Legend box (small rectangle in the bottom-LEFT corner of the canvas, with
a thin black border and the heading "Legend" centered at the top inside
the box).

Format: KEY : VALUE (definition-list style, one row per entry). The KEY
on the LEFT is the descriptive name; the VALUE on the RIGHT is a small
visual sample of the shape / line. A colon ":" or thin vertical divider
separates the two columns. Both columns are vertically aligned across
all rows so it reads as a clean two-column key:value table.

    External Entity   :   [tiny rectangle]
    Process           :   [tiny circle]
    Data Store        :   [tiny open-ended rectangle]
    Data Flow         :   [tiny arrow →]

Legend text size 22–26 px. The visual samples on the right are drawn at
miniature size (~60 × 30 px), vertically centered with their row label.

Composition:

External entities (positioned outside the central work area):
- LEFT edge:   rectangle labeled "User"
- LEFT edge:   rectangle labeled "Admin (root)" (below User)
- RIGHT edge:  rectangle labeled "Linux Filesystem"
- RIGHT edge:  rectangle labeled "PAM Auth Service" (below Linux Filesystem)

Sub-processes (FOUR circles, ~300 px diameter, arranged in a 2-column ×
2-row grid in the central area). Each circle's label is two lines: number
on top, name on bottom.
    Top row:
      "1.0"  /  "Authentication & Sessions"
      "2.0"  /  "File System Operations"
    Bottom row:
      "3.0"  /  "Trash Management"
      "4.0"  /  "Admin Operations"

Data stores (TWO open-ended rectangles, placed near the processes that use
them):
    D1  "Sessions Store"
    D2  "Per-user Trash"

Data flows (keep labels short, ~3–6 words each):

  User  ↔  1.0 Authentication & Sessions :  "login / session ops ↔ cookie"
  1.0   ↔  PAM Auth Service :               "authenticate ↔ result"
  1.0   ↔  D1 Sessions Store :              "create / read / delete"

  User  ↔  2.0 File System Operations :     "browse / upload / download ↔ data"
  2.0   ↔  Linux Filesystem :               "fs syscalls ↔ file data"

  User  ↔  3.0 Trash Management :           "delete / restore / empty ↔ listing"
  3.0   ↔  D2 Per-user Trash :              "move / restore items"
  3.0   →  Linux Filesystem :               "fs ops"

  Admin (root)  ↔  4.0 Admin Operations :   "user / disk commands ↔ status"
  4.0   ↔  Linux Filesystem :               "useradd / mount / format"

Layout rules:
- Generous whitespace.
- Arrows must visibly TOUCH the borders of rectangles, circles, and store
  lines — no floating gaps.
- Arrow labels placed beside the line, not on top of it.
- Arrows can be slightly curved; do not need to be strictly orthogonal.

Typography:
- Sub-process labels: 28–32 px.
- External entity labels: 30–34 px.
- Data-store labels: 26–30 px.
- Arrow labels: 22–26 px.
- Title at top center: "DFD Level 1 — NAS Dashboard"  (44 px, Aptos sans-serif).

Style constraints:
- Strict black-and-white. No colored fills or strokes.
- Hand-drawn sketch quality, clean and professional, NOT cartoonish.
- NO emoji, NO icons, NO 3D, NO shadows.
- Outer thin black border framing the canvas (3 px).
- White background only.
```

## Iteration hints
- Wrong process numbers → "ensure process numbers are exactly 1.0, 2.0,
  3.0, 4.0, 5.0, 6.0 and labels match exactly"
- Data stores look wrong → "data stores must be open-ended rectangles —
  horizontal line above and below the text, no vertical sides"
- Crossing arrows → "redraw to minimize arrow crossings, route arrows
  around shapes rather than through them"
- Missing labels → "every arrow must have a small text label beside it"
