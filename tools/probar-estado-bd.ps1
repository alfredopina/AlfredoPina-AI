# Prueba (solo lectura) del estado de apcweb-backoffice vía Azure Resource Manager.
# NO despierta la base: pregunta a la capa de administración de Azure, no a SQL.
# Los valores se escriben aquí en tu terminal (el secreto no se muestra ni se guarda).
# Uso:  powershell -ExecutionPolicy Bypass -File tools\probar-estado-bd.ps1

$ErrorActionPreference = 'Stop'
$recursoPorDefecto = '/subscriptions/56546bd8-e947-4ccc-8956-b2cb29e78859/resourceGroups/GR_AlfredoPina/providers/Microsoft.Sql/servers/apcweb-sql-server/databases/apcweb-backoffice'

$tenant  = (Read-Host 'Id. de directorio (inquilino)').Trim()
$cliente = (Read-Host 'Id. de aplicacion (cliente)').Trim()
$seg     = Read-Host 'Valor del secreto (no se ve al escribir)' -AsSecureString
$bstr    = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seg)
$secreto = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
$recurso = Read-Host "Id. de recurso de la base (Enter = $recursoPorDefecto)"
if ([string]::IsNullOrWhiteSpace($recurso)) { $recurso = $recursoPorDefecto }
$recurso = $recurso.Trim()

function Mostrar-Error($paso, $e) {
  Write-Host ''
  Write-Host "FALLO en: $paso" -ForegroundColor Red
  if ($e.ErrorDetails -and $e.ErrorDetails.Message) { Write-Host $e.ErrorDetails.Message } else { Write-Host $e.Exception.Message }
}

# 1) Token (client_credentials) para la API de administración de Azure
try {
  $token = (Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$tenant/oauth2/v2.0/token" -Body @{
    grant_type    = 'client_credentials'
    client_id     = $cliente
    client_secret = $secreto
    scope         = 'https://management.azure.com/.default'
  }).access_token
  Write-Host 'Paso 1 OK: Entra acepto el inquilino, el cliente y el secreto.' -ForegroundColor Green
} catch { Mostrar-Error '1) obtener token (revisa inquilino, cliente y secreto; el secreto es la columna Valor, no el Id. de secreto)' $_; exit 1 }

# 2) Leer la base (GET, no toca SQL)
try {
  $db = Invoke-RestMethod -Method Get -Uri "https://management.azure.com$($recurso)?api-version=2021-11-01" -Headers @{ Authorization = "Bearer $token" }
  Write-Host 'Paso 2 OK: el rol Lector funciona.' -ForegroundColor Green
  Write-Host ''
  Write-Host ('Base:   ' + $db.name)
  Write-Host ('Estado: ' + $db.properties.status)
  Write-Host ('Plan:   ' + $db.sku.name + ' ' + $db.sku.tier)
  Write-Host ('Pausa automatica (min): ' + $db.properties.autoPauseDelay)
  if ($db.properties.freeLimitExhaustionBehavior) { Write-Host ('Al agotar cuota gratis: ' + $db.properties.freeLimitExhaustionBehavior) }
} catch { Mostrar-Error '2) leer la base (403 = el rol Lector aun no propaga o esta en otro ambito; 404 = Id. de recurso mal escrito)' $_; exit 1 }
