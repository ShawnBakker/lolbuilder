#!/usr/bin/env bash
# smoke-test.sh — Data-source validation gate (brainstorm → spec)
# Run ON THE ORACLE VPS. Requires: curl, jq, file.
#
# Usage:
#   ./smoke-test.sh "<champion_url>" "<synergy_url>" ["<second_champion_url>"]
#
# The URLs come from DevTools capture (see CAPTURE-GUIDE below / in repo docs):
# known-stale guesses 404'd on 2026-07-02, so this script refuses to guess.
#
# Why input-driven instead of hardcoded: the endpoint shape is the hypothesis
# under test. Hardcoding a guess that already failed would test nothing.

set -uo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <champion_url> <synergy_url> [second_champion_url]" >&2
  echo "Capture real URLs via browser DevTools on lolalytics.com first." >&2
  exit 1
fi

CHAMP_URL="$1"; SYNERGY_URL="$2"; SECOND_URL="${3:-}"
UA="personal-draft-tool-smoketest (private hobby project)"
OUT="smoke-findings-$(date +%Y%m%d-%H%M).md"
DELAY=3

command -v jq >/dev/null || { echo "jq required: sudo apt install -y jq" >&2; exit 1; }

fetch() { # $1=url $2=outfile -> echoes "code|bytes|type"
  local code bytes type
  code=$(curl -sS -A "$UA" -o "$2" -w "%{http_code}" --max-time 20 "$1" 2>/dev/null || echo "ERR")
  bytes=$(wc -c < "$2" 2>/dev/null || echo 0)
  type=$(file -b --mime-type "$2" 2>/dev/null || echo "unknown")
  echo "${code}|${bytes}|${type}"
  sleep "$DELAY"
}

summarize_json() { # $1=file -> top-level keys or diagnosis
  if jq -e . "$1" >/dev/null 2>&1; then
    jq -r 'keys | join(", ")' "$1"
  elif grep -qi "cloudflare\|challenge\|cf-ray" "$1"; then
    echo "NOT JSON — looks like a Cloudflare challenge page"
  else
    echo "NOT JSON — first 200 chars: $(head -c 200 "$1" | tr '\n' ' ')"
  fi
}

bucket_check() { # $1=file — search common names for game-length buckets
  jq -r '[paths | join(".")] | map(select(test("time|Time|duration|length|graph|phase|min"; "i"))) | unique | .[0:15] | join("\n")' "$1" 2>/dev/null \
    | grep . || echo "no time/length/graph-named paths found"
}

echo "# Smoke Test Findings — $(date -u +%F' '%R' UTC'), from $(hostname)" > "$OUT"
echo >> "$OUT"

# Step 0 — DDragon freshness
DD=$(curl -sS -A "$UA" https://ddragon.leagueoflegends.com/api/versions.json | jq -r '.[0]' 2>/dev/null || echo "FETCH FAILED")
echo "## Step 0 — DDragon: latest = $DD (expect 16.NN.1 mapping to live 26.NN)" | tee -a "$OUT"
sleep "$DELAY"

# Step 1 — Champion payload
echo "## Step 1 — Champion payload" | tee -a "$OUT"
R=$(fetch "$CHAMP_URL" champ1.json); IFS='|' read -r CODE BYTES TYPE <<< "$R"
{ echo "- URL: \`$CHAMP_URL\`"
  echo "- HTTP $CODE, $BYTES bytes, mime=$TYPE"
  echo "- Top-level keys: $(summarize_json champ1.json)"
  echo "- Candidate game-length-bucket paths:"
  echo '```'; bucket_check champ1.json; echo '```'; } | tee -a "$OUT"

# Step 2 — Synergy payload
echo "## Step 2 — Synergy payload" | tee -a "$OUT"
R=$(fetch "$SYNERGY_URL" synergy.json); IFS='|' read -r CODE BYTES TYPE <<< "$R"
{ echo "- URL: \`$SYNERGY_URL\`"
  echo "- HTTP $CODE, $BYTES bytes, mime=$TYPE"
  echo "- Top-level keys: $(summarize_json synergy.json)"
  echo "- MANUAL CHECK REQUIRED: arbitrary-pair duo WRs, or only top-N lists?"; } | tee -a "$OUT"

# Step 3 — Consistency (second champion/role)
echo "## Step 3 — Second champion (consistency)" | tee -a "$OUT"
if [ -n "$SECOND_URL" ]; then
  R=$(fetch "$SECOND_URL" champ2.json); IFS='|' read -r CODE BYTES TYPE <<< "$R"
  K1=$(summarize_json champ1.json); K2=$(summarize_json champ2.json)
  { echo "- HTTP $CODE, $BYTES bytes"
    [ "$K1" = "$K2" ] && echo "- Key structure MATCHES champ1 ✔" \
                      || echo "- Key structure DIFFERS — investigate before /spec"; } | tee -a "$OUT"
else
  echo "- SKIPPED (no second URL provided) — one datapoint can't distinguish 'works' from 'cached fluke'" | tee -a "$OUT"
fi

{ echo "## Remaining manual steps (from runbook)"
  echo "- [ ] Step 4: u.gg DevTools capture — record URL pattern + version-integer location"
  echo "- [ ] Step 5: op.gg MCP existence + does it carry matchup/build data (resolves crosscheck disagreement F17)"
  echo "- [ ] Step 6: note any challenge/block observed this session (none = good, not proof)"
  echo "- [ ] Fill 'Payload field map' section by inspecting champ1.json / synergy.json with jq"
  echo
  echo "## Verdict: [FULL PASS / PARTIAL — buckets missing / PARTIAL — synergy limited / FAIL — blocked]"; } >> "$OUT"

echo; echo "Findings written to $OUT — raw payloads kept as champ1.json / synergy.json / champ2.json"
echo "Next: fill the manual sections, then the findings doc becomes the /spec input."
