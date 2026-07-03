# smoke-test.ps1 — Data-source validation gate, laptop edition (Windows/PowerShell)
# Run:  powershell -ExecutionPolicy Bypass -File .\smoke-test.ps1
# Or in VSCode terminal:  .\smoke-test.ps1   (if execution policy allows)
#
# Context: synergy endpoint (ep=build-team) already validated 2026-07-02.
# This script's main job is the LAST unknown: the champion payload
# (matchups + game-length buckets) — the early/mid/late feature depends on it.

$ErrorActionPreference = "Continue"
$Delay = 3  # polite pacing, seconds
$Out = "smoke-findings-$(Get-Date -Format 'yyyyMMdd-HHmm').md"
$Base = "https://a1.lolalytics.com/mega/"

function Probe {
    param([string]$Label, [string]$Url)
    Write-Host "`n=== $Label ===" -ForegroundColor Cyan
    Add-Content $Out "`n## $Label`n- URL: ``$Url``"
    try {
        $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20
        $bytes = $resp.RawContentLength
        Add-Content $Out "- HTTP $($resp.StatusCode), $bytes bytes"
        Write-Host "HTTP $($resp.StatusCode), $bytes bytes" -ForegroundColor Green
        try {
            $json = $resp.Content | ConvertFrom-Json
            $keys = ($json.PSObject.Properties.Name) -join ", "
            Add-Content $Out "- Top-level keys: $keys"
            Write-Host "Keys: $keys"
            # Hunt for game-length buckets: any key matching time/graph/length/phase/min
            $bucketKeys = $json.PSObject.Properties.Name |
                Where-Object { $_ -match "time|graph|length|phase|min|duration" }
            if ($bucketKeys) {
                Add-Content $Out "- GAME-LENGTH BUCKET CANDIDATES: $($bucketKeys -join ', ')  <-- early/mid/late feature lives here"
                Write-Host "BUCKET CANDIDATES: $($bucketKeys -join ', ')" -ForegroundColor Yellow
            } else {
                Add-Content $Out "- No bucket-named top-level keys (check nested — see raw file)"
            }
            # Save raw payload for manual inspection
            $raw = "$($Label -replace '[^a-zA-Z0-9]','_').json"
            $resp.Content | Set-Content $raw -Encoding UTF8
            Add-Content $Out "- Raw payload saved: $raw"
            return $json
        } catch {
            $head = $resp.Content.Substring(0, [Math]::Min(200, $resp.Content.Length))
            Add-Content $Out "- NOT JSON. First 200 chars: $head"
            Write-Host "NOT JSON — possible challenge page" -ForegroundColor Red
        }
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        Add-Content $Out "- FAILED: HTTP $code / $($_.Exception.Message)"
        Write-Host "FAILED: $code $($_.Exception.Message)" -ForegroundColor Red
    }
    Start-Sleep -Seconds $Delay
}

Set-Content $Out "# Smoke Test Findings — $(Get-Date -Format u), from laptop (residential IP)"

# Step 0 — DDragon freshness
$dd = (Invoke-RestMethod "https://ddragon.leagueoflegends.com/api/versions.json")[0]
Add-Content $Out "`n## Step 0 — DDragon latest: $dd (expect 16.NN.1 for live 26.NN)"
Write-Host "DDragon latest: $dd"
Start-Sleep -Seconds $Delay

# Step 1 — THE UNKNOWN: champion payload hypothesis (ep=champion)
Probe "Step 1 — Champion payload (Aatrox top) — HYPOTHESIS" `
    "$Base`?ep=champion&v=1&patch=16.13&c=aatrox&lane=top&tier=all&queue=ranked&region=all"

# Step 2 — Validated synergy endpoint, re-confirm from this IP
Probe "Step 2 — Synergy payload (Aatrox, validated contract)" `
    "$Base`?ep=build-team&v=1&patch=16.13&c=aatrox&lane=all&tier=all&queue=ranked&region=all"

# Step 3 — Consistency: second champion/role
Probe "Step 3 — Second champion (Lulu support)" `
    "$Base`?ep=champion&v=1&patch=16.13&c=lulu&lane=support&tier=all&queue=ranked&region=all"

# Step 4 — Filter-surface experiment: does tier filtering work via direct GET?
Probe "Step 4 — Tier filter experiment (emerald_plus)" `
    "$Base`?ep=build-team&v=1&patch=16.13&c=aatrox&lane=all&tier=emerald_plus&queue=ranked&region=all"

Add-Content $Out @"

## Manual follow-ups
- [ ] If Step 1 404'd: browser hard-reload (Ctrl+Shift+R) on Aatrox build page,
      filters 'lolalytics' + Fetch/XHR, capture other mega/?ep=... values (counters/items/graph?)
- [ ] Compare Step 4 payload vs Step 2: identical => tier param ignored via GET (finding!);
      different numbers => full filter surface available to pipeline
- [ ] Inspect saved *.json raw payloads for matchup arrays + nested time buckets
- [ ] op.gg MCP existence check (resolves crosscheck disagreement F17)
- [ ] u.gg DevTools pattern capture (fallback documentation)

## Verdict: [FULL PASS / PARTIAL — buckets missing / PARTIAL — synergy only / FAIL]
"@

Write-Host "`nFindings written to $Out — raw payloads saved alongside." -ForegroundColor Green
Write-Host "Bring the findings file (and interesting payloads) back to close the smoke test."
