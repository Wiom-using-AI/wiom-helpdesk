@echo off
net session >nul 2>&1
if %errorLevel% == 0 goto :wiom_main
echo Set oShell = CreateObject("Shell.Application") > "%TEMP%\wiom_elev.vbs"
echo oShell.ShellExecute "%~f0", "", "", "runas", 1 >> "%TEMP%\wiom_elev.vbs"
cscript //nologo "%TEMP%\wiom_elev.vbs"
del "%TEMP%\wiom_elev.vbs" >nul 2>&1
exit /b
:wiom_main
title WIOM IT Helpdesk - Touchscreen Fix
color 0B
cls
echo.
echo  ============================================
echo    WIOM IT Helpdesk - Touchscreen Auto-Fix
echo  ============================================
echo.
echo  [1/2]  Touchscreen driver reset kar rahe hain...
powershell -NonInteractive -NoProfile -ExecutionPolicy Bypass -Command "$ts=Get-PnpDevice|Where-Object{$_.FriendlyName -match 'touch|HID-compliant touch screen'}|Select-Object -First 1; if($ts){Disable-PnpDevice -InstanceId $ts.InstanceId -Confirm:$false -ErrorAction SilentlyContinue; Start-Sleep 2; Enable-PnpDevice -InstanceId $ts.InstanceId -Confirm:$false -ErrorAction SilentlyContinue; Write-Host '    Touchscreen reset:' $ts.FriendlyName}else{Write-Host '    Touchscreen device not found in device manager'}"
echo.
echo  [2/2]  Touch calibration settings khol rahe hain...
powershell -NonInteractive -NoProfile -ExecutionPolicy Bypass -Command "Start-Process 'ms-settings:devices-touchpad' -ErrorAction SilentlyContinue; Write-Host '    Touch Settings opened'"
echo.
echo  ============================================
echo    DONE! Touchscreen reset kiya.
echo.
echo    Test karo — screen touch karo.
echo    Agar abhi bhi nahi: ticket raise karo
echo    (touchscreen hardware issue ho sakta hai)
echo  ============================================
echo.
pause
