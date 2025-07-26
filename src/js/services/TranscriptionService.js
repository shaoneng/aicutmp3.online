// 语音识别服务
import { OptimizedTranscriptionParser } from '../utils/OptimizedTranscriptionParser.js';

export class TranscriptionService extends OptimizedTranscriptionParser {
    constructor(options = {}) {
        super(); // 调用父类构造函数
        
        this.workerEndpoint = 'https://api.aicutmp3.online/api/transcribe';
        this.retryAttempts = 3;
        this.retryDelay = 1000; // 初始重试延迟（毫秒）
        this.isFirstCall = true;

        // 回调函数
        this.onTranscriptionStart = options.onTranscriptionStart || (() => { });
        this.onTranscriptionComplete = options.onTranscriptionComplete || (() => { });
        this.onTranscriptionError = options.onTranscriptionError || (() => { });

        console.log('🎤 TranscriptionService 初始化完成');
    }

    // 新方法：直接从文件进行转录（推荐）
    async transcribeFromFile(file) {
        console.log('🎤 开始转录音频文件:', {
            name: file.name,
            size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
            type: file.type
        });

        // 通知开始转录
        this.onTranscriptionStart();

        try {
            // 1. 直接将文件转换为 base64（无需解码）
            console.log('📦 转换文件为base64...');
            const base64Audio = await this.fileToBase64(file);

            // 2. 调用 Workers API
            console.log('🌐 调用转录服务...');
            const result = await this.callWorkerAPI({ data: base64Audio, compressed: false }, file.type);

            // 3. 解析结果
            const transcriptionData = this.parseTranscriptionResult(result);

            // 4. 通知完成
            this.onTranscriptionComplete(transcriptionData);

            return transcriptionData;

        } catch (error) {
            console.error('❌ 转录失败:', error);
            this.onTranscriptionError(error.message);
            throw error;
        }
    }

    // 原方法：从AudioBuffer转录（用于音频处理场景）
    async transcribe(audioBuffer, mimeType, originalFile = null) {
        console.log('🎤 开始转录音频:', {
            duration: audioBuffer ? audioBuffer.duration : 'unknown',
            sampleRate: audioBuffer ? audioBuffer.sampleRate : 'unknown',
            mimeType,
            hasOriginalFile: !!originalFile
        });

        // 通知开始转录
        this.onTranscriptionStart();

        // 首次调用提示
        if (this.isFirstCall) {
            console.log('ℹ️ 首次识别可能较慢，请稍候...');
            this.isFirstCall = false;
        }

        try {
            let base64Audio;

            // 选择处理方式：原始文件 vs 解码后的AudioBuffer
            if (originalFile && originalFile.size < 20 * 1024 * 1024) { // 小于20MB直接上传
                console.log('📦 使用原始文件（更快）...');
                base64Audio = await this.fileToBase64(originalFile);
            } else {
                console.log('📦 转换音频格式（标准化）...');
                base64Audio = await this.audioBufferToBase64(audioBuffer);
            }

            // 2. 压缩数据（如果需要）
            const compressedAudio = await this.compressBase64(base64Audio);

            // 3. 调用 Workers API
            console.log('🌐 调用转录服务...');
            const result = await this.callWorkerAPI(compressedAudio, mimeType, true);

            // 4. 解析结果
            const transcriptionData = this.parseTranscriptionResult(result);

            // 5. 通知完成
            this.onTranscriptionComplete(transcriptionData);

            return transcriptionData;

        } catch (error) {
            console.error('❌ 转录失败:', error);
            this.onTranscriptionError(error.message);
            throw error;
        }
    }

    async audioBufferToBase64(audioBuffer) {
        // 将 AudioBuffer 转换为 WAV 格式的 base64
        const wavBuffer = this.audioBufferToWav(audioBuffer);
        const base64 = this.arrayBufferToBase64(wavBuffer);

        console.log(`📊 音频数据大小: ${(base64.length * 0.75 / 1024 / 1024).toFixed(2)} MB`);

        return base64;
    }

