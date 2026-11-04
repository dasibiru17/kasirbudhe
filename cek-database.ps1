# =====================================================================
#  CEK DATABASE SUPABASE — Jalankan di PowerShell:
#    cd "d:\WEBSITE MAS WAHYU\TripGenZku\pos-kasir"
#    powershell -NoProfile -ExecutionPolicy Bypass -File .\cek-database.ps1
# =====================================================================

$key = 'sb_publishable_ddDeITyp-jBV6c9rv9ZdwA_vpWcV690'
$base = 'https://uumbhhqglqiyetenpukd.supabase.co/rest/v1/'
$headers = @{ apikey = $key; Authorization = "Bearer $key" }
$tables = @('users', 'products', 'transactions', 'expenses', 'app_config')

Write-Host ""
Write-Host "Memeriksa database Supabase..." -ForegroundColor Cyan
Write-Host "URL: $base" -ForegroundColor DarkGray
Write-Host ""

$ada = 0
$tidak = 0

foreach ($t in $tables) {
    try {
        Invoke-WebRequest -Uri "$base$t`?select=*&limit=1" -Headers $headers -UseBasicParsing -TimeoutSec 20 | Out-Null
        Write-Host ("  {0,-14} => OK (tabel ada)" -f $t) -ForegroundColor Green
        $ada++
    }
    catch {
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        if ($code -eq 401 -or $code -eq 403) {
            Write-Host ("  {0,-14} => OK (tabel ada, RLS aktif - normal)" -f $t) -ForegroundColor Green
            $ada++
        }
        else {
            Write-Host ("  {0,-14} => TIDAK ADA (HTTP {1})" -f $t, $code) -ForegroundColor Red
            $tidak++
        }
    }
}

Write-Host ""
if ($tidak -eq 0) {
    Write-Host "SEMUA TABEL ADA -> database SIAP dipakai." -ForegroundColor Green
    Write-Host "Silakan jalankan: npm run dev" -ForegroundColor Green
}
else {
    Write-Host "ADA $tidak TABEL YANG BELUM ADA -> skrip SQL belum dijalankan." -ForegroundColor Red
    Write-Host "Buka: https://supabase.com/dashboard/project/uumbhhqglqiyetenpukd/sql/new" -ForegroundColor Yellow
    Write-Host "Tempel seluruh isi supabase-schema-secure.sql lalu klik RUN." -ForegroundColor Yellow
}
Write-Host ""
