@echo off
REM Gera hostinger\linkhub-site.zip para enviar a Hostinger (precisa do arquivo .env com as chaves do Supabase)
cd /d "%~dp0"
node scripts\gerar-hostinger.mjs
pause
