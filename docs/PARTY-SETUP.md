# Party Setup Guide

> "The most important document in this entire repository. This is the one that actually makes Dan's party legendary. Everything else is just code."

## What You Need

### Hardware

| Item | Purpose | Notes |
|------|---------|-------|
| Laptop/Mac | Runs the visualiser | Chrome browser required |
| TV/Projector | Big screen display | HDMI or AirPlay |
| Audio source | Music for the party | Spotify, vinyl, whatever Dan wants |
| Phone/iPad | Remote control | Any device with a browser |
| Good speakers | Making humans dance | The bigger the better |
| Beer | Keeping Dan hydrated | CRITICAL — do not underestimate |

### Network

All devices need to be on the same network (or have internet access to reach the Vercel deployment). The visualiser runs from `pulseforge-lyart.vercel.app` — no local server required for the live party.

## Setup Steps

### 1. The Big Screen (5 minutes)

1. Connect laptop to TV/projector via HDMI
2. Open Chrome on the laptop
3. Navigate to `https://pulseforge-lyart.vercel.app`
4. Click "Start" to begin audio capture
5. Select "System Audio" when prompted (share a Chrome tab or entire screen playing music)
6. Press `F` for fullscreen
7. Press `H` to hide the HUD

The visualiser is now running and listening to whatever audio you play.

### 2. The Music (2 minutes)

Play music on the same laptop:
- Open Spotify/Apple Music/YouTube in another tab
- Or use any audio player
- The system audio capture will pick up ALL audio from the machine

Alternatively, use a microphone input:
- Select mic/line-in during audio setup
- Useful for vinyl DJs or live instruments
- Position mic near the speaker for best results

### 3. The Remote Control (1 minute)

On your phone/iPad:
1. Open `https://pulseforge-lyart.vercel.app/admin`
2. Go to the "REMOTE" tab
3. You can now switch effects and palettes from your pocket

### 4. Guest Submissions (1 minute)

Tell guests to visit `https://pulseforge-lyart.vercel.app/submit` on their phones. They can:
- Send birthday messages to Dan
- Upload photos
- All submissions appear as floating overlays on the big screen

**Pro tip**: Make a QR code for the submit URL and print it on cards for the tables.

### 5. Pre-party Admin Setup (5 minutes)

On the admin panel:
1. Add 3-5 system messages in ROTATION:
   - "HAPPY BIRTHDAY DAN"
   - "WELCOME TO DANFEST 50"
   - "EAT SLEEP RAVE REPEAT"
   - "DAN IS 50 AND STILL GORGEOUS"
2. Test each message with the preview button
3. Verify the remote control works (press Next Effect, confirm the big screen changes)

## Night-Of Checklist

- [ ] Laptop charged / plugged in (this thing will run for hours)
- [ ] Chrome is the active browser (NOT Safari — no system audio capture)
- [ ] Music source is ready
- [ ] TV/projector connected and displaying
- [ ] Visualiser running in fullscreen with audio capture active
- [ ] Admin panel open on phone
- [ ] Guest submission URL shared (QR codes, group chat, etc.)
- [ ] Dan has a beer in hand
- [ ] Backup beers chilling for Dan
- [ ] Emergency beer supply for Dan (fridge, cooler, etc.)
- [ ] Someone designated to keep Dan's beer glass full

## Troubleshooting

### "No audio detected" / visuals aren't reacting
- Make sure you selected "System Audio" not a specific tab
- Check the music is actually playing and not muted
- Try increasing the sensitivity slider (visible in the HUD)
- Restart audio capture: click the audio icon, stop, then start again

### "Visuals are choppy"
- Close other browser tabs (they steal GPU)
- Make sure the laptop isn't on power saver mode
- The visualiser auto-adapts quality, but if your machine is struggling, some effects are heavier than others
- Switch to lighter effects via remote: Starfield, Flow Lines, Plasma are gentle on the GPU

### "Remote control isn't working"
- Both devices need internet access
- The visualiser polls every 2 seconds — wait a moment
- Check you're on the correct URL (not localhost)
- Try refreshing the admin page

### "Guest submissions aren't appearing"
- Submissions appear every 8 seconds by default (configurable in Settings)
- Check the USER tab in admin — submissions might be paused
- The submission display layer needs the visualiser to be running

### "Dan needs more beer"
- This is a feature, not a bug
- Solution: go get Dan a beer
- If unsure which beer, Dan likes all of them
- In case of emergency, any cold liquid with alcohol content > 4% will suffice

## The Dan Protocol

For optimal party visuals:

1. **7pm-9pm (Warmup)**: Leave on random mode. Deep House genre vibes. Keep palettes cycling.
2. **9pm-11pm (Peak)**: Switch to Future Disco. Start throwing in one-off messages for arriving guests. Use Laser Show and Disco Ball for big moments.
3. **11pm-1am (Full send)**: Peak Techno. All effects on maximum. Remote control freestyle. This is where you earn your DJ stripes.
4. **1am+ (Afterparty)**: Slower effects — Aurora, Nebula, Lava Lamp. Turn intensity down. Everyone's vibes are internal at this point.

Throughout all phases: keep Dan's glass full. This is non-negotiable.

---

*Final note: The best party visuals are the ones nobody notices because they're too busy having the time of their lives. If Dan doesn't remember the visuals but remembers the party being incredible, you've done your job perfectly. Legend.*
