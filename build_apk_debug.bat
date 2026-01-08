@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo ==========================================================
echo   Build Android DEBUG APK (Capacitor + Vite)
echo ==========================================================
echo.

if not exist "package.json" (
  echo ERROR: package.json not found.
  echo Put this .bat file in your project root folder and run again.
  pause
  exit /b 1
)

set "STUDIO_JBR=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_SDK=%LOCALAPPDATA%\Android\Sdk"

echo [Info] Project root: %CD%
echo [Info] Android SDK : %ANDROID_SDK%
echo [Info] Studio JBR  : %STUDIO_JBR%
echo.

if exist "%STUDIO_JBR%\bin\java.exe" (
  set "JAVA_HOME=%STUDIO_JBR%"
  set "PATH=%JAVA_HOME%\bin;%PATH%"
  echo [OK] Using JAVA_HOME from Android Studio JBR.
) else (
  echo [WARN] Android Studio JBR not found at:
  echo   %STUDIO_JBR%
)

if not exist "%ANDROID_SDK%\platforms" (
  echo ERROR: Android SDK not found at:
  echo   %ANDROID_SDK%
  echo Install Android SDK via Android Studio (SDK Manager) then rerun.
  pause
  exit /b 1
)

echo.
echo [1/9] Installing npm dependencies...
call npm install || goto :fail

echo.
echo [2/9] Ensuring Capacitor packages...
call npm install @capacitor/core @capacitor/cli @capacitor/android || goto :fail

echo.
echo [3/9] Building web assets (Vite)...
call npm run build || goto :fail

echo.
echo [4/9] Adding Android platform (if missing)...
if not exist "android\" (
  call npx cap add android || goto :fail
) else (
  echo Android folder exists. Skipping cap add.
)

echo.
echo [5/9] Writing android\local.properties (sdk.dir)...
set "SDK_ESC=%ANDROID_SDK:\=\\%"
> "android\local.properties" echo sdk.dir=%SDK_ESC%

echo.
echo [6/9] Syncing Capacitor to Android...
call npx cap sync android || goto :fail

echo.
echo [7/9] Ensuring android\gradle.properties uses Android Studio JBR...
if exist "%STUDIO_JBR%\bin\java.exe" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$gp='android\gradle.properties';" ^
    "if(Test-Path $gp){$c=Get-Content $gp | Where-Object {$_ -notmatch '^\s*org\.gradle\.java\.home\s*='}} else {$c=@()};" ^
    "$c += 'org.gradle.java.home=%STUDIO_JBR%';" ^
    "Set-Content -Path $gp -Value $c -Encoding ASCII"
)

echo.
echo [8/9] Building DEBUG APK with Gradle...
pushd android
call .\gradlew --stop
call .\gradlew assembleDebug || (popd & goto :fail)
popd

echo.
echo ==========================================================
echo SUCCESS!
echo APK path:
echo   %CD%\android\app\build\outputs\apk\debug\app-debug.apk
echo ==========================================================
echo.
pause
exit /b 0

:fail
echo.
echo ==========================================================
echo ERROR: Build failed.
echo ==========================================================
echo.
pause
exit /b 1
