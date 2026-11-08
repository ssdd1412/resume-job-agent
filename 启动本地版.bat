@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PYTHONUTF8=1
title 简历生成 + 工作匹配 Agent

echo ============================================
echo   简历生成 + 工作匹配 Agent  本地启动
echo ============================================
echo.

if not exist ".env" (
  echo [!] 没有找到 .env，请先复制 .env.example 为 .env 并填入模型 Key。
  echo     例如：
  echo     AI_GATEWAY_API_KEY=你的Key
  echo     AI_GATEWAY_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
  echo     AI_GATEWAY_MODEL=qwen-plus
  echo.
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo [1/3] 首次运行：创建 Python 虚拟环境...
  python -m venv .venv
  if errorlevel 1 (
    echo [!] 创建虚拟环境失败：请确认已安装 Python 3.10+ 并加入 PATH。
    pause
    exit /b 1
  )
  .venv\Scripts\python.exe -m pip install -q -r requirements.txt
)

if not exist "node_modules" (
  echo [2/3] 首次运行：安装前端依赖（约 1-3 分钟）...
  call npm install --no-audit --no-fund
)

if not exist "dist\index.html" (
  echo [2/3] 构建前端...
  call npm run build
)

echo [3/3] 启动本地服务：http://127.0.0.1:8088
echo       关闭这个窗口即停止服务。
echo.
start "" http://127.0.0.1:8088
.venv\Scripts\python.exe dev\local_server.py
pause
