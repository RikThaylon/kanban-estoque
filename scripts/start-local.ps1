# ══════════════════════════════════════════════════════════
# Kanban Estoque — Start local (sem Docker)
# ══════════════════════════════════════════════════════════
# Sobe backend (3001) e frontend (5173) em paralelo.
# Pre-requisito: .\scripts\setup-local.ps1 ja executado.
# ══════════════════════════════════════════════════════════

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# Sanity-check: postgres escutando na porta?
$dbPort = 5432
if (Test-Path .env) {
    $linha = Get-Content .env | Where-Object { $_ -match '^DB_PORT=' } | Select-Object -First 1
    if ($linha) { $dbPort = ($linha -split '=', 2)[1].Trim() }
}

$tcp = Test-NetConnection -ComputerName localhost -Port $dbPort -WarningAction SilentlyContinue
if (-not $tcp.TcpTestSucceeded) {
    Write-Host "[ERRO] PostgreSQL nao esta escutando em localhost:$dbPort" -ForegroundColor Red
    Write-Host "       Inicie o servico: services.msc -> postgresql-x64-XX -> Iniciar" -ForegroundColor Yellow
    exit 1
}

Write-Host "Iniciando backend e frontend em paralelo..." -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "  Backend:  http://localhost:3001/health" -ForegroundColor White
Write-Host "  Ctrl+C para parar ambos" -ForegroundColor DarkGray
Write-Host ""

npm run dev
