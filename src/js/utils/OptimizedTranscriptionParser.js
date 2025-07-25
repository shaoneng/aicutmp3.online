// 优化后的转录结果解析逻辑
export class OptimizedTranscriptionParser {
    constructor() {
        // 基础解析器构造函数
    }
    
    /**
     * 解析转录结果的主方法
     * @param {Object} result - API返回的结果
     * @returns {Object} 解析后的转录数据
     */
    parseTranscriptionResult(result) {
        console.log('🔍 解析转录结果:', result);

        if (result.error) {
            console.error('❌ API 返回错误:', result.error);
            throw new Error(result.error);
        }

        let segments = [];

        // 步骤1: 尝试直接获取segments
        if (result.segments && Array.isArray(result.segments)) {
            segments = result.segments;
            console.log('✅ 直接获取到segments:', segments.length);
        }
        // 步骤2: 处理Gemini API响应格式
        else if (result.candidates && result.candidates.length > 0) {
            const text = this.extractTextFromGeminiResponse(result);
            segments = this.parseTextToSegments(text);
        }
        // 步骤3: 其他格式处理
        else {
            console.warn('⚠️ 未知的响应格式:', result);
            throw new Error('无法识别的响应格式');
        }

        // 验证和清理数据
        const cleanedSegments = this.cleanAndValidateSegments(segments);

        if (cleanedSegments.length === 0) {
            throw new Error('未检测到有效的语音内容');
        }

        console.log(`✅ 语音识别完成，共 ${cleanedSegments.length} 个文本段落`);

        return {
            segments: cleanedSegments,
            totalSegments: cleanedSegments.length,
            totalDuration: cleanedSegments.length > 0 ? Math.max(...cleanedSegments.map(s => s.endTime)) : 0,
            processedAt: new Date().toISOString()
        };
    }

