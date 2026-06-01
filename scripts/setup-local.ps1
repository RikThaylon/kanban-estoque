# ══════════════════════════════════════════════════════════
# Kanban Estoque — Setup local (sem Docker)
# ══════════════════════════════════════════════════════════
# Faz: checa pré-requisitos, instala dependências, cria DB,
# aplica migrations de schema.
#
# Uso (PowerShell na raiz do projeto):
#   powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1
# ══════════════════════════════════════════════════════════

$ErrorActionPreference = 'Stop'

function Write-Step($msg) {
    Write-Host ""
    Write-Host "==> $msg" -ForegroundColor Cyan
}

function Write-Ok($msg) {
    Write-Host "    [OK] $msg" -ForegroundColor Green
}

function Write-Warn($msg) {
    Write-Host "    [AVISO] $msg" -ForegroundColor Yellow
}

function Write-Fail($msg) {
    Write-Host "    [ERRO] $msg" -ForegroundColor Red
}

# Garante que estamos na raiz do projeto (pasta que contém .env e backend/)
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
Write-Host "Raiz do projeto: $root" -ForegroundColor DarkGray

# ── 1. Checa Node.js ────────────────────────────────────────
Write-Step "Verificando Node.js"
try {
    $nodeVersion = node --version
    Write-Ok "Node $nodeVersion"
} catch {
    Write-Fail "Node.js nao encontrado. Instale em https://nodejs.org/"
    exit 1
}

# ── 2. Checa PostgreSQL (psql) ──────────────────────────────
Write-Step "Verificando PostgreSQL (psql)"
$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
    # Tenta caminhos comuns do instalador oficial
    $candidatos = @(
        "C:\Program Files\PostgreSQL\17\bin\psql.exe",
        "C:\Program Files\PostgreSQL\16\bin\psql.exe",
        "C:\Program Files\PostgreSQL\15\bin\psql.exe"
    )
    foreach ($c in $candidatos) {
        if (Test-Path $c) {
            $env:Path = "$(Split-Path $c);$env:Path"
            $psql = Get-Command psql -ErrorAction SilentlyContinue
            break
        }
    }
}

if (-not $psql) {
    Write-Fail "PostgreSQL nao encontrado."
    Write-Host ""
    Write-Host "    Instale com (rode PowerShell como Administrador):"
    Write-Host "      winget install -e --id PostgreSQL.PostgreSQL.16" -ForegroundColor White
    Write-Host ""
    Write-Host "    Ou baixe o instalador: https://www.postgresql.org/download/windows/"
    Write-Host "    Depois feche e abra o PowerShell e rode este script novamente."
    exit 1
}
Write-Ok "psql encontrado em $($psql.Source)"

# ── 3. Carrega variaveis do .env ────────────────────────────
Write-Step "Lendo .env"
if (-not (Test-Path ".env")) {
    Write-Fail "Arquivo .env nao encontrado na raiz do projeto."
    exit 1
}

$envVars = @{}
Get-Content .env | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
        $idx = $line.IndexOf("=")
        $key = $line.Substring(0, $idx).Trim()
        $val = $line.Substring($idx + 1).Trim()
        $envVars[$key] = $val
    }
}
$dbName = $envVars['POSTGRES_DB']
$dbUser = $envVars['POSTGRES_USER']
$dbPass = $envVars['POSTGRES_PASSWORD']
$dbPort = if ($envVars['DB_PORT']) { $envVars['DB_PORT'] } else { '5432' }
Write-Ok "DB alvo: $dbName / user: $dbUser / port: $dbPort"

# ── 4. Cria role e database (idempotente) ───────────────────
Write-Step "Criando role e database (precisa da senha do superusuario 'postgres')"
Write-Host "    Se solicitar senha, eh a do usuario 'postgres' (definida na instalacao)." -ForegroundColor DarkGray

$createRoleSql = "DO `$`$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$dbUser') THEN CREATE ROLE $dbUser WITH LOGIN PASSWORD '$dbPass'; END IF; END `$`$;"
$createDbSql = "SELECT 'CREATE DATABASE $dbName OWNER $dbUser' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$dbName')\gexec"
$grantSql = "GRANT ALL PRIVILEGES ON DATABASE $dbName TO $dbUser;"

& psql -U postgres -h localhost -p $dbPort -c $createRoleSql
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Falha ao criar role. Verifique se o servico do PostgreSQL esta rodando."
    Write-Host "    Servicos: services.msc -> postgresql-x64-XX -> Iniciar"
    exit 1
}
Write-Ok "Role $dbUser pronta"

& psql -U postgres -h localhost -p $dbPort -c $createDbSql
& psql -U postgres -h localhost -p $dbPort -c $grantSql
Write-Ok "Database $dbName pronta"

# ── 5. Instala dependencias ─────────────────────────────────
Write-Step "Instalando dependencias (raiz, backend, frontend)"
npm install
if ($LASTEXITCODE -ne 0) { Write-Fail "npm install (raiz) falhou"; exit 1 }
npm install --prefix backend
if ($LASTEXITCODE -ne 0) { Write-Fail "npm install (backend) falhou"; exit 1 }
npm install --prefix frontend
if ($LASTEXITCODE -ne 0) { Write-Fail "npm install (frontend) falhou"; exit 1 }
Write-Ok "Dependencias instaladas"

# ── 6. Aplica migrations ────────────────────────────────────
Write-Step "Aplicando schema (migrations)"
npm run db:migrate
if ($LASTEXITCODE -ne 0) { Write-Fail "Migration falhou"; exit 1 }
Write-Ok "Schema aplicado"

# ── 7. Final ────────────────────────────────────────────────
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host " Setup concluido!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host " Para iniciar o sistema:"
Write-Host "   .\scripts\start-local.ps1" -ForegroundColor White
Write-Host " ou:"
Write-Host "   npm run dev" -ForegroundColor White
Write-Host ""
Write-Host " Frontend: http://localhost:5173"
Write-Host " Backend:  http://localhost:3001/health"
Write-Host ""
