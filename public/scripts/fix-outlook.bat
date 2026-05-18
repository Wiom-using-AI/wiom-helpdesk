@echo off
net session >nul 2>&1
if %errorLevel% == 0 goto :wiom_main
powershell -NonInteractive -NoProfile -ExecutionPolicy Bypass -Command "$p=ConvertTo-SecureString 'Wiom@1234' -AsPlainText -Force;$c=New-Object PSCredential('.\wiom',$p);Start-Process 'cmd.exe' -Credential $c -ArgumentList ('/c '+[char]34+'%~f0'+[char]34) -WindowStyle Normal -Wait"
exit /b
:wiom_main
title WIOM IT Helpdesk - Outlook Fix
color 0B
cls
echo.
echo  ============================================
echo    WIOM IT Helpdesk - Outlook Auto-Fix
echo  ============================================
echo.
echo  Outlook restart kar rahe hain Safe Mode mein...
echo.
echo  ============================================
echo.

echo  [1/2]  Outlook band kar rahe hain...
powershell -NonInteractive -NoProfile -ExecutionPolicy Bypass -Command ^
  "Stop-Process -Name 'OUTLOOK' -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 2; Write-Host '    Outlook closed'"
echo.

echo  [2/2]  Outlook Safe Mode mein start kar rahe hain...
powershell -NonInteractive -NoProfile -ExecutionPolicy Bypass -Command ^
  "Start-Process -FilePath 'outlook.exe' -ArgumentList '/safe' -ErrorAction SilentlyContinue; Start-Sleep -Seconds 2; Write-Host '    Outlook starting in safe mode...'"
echo.

echo  ============================================
echo.
echo    DONE! Outlook Safe Mode mein khul raha hai.
echo.
echo    Agar email aa rahe hain Safe Mode mein:
echo    Close karo -> normally dobara kholo
echo.
echo    Agar Safe Mode mein bhi nahi chala:
echo.
echo  ============================================
echo.
pause
