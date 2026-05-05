# Class Diagram — Image Generation Prompt

## Print/sizing baseline
- Output size: 1754 × 2480 px (A4 PORTRAIT @ 300 DPI) — diagram grows
  vertically as content is added, not horizontally.
- Aspect ratio: 1 : √2 (portrait)
- Body font: ≥ 26 px in source
- Title font: ≥ 60 px in source
- Stroke width: 3–4 px

## Style
- Hand-drawn / sketchy B&W (Excalidraw / whiteboard)
- Strictly black and white — no colors, no fills
- **Font family: Aptos** (sans-serif) for ALL text — title, class names,
  stereotypes, attributes, operations, multiplicities. No other font.

## Prompt

```
A clean black-and-white UML Class Diagram in a hand-drawn sketch style
(thin slightly-wobbly strokes, like Excalidraw / whiteboard), for a
self-hosted NAS file manager called "Imaginary Storage NAS Dashboard".
White background, strictly monochrome. NO colors, NO fills, NO shadows.

Aspect ratio 1:1.414 (A4 PORTRAIT). Render at 1754×2480 px so all labels
remain crisp when printed on A4 paper. The diagram grows VERTICALLY when
more classes need to be shown — never spread horizontally beyond the
canvas width.

Note: this project mixes C structs (backend) and TypeScript classes
(frontend). The diagram uses standard UML class-box notation for both.

UML class-box notation (every class drawn the same way):
- Rectangle divided by horizontal lines into THREE compartments:
    * Top:    class name (and stereotype if applicable)
    * Middle: attributes (name : type)
    * Bottom: operations (name() : returnType)
- Visibility prefixes: + public, - private, # protected.
- For C structs, use stereotype "<<struct>>" above the name.

Layout: TWO grouping rectangles stacked TOP and BOTTOM:
- TOP group:    label "Backend (C structs)"
- BOTTOM group: label "Frontend (TypeScript)"

KEEP DETAILS MINIMAL per class — show only the most relevant items:
  * 3–4 attributes max
  * 2–3 operations max
  * Use ellipsis "..." in a compartment if more exist but were trimmed.

──────────────── TOP GROUP — Backend (C structs) ───────────────────────

FOUR classes (arrange in 2 columns inside the top group):

  <<struct>> Session
  ───────────────────
  + token        : char[64]
  + username     : string
  + uid, gid     : int
  ───────────────────
  + create_session(user)
  + validate_session(token)
  + delete_session(token)

  <<struct>> FileEntry
  ───────────────────
  + name      : string
  + size      : off_t
  + mtime     : time_t
  + is_dir    : bool
  ───────────────────
  + fs_list_dir(path)

  <<struct>> TrashItem
  ───────────────────
  + name           : string
  + original_path  : string
  + deleted_at     : ISO8601
  ───────────────────
  + trash_move(path)
  + trash_restore(name)

  <<struct>> UploadSession
  ───────────────────
  + upload_id      : string
  + chunk_count    : int
  + chunk_hashes[] : sha256
  + received[]     : bitset
  ───────────────────
  + write_chunk(idx, data)
  + finalize()

──────────────── BOTTOM GROUP — Frontend (TypeScript) ──────────────────

FOUR classes (arrange in 2 columns inside the bottom group):

  ApiClient
  ───────────────────
  - baseUrl       : string
  - suppress401   : boolean
  ───────────────────
  + apiRequest(path, opts)
  + suppress401Redirect()

  FsApi
  ───────────────────
  ───────────────────
  + listDir(path)
  + uploadSimple(file, path)
  + download(path)
  + rename(path, name)
  + ...

  UploadEngine     <<singleton>>
  ───────────────────
  - queue    : UploadItem[]
  - paused   : boolean
  - current  : UploadItem
  ───────────────────
  + addFiles(files, dir)
  + togglePause()
  + onChange(fn)

  RootStore
  ───────────────────
  + fileSystem  : Slice
  + uploads     : Slice
  + trash       : Slice
  + sessions    : Slice
  + ...
  ───────────────────
  (no operations)

Relationships:

Backend side:
  Session  ──association──  TrashItem      (1..*)  [optional, omit if it
                                                    crowds the diagram]

Frontend side:
  RootStore  ──composition◆──  fileSystem / uploads / trash / sessions slices
  FsApi  ──dependency--▶──  ApiClient
  UploadEngine  ──aggregation◇──  UploadItem (1..*)
       (UploadItem may be implied — only draw if space permits)
  UploadEngine  ──dependency--▶──  FsApi

Cross-group dependency (single dashed arrow with label, going from
bottom group up to top group):
  ApiClient  ─ ─ ─ HTTP / JSON ─ ─ ─▶  Session    (or any backend class —
                                                   the dashed line stands
                                                   for the HTTP boundary)

──────────────── Legend (bottom of canvas) ─────────────────────────────

Small Legend rectangle in the bottom-LEFT corner of the canvas (outside
both group rectangles), thin black border, heading "Legend" centered at
top inside the box.

Format: KEY : VALUE (definition-list style, one row per entry). The KEY
on the LEFT is the descriptive name; the VALUE on the RIGHT is a small
visual sample of the shape / line. A colon ":" or thin vertical divider
separates the two columns. Both columns are vertically aligned across
all rows so it reads as a clean two-column key:value table.

    Class / Struct              :   [tiny class box, 3 compartments]
    Association                 :   [tiny solid line, no arrowhead]
    Aggregation                 :   [tiny line + open diamond ◇]
    Composition                 :   [tiny line + filled diamond ◆]
    Dependency / Uses           :   [tiny dashed line + arrow ▶]
    Generalization (inherits)   :   [tiny line + hollow triangle △]

Legend text size 22–26 px. The visual samples on the right are drawn at
miniature size, vertically centered with their row label.

Layout rules:
- Top and bottom group rectangles span almost the full canvas width.
- Inside each group, classes arranged in TWO columns; if more classes
  are needed, ADD MORE ROWS (extend the group downward), never widen
  the canvas.
- Each class box sized to fit its trimmed content (~360 × 240 px).
- Generous spacing — at least 50 px between class boxes.
- Arrows must visibly TOUCH class-box edges; no floating gaps.
- Avoid arrow crossings where possible; route around boxes.
- Compartments inside each class box are clearly separated by horizontal
  lines.

Typography:
- Group labels: 32 px, slightly heavier sketch stroke, top-left INSIDE
  each group rectangle.
- Class names: 26–30 px, centered, slightly heavier stroke.
- Stereotype labels (<<struct>>, <<singleton>>): 22 px, italic, above
  the class name.
- Attributes & operations: 22–24 px, left-aligned within compartment.
- Multiplicity labels: 22 px, near the line endpoints.
- Legend text: 22–26 px.
- Diagram title at top center: "Class Diagram — NAS Dashboard"
  (44 px, Aptos sans-serif).

Style constraints:
- Strict black-and-white. No colored fills or strokes.
- Hand-drawn sketch quality, clean and professional, NOT cartoonish.
- NO emoji, NO icons, NO 3D, NO shadows.
- Outer thin black border framing the canvas (3 px).
- White background only.
```

## Iteration hints
- Too dense → "trim each class to ≤3 attributes and ≤2 operations; use
  '...' in a compartment to indicate more exist"
- Classes don't fit → "extend the group rectangle downward and add more
  rows; do NOT widen the canvas or shrink the class boxes"
- Wrong arrowhead types → "use open diamond for aggregation, filled
  diamond for composition, hollow triangle for generalization, open
  arrowhead for dependency, no arrowhead for association"
- Stereotypes missing → "add <<struct>> above each backend C class name
  and <<singleton>> above UploadEngine"
- Legend missing → "add the Legend box in the bottom-left corner with all
  six rows (Class, Association, Aggregation, Composition, Dependency,
  Generalization)"