    // 新增：直接处理原始文件的方法
    async fileToBase64(file) {
        console.log(`📁 直接处理原始文件: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

        const arrayBuffer = await file.arrayBuffer();
        const base64 = this.arrayBufferToBase64(arrayBuffer);

        console.log(`📊 原始文件转换完成: ${(base64.length * 0.75 / 1024 / 1024).toFixed(2)} MB`);

        return base64;
    }

    audioBufferToWav(audioBuffer) {
        const length = audioBuffer.length;
        const numberOfChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const bytesPerSample = 2; // 16-bit

        // 计算 WAV 文件大小
        const dataLength = length * numberOfChannels * bytesPerSample;
        const headerLength = 44;
        const totalLength = headerLength + dataLength;

        // 创建 ArrayBuffer
        const arrayBuffer = new ArrayBuffer(totalLength);
        const view = new DataView(arrayBuffer);

        // WAV 文件头
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, totalLength - 8, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true); // PCM format
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, numberOfChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numberOfChannels * bytesPerSample, true);
        view.setUint16(32, numberOfChannels * bytesPerSample, true);
        view.setUint16(34, 16, true); // 16-bit
        writeString(36, 'data');
        view.setUint32(40, dataLength, true);

        // 写入音频数据
        let offset = 44;
        for (let i = 0; i < length; i++) {
            for (let channel = 0; channel < numberOfChannels; channel++) {
                const sample = audioBuffer.getChannelData(channel)[i];
                const intSample = Math.max(-1, Math.min(1, sample)) * 0x7FFF;
                view.setInt16(offset, intSample, true);
                offset += 2;
            }
        }

        return arrayBuffer;
    }

    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    async compressBase64(base64Audio) {
        // 检查是否需要压缩
        const sizeInMB = (base64Audio.length * 0.75) / (1024 * 1024);

        if (sizeInMB < 10) {
            console.log('📦 文件较小，无需压缩');
            return { data: base64Audio, compressed: false };
        }

        try {
            // 动态导入 pako 进行 GZIP 压缩
            const { gzip } = await import('https://cdn.skypack.dev/pako');

            console.log('📦 压缩音频数据...');
            const compressed = gzip(base64Audio);
            const compressedBase64 = this.arrayBufferToBase64(compressed.buffer);

            const originalSize = (base64Audio.length * 0.75) / (1024 * 1024);
            const compressedSize = (compressedBase64.length * 0.75) / (1024 * 1024);
            const ratio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);

            console.log(`📦 压缩完成: ${originalSize.toFixed(2)}MB → ${compressedSize.toFixed(2)}MB (节省 ${ratio}%)`);

            return { data: compressedBase64, compressed: true };

        } catch (error) {
            console.warn('压缩失败，使用原始数据:', error);
            return { data: base64Audio, compressed: false };
        }
    }

    async callWorkerAPI(audioData, mimeType, compressed) {
        const requestData = {
            audioBase64: audioData.data,
            mimeType: mimeType || 'audio/wav',
            compressed: audioData.compressed
        };

        console.log('🌐 发送请求到:', this.workerEndpoint);
        console.log('📊 请求数据大小:', JSON.stringify(requestData).length, 'bytes');

        // 使用重试机制
        return await this.retryWithBackoff(async () => {
            const response = await fetch(this.workerEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            console.log('📡 响应状态:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ API 错误响应:', errorText);

                // 提供更详细的错误信息
                if (response.status === 401) {
                    throw new Error('API认证失败，请检查 Gemini API 密钥');
                } else if (response.status === 429) {
                    throw new Error('API调用频率过高，请稍后重试');
                } else if (response.status === 413) {
                    throw new Error('音频文件过大，请选择较小的文件');
                } else if (response.status === 500) {
                    // 检查是否是网络连接问题
                    if (errorText.includes('Network connection lost')) {
                        throw new Error('网络连接中断，请检查网络连接后重试');
                    } else {
                        throw new Error('服务器内部错误，请重试');
                    }
                } else {
                    throw new Error(`API调用失败 (${response.status}): ${errorText}`);
                }
            }

            const apiResult = await response.json();
            console.log('✅ API 响应成功:', apiResult);
            return apiResult;
        });
    }

    async retryWithBackoff(fn) {
        let lastError;

        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                console.warn(`🔄 第 ${attempt} 次尝试失败:`, error.message);

                if (attempt === this.retryAttempts) {
                    break;
                }

                // 指数退避延迟
                const delay = this.retryDelay * Math.pow(2, attempt - 1);
                console.log(`⏳ ${delay}ms 后重试...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError;
    }

    parseTranscriptionResult(result) {
        console.log('🔍 解析转录结果:', result);

        if (result.error) {
            console.error('❌ API 返回错误:', result.error);
            throw new Error(result.error);
        }

        // 处理不同的响应格式
        let segments = [];

        if (result.segments && Array.isArray(result.segments)) {
            // 检查是否segments中的text字段包含嵌套的JSON
            if (result.segments.length === 1 && result.segments[0].text && result.segments[0].text.includes('```json')) {
                console.log('🔍 发现segments中包含嵌套的JSON，开始解析...');
                const nestedText = result.segments[0].text;
                segments = this.extractSegmentsFromText(nestedText);
            } else {
                segments = result.segments;
            }
        } else if (result.candidates && result.candidates.length > 0) {
            // 处理 Gemini API 的原始响应格式
            const candidate = result.candidates[0];
            if (candidate.content && candidate.content.parts) {
                const text = candidate.content.parts[0].text;
                console.log('📝 原始文本:', text);

                // 解析 Gemini 响应文本
                console.log('🔍 解析语音识别结果...');

                // 步骤1: 尝试多种清理方式
                const cleaningStrategies = [
                    // 策略1: 标准清理
                    (t) => {
                        let cleaned = t.trim();
                        cleaned = cleaned.replace(/```json\s*/g, '');
                        cleaned = cleaned.replace(/\s*```/g, '');
                        return cleaned.trim();
                    },
                    // 策略2: 处理真正的换行符
                    (t) => {
                        let cleaned = t.trim();
                        cleaned = cleaned.replace(/\n/g, ''); // 移除真正的换行符
                        cleaned = cleaned.replace(/```json/g, '');
                        cleaned = cleaned.replace(/```/g, '');
                        return cleaned.trim();
                    },
                    // 策略3: 强力清理（处理所有可能的换行符）
                    (t) => {
                        let cleaned = t.trim();
                        cleaned = cleaned.replace(/```json/g, '');
                        cleaned = cleaned.replace(/```/g, '');
                        cleaned = cleaned.replace(/\\n/g, ''); // 字面上的\n
                        cleaned = cleaned.replace(/\n/g, ''); // 真正的换行符
                        cleaned = cleaned.replace(/\r/g, ''); // 回车符
                        cleaned = cleaned.replace(/^\s+|\s+$/gm, '');
                        return cleaned.trim();
                    }
                ];

                // 尝试每种清理策略
                for (let i = 0; i < cleaningStrategies.length; i++) {
                    try {
                        const cleanedText = cleaningStrategies[i](text);
                        console.log(`🧹 策略${i + 1}清理结果:`, cleanedText.substring(0, 100) + '...');
                        console.log(`🧹 策略${i + 1}清理后长度:`, cleanedText.length);

                        const parsed = JSON.parse(cleanedText);
                        console.log(`✅ 策略${i + 1}JSON解析成功`);

                        if (parsed.segments && Array.isArray(parsed.segments)) {
                            segments = parsed.segments;
                            console.log(`✅ 策略${i + 1}成功！找到 ${segments.length} 个段落，解析完成`);
                            break;
                        } else {
                            console.log(`❌ 策略${i + 1}解析成功但没有segments数组`);
                        }
                    } catch (error) {
                        console.log(`❌ 策略${i + 1}失败:`, error.message);
                    }
                }

                // 如果所有JSON解析都失败，使用正则表达式
                if (segments.length === 0) {
                    console.log('🔍 JSON解析全部失败，使用正则表达式...');

                    // 多种正则表达式模式
                    const regexPatterns = [
                        // 模式1: 标准格式
                        /\{\s*"text":\s*"([^"]+)"\s*,\s*"startTime":\s*([\d.]+)\s*,\s*"endTime":\s*([\d.]+)\s*\}/g,
                        // 模式2: 处理可能的空白
                        /\{\s*"text"\s*:\s*"([^"]+)"\s*,\s*"startTime"\s*:\s*([\d.]+)\s*,\s*"endTime"\s*:\s*([\d.]+)\s*\}/g,
                        // 模式3: 更宽松的匹配
                        /"text":\s*"([^"]+)"[\s\S]*?"startTime":\s*([\d.]+)[\s\S]*?"endTime":\s*([\d.]+)/g
                    ];

                    for (let i = 0; i < regexPatterns.length; i++) {
                        const pattern = regexPatterns[i];
                        const matches = [];
                        let match;

                        while ((match = pattern.exec(text)) !== null) {
                            matches.push({
                                text: match[1],
                                startTime: parseFloat(match[2]),
                                endTime: parseFloat(match[3]),
                                confidence: 0.9
                            });
                        }

                        if (matches.length > 0) {
                            segments = matches;
                            console.log(`✅ 正则模式${i + 1}成功，找到 ${segments.length} 个段落`);
                            break;
                        }
                    }
                }

