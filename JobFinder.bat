@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao foi encontrado. Instale em https://nodejs.org e rode de novo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Primeira execucao: instalando dependencias. Isso pode demorar alguns minutos...
  call npm install
  if errorlevel 1 (
    echo Falha ao instalar as dependencias.
    pause
    exit /b 1
  )
  echo Instalando o navegador do Playwright ^(usado para buscar/aplicar em vagas^)...
  call npx playwright install chromium
)

echo.
echo Abrindo o JobFinder em http://localhost:5173 ...
echo Feche esta janela para encerrar o aplicativo.
call npm run web:dev -- --open
