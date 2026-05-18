@echo off
net session >nul 2>&1
if %errorLevel% == 0 goto :wiom_main
powershell -NonInteractive -NoProfile -ExecutionPolicy Bypass -Command "$p=ConvertTo-SecureString 'Wiom@1234' -AsPlainText -Force;$c=New-Object PSCredential('.\wiom',$p);Start-Process 'cmd.exe' -Credential $c -ArgumentList ('/c '+[char]34+'%~f0'+[char]34) -WindowStyle Normal -Wait"
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