                // 最后的备用方案：使用正则表达式强制提取
                if (segments.length === 0) {
                    console.warn('⚠️ JSON解析失败，使用正则表达式强制提取...');

                    // 强制使用正则表达式提取所有文本段落
                    const textMatches = text.match(/"text":\s*"([^"]+)"/g);
                    const startTimeMatches = text.match(/"startTime":\s*([\d.]+)/g);
                    const endTimeMatches = text.match(/"endTime":\s*([\d.]+)/g);

                    console.log(`📝 正则提取结果: ${textMatches?.length || 0} 个文本, ${startTimeMatches?.length || 0} 个开始时间, ${endTimeMatches?.length || 0} 个结束时间`);

                    if (textMatches && startTimeMatches && endTimeMatches &&
                        textMatches.length === startTimeMatches.length &&
                        textMatches.length === endTimeMatches.length) {

                        // 提取并组合数据
                        textMatches.forEach((textMatch, index) => {
                            const text = textMatch.match(/"text":\s*"([^"]+)"/)[1];
                            const startTime = parseFloat(startTimeMatches[index].match(/"startTime":\s*([\d.]+)/)[1]);
                            const endTime = parseFloat(endTimeMatches[index].match(/"endTime":\s*([\d.]+)/)[1]);

                            segments.push({
                                text: text,
                                startTime: startTime,
                                endTime: endTime,
                                confidence: 0.9
                            });
                        });