    /**
     * 从Gemini API响应中提取文本
     * @param {Object} result - Gemini API响应
     * @returns {string} 提取的文本
     */
    extractTextFromGeminiResponse(result) {
        const candidate = result.candidates[0];
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
            const text = candidate.content.parts[0].text;
            console.log('📝 从Gemini响应提取文本:', text.substring(0, 200) + '...');
            return text;
        }
        throw new Error('Gemini响应中没有找到文本内容');
    }

    /**
     * 将文本解析为segments
     * @param {string} text - 要解析的文本
     * @returns {Array} segments数组
     */
    parseTextToSegments(text) {
        console.log('🔍 开始解析文本为segments...');

        // 方法1: 尝试JSON解析
        const jsonSegments = this.tryParseAsJSON(text);
        if (jsonSegments.length > 0) {
            console.log('✅ JSON解析成功');
            return jsonSegments;
        }

        // 方法2: 使用正则表达式解析
        const regexSegments = this.tryParseWithRegex(text);
        if (regexSegments.length > 0) {
            console.log('✅ 正则表达式解析成功');
            return regexSegments;
        }

        // 方法3: 创建单个段落作为备用方案
        console.warn('⚠️ 所有解析方法失败，创建单个段落');
        return [{
            text: text.trim() || "语音识别完成，但无法解析具体内容。",
            startTime: 0,
            endTime: 10,
            confidence: 0.5
        }];
    }

    /**
     * 尝试将文本解析为JSON
     * @param {string} text - 要解析的文本
     * @returns {Array} segments数组
     */
    tryParseAsJSON(text) {
        const cleaningMethods = [
            // 方法1: 基本清理
            (t) => t.trim(),
            
            // 方法2: 移除markdown代码块
            (t) => t.replace(/```json\s*/g, '').replace(/\s*```/g, '').trim(),
            
            // 方法3: 移除所有换行符和多余空白
            (t) => t.replace(/```json/g, '').replace(/```/g, '')
                   .replace(/\n/g, '').replace(/\r/g, '').trim(),
            
            // 方法4: 提取JSON对象
            (t) => {
                const match = t.match(/\{[\s\S]*\}/);
                return match ? match[0] : t;
            }
        ];

        for (let i = 0; i < cleaningMethods.length; i++) {
            try {
                const cleanedText = cleaningMethods[i](text);
                console.log(`🧹 清理方法${i + 1}:`, cleanedText.substring(0, 100) + '...');
                
                const parsed = JSON.parse(cleanedText);
                
                if (parsed.segments && Array.isArray(parsed.segments)) {
                    console.log(`✅ 清理方法${i + 1}成功，找到 ${parsed.segments.length} 个段落`);
                    return parsed.segments;
                }
            } catch (error) {
                console.log(`❌ 清理方法${i + 1}失败:`, error.message);
            }
        }

        return [];
    }

    /**
     * 使用正则表达式解析文本
     * @param {string} text - 要解析的文本
     * @returns {Array} segments数组
     */
    tryParseWithRegex(text) {
        console.log('🔍 使用正则表达式解析...');

        // 支持多种时间格式的正则表达式
        const patterns = [
            // 模式1: 字符串时间格式 "startTime": "00:05"
            /"text":\s*"([^"]+)"[\s\S]*?"startTime":\s*"([^"]+)"[\s\S]*?"endTime":\s*"([^"]+)"/g,
            
            // 模式2: 数字时间格式 "startTime": 5
            /"text":\s*"([^"]+)"[\s\S]*?"startTime":\s*(\d+(?:\.\d+)?)[\s\S]*?"endTime":\s*(\d+(?:\.\d+)?)/g,
            
            // 模式3: 完整对象匹配
            /\{\s*"text":\s*"([^"]+)"\s*,\s*"startTime":\s*(?:"([^"]+)"|(\d+(?:\.\d+)?))\s*,\s*"endTime":\s*(?:"([^"]+)"|(\d+(?:\.\d+)?))\s*\}/g
        ];

        for (let i = 0; i < patterns.length; i++) {
            const segments = [];
            let match;
            
            while ((match = patterns[i].exec(text)) !== null) {
                const segment = {
                    text: match[1],
                    startTime: match[2] || match[3], // 支持字符串或数字格式
                    endTime: match[3] || match[4] || match[5], // 支持不同的匹配组
                    confidence: 0.9
                };
                segments.push(segment);
            }

            if (segments.length > 0) {
                console.log(`✅ 正则模式${i + 1}成功，找到 ${segments.length} 个段落`);
                return segments;
            }
        }

        return [];
    }

    /**
     * 清理和验证segments数据
     * @param {Array} segments - 原始segments数组
     * @returns {Array} 清理后的segments数组
     */
    cleanAndValidateSegments(segments) {
        return segments
            .filter(segment => segment.text && segment.text.trim().length > 0)
            .map((segment, index) => {
                const startTimeSeconds = this.parseTimeToSeconds(segment.startTime) || index * 5;
                const endTimeSeconds = this.parseTimeToSeconds(segment.endTime) || (index + 1) * 5;
                
                return {
                    text: segment.text.trim(),
                    startTime: startTimeSeconds,
                    endTime: endTimeSeconds,
                    confidence: Math.min(1, Math.max(0, parseFloat(segment.confidence) || 0.8)),
                    startTimeFormatted: this.formatSecondsToTime(startTimeSeconds),
                    endTimeFormatted: this.formatSecondsToTime(endTimeSeconds)
                };
            });
    }

    /**
     * 将时间转换为秒数
     * @param {string|number} timeStr - 时间字符串或数字
     * @returns {number} 秒数
     */
    parseTimeToSeconds(timeStr) {
        if (typeof timeStr === 'number') {
            return timeStr;
        }
        
        if (typeof timeStr === 'string') {
            // MM:SS 格式
            const mmssMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
            if (mmssMatch) {
                return parseInt(mmssMatch[1]) * 60 + parseInt(mmssMatch[2]);
            }
            
            // HH:MM:SS 格式
            const hhmmssMatch = timeStr.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
            if (hhmmssMatch) {
                return parseInt(hhmmssMatch[1]) * 3600 + parseInt(hhmmssMatch[2]) * 60 + parseInt(hhmmssMatch[3]);
            }
            
            // 数字字符串
            const parsed = parseFloat(timeStr);
            if (!isNaN(parsed)) {
                return parsed;
            }
        }
        
        return 0;
    }

    /**
     * 将秒数格式化为 MM:SS
     * @param {number} seconds - 秒数
     * @returns {string} MM:SS格式的时间字符串
     */
    formatSecondsToTime(seconds) {
        if (!seconds || isNaN(seconds)) return '00:00';
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
}