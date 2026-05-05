# Activity Diagram — Login + Multi-Session Switch — Image Generation Prompt

## Print/sizing baseline
- Output size: 1754 × 2480 px (A4 PORTRAIT @ 300 DPI)
- Aspect ratio: 1 : √2 (portrait)
- Body font: ≥ 30 px in source
- Title font: ≥ 60 px in source
- Stroke width: 3–4 px

## Style
- Hand-drawn / sketchy B&W (Excalidraw / whiteboard)
- Strictly black and white — no colors, no fills
- **Font family: Aptos** (sans-serif) for ALL text — title, lane labels,
  activity labels, decision labels, branch labels. No other font.

## Prompt

```
A clean black-and-white UML Activity Diagram in a hand-drawn sketch style
(thin slightly-wobbly strokes, like Excalidraw / whiteboard), depicting the
LOGIN + MULTI-SESSION SWITCH flow of a self-hosted NAS file manager called
"Imaginary Storage NAS Dashboard". White background, strictly monochrome.
NO colors, NO fills, NO shadows.

Aspect ratio 1:1.414 (A4 PORTRAIT). Render at 1754×2480 px so all labels
remain crisp when printed on A4 paper.

Notation (UML activity diagram):
- Initial node:    solid black filled small circle ●
- Final node:      solid black filled circle inside an outer circle ⦾
- Activity:        rounded rectangle (capsule), with action name inside
- Decision:        diamond, with labelled outgoing arrows
- Merge:           diamond with multiple incoming arrows, one outgoing
- Fork / Join:     thick horizontal black bar (synchronization bar)
- Swimlanes:       two vertical lanes, separated by a thin vertical line,
                   with lane labels at the top of each lane
- Arrows:          solid black arrows, with arrowheads pointing in the
                   direction of flow

Two swimlanes (vertical, side by side):
  LEFT lane label:  "User (Browser)"
  RIGHT lane label: "Server (chttp)"

Flow direction: top to bottom. Each activity sits in the lane that owns it.

Steps to depict (in order, top to bottom):

  ● (Initial node) — at the top of the LEFT lane
  ↓
  [User] "Open /login page"
  ↓
  [User] "Submit username + password"
  ↓
  ─── arrow crossing to RIGHT lane ───
  ↓
  [Server] "POST /login received"
  ↓
  [Server] "PAM authenticate(user, pwd)"
  ↓
  ◇ Decision: "Auth success?"
       No  ▶  [Server] "Return 401 Unauthorized"
              ↓
              ─── arrow crossing back to LEFT ───
              [User] "Show error" → ⦾ Final node "(End — failed)"

       Yes ▶  [Server] "create_session() →
                        write ./sessions/<token> (mode 0644)"
              ↓
              [Server] "Set cookie:
                        active_session=<token>/<user>"
              ↓
              ─── arrow crossing back to LEFT ───
              [User] "Cookie stored;
                      navigate to /"
              ↓
              [User] "GET /whoami + GET /fs/list?path=."
              ↓
              ─── arrow crossing to RIGHT ───
              [Server] "Validate active_session cookie;
                        fork() + setuid() per request;
                        return user info + dir listing"
              ↓
              ─── arrow crossing back to LEFT ───
              [User] "Render Dashboard with file browser"
              ↓
              ◇ Decision: "User clicks
                           'Switch session' for
                           another stored session?"
                   No  ▶  ⦾ Final node "(End — logged in)"
                   Yes ▶  [User] "suppress401Redirect();
                                  POST /sessions/switch/:id"
                          ↓
                          ─── arrow to RIGHT ───
                          [Server] "Read target session file;
                                    update active_session cookie"
                          ↓
                          ─── arrow back to LEFT ───
                          [User] "fetchSettings(),
                                  fetchBookmarks(),
                                  navigate to '/' →
                                  await listDirThunk"
                          ↓
                          [User] "Render dashboard for
                                  switched user"
                          ↓
                          ⦾ Final node "(End — switched)"

Layout rules:
- Two equal-width swimlanes; lane labels at top in slightly heavier text.
- Activity capsules ~520 × 130 px.
- Arrows must visibly TOUCH the activity edges — no floating gaps.
- Cross-lane arrows clearly cross the lane boundary perpendicularly.
- Decision diamond branches labelled "Yes" / "No" beside outgoing arrows.

Typography:
- Activity labels: 24–28 px, centered.
- Lane labels: 30 px, italic.
- Decision labels: 24 px, centered.
- Yes / No labels: 22 px, italic, beside arrows.
- Diagram title at top center:
        "Activity Diagram — Login + Multi-Session Switch"
  44 px, black, Aptos sans-serif.

Style constraints:
- Strict black-and-white. No colored fills or strokes.
- Hand-drawn sketch quality, clean and professional, NOT cartoonish.
- NO emoji, NO icons, NO 3D, NO shadows.
- Outer thin black border framing the canvas (3 px).
- White background only.
```

## Iteration hints
- Swimlanes missing → "redraw with two vertical swimlanes ('User (Browser)'
  and 'Server (chttp)') separated by a vertical line, lane labels at top"
- Wrong start/end nodes → "use a solid filled small circle for the initial
  node, and a solid filled circle inside an outer circle for the final
  node"
- Activities not capsule-shaped → "activities must be rounded rectangles
  (stadium / capsule shapes), not plain rectangles or ellipses"
- Cross-lane arrows confusing → "ensure cross-lane arrows are clearly
  horizontal and perpendicular to the lane boundary"
