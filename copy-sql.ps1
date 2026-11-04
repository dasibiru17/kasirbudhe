# =====================================================================
#  Salin SQL skema ke clipboard, lalu tempel di Supabase SQL Editor
#  Jalankan di PowerShell:
#    powershell -NoProfile -ExecutionPolicy Bypass -File ".\copy-sql.ps1"
# =====================================================================

$file = Join-Path $PSScriptRoot 'supabase-schema-secure.sql'
if (-not (Test-Path $file)) {
    Write-Host "File tidak ditemukan: $file" -ForegroundColor Red
    exit 1
}

$sql = Get-Content $file -Raw
Set-Clipboard -Value $sql

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " SQL SKEMA SUDAH DISALIN KE CLIPBOARD" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host (" Panjang : {0} karakter" -f $sql.Length)
Write-Host " Langkah selanjutnya:"
Write-Host "   1. Buka https://supabase.com/dashboard/project/uumbhhqglqiyetenpukd/sql/new"
Write-Host "   2. Klik di kotak editor"
Write-Host "   3. Tekan Ctrl+V  (tempel)"
Write-Host "   4. Klik tombol RUN (atau Ctrl+Enter)"
Write-Host "   5. Tunggu sampai muncul: Success. No rows returned"
Write-Host ""
