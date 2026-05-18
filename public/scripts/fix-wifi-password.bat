@echo off
title WIOM IT Helpdesk - WiFi Password
color 0A
cls
echo.
echo  ============================================
echo    WIOM IT Helpdesk - WiFi Password Info
echo  ============================================
echo.
echo  WIOM Office WiFi Networks:
echo  ==========================================
echo    Ground Floor
echo    Network : Wiom office 5g-Test
echo    Password: spartans500
echo  ------------------------------------------
echo    Guest Network
echo    Network : Wiom office Guest
echo    Password: spartans500
echo  ------------------------------------------
echo    3rd Floor
echo    Network : Wiom office 3rd floor
echo    Password: spartans500
echo  ------------------------------------------
echo    Saket Office
echo    Network : Wiomnet
echo    Password: Password@12345
echo  ==========================================
echo.
echo  [Auto] Ab WiFi se connect kar rahe hain...
powershell -NonInteractive -NoProfile -ExecutionPolicy Bypass -Command "$networks=@('Wiom office 5g-Test','Wiom office Guest','Wiom office 3rd floor','Wiomnet'); $profiles=(netsh wlan show profiles); $connected=$false; foreach($n in $networks){if($profiles -match [regex]::Escape($n)){netsh wlan connect name=$n 2>$null|Out-Null; Write-Host ('    ' + $n + ' se connect kiya!'); $connected=$true; break}}; if(-not $connected){Write-Host '    Koi office WiFi saved nahi hai - manually connect karo'}"
echo.
echo  ============================================
echo    Manual steps (agar auto nahi hua):
echo    1. Taskbar WiFi icon click karo
echo    2. Upar wali list mein se apna network select karo
echo    3. Password type karo (upar dekho)
echo    4. Connect click karo
echo.
echo    Ab bhi nahi hua:
echo    1. WiFi toggle OFF, phir ON karo
echo    2. Laptop restart karo
echo  ============================================
echo.
pause
