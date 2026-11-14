# Sobe banco, API e front-end do Zaptos com Docker.
# Uso (na raiz do projeto):  powershell -ExecutionPolicy Bypass -File scripts\iniciar.ps1

$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

function Falhar($mensagem) {
    Write-Host ""
    Write-Host $mensagem -ForegroundColor Red
    exit 1
}

# 1. .env
$arquivoEnv = Join-Path $raiz '.env'
if (-not (Test-Path $arquivoEnv)) {
    Falhar @"
Não encontrei o arquivo .env na raiz do projeto.
Crie a partir do modelo e preencha DB_PASSWORD e SECRET_KEY:

    Copy-Item .env.example .env
    notepad .env

Para gerar a SECRET_KEY:  py -c "import secrets; print(secrets.token_urlsafe(48))"
"@
}

$valores = @{}
foreach ($linha in Get-Content $arquivoEnv -Encoding UTF8) {
    if ($linha -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
        $valores[$Matches[1]] = $Matches[2].Trim()
    }
}
$faltando = @('DB_PASSWORD', 'SECRET_KEY') | Where-Object { -not $valores[$_] }
if ($faltando) {
    Falhar ("Preencha no .env: " + ($faltando -join ', ') + "`nPara gerar a SECRET_KEY:  py -c `"import secrets; print(secrets.token_urlsafe(48))`"")
}

# 2. Docker
$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
    Falhar "O Docker não está instalado. Instale o Docker Desktop: https://www.docker.com/products/docker-desktop/"
}
docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Falhar "O Docker não está rodando. Abra o Docker Desktop, espere ele dizer 'Engine running' e rode este script de novo."
}

# 3. Portas livres (se o Zaptos ainda não estiver rodando)
$jaRodando = docker compose ps -q 2> $null
if (-not $jaRodando) {
    $portaApi = if ($env:API_PORTA) { [int]$env:API_PORTA } else { 8000 }
    $portaWeb = if ($env:WEB_PORTA) { [int]$env:WEB_PORTA } else { 5173 }
    $ocupadas = @()
    foreach ($porta in @($portaWeb, $portaApi)) {
        $uso = Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue
        if ($uso) { $ocupadas += $porta }
    }
    if ($ocupadas) {
        Falhar ("A(s) porta(s) " + ($ocupadas -join ', ') + " já estão em uso por outro programa. Feche esse programa (ex.: uma API ou servidor de front-end rodando no terminal) e tente de novo.")
    }
}

# 4. Subir
Write-Host "Subindo banco, API e front-end (a primeira vez demora alguns minutos)..." -ForegroundColor Cyan
docker compose up -d --build
if ($LASTEXITCODE -ne 0) {
    Falhar "O docker compose falhou. Veja as mensagens acima."
}

# 5. Esperar a API
$portaApi = if ($env:API_PORTA) { $env:API_PORTA } else { '8000' }
$portaWeb = if ($env:WEB_PORTA) { $env:WEB_PORTA } else { '5173' }
$urlSaude = "http://localhost:$portaApi/api/health"
Write-Host "Esperando a API responder em $urlSaude ..." -ForegroundColor Cyan
$limite = (Get-Date).AddMinutes(3)
$pronta = $false
while ((Get-Date) -lt $limite) {
    try {
        $resposta = Invoke-WebRequest -Uri $urlSaude -UseBasicParsing -TimeoutSec 3
        if ($resposta.StatusCode -eq 200) { $pronta = $true; break }
    } catch { }
    Start-Sleep -Seconds 2
    Write-Host "." -NoNewline
}
Write-Host ""
if (-not $pronta) {
    Falhar "A API não respondeu em 3 minutos. Veja o motivo com:  docker compose logs api db"
}

Write-Host ""
Write-Host "Zaptos rodando!" -ForegroundColor Green
Write-Host "  App (cliente e lojista):  http://localhost:$portaWeb"
Write-Host "  Painel do admin:          http://localhost:$portaWeb/admin.html"
Write-Host "  Documentação da API:      http://localhost:$portaApi/docs"
Write-Host ""
Write-Host "Contas de teste: backend\db\README.md"
Write-Host "Para parar: scripts\parar.ps1   |   Dados limpos para a demonstração: scripts\recarregar-banco.ps1"
