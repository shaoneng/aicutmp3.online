#!/bin/bash

echo "🚀 启动音频剪辑工具本地开发环境"
echo "=================================="

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 请在项目根目录运行此脚本"
    exit 1
fi

# 检查 wrangler 是否安装
if ! command -v wrangler &> /dev/null; then
    echo "📦 安装 wrangler..."
    npm install -g wrangler
fi

# 检查 Workers 环境变量
if [ ! -f "workers/.dev.vars" ]; then
    echo "⚠️  创建 Workers 环境变量文件..."
    cp workers/.dev.vars.example workers/.dev.vars
    echo "📝 请编辑 workers/.dev.vars 文件，填入你的 Gemini API 密钥"
    echo "   然后重新运行此脚本"
    exit 1
fi

echo "✅ 环境检查完成"
echo ""
echo "🔧 启动服务..."
echo "1. Workers 服务将在 http://localhost:8787 启动"
echo "2. 前端服务将在 http://localhost:8000 启动"
echo ""

# 使用 tmux 或 screen 启动多个服务（如果可用）
if command -v tmux &> /dev/null; then
    echo "使用 tmux 启动服务..."
    tmux new-session -d -s audio-editor
    tmux send-keys -t audio-editor "cd workers && wrangler dev --port 8787" Enter
    tmux split-window -t audio-editor
    tmux send-keys -t audio-editor "python -m http.server 8000" Enter
    
    echo "✅ 服务已启动！"
    echo "📱 访问: http://localhost:8000/src/index.html"
    echo "🔍 查看服务: tmux attach -t audio-editor"
    echo "🛑 停止服务: tmux kill-session -t audio-editor"
else
    echo "请手动启动以下服务："
    echo ""
    echo "终端1: cd workers && wrangler dev --port 8787"
    echo "终端2: python -m http.server 8000"
    echo ""
    echo "然后访问: http://localhost:8000/src/index.html"
fi