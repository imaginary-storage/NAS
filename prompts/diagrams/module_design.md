# Module Design Diagram — Image Generation Prompt

## Print/sizing baseline
- Output size: 1754 × 2480 px (A4 PORTRAIT @ 300 DPI) — diagram grows
  vertically as content is added, not horizontally.
- Aspect ratio: 1 : √2 (portrait)
- Body font: ≥ 30 px in source
- Title font: ≥ 60 px in source
- Stroke width: 3–4 px

## Style
- Hand-drawn / sketchy B&W (Excalidraw / whiteboard)
- Strictly black and white — no colors, no fills
- **Font family: Aptos** (sans-serif) for ALL text — titles, group
  labels, module labels, annotations. No other font.

## Prompt

```
A clean black-and-white Module Design Diagram in a hand-drawn sketch
style (thin slightly-wobbly strokes, like Excalidraw / whiteboard), for a
self-hosted NAS file manager called "Imaginary Storage NAS Dashboard".
White background, strictly monochrome. NO colors, NO fills, NO shadows.

Aspect ratio 1:1.414 (A4 PORTRAIT). Render at 1754×2480 px so all labels
remain crisp when printed on A4 paper. The diagram grows VERTICALLY when
more modules need to be shown — never spread horizontally beyond the
canvas width.

The diagram has TWO grouping rectangles stacked TOP and BOTTOM:
- TOP group:    "Backend (C / chttp)"
- BOTTOM group: "Frontend (React + TypeScript)"

Each grouping rectangle has a thin black border and a small group label
in the top-left INSIDE the rectangle.

Inside each group, modules are drawn as rounded rectangles
(~400 × 150 px). Each module box has:
  Line 1: the module NAME (slightly heavier stroke)
  Lines 2–3: ONE or TWO short bullet points describing what it does
             (≤6 words each, prefixed with "•")

Solid arrows show "uses / depends on" relationships, with arrowhead at
the dependee end.

──────────────── TOP GROUP — Backend (C / chttp) ───────────────────────

EIGHT modules (arrange in 2 vertical columns inside the top group):

  Column A:
    "main.c
     • registers routes & auth wrappers
     • bootstraps chttp server"

    "chttp framework
     • HTTP/1.1 server library
     • multipart, streaming, route table"

    "Auth & Sessions
     • PAM credential check
     • session token in ./sessions/"

    "Routes
     • /login, /whoami, /logout
     • /sessions list / switch / delete"

  Column B:
    "File System
     • list, upload, download
     • rename, move, copy, mkdir"

    "Trash
     • move-to-trash, restore, empty
     • ~/.imaginary/trash/"

    "Admin (root only)
     • user mgmt (add / del)
     • disk mount / unmount / format"

    "Utils & Vendor
     • mime, safe_path, multipart
     • cJSON, sha256"

Backend dependency arrows (solid, arrowhead at dependee):
  main.c → chttp framework
  main.c → Auth & Sessions
  main.c → Routes
  main.c → File System
  main.c → Trash
  main.c → Admin
  Routes → Auth & Sessions
  File System → Utils & Vendor
  Trash → Utils & Vendor
  Admin → Utils & Vendor

──────────────── BOTTOM GROUP — Frontend (React + TS) ──────────────────

EIGHT modules (arrange in 2 vertical columns inside the bottom group):

  Column A:
    "App.tsx
     • Router + ProtectedRoute
     • auth guard at app root"

    "Redux Store
     • 7 slices (fs, uploads, trash...)
     • configureStore"

    "API Client
     • fetch wrapper
     • 401 handling, suppress401"

    "API Modules
     • filesystem.ts, trash.ts
     • sessions.ts"

  Column B:
    "File Browser
     • grid + list view
     • FileCard, Toolbar, ContextMenu"

    "Upload Manager
     • Drive-style bottom widget
     • pause / resume / cancel UI"

    "Layout
     • AppShell, TopBar, Sidebar
     • PlacesPanel, theme toggle"

    "Upload Engine
     • 4 MB chunks, SHA-256
     • resumable, sequential queue"

Frontend dependency arrows (solid, arrowhead at dependee):
  App.tsx → Redux Store
  App.tsx → Layout
  File Browser → Redux Store
  File Browser → API Modules
  Upload Manager → Upload Engine
  Upload Engine → API Modules
  API Modules → API Client
  Layout → API Modules

──────────────── Cross-group link ──────────────────────────────────────

ONE dashed arrow with label, drawn from the bottom group up to the top
group:
  Frontend "API Client"  ─ ─ ─ HTTPS / JSON ─ ─ ─▶  Backend "chttp framework"

──────────────── Legend (bottom of canvas) ─────────────────────────────

Small Legend rectangle in the bottom-LEFT corner of the canvas (outside
both group rectangles), thin black border, heading "Legend" centered at
top inside the box.

Format: KEY : VALUE (definition-list style, one row per entry). The KEY
on the LEFT is the descriptive name; the VALUE on the RIGHT is a small
visual sample of the shape / line. A colon ":" or thin vertical divider
separates the two columns. Both columns are vertically aligned across
all rows so it reads as a clean two-column key:value table.

    Module                  :   [tiny rounded rectangle]
    Group (Backend/Frontend):   [tiny large bordered rectangle]
    Depends on / uses       :   [tiny solid arrow →]
    Cross-tier link (HTTPS) :   [tiny dashed arrow ▶]

Legend text size 22–26 px. The visual samples on the right are drawn at
miniature size, vertically centered with their row label.

Layout rules:
- Top and bottom group rectangles span almost the full canvas width.
- Inside each group, modules are arranged in TWO vertical columns;
  if more modules are needed, ADD MORE ROWS (extend the group downward),
  never widen the canvas.
- Generous spacing — at least 40 px between module boxes.
- Arrows must visibly TOUCH module box edges — no floating gaps.
- Avoid arrow crossings where possible; route around boxes.

Typography:
- Group labels ("Backend (C / chttp)", "Frontend (React + TypeScript)"):
  32 px, slightly heavier sketch stroke, placed at top-left INSIDE each
  group rectangle.
- Module labels: 24–28 px, centered inside their box. Two short lines
  max (name + purpose hint).
- Cross-group dashed arrow label "HTTPS / JSON": 24 px, italic.
- Legend text: 22–26 px.
- Diagram title at top center: "Module Design — NAS Dashboard"
  (44 px, Aptos sans-serif).

Style constraints:
- Strict black-and-white. No colored fills or strokes.
- Hand-drawn sketch quality, clean and professional, NOT cartoonish.
- NO emoji, NO icons, NO 3D, NO shadows.
- Outer thin black border framing the canvas (3 px).
- White background only.
```

## Iteration hints
- Too dense / crowded → "reduce module purpose hint to a single short
  phrase, or omit it; keep only the module name in each box"
- Modules don't fit → "extend the group rectangle downward and add more
  rows; do NOT widen the canvas or shrink the boxes"
- Cross-group arrow missing → "add the dashed arrow labelled 'HTTPS / JSON'
  from Frontend 'API Client' to Backend 'chttp framework'"
- Legend missing → "add the Legend box in the bottom-left corner of the
  canvas with the four rows (Module, Group, Depends-on arrow, Cross-tier
  dashed arrow)"
