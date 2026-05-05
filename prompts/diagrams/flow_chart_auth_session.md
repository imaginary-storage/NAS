# Flow Chart — Authentication & Session Management — Image Generation Prompt

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
AUTHENTICATION & SESSION MANAGEMENT for a self-hosted NAS file manager
called "Imaginary Storage NAS Dashboard" — covering Login, Session
Switch, and Logout. White background, strictly monochrome. NO colors,
NO fills, NO shadows.

Aspect ratio 1:1.414 (A4 PORTRAIT). Render at 1754×2480 px so all labels
remain crisp when printed on A4 paper.

Notation (standard ANSI flow chart shapes):
- Start / End:    rounded "stadium" shape (capsule)
- Process step:   rectangle
- Decision:       diamond, with labels on outgoing arrows
- Input/Output:   parallelogram
- Connector:      small circle when arrows merge
- Flow:           solid arrow with arrowhead

Flow direction: top to bottom; branch outcomes route sideways.

Steps:

  1. (Start)        "Start"
  2. (I/O)          "User opens login page or
                     clicks session control"
  3. (Decision)     "Action?"
       Branch values: "Login" / "Switch session" / "Logout"

  ─── LOGIN BRANCH ────────────────────────────────────────────
  4L. (I/O)         "Submit username + password"
  5L. (Process)     "POST /login with credentials"
  6L. (Process)     "Server: PAM authenticate
                     (pam_start, pam_authenticate)"
  7L. (Decision)    "PAM success?"
        No  ▶  (Process) "Return 401 Unauthorized" →
                (Process) "UI shows error" →
                (End) "End — login failed"
        Yes ▶  Continue.
  8L. (Process)     "create_session():
                     • generate hex64 token
                     • write ./sessions/<token>
                       (mode 0644)"
  9L. (Process)     "Set-Cookie: active_session=
                     <token>/<username>;
                     HttpOnly; SameSite=Lax"
 10L. (Process)     "Browser navigates to /
                     and fetches /whoami + dir list"
 11L. (End)         "End — logged in"

  ─── SWITCH-SESSION BRANCH ───────────────────────────────────
  4S. (Process)     "Frontend: suppress401Redirect()
                     (avoid race during cookie swap)"
  5S. (Process)     "POST /sessions/switch/:session_id"
  6S. (Process)     "Server: read sessions/<id>;
                     update active_session cookie
                     to <id>/<user>"
  7S. (Process)     "Frontend: setCurrentPath('/')
                     → navigate('/') → await
                     listDirThunk"
  8S. (Process)     "Re-fetch settings + bookmarks
                     for the switched user"
  9S. (End)         "End — session switched"

  ─── LOGOUT BRANCH ───────────────────────────────────────────
  4O. (Process)     "DELETE /logout"
  5O. (Process)     "Server: read active_session
                     cookie; delete sessions/<token>"
  6O. (Process)     "Set-Cookie: active_session=;
                     Max-Age=0  (clears cookie)"
  7O. (Process)     "Frontend: clear Redux auth slice;
                     navigate to /login"
  8O. (End)         "End — logged out"

Layout rules:
- Top portion: Start, action I/O, central decision diamond.
- Three vertical sub-columns from the decision: Login (left),
  Switch session (middle), Logout (right). Arrange so the diagram
  remains TALL, not wide — if columns don't fit horizontally, stack
  branches vertically instead.
- Each branch ends in its own rounded "End" capsule.
- Arrows must visibly TOUCH the shape edges — no floating gaps.

Legend box (small rectangle in the bottom-LEFT corner of the canvas, thin
black border, heading "Legend" centered at top inside the box).

Format: KEY : VALUE (definition-list style). KEY = name; VALUE = mini
visual. Columns vertically aligned, separated by ":".

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
- Branch labels (e.g. "Login", "Yes", "No"): 22 px, italic, beside arrows.
- Diagram title at top center:
        "Flow Chart — Authentication & Session Management"
  (44 px, Aptos sans-serif).

Style constraints:
- Strict black-and-white. No colored fills or strokes.
- Hand-drawn sketch quality, clean and professional, NOT cartoonish.
- NO emoji, NO icons, NO 3D, NO shadows.
- Outer thin black border framing the canvas (3 px).
- White background only.
```

## Iteration hints
- Three branches don't fit → "stack branches vertically (Login, then
  Switch, then Logout) one below the other; the diagram grows downward"
- Branch labels missing → "label each branch from the central decision
  diamond with 'Login', 'Switch session', or 'Logout'"
- Legend missing → "add the Legend box in the bottom-left corner with
  six rows in key:value format"
