@echo off
title WIOM IT Helpdesk - WiFi Password
color 0A
cls
echo.
echo  ============================================
echo    WIOM IT Helpdesk - WiFi Password Info
echo  ============================================
echo.
echo  WIOM Office WiFi:
echo  ==========================================
echo    Network : spartans500
echo    Password: spartans500
echo    Works on: Ground Floor AND First Floor
echo  ==========================================
echo.
echo  [Auto] Saved WiFi passwords check kar rahe hain...
powershell -NonInteractive -NoProfile -ExecutionPolicy Bypass -Command "netsh wlan show profiles | Select-String 'All User Profile' | ForEach-Object { $n=($_ -replace '.*: ','').Trim(); $p=(netsh wlan show profile name=$n key=clear 2>$null | Select-String 'Key Content') -replace '.*: ',''; if($p){Write-Host ('    Network: '+$n+' | Password: '+$p.Trim())} }"
echo.
echo  [Auto] Ab WiFi se connect kar rahe hain...
powershell -NonInteractive -NoProfile -ExecutionPolicy Bypass -Command "$profile=(netsh wlan show profiles|Select-String 'spartans500'); if($profile){netsh wlan connect name='spartans500' 2>$null; Write-Host '    spartans500 se connect kiya!'}else{Write-Host '    spartans500 saved nahi hai - manually connect karo'}"
echo.
echo  ============================================
echo    Manual steps (agar auto nahi hua):
echo    1. Taskbar WiFi icon click karo
echo    2. "spartans500" select karo
echo    3. Password: spartans500
echo    4. Connect click karo
echo.
echo    Ab bhi nahi hua:
echo    1. WiFi toggle OFF, phir ON karo
echo    2. Laptop restart karo
echo.
echo    IT Helpdesk: Slack pe ticket raise karo
echo  ============================================
echo.
pause
