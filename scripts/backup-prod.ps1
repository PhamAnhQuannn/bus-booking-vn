# Private daily prod backup for Windows (run by Task Scheduler, trigger = At log on).
# Layer B of the backup strategy (docs/ops/neon-pitr-setup.md): a logical pg_dump of the Neon
# production DB to a PRIVATE local folder. Complements Neon 6h PITR + manual snapshots (layer A).
#
# Once-per-day guard: if today's dump already exists it exits 0, so multiple logins/day don't re-dump.
# PII-safety: the dump stays on THIS machine only — never commit it, never sync it to a public place.
#
# Prereqs (USER, one-time):
#   1. Install PostgreSQL 16 client so `pg_dump` is on PATH (or run from WSL / a running docker pg16).
#   2. Set a USER env var  BBVN_PROD_DATABASE_URL  = the Neon prod connection string (from your vault).
#      (System → Environment Variables → User variables → New. Never put it in the repo.)
#
# Manual run:  powershell -File scripts\backup-prod.ps1
param(
  [string]$OutDir = "$HOME\bbvn-backups",   # private, outside the repo
  [int]$KeepDays  = 14
)
$ErrorActionPreference = 'Stop'

$url = $env:BBVN_PROD_DATABASE_URL
if (-not $url) { Write-Error 'BBVN_PROD_DATABASE_URL not set (see prereqs in header).'; exit 1 }

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  Write-Error 'pg_dump not found on PATH. Install PostgreSQL 16 client tools (or run via WSL/docker).'; exit 1
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd'
$out   = Join-Path $OutDir "bbvn-$stamp.dump"

if (Test-Path $out) { Write-Host "already backed up today -> $out (skip)"; exit 0 }   # once/day guard

# -F c custom format; --no-owner/--no-privileges keep it portable across roles.
# NOTE: $ErrorActionPreference='Stop' does NOT trap native-exe exit codes in PS 5.1 — check explicitly,
# else a failed/partial dump is reported as success (and the once/day guard then blocks a retry).
pg_dump $url -F c --no-owner --no-privileges -f $out
if ($LASTEXITCODE -ne 0) {
  Remove-Item $out -Force -ErrorAction SilentlyContinue   # drop the partial/corrupt file
  Write-Error "pg_dump failed (exit $LASTEXITCODE) — no valid backup written."
  exit 1
}
$size = (Get-Item $out).Length
Write-Host "backup written: $out ($size bytes)"

# Prune dumps older than KeepDays.
Get-ChildItem $OutDir -Filter 'bbvn-*.dump' |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
  ForEach-Object { Write-Host "prune: $($_.Name)"; Remove-Item $_.FullName -Force }
