@echo off
setlocal
title Build Ink Arena Remastered - Shareable EXE
cd /d "%~dp0"
echo.
echo ===========================================
echo  BUILD SHAREABLE INK ARENA SETUP EXE
echo ===========================================
echo.
echo This is for the game creator, not for your friends.
echo Your friends will only need the final Setup EXE.
echo.
where node.exe >nul 2>nul
if errorlevel 1 (
 echo Node.js LTS is required only on the creator's PC to build the installer.
 start "" "https://nodejs.org/"
 echo Install Node.js LTS, then run BUILD_FOR_SHARING.bat again.
 pause
 exit /b 1
)
echo Downloading build dependencies...
call npm.cmd install
if errorlevel 1 goto failed
echo.
echo Building standalone Windows installer...
call npm.cmd run dist
if errorlevel 1 goto failed
echo.
echo If successful, the shareable installer is in the release folder.
echo Send only InkArenaRemastered-Setup-1.0.0.exe to your friends.
explorer "%~dp0release"
pause
exit /b 0
:failed
echo.
echo Build failed. See the error above.
pause
exit /b 1
