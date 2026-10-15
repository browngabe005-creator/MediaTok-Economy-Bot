# One-time token setup, called by START-BOT.bat.
$ErrorActionPreference = 'Stop'
$envPath = Join-Path $PSScriptRoot '.env'
$clientId = '1560363162807701555'
$guildId = '1546232060719534120'

$existingToken = ''
if (Test-Path -LiteralPath $envPath) {
    $tokenLine = Get-Content -LiteralPath $envPath | Where-Object { $_ -match '^TOKEN\s*=' } | Select-Object -First 1
    if ($tokenLine) { $existingToken = ($tokenLine -replace '^TOKEN\s*=', '').Trim() }
}
$needsToken = [string]::IsNullOrWhiteSpace($existingToken) -or ($existingToken -match '^(PASTE|YOUR|REPLACE|INSERT|CHANGE)_')
if (-not $needsToken) {
    Write-Host 'Discord bot token found in .env. Starting bot...' -ForegroundColor Green
    exit 0
}

Write-Host ''
Write-Host 'MediaTok Economy Bot - one-time setup' -ForegroundColor Cyan
Write-Host "CLIENT_ID: $clientId"
Write-Host "GUILD_ID:  $guildId"
Write-Host ''
Write-Host 'IMPORTANT: Reset the Discord token you shared earlier.' -ForegroundColor Yellow
Write-Host 'Developer Portal > Your Application > Bot > Reset Token' -ForegroundColor Yellow
Write-Host 'Your input will not be shown on screen.'
Write-Host ''
$secureToken = Read-Host 'Paste your NEW bot token and press Enter' -AsSecureString
$ptr = [IntPtr]::Zero
try {
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
    $newToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Trim()
} finally {
    if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
if ($newToken -notmatch '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$') {
    Write-Host 'That does not look like a Discord bot token. No file was changed.' -ForegroundColor Red
    exit 1
}
@(
    '# MediaTok Economy Bot - KEEP PRIVATE',
    ('TOKEN=' + $newToken),
    ('CLIENT_ID=' + $clientId),
    ('GUILD_ID=' + $guildId)
) | Set-Content -LiteralPath $envPath -Encoding Ascii
Write-Host 'Saved .env with your bot token and prefilled IDs.' -ForegroundColor Green
exit 0
