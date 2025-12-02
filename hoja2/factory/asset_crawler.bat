@echo off
echo Generating folder structure...
echo.

python asset_crawler.py

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Success! Check folder_structure.js
) else (
    echo.
    echo Error running script. Make sure Python is installed and in your PATH.
)

echo.
pause