                        console.log(`✅ 正则表达式强制提取成功，找到 ${segments.length} 个段落`);
                    } else {
                        console.error('❌ 正则表达式提取也失败了');
                        segments = [{
                            text: "语音识别完成，但文本解析遇到问题。请重试或检查音频质量。",
                            startTime: 0,
                            endTime: 10,
                            confidence: 0.5
                        }];
                    }
                }
            }
        }

        // 如果还是没有段落，说明所有方法都失败了
        if (!segments || segments.length === 0) {
            console.error('❌ 所有解析方法都失败了');
            console.error('❌ 原始结果:', result);
            console.error('❌ 原始文本:', typeof text !== 'undefined' ? text : '[text 未定义]');
            throw new Error('语音识别结果解析失败，请重试');
        }

        // 验证和清理数据
        const cleanedSegments = segments
            .filter(segment => segment.text && segment.text.trim().length > 0)
            .map((segment, index) => {
                const startTimeSeconds = this.parseTimeToSeconds(segment.startTime) || index * 5;
                const endTimeSeconds = this.parseTimeToSeconds(segment.endTime) || (index + 1) * 5;

                return {
                    text: segment.text.trim(),
                    startTime: startTimeSeconds,
                    endTime: endTimeSeconds,
                    confidence: Math.min(1, Math.max(0, parseFloat(segment.confidence) || 0.8)),
                    // 始终生成格式化的时间戳，无论原始格式如何
                    startTimeFormatted: this.formatSecondsToTime(startTimeSeconds),
                    endTimeFormatted: this.formatSecondsToTime(endTimeSeconds)
                };
            });

        if (cleanedSegments.length === 0) {
            console.warn('未检测到有效的语音内容，自动补一个兜底 segment');
            cleanedSegments.push({
                text: "未检测到有效的语音内容。",
                startTime: 0,
                endTime: 0,
                confidence: 0,
                startTimeFormatted: "00:00",
                endTimeFormatted: "00:00"                

            });
        }

        console.log(`✅ 语音识别完成，共 ${cleanedSegments.length} 个文本段落`);

        return {
            segments: cleanedSegments,
            totalSegments: cleanedSegments.length,
            totalDuration: cleanedSegments.length > 0 ? Math.max(...cleanedSegments.map(s => s.endTime)) : 0,
            processedAt: new Date().toISOString()
        };
    }

    extractSegmentsFromText(text) {
        try {
            const jsonMatch = text.match(/```json\s*([\s\S]+?)\s*```/);
            const jsonString = jsonMatch ? jsonMatch[1] : text;
            const parsed = JSON.parse(jsonString);
            if (parsed.segments && Array.isArray(parsed.segments)) {
                return parsed.segments;
            }
            return [];
        } catch (e) {
            console.error('extractSegmentsFromText 解析失败:', e);
            return [];
        }
    }
    // 旧的解析方法已移动到 OptimizedTranscriptionParser 中

    // 设置 Workers 端点 URL
    setWorkerEndpoint(url) {
        this.workerEndpoint = url;
        console.log('🔧 Workers 端点已更新:', url);
    }

    /**
     * 将 MM:SS 格式的时间转换为秒数
     * @param {string|number} timeStr - 时间字符串 (MM:SS) 或数字
     * @returns {number} 秒数
     */
    parseTimeToSeconds(timeStr) {
        // 如果是数字，直接返回
        if (typeof timeStr === 'number') {
            return timeStr;
        }

        if (typeof timeStr === 'string') {
            // 处理 MM:SS 格式 (如 "00:05", "01:23")
            const mmssMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
            if (mmssMatch) {
                const minutes = parseInt(mmssMatch[1], 10);
                const seconds = parseInt(mmssMatch[2], 10);
                return minutes * 60 + seconds;
            }

            // 处理 HH:MM:SS 格式 (如 "00:01:23")
            const hhmmssMatch = timeStr.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
            if (hhmmssMatch) {
                const hours = parseInt(hhmmssMatch[1], 10);
                const minutes = parseInt(hhmmssMatch[2], 10);
                const seconds = parseInt(hhmmssMatch[3], 10);
                return hours * 3600 + minutes * 60 + seconds;
            }

            // 尝试解析为浮点数
            const parsed = parseFloat(timeStr);
            if (!isNaN(parsed)) {
                return parsed;
            }
        }

        console.warn('无法解析时间格式:', timeStr);
        return 0;
    }

    /**
     * 将秒数转换为 MM:SS 格式
     * @param {number} seconds - 秒数
     * @returns {string} MM:SS 格式的时间字符串
     */
    formatSecondsToTime(seconds) {
        if (!seconds || isNaN(seconds)) return '00:00';

        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);

        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
}
