# Running a SimGas teaching room on a local network

This guide is for simulation faculty who want the full trainer–trainee
workflow in a teaching room: the trainer drives the case from a laptop,
trainees join from phones or tablets, and a projector can show the
monitor. No accounts, no cloud service, no patient data — everything runs
on one machine on your local Wi-Fi.

## What you need

- A laptop with [Node.js 20+](https://nodejs.org) installed.
- A Wi-Fi network that the laptop and the trainees' devices share.
  A phone hotspot works in a pinch.
- Optionally: a projector or wall display connected to any device with a
  browser.

## One-time setup

```bash
git clone https://github.com/bsharif/simgas.git
cd simgas
npm install
npm run build
```

## Start the room server

```bash
npm start
```

The server listens on port `4174` and serves both the app and the
realtime session socket. Find your laptop's LAN address:

- **macOS**: System Settings → Wi-Fi → Details, or `ipconfig getifaddr en0`
- **Windows**: `ipconfig` → "IPv4 Address"
- **Linux**: `hostname -I`

Trainees browse to `http://<your-laptop-ip>:4174`.

## Room workflow

1. On the laptop, open `http://localhost:4174`, choose **Host trainer
   room**, enter your name, and pick a starting scenario.
2. The room opens as a **waiting room**. Nothing runs yet — invite
   trainees with the 6-character code or the QR code on screen (the QR
   encodes the full join link).
3. Watch the roster: each trainee shows a green dot when connected. If
   someone drops off Wi-Fi the dot turns red until they reconnect.
4. Press **Start case** when you've briefed the group.
5. During the case you can pause/resume, override vitals, force phases,
   inject events, add private notes, and mark teaching moments. Every
   trainee action appears on your attributed action timeline.
6. When the case ends, review the debrief privately, then press **Open
   debrief for everyone** to share it with the group. **Restart case**
   or pick a new case runs the next round in the same room.

### Projector / observer view

Join the room from the projector device as a trainee named "Projector"
and leave the action tray closed — the monitor fills the screen. (A
dedicated read-only observer role is on the roadmap.)

## Troubleshooting

**Trainees can't reach the page.**
- Phone and laptop must be on the *same* network — hospital guest Wi-Fi
  often isolates clients from each other ("AP/client isolation"). Use a
  hotspot or a dedicated teaching-room router if so.
- Check a local firewall isn't blocking port 4174 (macOS will prompt the
  first time; allow incoming connections for Node).

**"Session not found" when joining.**
- Codes expire ~10 minutes after a room empties or a case ends without a
  restart. Create a fresh room and re-share the code.

**The monitor stutters on a phone.**
- Close other tabs; low-power mode throttles browser animation. The
  numerics are still authoritative — waveform smoothness is cosmetic.

**The trainer lost Wi-Fi mid-case.**
- Reconnect within the session TTL and the app resumes the trainer seat
  automatically (the reconnect token is held in the page). The case keeps
  running on the server while you're gone.

**Browsers**: recent Chrome, Edge, Safari, or Firefox. Trainee view is
mobile-first; the trainer view wants a laptop-sized screen.

## Privacy

Sessions live in the laptop's memory and vanish when the server stops.
Nothing is written to disk, no analytics are sent, and no accounts exist.
Use display names, not patient or learner identifiers, if your governance
requires it.
