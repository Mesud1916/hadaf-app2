@echo off
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"

echo JAVA_HOME=%JAVA_HOME%
java -version

cd /d C:\hadaf-app2
call npm run build
call npx cap sync android

cd /d C:\hadaf-app2\android
call gradlew --stop
call gradlew assembleDebug

pause
