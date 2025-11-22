# Save as Start-DeepSeekClaude.ps1
param(
    [string]$ProjectName = "election",
    [int]$TimeoutMs = 600000
)

$env:ANTHROPIC_BASE_URL = "https://api.deepseek.com/anthropic"
$env:ANTHROPIC_AUTH_TOKEN = "sk-ea5c370fbd514e84bc67107e34274881"
$env:ANTHROPIC_MODEL = "deepseek-chat"
$env:ANTHROPIC_SMALL_FAST_MODEL = "deepseek-chat"
$env:API_TIMEOUT_MS = $TimeoutMs.ToString()

Clear-Host
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   🤖 Claude Code with DeepSeek" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Starting Claude Code with DeepSeek backend..." -ForegroundColor Green
Write-Host "Project: $ProjectName" -ForegroundColor White
Write-Host "Model: $env:ANTHROPIC_MODEL" -ForegroundColor White
Write-Host "Timeout: $TimeoutMs ms" -ForegroundColor White
Write-Host ""

try {
    # Start Claude process
    $process = Start-Process -FilePath "claude" -NoNewWindow -Wait -PassThru
    
    if ($process.ExitCode -eq 0) {
        Write-Host "`n✅ Session completed successfully." -ForegroundColor Green
    } else {
        Write-Host "`n⚠️  Session ended with exit code: $($process.ExitCode)" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "`n❌ Error: Failed to start Claude - $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Please ensure Claude is installed and in your PATH" -ForegroundColor Yellow
}

Start-Sleep -Seconds 3