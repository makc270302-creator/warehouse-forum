@echo off
set "NODE_HOME=%USERPROFILE%\Tools\nodejs"
set "PATH=%NODE_HOME%;%PATH%"
set "WATCHPACK_POLLING=true"
set "WATCHPACK_POLLING_INTERVAL=1000"
pushd "%~dp0"
npm run dev
popd
