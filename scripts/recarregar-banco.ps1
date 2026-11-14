# Apaga o banco e carrega de novo schema.sql + seed.sql (dados limpos para a demonstração).
# Uso (na raiz do projeto, com o Zaptos rodando):
#   powershell -ExecutionPolicy Bypass -File scripts\recarregar-banco.ps1

$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

function Falhar($mensagem) {
    Write-Host ""
    Write-Host $mensagem -ForegroundColor Red
    exit 1
}

docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Falhar "O Docker não está rodando. Abra o Docker Desktop e rode scripts\iniciar.ps1 antes."
}

$banco = docker compose ps -q --status running db 2> $null
if (-not $banco) {
    Falhar "O banco não está rodando. Rode scripts\iniciar.ps1 antes."
}

Write-Host ""
Write-Host "ATENÇÃO: isto APAGA todos os dados do banco zaptos (pedidos, reservas, avisos, produtos e usuários criados)" -ForegroundColor Yellow
Write-Host "e carrega de novo backend\db\schema.sql e backend\db\seed.sql." -ForegroundColor Yellow
Write-Host "As fotos em backend\uploads não são apagadas."
$resposta = Read-Host "Digite SIM para continuar"
if ($resposta -cne 'SIM') {
    Write-Host "Cancelado. Nada foi alterado."
    exit 0
}

foreach ($arquivo in @('schema.sql', 'seed.sql')) {
    Write-Host "Carregando $arquivo ..." -ForegroundColor Cyan
    docker compose exec -T db sh -c "MYSQL_PWD=`$MYSQL_ROOT_PASSWORD mysql -uroot < /zaptos-db/$arquivo"
    if ($LASTEXITCODE -ne 0) {
        Falhar "Falhou ao carregar $arquivo. Veja as mensagens acima."
    }
}

Write-Host ""
Write-Host "Banco recarregado com os dados de exemplo." -ForegroundColor Green
