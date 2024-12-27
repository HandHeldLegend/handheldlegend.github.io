@echo off
REM Get the directory of the batch file
set SCRIPT_DIR=%~dp0

REM Navigate to the directory of the batch file
cd /d "%SCRIPT_DIR%"

REM Run the Python script
python factory.py

REM Optional: Pause to keep the command window open
pause