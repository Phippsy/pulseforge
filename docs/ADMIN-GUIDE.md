# Admin & Remote Control Guide

> "With great power comes great responsibility. With the DANFEST admin panel comes great potential for visual chaos. Use wisely, Dan."

## Overview

The admin panel (`/admin`) provides full control over:

- System messages (rotating text overlays)
- User submission moderation
- Colour palette editing
- Display settings
- Remote control (real-time effect/palette switching)

## Accessing Admin

Navigate to `/admin` on any device. There's no authentication — it's a birthday party, not a bank.

## Tabs

### SYSTEM — Message Management

System messages appear as full-screen cinematic text overlays during the visualiser. Two types:

- **ROTATION**: Permanently in the rotation, interspersed with user submissions
- **ONE-OFF**: Shown immediately as priority — ideal for shoutouts mid-set ("THIS ONE'S FOR DAVE")

Each message has a text effect:
| Effect | Description |
|--------|-------------|
| IMPACT | Full-width bold text, maximum presence |
| SCATTERED | Letters at random positions with glow |
| GRID | Constructivist grid with colored accent lines |
| STAGGER | Words appear at staggered positions |
| TYPEWRITER | Characters reveal one by one |
| KINETIC | Words fly in from different directions |
| ZOOM | Text zooms in from nothing |
| GLITCH | Digital glitch distortion |

**Preview**: Hit the play button to see exactly how the message will look full-screen.

### USER — Submission Moderation

Party guests can submit messages and photos at `/submit`. This tab shows all submissions with:

- **Toggle**: Pause/unpause individual items
- **Delete**: Remove inappropriate content (Uncle Dave's "jokes", etc.)
- **Stats**: Active/paused/total counts

### PALETTES — Colour Editing

All 60 palettes can be customised:

- Change any of the 4 accent colours
- Change the background colour
- Rename palettes
- Filter to find specific palettes
- Reset overrides per-palette or all at once

Overrides are stored in localStorage — they persist across sessions but are device-specific.

### SETTINGS — Display Timing

Control how frequently new messages appear. Range: 3-30 seconds.

### REMOTE — Live Control

The main event for party DJing. Two quick-action buttons:

- **NEXT PALETTE** — Immediately cycle to next colour palette
- **NEXT EFFECT** — Immediately switch to a random new effect

Plus a full grid of all 42 effects — tap any one to instantly switch the big screen to that specific effect.

#### How Remote Control Works

1. Admin panel sends a POST to `/api/remote-control`
2. Command is stored in Redis queue
3. Visualiser (running on the big screen) polls every 2 seconds
4. Command is consumed and executed immediately

Latency: 0-2 seconds (depends on where in the polling cycle the command arrives).

#### Multi-Device

Remote commands are broadcast — ALL running visualiser instances will respond. This means:

- Control from your phone while visuals run on the projector
- Multiple screens can run in sync
- Dan can drunkenly stab at his iPad and still hit the right button (the buttons are big for a reason)

## The Submit Page (`/submit`)

Party guests see a simple form at `/submit`:

- Name field
- Message text area
- Photo upload (supports HEIC from iPhones, auto-compressed)
- Video coming soon

Submissions appear as floating messages on the visualiser, rendered in random decorative fonts with glow effects. Photos are displayed as floating Polaroid-style frames.

## Pro Tips for the Party DJ

1. **Set up beforehand**: Add 3-5 system messages in ROTATION mode before the party starts
2. **Use ONE-OFF for shoutouts**: When a banger drops, send "THIS TUNE IS FOR DAN" as one-off
3. **Remote from your phone**: Keep /admin open on your phone for quick palette/effect changes
4. **Ceefax for banter**: Switch to Ceefax effect when someone requests a toilet break
5. **Laser Show for drops**: Switch to Laser Show right when the bass drops — maximum impact
6. **Fireworks 50 for midnight**: The Fireworks effect literally spells "50" — save it for the cake moment
7. **Let random mode do its thing**: 90% of the time, random mode is perfect. Only intervene for key moments.

## Keyboard Shortcuts (Main Visualiser)

These work on the main display (not admin page):

| Key       | Action                      |
| --------- | --------------------------- |
| `Space`   | Toggle blackout             |
| `F`       | Toggle fullscreen           |
| `R`       | Toggle random mode          |
| `→` / `←` | Next/previous effect        |
| `↑` / `↓` | Increase/decrease intensity |
| `P`       | Next palette                |
| `H`       | Toggle HUD                  |
| `?`       | Show all shortcuts          |

---

_Unwritten rule: If you're spending more time in the admin panel than dancing, you're doing it wrong. Set it up, let random mode ride, and get back to the dancefloor._
