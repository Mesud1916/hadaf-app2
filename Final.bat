@echo off
setlocal enabledelayedexpansion

echo ===============================
echo  Hadaf APK Release Builder
echo ===============================

:: -------- PATHS --------
set PROJECT_DIR=C:\hadaf-app2
set ANDROID_DIR=%PROJECT_DIR%\android
set APK_UNSIGNED=%ANDROID_DIR%\app\build\outputs\apk\release\app-release-unsigned.apk
set APK_SIGNED=%PROJECT_DIR%\hadaf-release-signed.apk
set KEYSTORE=%PROJECT_DIR%\keystore\hadaf-release.jks
set KEY_ALIAS=hadaf

:: -------- CHECK KEYSTORE --------
if not exist "%KEYSTORE%" (
    echo ❌ Keystore not found:
    echo %KEYSTORE%
    pause
    exit /b 1
)

:: -------- BUILD RELEASE --------
echo 🔧 Building Release APK...
cd /d "%ANDROID_DIR%"
call gradlew.bat assembleRelease

if not exist "%APK_UNSIGNED%" (
    echo ❌ Release APK not found!
    pause
    exit /b 1
)

:: -------- FIND APKSIGNER --------
set SDK_ROOT=%LOCALAPPDATA%\Android\Sdk
for /f "delims=" %%i in ('dir "%SDK_ROOT%\build-tools" /b /ad-h /o-n') do (
    set BUILD_TOOLS=%%i
    goto found
)
:found

set APKSIGNER=%SDK_ROOT%\build-tools\%BUILD_TOOLS%\apksigner.bat

if not exist "%APKSIGNER%" (
    echo ❌ apksigner not found!
    pause
    exit /b 1
)

:: -------- SIGN APK --------
echo 🔐 Signing APK...
copy "%APK_UNSIGNED%" "%APK_SIGNED%" >nul

"%APKSIGNER%" sign ^
  --ks "%KEYSTORE%" ^
  --ks-key-alias %KEY_ALIAS% ^
  "%APK_SIGNED%"

:: -------- VERIFY --------
"%APKSIGNER%" verify --print-certs "%APK_SIGNED%"

echo.
echo ✅ DONE!
echo 📦 Output file:
echo %APK_SIGNED%
echo ===============================
pause
