@echo off
title DeepSeek Claude - Election Project

echo ========================================
echo    🤖 Claude Code with DeepSeek
echo ========================================
echo.

set ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
set ANTHROPIC_AUTH_TOKEN=sk-ea5c370fbd514e84bc67107e34274881
set ANTHROPIC_MODEL=deepseek-chat
set ANTHROPIC_SMALL_FAST_MODEL=deepseek-chat
set API_TIMEOUT_MS=600000

echo Starting Claude Code with DeepSeek backend...
echo Project: election
echo.
claude

echo.
echo Session completed.
timeout /t 3
