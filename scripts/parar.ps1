# Para banco, API e front-end. Os dados do banco continuam guardados no volume.
# Uso (na raiz do projeto):  powershell -ExecutionPolicy Bypass -File scripts\parar.ps1

$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "O Docker não está rodando: não há nada para parar." -ForegroundColor Yellow
    exit 0
}

docker compose down
if ($LASTEXITCODE -ne 0) {
    Write-Host "O docker compose down falhou. Veja as mensagens acima." -ForegroundColor Red
    exit 1
}
Write-Host "Zaptos parado. Os dados do banco foram mantidos." -ForegroundColor Green
