# System Architecture Diagram — Image Generation Prompt

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
  annotations. No other font.

## Prompt

```
A clean black-and-white System Architecture Diagram in a hand-drawn sketch
style (thin slightly-wobbly strokes, like Excalidraw / whiteboard), for a
self-hosted NAS file manager called "Imaginary Storage NAS Dashboard".
White background, strictly monochrome. NO colors, NO fills, NO shadows.

Aspect ratio 1.414:1 (A4 landscape). Render at 2480×1754 px so all labels
remain crisp when printed on A4 paper.

Composition: a stacked layered architecture with FOUR horizontal layers,
each shown as a wide rectangle spanning the canvas width. Within each
layer, multiple component boxes (rounded rectangles) are arranged in a row.

Layer labels appear on the LEFT edge, vertically aligned with the layer
band. Component boxes are sized ~360 × 140 px each.

Layers (top to bottom):

  ── Layer 1: CLIENT (Browser) ─────────────────────────────────
    Components (left to right):
      • "React 19 UI"
      • "Redux Toolkit Store"
      • "Upload Engine (chunked, SHA-256)"
      • "API Client (fetch wrapper)"

  ── Layer 2: TRANSPORT ────────────────────────────────────────
    Single wide component box spanning the layer:
      • "HTTPS / HTTP   (cookies: active_session)"

  ── Layer 3: SERVER (chttp HTTP framework, root process) ──────
    Components (left to right):
      • "Router & Auth Wrappers
         (DEFINE_AUTH_ROUTE,
          DEFINE_STREAM_AUTH_ROUTE,
          DEFINE_NOPRIV_AUTH_ROUTE)"
      • "Session Validator
         (./sessions/<token>)"
      • "fork() + setuid()
         per request"
      • "Route Handlers
         (auth, fs, trash, admin)"

  ── Layer 4: STORAGE & SYSTEM ─────────────────────────────────
    Components (left to right):
      • "Linux Filesystem
         (per-user home dirs)"
      • "PAM
         (authentication)"
      • "Per-user .imaginary/
         (trash, uploads, bookmarks,
          settings)"
      • "Sessions Store
         ./sessions/"

Connections (vertical solid arrows showing the request flow direction
between layers):
- Top arrows: Browser components ▼ HTTPS layer.
- Middle arrows: HTTPS ▼ Router & Auth Wrappers.
- Router ▼ Session Validator ▼ fork()+setuid() ▼ Route Handlers.
- Route Handlers ▼ Linux Filesystem (and other Layer 4 components).
- Authentication path: Router ▼ Session Validator AND a separate dashed
  arrow from Route Handlers ▶ PAM (only on /login).

Annotations (small italic notes beside relevant components):
- Beside "fork() + setuid()": "drops privileges to authenticated UID/GID
  before touching the filesystem"
- Beside "Sessions Store": "mode 0700 dir; session files mode 0644"
- Beside "Upload Engine": "4 MB chunks, resume from received_chunks[]"

Legend box (small rectangle in the bottom-LEFT corner of the canvas,
outside the layer bands, with a thin black border and the heading
"Legend" centered at the top inside the box).

Format: KEY : VALUE (definition-list style, one row per entry). The KEY
on the LEFT is the descriptive name; the VALUE on the RIGHT is a small
visual sample of the shape / line. A colon ":" or thin vertical divider
separates the two columns. Both columns are vertically aligned across
all rows so it reads as a clean two-column key:value table.

    Architectural Layer             :   [tiny wide rectangle band]
    Component / Module              :   [tiny rounded rectangle]
    Synchronous request flow        :   [tiny solid arrow ▼]
    Conditional flow (only /login)  :   [tiny dashed arrow ▶]
    Annotation note                 :   [tiny italic text sample]

Legend text size 22–26 px. The visual samples on the right are drawn at
miniature size, vertically centered with their row label.

Layout rules:
- Each layer is clearly separated with vertical whitespace (~60 px gap).
- Layer band rectangles drawn with thin strokes; layer label sits to the
  LEFT of each band.
- Component boxes are uniform within a layer.
- Arrows must visibly TOUCH the component box edges — no floating gaps.

Typography:
- Layer labels (left side): 28 px, italic, black.
- Component labels: 26–30 px, centered inside their box.
- Annotation notes: 22 px, italic.
- Diagram title at the very top center:
        "System Architecture — NAS Dashboard"
  44 px, black, Aptos sans-serif.

Style constraints:
- Strict black-and-white. No colored fills or strokes.
- Hand-drawn sketch quality, clean and professional, NOT cartoonish.
- NO emoji, NO icons, NO 3D, NO shadows.
- Outer thin black border framing the canvas (3 px).
- White background only.
```

## Iteration hints
- Layers misaligned → "redraw with each layer as a clear horizontal band
  spanning the full canvas width, with the layer name on the left edge"
- Wrong component count per layer → "match component counts exactly per
  the prompt — Layer 1: 4, Layer 2: 1, Layer 3: 4, Layer 4: 4"
- Privilege-drop note missing → "add the small italic note beside the
  fork()+setuid() box explaining privilege drop"
