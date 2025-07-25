# 音频剪辑工具 MVP

基于网页的音频剪辑工具，支持音频上传、AI语音识别、可视化剪辑和导出功能。

## 功能特性

- 🎵 支持 MP3/WAV 格式音频上传（≤10分钟，≤20MB）
- 🤖 集成 Gemini Flash Lite AI 进行语音识别
- 📊 可视化音频波形显示
- ✂️ 拖拽选择音频片段进行剪辑
- 💾 导出 WAV 格式音频文件
- 🔒 所有处理仅在浏览器本地完成，保护隐私

## 技术栈

- **前端**: 纯 HTML/CSS/JavaScript
- **音频处理**: Web Audio API + WaveSurfer.js
- **语音识别**: Gemini Flash Lite (通过 Cloudflare Workers 代理)
- **音频剪辑**: FFmpeg.wasm
- **部署**: GitHub Pages + Cloudflare Workers

## 浏览器支持

| 浏览器 | 版本 | 支持程度 |
|--------|------|----------|
| Chrome | 90+ | ✅ 完全支持 |
| Firefox | 88+ | ✅ 完全支持 |
| Safari | 14+ | ⚠️ 需用户手势播放 |
| iOS Safari | 14+ | ⚠️ 基本功能可用 |
| Edge | 90+ | ✅ 完全支持 |

## 快速开始

### 本地测试

1. 配置 API 密钥
```bash
cd workers
cp .dev.vars.example .dev.vars
# 编辑 .dev.vars 文件，填入你的 Gemini API 密钥
```

2. 启动服务（需要两个终端）
```bash
# 终端1: 启动 Workers 服务
cd workers
npm install
wrangler dev --port 8787

# 终端2: 启动前端服务
python -m http.server 8000
```

3. 访问 http://localhost:8000/src/index.html

### 一键启动（如果有 tmux）
```bash
./start-dev.sh
```

## 使用说明

1. **上传音频**: 拖拽或选择 MP3/WAV 文件
2. **等待识别**: 系统自动进行语音识别
3. **拖拽选择**: 在波形图上选择要剪辑的片段
4. **导出片段**: 点击导出按钮下载 WAV 文件

## 隐私保护

- 音频文件仅在浏览器本地处理，不会上传到服务器
- 语音识别通过加密传输，Workers 不存储音频内容
- 所有数据在页面关闭时自动清除

## 开发状态

当前版本：MVP v1.0.0
- ✅ 项目基础设施
- 🚧 文件上传功能
- 🚧 Workers API 代理
- 🚧 语音识别集成
- ⏳ 音频波形显示
- ⏳ 剪辑选择功能
- ⏳ 音频导出功能

## 许可证

MIT License