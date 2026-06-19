@echo off
set "NODE_HOME=%USERPROFILE%\Tools\nodejs"
set "PATH=%NODE_HOME%;%PATH%"
pushd "%~dp0"
npm run build
popd
