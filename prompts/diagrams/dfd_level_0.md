# DFD Level 0 (Context Diagram) — Image Generation Prompt

## Print/sizing baseline
- Output size: 2480 × 1754 px (A4 landscape @ 300 DPI)
- Aspect ratio: √2 : 1 (≈ 1.414)
- Body font: ≥ 36 px in source (~10 pt on A4 print)
- Title font: ≥ 60 px in source
- Stroke width: 3–4 px

## Style (uniform across all diagrams)
- Hand-drawn / sketchy B&W aesthetic (Excalidraw / whiteboard look)
- Strictly black and white — no colors, no fills, no shadows
- **Font family: Aptos** (sans-serif) for ALL text — titles, labels,
  annotations, stereotype tags. No other font anywhere in the diagram.

## Prompt

```
A clean black-and-white Data Flow Diagram (DFD) — Level 0 (Context
Diagram) — in a hand-drawn sketch style (thin slightly-wobbly strokes, like
Excalidraw / whiteboard), for a self-hosted NAS file manager called
"Imaginary Storage NAS Dashboard". White background, strictly monochrome
black ink on white paper. NO colors, NO fills, NO shadows.

Aspect ratio 1.414:1 (A4 landscape). Render at 2480×1754 px so all labels
remain crisp when printed on A4 paper.

Notation (Yourdon/DeMarco DFD style):
- External entities are drawn as RECTANGLES (square corners).
- The single system process is drawn as a CIRCLE (or rounded rectangle).
- Data flows are drawn as labeled SOLID ARROWS with open arrowheads.
- This is Level 0, so there are NO data stores yet.

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
    Data Flow         :   [tiny arrow →]

Legend text size 22–26 px. The visual samples on the right are drawn at
miniature size (~60 × 30 px), vertically centered with their row label.

Composition:

- ONE central process bubble (large circle, ~520 px diameter, centered
  horizontally and vertically). Inside the circle, two-line label:
        "0"
        "NAS Dashboard System"
  ("0" is on its own line as the process number; the name on the next.)

- FOUR external entities, one in each corner area of the canvas, drawn as
  rectangles ~420 × 140 px:
    * Top-LEFT:    "User"          (browser-based end user)
    * Bottom-LEFT: "Admin (root)"  (privileged operator)
    * Top-RIGHT:   "Linux Filesystem"
    * Bottom-RIGHT: "PAM Auth Service"

- Each external entity is connected to the central process by labeled
  data-flow arrows. Use TWO arrows per entity (one each direction), or a
  single bidirectional arrow with two labels — both styles are acceptable
  as long as labels are readable. Recommended: two separate arrows.

Data flows (label text, EXACTLY as shown — keep verbatim):

  User  ──▶  NAS Dashboard System :  "HTTP requests (login, browse, upload,
                                       download, trash, sessions)"
  NAS Dashboard System  ──▶  User :  "responses (JSON, file streams,
                                       session cookies)"

  Admin (root)  ──▶  NAS Dashboard System :  "admin commands (manage users,
                                              manage disks)"
  NAS Dashboard System  ──▶  Admin (root) :  "user list, disk status"

  NAS Dashboard System  ──▶  Linux Filesystem :  "fs operations (read,
                                                  write, rename, unlink,
                                                  list)"
  Linux Filesystem  ──▶  NAS Dashboard System :  "file data, metadata,
                                                  directory entries"

  NAS Dashboard System  ──▶  PAM Auth Service :  "username + password"
  PAM Auth Service  ──▶  NAS Dashboard System :  "authentication result"

Layout rules:
- Generous whitespace; rectangles, the central circle, and labels must NOT
  overlap.
- Arrow labels sit ABOVE or BESIDE their arrow line, not on top of it.
- Arrows must visibly TOUCH the rectangle edges and the circle edge — no
  floating gaps.
- Arrows can be slightly curved/diagonal; they do not need to be strictly
  orthogonal in this diagram (the hand-drawn style allows natural routing).

Typography:
- Process bubble label: 36–40 px, centered, black.
- External entity labels: 32–36 px, centered inside their rectangle.
- Data-flow labels: 24–28 px, black, placed close to the arrow.
- Diagram title at the very top of the canvas, centered:
        "DFD Level 0 — NAS Dashboard (Context Diagram)"
  44 px, black, Aptos sans-serif.

Style constraints:
- Strict black-and-white only. No colored fills or strokes.
- Hand-drawn sketch quality but clean and professional, NOT cartoonish.
- NO emoji, NO icons, NO 3D, NO drop shadows.
- Outer thin black border framing the entire canvas (3 px).
- White background only.
```

## Iteration hints
- Wrong text → "regenerate, keep all label text exactly verbatim"
- Lines float / don't connect → "redraw so every arrow clearly touches the
  rectangle border and the circle edge"
- Color leaks → "strictly monochrome black on white, remove all color"
- Cluttered labels → "move arrow labels off the line, place them above or
  beside, ensure no label overlaps another arrow"
- Bidirectional confusion → "use two separate single-headed arrows per
  entity instead of one bidirectional arrow"
