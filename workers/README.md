# Audio Editor Workers

Cloudflare Workers 服务，用于代理 Gemini Flash Lite API 调用。

## 功能

- 接收前端发送的音频数据（base64格式）
- 代理调用 Gemini Flash Lite API 进行语音识别
- 处理 CORS 跨域问题
- 错误处理和重试机制

## 部署步骤

1. 安装 Wrangler CLI
```bash
npm install -g wrangler
```

2. 登录 Cloudflare
```bash
wrangler login
```

3. 设置环境变量
```bash
# 在 Cloudflare Dashboard 中设置以下环境变量：
# GEMINI_API_KEY: 你的 Gemini API 密钥
# CORS_ORIGIN: 你的前端域名，如 https://username.github.io
```

4. 部署到 Cloudflare
```bash
npm run deploy
```

## 本地开发

```bash
npm install
npm run dev
```

## API 接口

### POST /

请求体：
```json
{
  "audioBase64": "base64编码的音频数据",
  "mimeType": "audio/mp3 或 audio/wav",
  "compressed": false
}
```

响应：
```json
{
  "segments": [
    {
      "text": "识别出的文本内容",
      "startTime": 0.5,
      "endTime": 3.2,
      "confidence": 0.95
    }
  ]
}
```

## 错误处理

- 429: API调用频率过高
- 401: API密钥无效  
- 413: 音频文件过大
- 500: 服务器内部错误