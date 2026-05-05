# Flow Chart — Resumable Chunked Upload — Image Generation Prompt

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
RESUMABLE CHUNKED UPLOAD flow of a self-hosted NAS file manager called
"Imaginary Storage NAS Dashboard". White background, strictly monochrome.
NO colors, NO fills, NO shadows.

Aspect ratio 1:1.414 (A4 PORTRAIT). Render at 1754×2480 px so all labels
remain crisp when printed on A4 paper.

Notation (standard ANSI flow chart shapes):
- Start / End:    rounded "stadium" shape (capsule)
- Process step:   rectangle
- Decision:       diamond, with "Yes" / "No" labels on outgoing arrows
- Input/Output:   parallelogram
- Connector:      small circle when arrows must rejoin
- Flow:           solid arrow with arrowhead

Flow direction: top to bottom; "Yes" continues down, "No" branches loop
back or exit to the side.

Steps (in order):

  1. (Start)        "Start"
  2. (I/O)          "User selects file(s)"
  3. (Process)      "Compute SHA-256 hash for each
                     4 MB chunk"
  4. (Process)      "Build manifest:
                     dest, filename, file_size,
                     chunk_size, chunk_count,
                     chunk_hashes[]"
  5. (Process)      "POST /fs/upload-session
                     → server returns upload_id"
  6. (Process)      "Save {upload_id, chunk_hashes}
                     to localStorage"
  7. (Decision)     "Resuming a previous upload?"
        Yes ▶  (Process) "GET /fs/upload-session/:id
                          → received_chunks[]"
                Then continue down to step 8.
        No  ▶  Continue directly to step 8.
  8. (Process)      "Pick next chunk index NOT
                     in received_chunks"
  9. (Process)      "STREAM_POST
                     /fs/upload-chunk/:id
                     with X-Chunk-Index header"
 10. (Decision)     "Server validated SHA-256?"
        Yes ▶  (Process) "Mark chunk as received" →
                continue to step 12
        No  ▶  (Process) "Retry with exponential
                          backoff (max N retries)"
                Loop back UP to step 9.
 11. (Decision)     "All chunks received?"
        No  ▶  Loop back to step 8.
        Yes ▶  Continue to step 12.
 12. (Process)      "Server: rename .data → dest;
                     delete .meta and .state"
 13. (Process)      "Client: clear localStorage
                     entry"
 14. (End)          "Upload complete"

Error branch (drawn to the side of the spine):
  From step 9 (or 5), if a fatal error occurs, route an arrow labelled
  "fatal error / user abort" to (Process)
       "DELETE /fs/upload-session/:id"
  then to (End) capsule labelled "Aborted".

Layout rules:
- Single vertical main column down the center.
- "Yes" arrows continue downward; "No" branches loop sideways (left for
  retries, right for aborts).
- Decision diamonds clearly labelled "Yes" / "No" beside outgoing arrows.
- Use a small connector circle if multiple arrows merge at one point.
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
- Step text: 24–28 px, centered inside shape.
- Decision text: 24 px, centered.
- "Yes" / "No" labels: 22 px, italic, beside arrows.
- Diagram title at top center:
        "Flow Chart — Resumable Chunked Upload"
  (44 px, Aptos sans-serif).

Style constraints:
- Strict black-and-white. No colored fills or strokes.
- Hand-drawn sketch quality, clean and professional, NOT cartoonish.
- NO emoji, NO icons, NO 3D, NO shadows.
- Outer thin black border framing the canvas (3 px).
- White background only.
```

## Iteration hints
- Wrong shape used → "decisions must be diamonds; processes must be
  rectangles; start/end must be rounded capsules"
- Yes/No labels missing → "label every branch from a decision diamond
  with 'Yes' or 'No'"
- Loops missing → "draw the retry loop from step 10 No-branch back UP
  to step 9, and the all-chunks loop from step 11 No-branch back to
  step 8"
- Step text wrong → "regenerate, keep all step text exactly verbatim"
- Legend missing → "add the Legend box bottom-left in key:value format"
