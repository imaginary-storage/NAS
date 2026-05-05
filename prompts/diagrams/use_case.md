# Use Case Diagram — Image Generation Prompt

## Print/sizing baseline (applies to all diagrams in this folder)
- Output size: 2480 × 1754 px (A4 landscape @ 300 DPI), or 1754 × 2480 (portrait)
- Aspect ratio: √2 : 1 (≈ 1.414, A4 ratio)
- Body font: ≥ 36 px in source (~10 pt on A4 print)
- Title font: ≥ 60 px in source
- Stroke width: 3–4 px (so lines survive print + photocopy)

## Style (uniform across all 8 diagrams)
- Hand-drawn / sketchy aesthetic — slightly wobbly strokes, like an
  Excalidraw or whiteboard sketch.
- Strictly **black and white** — no fills, no colors. White background,
  black strokes and black text only.
- **Font family: Aptos** (sans-serif) for ALL text in the diagram —
  titles, labels, annotations, legend, stereotype tags. No other font.
- Subtle, NOT cartoonish. The "hand-drawn" feel should be light, not
  overdone.

## Prompt

```
A clean black-and-white UML Use Case Diagram in a hand-drawn sketch style
(thin slightly-wobbly strokes, like Excalidraw / whiteboard), for a
self-hosted NAS file manager. White background. NO colors, NO fills,
NO shadows — strictly monochrome line art with black ink on white paper.

Aspect ratio 1.414:1 (A4 landscape). Render at 2480×1754 px so that all
labels remain crisp and readable when printed on A4 paper.

Overall composition:
- A LARGE rectangular system boundary occupying ~75% of the canvas width,
  centered. The label "<<system>> NAS Dashboard" sits at the top-center
  INSIDE the rectangle, just below the top edge.
- Outside the boundary, on the LEFT side, two stick-figure actors stacked
  vertically:
    * Top actor: head circle, body line, arms line, two legs.
      Label below: "User"
    * Bottom actor: same stick figure.
      Label below: "Admin (root)"
- Outside the boundary, on the RIGHT side, one stick-figure actor:
    * Label below: "PAM (Auth Backend)"
- A small "Legend" box in the bottom-LEFT corner of the canvas (outside
  the system boundary), thin black border, heading "Legend" centered at
  the top inside the box.

  Format: KEY : VALUE (definition-list style, one row per entry). The KEY
  on the LEFT is the descriptive name; the VALUE on the RIGHT is a small
  visual sample. A colon ":" or thin vertical divider separates the two
  columns. Both columns are vertically aligned across all rows so it
  reads as a clean two-column key:value table.

      Actor                       :   [tiny stick figure]
      Association                 :   [short solid line, no arrowhead]
      <<include>> / <<extend>>    :   [short dashed line + arrowhead ▶]

  Legend text size 22–26 px. The visual samples on the right are drawn
  at miniature size, vertically centered with their row label.

Use cases (drawn as horizontal ELLIPSES inside the system boundary, plain
white fill, thin black border, ~480×110 px each, with single or two-line
black text labels centered):

  Primary (User-facing) — arrange in the upper-left half of the boundary:
    1. "Login"
    2. "Browse Files"
    3. "Upload File"
    4. "Download File"
    5. "Rename / Move / Copy"
    6. "Move to Trash"
    7. "Manage Sessions"

  Admin-only — arrange in the lower-left of the boundary:
    8. "Manage Users"
    9. "Manage Disks"

  Auxiliary (right side of boundary, closer to PAM actor):
    10. "Authenticate via PAM"

  Extension target (lower-right of boundary):
    11. "Restore from Trash"

Relationships:

A. ASSOCIATIONS — solid black lines, no arrowheads, must visibly TOUCH
   both the actor and the ellipse edge:
   - User actor → use cases 1, 2, 3, 4, 5, 6, 7
   - Admin actor → use cases 8, 9
   - PAM actor → use case 10

B. INCLUDE / EXTEND — DASHED black lines with a small open-triangle
   arrowhead at the destination end, with a small text label beside the
   line ("<<include>>" or "<<extend>>", italic):
   - 1 "Login"            ----<<include>>----▶ 10 "Authenticate via PAM"
   - 3 "Upload File"      ----<<include>>----▶ 10 "Authenticate via PAM"
   - 6 "Move to Trash"    ----<<extend>>-----▶ 11 "Restore from Trash"
   - 7 "Manage Sessions"  ----<<extend>>-----▶ 11 "Restore from Trash"
     (omit this one if it adds clutter)

Layout rules:
- Leave generous whitespace; ellipses must NOT touch each other.
- Lines must visibly CONNECT to ellipse borders and actor bodies — no
  floating gaps, no lines that stop short of a node.
- Association lines from a single actor may fan out to the use cases at
  natural angles (the hand-drawn style allows soft curves) — they do not
  need to be strictly orthogonal.
- Dashed include/extend lines should be clearly distinct from solid
  associations.

Typography:
- Use case labels: 30–36 px, black, Aptos sans-serif, centered inside
  ellipse. Two-line labels are fine where the name is long.
- Actor labels: 28–32 px, black, Aptos sans-serif, centered below the
  figure.
- "<<system>> NAS Dashboard" label: 32 px, black.
- Stereotype labels on dashed arrows ("<<include>>", "<<extend>>"): 24 px,
  italic, black.
- Legend text: 24 px, black.
- No diagram title outside the system boundary — the "<<system>>" label
  inside the boundary serves as the title.

Style constraints:
- Strict black-and-white. No filled colors anywhere.
- Hand-drawn / sketchy quality, but clean enough to read.
- NO emoji, NO icons, NO shading, NO 3D.
- White background only.
```

## Iteration hints
- Wrong text → "regenerate, keep all label text exactly verbatim"
- Lines float / don't connect → "redraw so every line clearly touches the
  actor body and the ellipse border"
- Color leaks → "strictly monochrome black on white, remove all color fills"
- Too cartoonish → "tone down the hand-drawn wobble, keep it subtle and
  professional"
- Missing dashed labels → "add small italic '<<include>>' or '<<extend>>'
  text next to each dashed arrow"
