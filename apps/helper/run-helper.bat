@echo off
rem lolbuilder helper launcher — see INSTALL.md next to this file.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Get it from https://nodejs.org (LTS), then run this again.
  pause
  exit /b 1
)
echo Starting the lolbuilder helper (reads your client, never writes to it). Close this window to stop it.
node "%~dp0helper.mjs"
pause
