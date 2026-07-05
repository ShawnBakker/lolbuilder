# lolbuilder helper — install guide (for friends)

This is a tiny program that runs on your PC and lets the lolbuilder website
auto-fill the draft board from your actual champ select, so you don't type
ten champion names. That's all it does.

## What it does — and doesn't — do (the honest part)

- **Reads only, as far as League is concerned.** It looks at your
  champ-select screen through the League client's own local interface. It
  cannot pick, ban, chat, accept queues, or change anything in the game or
  your account — the code contains no operations that send anything TO the
  League client or any Riot service. The one thing it writes is a small
  stats log file on your own machine (`lolbuilder\calibration-log.jsonl`
  under your local app data), which records the tool's own predictions so
  it can be honest later about whether they tracked your results.
- **Local only.** It talks to two things: the League client on your own PC,
  and the lolbuilder page open in your browser. It sends nothing anywhere
  else. No accounts, no passwords, no telemetry.
- **Your client's access token stays on your machine.** The helper reads a
  local League file to connect; that token is scrubbed from every message
  the helper prints, so even error text you copy-paste to us can't leak it.
- It's plain JavaScript you can read — nothing is hidden in a binary.

## What you need

- Windows with League installed in the usual place (`C:\Riot Games\...`)
- Node.js (free, from [nodejs.org](https://nodejs.org) — pick "LTS")

## Steps

1. Download `helper.zip` from the lolbuilder GitHub release and unzip it
   anywhere (Desktop is fine). It contains two files: `helper.mjs` and
   `run-helper.bat`.
2. Double-click `run-helper.bat`.
3. **What Windows may show, and why it's fine:**
   - *"Windows protected your PC" (SmartScreen):* the script isn't signed
     with a paid certificate — click **More info → Run anyway**. It's the
     same file you can open in Notepad and read.
   - *A firewall prompt:* the helper listens only on `127.0.0.1` (your own
     machine — nothing from the network can reach it). Allow it.
   - *Antivirus curiosity:* an unsigned script opening a local port is a
     pattern AV tools watch. The two bullet points above are the whole
     story; the source is in the repo if you (or your AV vendor) want to
     look.
4. You'll see: `lolbuilder helper v0.3.0 listening on http://127.0.0.1:27437`.
   Leave the window open.
5. Open the lolbuilder site, click **Auto (LCU helper)**. The status line
   tells you the truth at every moment: waiting for League, waiting for
   champ select, or LIVE.

## Checking it works

Open <http://127.0.0.1:27437/health> in your browser — you should see a
line of text with `"ok":true`. If League is running it also says
`"lcu":"connected"`.

## If something's off

- **"League client not detected"** and League is installed somewhere unusual:
  start the helper as
  `run-helper.bat` from a terminal with `set LEAGUE_LOCKFILE=D:\Your\Path\League of Legends\lockfile`
  (or edit the bat to add that line above the `node` line).
- **The site says "helper is outdated":** grab the newest `helper.zip` from
  the release page — the site updates itself, the helper doesn't.
- **Anything else:** close the window, start it again, and if it persists,
  copy the text from the helper window to us — it's safe to paste (see the
  token note above).

## Stopping it

Close the window. It keeps nothing running and stores nothing.
