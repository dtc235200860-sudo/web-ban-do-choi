@echo off
REM start_gemini_and_run.cmd - prompt for Gemini API key and run Django dev server
SETLOCAL ENABLEDELAYEDEXPANSION

echo.
set /p GEMINI_API_KEY=Paste Gemini API key here and press Enter: 
if "%GEMINI_API_KEY%"=="" (
  echo No API key entered. Exiting.
  pause
  exit /b 1
)

echo Using provided API key for this session.

REM Attempt to activate common venv locations (optional)
if exist "%~dp0Shop_do_choi\.venv\Scripts\activate.bat" (
  call "%~dp0Shop_do_choi\.venv\Scripts\activate.bat"
) else if exist "%~dp0venv\Scripts\activate.bat" (
  call "%~dp0venv\Scripts\activate.bat"
) else (
  REM no venv activation found; continue with system python
)

REM Change to the Django project folder and run server with env var for this process
pushd "%~dp0Shop_do_choi"
set "GEMINI_API_KEY=%GEMINI_API_KEY%"
echo Starting Django development server (GEMINI_API_KEY set for this run)...
python manage.py runserver
popd
ENDLOCAL
