# Flow Chart — Admin Operations — Image Generation Prompt

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
ADMIN OPERATIONS for a self-hosted NAS file manager called
"Imaginary Storage NAS Dashboard" — root-only flows for user management
and disk management. White background, strictly monochrome. NO colors,
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

Flow direction: top to bottom; root check rejection exits to the right.

Steps:

  1. (Start)        "Start"
  2. (I/O)          "Admin user opens
                     /admin/users or /admin/disks
                     in dashboard"
  3. (Process)      "Validate active_session cookie"
  4. (Decision)     "getuid() == 0 ?
                     (server is running as root,
                      and authenticated user is root)"
        No  ▶  (Process) "Return 403 Forbidden" →
                (End) "End — denied"
        Yes ▶  Continue.
  5. (Decision)     "Resource group?"
       Branches: "User Management" / "Disk Management"

  ─── USER MANAGEMENT branch ─────────────────────────
  6U. (Decision)    "Sub-action?"
       Branches: List / Add / Modify / Delete

       List   ▶  (Process) "Read /etc/passwd;
                            filter UID ≥ 1000;
                            return JSON [{username,
                            uid, home, shell}]"
       Add    ▶  (I/O) "Read POST body
                        {username, password,
                         home?, shell?}"  →
                  (Process) "Run useradd
                             with arguments;
                             then echo password
                             | passwd --stdin"
       Modify ▶  (I/O) "Read PUT body
                        {field changes}"  →
                  (Process) "Run usermod
                             (for shell/home)
                             or passwd
                             (for password reset)"
       Delete ▶  (Process) "Run userdel -r
                            (removes home)"

  7U. → join to step 13

  ─── DISK MANAGEMENT branch ─────────────────────────
  6D. (Decision)    "Sub-action?"
       Branches: List / Mount / Unmount / Format

       List    ▶  (Process) "Read /proc/mounts +
                              run lsblk -J;
                              build JSON [{device,
                              size, mountpoint, fs}]"
       Mount   ▶  (I/O) "Read POST body
                         {device, mountpoint, fs}"  →
                   (Process) "Verify mountpoint
                              exists (mkdir if needed);
                              call mount(2) syscall"
       Unmount ▶  (I/O) "Read POST body {mountpoint}"  →
                   (Decision) "Path safe and currently
                               mounted?"
                     No  ▶  (Process) "Return 400" →
                              (End) "End — error"
                     Yes ▶  (Process) "Call umount(2)"
       Format  ▶  (I/O) "Read POST body
                         {device, fs (ext4/btrfs/...)}"  →
                   (Decision) "Confirm device is
                               unmounted and not the
                               root device?"
                     No  ▶  (Process) "Return 409
                                       (refuse — unsafe)" →
                              (End) "End — error"
                     Yes ▶  (Process) "Run mkfs.<fs>
                                       on <device>
                                       (DESTRUCTIVE)"

  7D. → join to step 13

 12. (Connector)    "(merge point)"
 13. (Decision)     "Operation succeeded
                     (exit code / errno)?"
        No  ▶  (Process) "Return 500
                          with stderr in JSON" →
                (End) "End — error"
        Yes ▶  Continue.
 14. (Process)      "Return 200 OK
                     (with JSON result)"
 15. (End)          "End — success"

Layout rules:
- Single vertical spine for steps 1–5 and 12–15.
- Two top-level branches (User Management / Disk Management); each
  sub-action is a SHORT vertical sub-flow that merges back at the
  connector.
- If sub-actions don't fit horizontally, stack them vertically — do NOT
  widen the canvas.
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
- Step text: 24–28 px, centered.
- Decision text: 24 px, centered.
- Branch labels: 22 px, italic, beside arrows.
- Diagram title at top center:
        "Flow Chart — Admin Operations"
  (44 px, Aptos sans-serif).

Style constraints:
- Strict black-and-white. No colored fills or strokes.
- Hand-drawn sketch quality, clean and professional, NOT cartoonish.
- NO emoji, NO icons, NO 3D, NO shadows.
- Outer thin black border framing the canvas (3 px).
- White background only.
```

## Iteration hints
- Sub-branches don't fit → "stack sub-actions vertically rather than
  widening; use a connector circle to rejoin to the spine"
- Root check missing → "include the 'getuid() == 0?' decision early in
  the flow with a 403 Forbidden exit on the No branch"
- Format safety check missing → "include the 'device unmounted and not
  root device?' confirmation diamond before invoking mkfs"
- Legend missing → "add the Legend box bottom-left in key:value format"
```
