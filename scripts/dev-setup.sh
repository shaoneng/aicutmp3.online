#!/bin/bash

# 本地开发环境设置脚本

echo "🚀 设置音频剪辑工具本地开发环境..."

# 1. 安装前端依赖
echo "📦 安装前端依赖..."
npm install

# 2. 安装 Workers 依赖
echo "📦 安装 Workers 依赖..."
cd workers
npm install

# 3. 检查 wrangler 是否已安装
if ! command -v wrangler &> /dev/null; then
    echo "⚠️  wrangler 未安装，正在安装..."
    npm install -g wrangler
fi

# 4. 创建本地环境变量文件
if [ ! -f .dev.vars ]; then
    echo "📝 创建本地环境变量文件..."
    cat > .dev.vars << EOF
GEMINI_API_KEY=your-gemini-api-key-here
CORS_ORIGIN=http://localhost:8000
EOF
    echo "⚠️  请编辑 workers/.dev.vars 文件，填入你的 Gemini API 密钥"
fi

cd ..

# 5. 创建前端配置文件
echo "📝 创建前端本地配置..."
cat > src/js/config.local.js << EOF
// 本地开发配置
export const CONFIG = {
    // 本地 Workers 端点
    WORKER_ENDPOINT: 'http://localhost:8787',
    
    // 文件限制
    MAX_FILE_SIZE: 20 * 1024 * 1024, // 20MB
    MAX_DURATION: 600, // 10分钟
    SUPPORTED_FORMATS: ['audio/mp3', 'audio/wav', 'audio/mpeg'],
    
    // API 配置
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
    
    // UI 配置
    NOTIFICATION_DURATION: 3000,
    ERROR_NOTIFICATION_DURATION: 5000,
    
    // 开发模式
    DEBUG: true
};
EOF

echo "✅ 本地开发环境设置完成！"
echo ""
echo "📋 下一步操作："
echo "1. 编辑 workers/.dev.vars 文件，填入你的 Gemini API 密钥"
echo "2. 运行 npm run dev:workers 启动 Workers 服务"
echo "3. 运行 npm run dev:frontend 启动前端服务"
echo "4. 访问 http://localhost:8000 进行测试"