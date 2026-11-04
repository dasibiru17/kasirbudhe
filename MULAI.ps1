# =====================================================================
#  MULAI CEPAT — Jalankan aplikasi POS dalam mode LOKAL
#  Tidak perlu Supabase, tidak perlu internet. Data tersimpan di browser.
#
#  Jalankan:
#    powershell -NoProfile -ExecutionPolicy Bypass -File ".\MULAI.ps1"
# =====================================================================

$root = $PSScriptRoot
Set-Location $root

# 1) Pastikan dependensi terpasang
if (-not (Test-Path (Join-Path $root 'node_modules'))) {
    Write-Host "Memasang dependensi (sekali saja, mohon tunggu)..." -ForegroundColor Yellow
    npm install
}

# 2) Aktifkan mode lokal lewat .env
$envFile = Join-Path $root '.env'
$lines = @()
if (Test-Path $envFile) {
    $lines = Get-Content $envFile | Where-Object { $_ -notmatch '^\s*VITE_LOCAL_MODE\s*=' }
}
$lines += 'VITE_LOCAL_MODE=true'
Set-Content -Path $envFile -Value $lines -Encoding UTF8
Write-Host "Mode LOKAL diaktifkan (file .env)." -ForegroundColor Green

Write-Host ""
Write-Host "Membuka browser di http://localhost:5180 ..." -ForegroundColor Cyan
Start-Job -ScriptBlock { Start-Sleep -Seconds 6; Start-Process 'http://localhost:5180/login' } | Out-Null

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " AKUN BAWAAN:" -ForegroundColor Green
Write-Host "   Pemilik : admin  / admin123"
Write-Host "   Kasir   : kasir  / kasir123"
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " Tekan Ctrl+C di jendela ini untuk menghentikan." -ForegroundColor DarkGray
Write-Host ""

npx vite dev --port 5180 --strictPort
