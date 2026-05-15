@echo off
net session >nul 2>&1
if %errorLevel% == 0 goto :wiom_main
echo Set oShell = CreateObject("Shell.Application") > "%TEMP%\wiom_elev.vbs"
echo oShell.ShellExecute "%~f0", "", "", "runas", 1 >> "%TEMP%\wiom_elev.vbs"
cscript //nologo "%TEMP%\wiom_elev.vbs"
del "%TEMP%\wiom_elev.vbs" >nul 2>&1
exit /b
:wiom_main
title WIOM IT Helpdesk - Copy Paste Fix
color 0C
cls
echo.
echo  ============================================
echo    WIOM IT Helpdesk - Copy Paste Auto-Fix
echo  ============================================
echo.
echo  Clipboard service restart kar rahe hain...
echo.
echo  ============================================
echo.

echo  [1/2]  Clipboard service band kar rahe hain...
powershell -NonInteractive -NoProfile -ExecutionPolicy Bypass -Command ^
  "Stop-Process -Name 'rdpclip' -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 1; Write-Host '    Clipboard service stopped'"
echo.

echo  [2/2]  Clipboard service restart kar rahe hain...
powershell -NonInteractive -NoProfile -ExecutionPolicy Bypass -Command ^
  "Start-Process -FilePath 'rdpclip.exe' -ErrorAction SilentlyContinue; Start-Sleep -Seconds 1; Write-Host '    Clipboard service started'"
echo.

echo  ============================================
echo.
echo    DONE! Copy-Paste ab kaam karna chahiye.
echo.
echo    Test karo: kuch select karo -> Ctrl+C
echo    Phir kahi aur: Ctrl+V
echo.
echo.
echo  ============================================
echo.
pause
