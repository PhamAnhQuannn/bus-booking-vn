@echo off
REM Entry cho Windows Task Scheduler — rebuild KB tourism (full: sweep->export->enrich->docx).
REM Set env + cwd on dinh roi goi wrapper python. Log chi tiet do rebuild_tourism.py tu ghi
REM (tourism-kb\raw\_shared\rebuild-*.log). Dong nay chi bao exit code cuoi.
setlocal
set PYTHONIOENCODING=utf-8
cd /d D:\Bus-Booking
python tourism-kb\code\rebuild_tourism.py
echo [run_rebuild] exit code: %ERRORLEVEL%
endlocal
exit /b %ERRORLEVEL%
