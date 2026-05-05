# Flow Chart — Overall Request Lifecycle — Image Generation Prompt

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
slightly-wobbly strokes, like Excalidraw / whiteboard), depicting the
OVERALL REQUEST LIFECYCLE of a self-hosted NAS file manager called
"Imaginary Storage NAS Dashboard" — from browser action to rendered
response. White background, strictly monochrome. NO colors, NO fills,
NO shadows.

Aspect ratio 1:1.414 (A4 PORTRAIT). Render at 1754×2480 px so all labels
remain crisp when printed on A4 paper.

Notation (standard ANSI flow chart shapes):
- Start / End:    rounded "stadium" shape (capsule)
- Process step:   rectangle
- Decision:       diamond, with "Yes" / "No" labels on outgoing arrows
- Input/Output:   parallelogram
- Connector:      small circle when arrows must rejoin
- Flow:           solid arrow with arrowhead

Flow direction: top to bottom; "No" branches loop or exit to the side.

Steps (in order):

  1. (Start)        "Start"
  2. (I/O)          "User action in React UI
                     (click / type / submit)"
  3. (Process)      "API client builds HTTP request
                     (method, URL, JSON body, cookie)"
  4. (Process)      "Browser sends HTTP/1.1 request
                     to chttp server"
  5. (Process)      "chttp accepts socket,
                     parses request line + headers"
  6. (Decision)     "Route matched in route table?"
        No  ▶  (Process) "Return 404 Not Found"  → (End) "Response sent"
        Yes ▶  Continue.
  7. (Decision)     "Route is auth-protected?
                     (DEFINE_AUTH_ROUTE / STREAM_AUTH_ROUTE)"
        No  ▶  Skip auth, jump directly to step 11
                (handler runs in main process).
        Yes ▶  Continue.
  8. (Process)      "Read 'active_session' cookie;
                     load ./sessions/<token>"
  9. (Decision)     "Session valid?"
        No  ▶  (Process) "Return 401 Unauthorized" → (End) "Response sent"
        Yes ▶  Continue.
 10. (Process)      "fork(); child setuid(uid),
                     setgid(gid), chdir(home);
                     parent waitpid"
 11. (Process)      "Handler runs:
                     parse params, do work,
                     build HttpResponse"
 12. (Process)      "Send response (JSON / file stream)"
 13. (Process)      "Child _exit(); parent
                     reaps and continues serving"
 14. (Process)      "Browser receives response;
                     React updates Redux state"
 15. (Process)      "UI re-renders with new state"
 16. (End)          "End"

Layout rules:
- Single vertical main column.
- "Yes" continues downward; "No" branches loop or exit to the right.
- Decision diamonds clearly labelled "Yes" / "No" beside outgoing arrows.
- Arrows must visibly TOUCH the shape edges — no floating gaps.

Legend box (small rectangle in the bottom-LEFT corner of the canvas, thin
black border, heading "Legend" centered at top inside the box).

Format: KEY : VALUE (definition-list style, one row per entry). KEY on
left = descriptive name; VALUE on right = miniature visual sample.
Vertically aligned columns separated by ":" or thin vertical divider.

    Start / End      :   [tiny capsule]
    Process          :   [tiny rectangle]
    Decision         :   [tiny diamond]
    Input / Output   :   [tiny parallelogram]
    Connector        :   [tiny small circle]
    Flow             :   [tiny solid arrow →]

Legend text size 22–26 px. Visual samples on the right are miniature.

Typography:
- Step text: 24–28 px, centered inside shape.
- Decision text: 24 px, centered.
- "Yes" / "No" labels: 22 px, italic, beside arrow.
- Diagram title at top center:
        "Flow Chart — Overall Request Lifecycle"
  (44 px, Aptos sans-serif).

Style constraints:
- Strict black-and-white. No colored fills or strokes.
- Hand-drawn sketch quality, clean and professional, NOT cartoonish.
- NO emoji, NO icons, NO 3D, NO shadows.
- Outer thin black border framing the canvas (3 px).
- White background only.
```

## Iteration hints
- Wrong shape used → "decisions must be diamonds, processes must be
  rectangles, start/end must be rounded capsules"
- Yes/No missing → "label every decision branch with 'Yes' or 'No'"
- Step text wrong → "regenerate, keep all step text exactly verbatim"
- Legend missing → "add the Legend box in the bottom-left corner with
  the six rows in key:value format"
