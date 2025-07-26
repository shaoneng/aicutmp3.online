// Cloudflare Workers - 音频转录服务
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        
        // 只处理 /api/transcribe 路径，其他返回 404
    if (url.pathname === '/api/transcribe') {
        if (request.method === 'OPTIONS') {
          return handleCORS();
        }
        if (request.method === 'POST') {
          return await handleTranscription(request, env);
        }
      }
      
      return new Response('API endpoint not found', { status: 404 });
    }
  };
// 处理 CORS
function handleCORS() {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

// 处理转录请求
async function handleTranscription(request, env) {

    try {
        console.log('🎤 收到转录请求');

        // 解析请求数据
        const requestData = await request.json();
        const { audioBase64, mimeType, compressed } = requestData;

        console.log('📊 请求信息:', {
            hasAudio: !!audioBase64,
            audioSize: audioBase64 ? audioBase64.length : 0,
            mimeType,
            compressed
        });

        if (!audioBase64) {
            throw new Error('缺少音频数据');
        }

        // 检查 API 密钥
        if (!env.GEMINI_API_KEY) {
            throw new Error('API密钥未配置，请检查环境变量');
        }

        // 处理压缩数据
        let audioData = audioBase64;
        if (compressed) {
            console.log('📦 解压缩音频数据');
            audioData = await decompressBase64(audioBase64);
        }

        // 调用 Gemini Flash Lite API
        console.log('🤖 调用 Gemini API');
        const transcriptionResult = await callGeminiAPI(audioData, mimeType, env.GEMINI_API_KEY);

        console.log('✅ 转录完成');

        return new Response(JSON.stringify(transcriptionResult), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            }
        });

    } catch (error) {
        console.error('❌ 转录失败:', error.message);
        console.error('❌ 错误堆栈:', error.stack);

        // 根据错误类型返回不同的状态码
        let status = 500;
        if (error.message.includes('API密钥')) {
            status = 401;
        } else if (error.message.includes('频率过高')) {
            status = 429;
        } else if (error.message.includes('过大')) {
            status = 413;
        }

        return new Response(JSON.stringify({
            error: error.message,
            timestamp: new Date().toISOString(),
            requestId: crypto.randomUUID()
        }), {
            status,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            }
        });
    }
}

// 调用 Gemini Flash Lite API
async function callGeminiAPI(audioBase64, mimeType, apiKey) {
    if (!apiKey) {
        throw new Error('API密钥未配置');
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    inline_data: {
                        mime_type: mimeType || 'audio/mpeg',
                        data: audioBase64
                    }
                }, {
                    text: `Please transcribe this audio and provide timestamps for each sentence or phrase. 

CRITICAL: Return ONLY a valid JSON object in this EXACT format:
{
  "segments": [
    {"text": "Hello, I'm Neil.", "startTime": "00:05", "endTime": "00:08"},
    {"text": "Welcome to our show.", "startTime": "00:09", "endTime": "00:12"}
  ]
}

STRICT Requirements:
- startTime and endTime MUST be strings in MM:SS format (e.g., "00:05", "01:23")
- Use quotes around time values: "00:05" NOT 5
- Break text into natural sentences or phrases
- Provide accurate timestamps for each segment
- Do not include any markdown, code blocks, explanations, or other text
- Return ONLY the JSON object, nothing else

Example of CORRECT format:
{"segments": [{"text": "From BBC learning English.com.", "startTime": "00:05", "endTime": "00:10"}]}`
                }]
            }]
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API 错误:', response.status, errorText);

        if (response.status === 429) {
            throw new Error('API调用频率过高，请稍后重试');
        } else if (response.status === 401) {
            throw new Error('API密钥无效');
        } else if (response.status === 413) {
            throw new Error('音频文件过大，请选择较小的文件');
        } else {
            throw new Error(`API调用失败: ${response.status}`);
        }
    }

    const result = await response.json();

    // 解析 Gemini 响应
    if (result.candidates && result.candidates.length > 0) {
        const content = result.candidates[0].content;
        if (content && content.parts && content.parts.length > 0) {
            const text = content.parts[0].text;

            try {
                // 尝试解析 JSON 格式的转录结果
                const transcriptionData = JSON.parse(text);
                if (transcriptionData.segments) {
                    return transcriptionData;
                }
            } catch (parseError) {
                console.warn('无法解析JSON格式，使用文本格式:', parseError);
            }

            // 如果不是JSON格式，创建简单的文本段落
            return {
                segments: [{
                    text: text.trim(),
                    startTime: 0,
                    endTime: 0,
                    confidence: 0.8
                }]
            };
        }
    }

    throw new Error('未收到有效的转录结果');
}

// 解压缩 base64 数据（如果需要）
async function decompressBase64(compressedBase64) {
    // 这里需要实现 GZIP 解压缩逻辑
    // 由于 Cloudflare Workers 环境限制，暂时直接返回原数据
    // 在实际部署时需要添加 pako 或其他解压缩库
    console.warn('解压缩功能暂未实现，返回原数据');
    return compressedBase64;
}
