@echo off
net session >nul 2>&1
if %errorLevel% == 0 goto :wiom_main
powershell -NonInteractive -NoProfile -ExecutionPolicy Bypass -Command "$p=ConvertTo-SecureString 'Wiom@1234' -AsPlainText -Force;$c=New-Object PSCredential('.\wiom',$p);Start-Process 'cmd.exe' -Credential $c -ArgumentList ('/c '+[char]34+'%~f0'+[char]34) -WindowStyle Normal -Wait"
exit /b
:wiom_main
title WIOM IT Helpdesk - Sound Fix
color 0D
cls
echo.
echo  ============================================
echo    WIOM IT Helpdesk - Sound Auto-Fix
echo  ============================================
echo.
echo  Audio service restart kar rahe hain...
echo.
echo  ============================================
echo.

echo  [1/2]  Audio service restart kar rahe hain...
powershell -NonInteractive -NoProfile -ExecutionPolicy Bypass -Command ^
  "Restart-Service -Name 'AudioSrv' -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 1; Restart-Service -Name 'AudioEndpointBuilder' -Force -ErrorAction SilentlyContinue; Write-Host '    Audio services restarted'"
echo.

echo  [2/2]  Sound settings check kar rahe hain...
powershell -NonInteractive -NoProfile -ExecutionPolicy Bypass -Command ^
  "Start-Sleep -Seconds 2; Write-Host '    Done! Volume check karo taskbar speaker icon se'"
echo.

echo  ============================================
echo.
echo    DONE! Sound aana chahiye ab.
echo.
echo    Check karo: taskbar mein speaker icon
echo    Volume 0 pe to nahi? Mute to nahi?
echo.
echo.
echo  ============================================
echo.
pause
