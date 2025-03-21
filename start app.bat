@echo off
REM Open Visual Studio Code in the current directory
start "" code .

REM Start the server (opens a new command prompt and runs npm start)
start "" cmd /k "npm start"

REM Wait 5 seconds for the server to initialize
timeout /T 5

REM Open Google Chrome at http://localhost:3000
start "" chrome http://localhost:3000
