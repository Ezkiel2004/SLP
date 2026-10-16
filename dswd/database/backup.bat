@echo off
rem =====================================================================
rem  Daily backup of the DSWD website: the database and uploaded files.
rem  Schedule it with Windows Task Scheduler; restore steps are in
rem  docs/phase-3-setup.md, section "Backups and restore".
rem
rem  Backups contain personal data from the feedback form (R.A. 10173):
rem  keep BACKUP_ROOT outside the web root and readable only by administrators.
rem  Database credentials go in %BACKUP_ROOT%\backup.cnf, never in this file:
rem      [client]
rem      user=dswd_backup
rem      password=...
rem  Without that file it signs in as root with no password (local XAMPP only).
rem =====================================================================
setlocal

if not defined XAMPP set "XAMPP=C:\xampp"
if not defined BACKUP_ROOT set "BACKUP_ROOT=C:\dswd-backups"
if not defined KEEP_DAYS set "KEEP_DAYS=30"
set "DB_NAME=dswd_website"
set "SITE=%~dp0.."

for /f %%d in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set "STAMP=%%d"
set "TARGET=%BACKUP_ROOT%\%STAMP%"
mkdir "%TARGET%" || exit /b 1

set "AUTH=--user=root"
if exist "%BACKUP_ROOT%\backup.cnf" set "AUTH=--defaults-extra-file=%BACKUP_ROOT%\backup.cnf"

"%XAMPP%\mysql\bin\mysqldump.exe" %AUTH% --single-transaction --default-character-set=utf8mb4 --result-file="%TARGET%\%DB_NAME%.sql" %DB_NAME%
if errorlevel 1 (
    echo Database backup failed. Nothing was deleted.
    exit /b 1
)

rem robocopy exit codes below 8 mean success.
robocopy "%SITE%\uploads" "%TARGET%\uploads" /E /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 (
    echo Copying uploaded files failed. Nothing was deleted.
    exit /b 1
)

rem Only after a good backup: remove backup folders older than KEEP_DAYS days.
forfiles /p "%BACKUP_ROOT%" /d -%KEEP_DAYS% /c "cmd /c if @isdir==TRUE rmdir /s /q @path" 2>nul

echo Backup saved to %TARGET%
exit /b 0
