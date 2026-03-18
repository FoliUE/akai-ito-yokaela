@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
  py -3 note_manager.py build
  exit /b %errorlevel%
)

where python >nul 2>nul
if %errorlevel%==0 (
  python note_manager.py build
  exit /b %errorlevel%
)

echo No se encontro Python para construir el ejecutable.
exit /b 1
