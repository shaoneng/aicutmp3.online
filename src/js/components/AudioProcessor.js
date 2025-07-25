// 音频处理核心类
export class AudioProcessor {
    constructor(options = {}) {
        // 初始化 AudioContext（Safari 兼容性处理）
        this.audioContext = null;
        this.audioBuffer = null;
        this.isInitialized = false;
        
        // 回调函数
        this.onAudioLoaded = options.onAudioLoaded || (() => {});
        this.onAudioError = options.onAudioError || (() => {});
        this.onProgress = options.onProgress || (() => {});
        
        console.log('🎵 AudioProcessor 初始化完成');
    }
    
    /**
     * 初始化 AudioContext（Safari 兼容性处理）
     */
    async initializeAudioContext() {
        if (this.isInitialized) {
            return this.audioContext;
        }
        
        try {
            // Safari 兼容性：支持 webkitAudioContext
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            
            if (!AudioContextClass) {
                throw new Error('浏览器不支持 Web Audio API');
            }
            
            this.audioContext = new AudioContextClass();
            
            // iOS AudioContext resume 处理
            if (this.audioContext.state === 'suspended') {
                console.log('🔊 检测到 AudioContext 被暂停，尝试恢复...');
                await this.resumeAudioContext();
            }
            
            this.isInitialized = true;
            console.log('🎵 AudioContext 初始化成功:', {
                sampleRate: this.audioContext.sampleRate,
                state: this.audioContext.state,
                baseLatency: this.audioContext.baseLatency
            });
            
            return this.audioContext;
            
        } catch (error) {
            console.error('❌ AudioContext 初始化失败:', error);
            throw new Error(`音频系统初始化失败: ${error.message}`);
        }
    }
    
    /**
     * iOS AudioContext resume 处理
     * 必须在用户手势中调用
     */
    async resumeAudioContext() {
        if (!this.audioContext) {
            throw new Error('AudioContext 未初始化');
        }
        
        if (this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
                console.log('✅ AudioContext 恢复成功，状态:', this.audioContext.state);
            } catch (error) {
                console.error('❌ AudioContext 恢复失败:', error);
                throw new Error('音频系统恢复失败，请在用户交互后重试');
            }
        }
    }
    
    /**
     * 解码音频文件
     * @param {File} file - 音频文件
     * @returns {Promise<AudioBuffer>} 解码后的音频缓冲区
     */
    async decodeAudio(file) {
        console.log('🎵 开始解码音频文件:', {
            name: file.name,
            size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
            type: file.type
        });
        
        try {
            // 确保 AudioContext 已初始化
            await this.initializeAudioContext();
            
            // 进度更新
            this.onProgress(10, '正在读取音频文件...');
            
            // 读取文件为 ArrayBuffer
            const arrayBuffer = await this.fileToArrayBuffer(file);
            
            this.onProgress(30, '正在解码音频数据...');
            
            // 使用 Web Audio API 解码
            const audioBuffer = await this.decodeArrayBuffer(arrayBuffer);
            
            this.onProgress(80, '音频解码完成...');
            
            // 验证音频数据
            this.validateAudioBuffer(audioBuffer);
            
            // 保存解码结果
            this.audioBuffer = audioBuffer;
            
            this.onProgress(100, '音频加载完成');
            
            const audioInfo = {
                duration: audioBuffer.duration,
                sampleRate: audioBuffer.sampleRate,
                numberOfChannels: audioBuffer.numberOfChannels,
                length: audioBuffer.length
            };
            
            console.log('✅ 音频解码成功:', audioInfo);
            this.onAudioLoaded(audioBuffer, audioInfo);
            
            return audioBuffer;
            
        } catch (error) {
            console.error('❌ 音频解码失败:', error);
            this.onAudioError(error.message);
            throw error;
        }
    }
    
    /**
     * 将文件转换为 ArrayBuffer
     * @param {File} file - 音频文件
     * @returns {Promise<ArrayBuffer>}
     */
    async fileToArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                resolve(event.target.result);
            };
            
            reader.onerror = () => {
                reject(new Error('文件读取失败'));
            };
            
            reader.readAsArrayBuffer(file);
        });
    }
    
    /**
     * 解码 ArrayBuffer 为 AudioBuffer
     * @param {ArrayBuffer} arrayBuffer - 音频数据
     * @returns {Promise<AudioBuffer>}
     */
    async decodeArrayBuffer(arrayBuffer) {
        try {
            // 使用现代 Promise 版本的 decodeAudioData
            if (this.audioContext.decodeAudioData.length === 1) {
                return await this.audioContext.decodeAudioData(arrayBuffer);
            } else {
                // 回退到回调版本（旧版浏览器）
                return new Promise((resolve, reject) => {
                    this.audioContext.decodeAudioData(
                        arrayBuffer,
                        resolve,
                        reject
                    );
                });
            }
        } catch (error) {
            // 提供更详细的错误信息
            if (error.name === 'EncodingError') {
                throw new Error('音频文件格式不支持或已损坏');
            } else if (error.name === 'DataCloneError') {
                throw new Error('音频文件过大，无法处理');
            } else {
                throw new Error(`音频解码失败: ${error.message}`);
            }
        }
    }
    
    /**
     * 验证 AudioBuffer 数据
     * @param {AudioBuffer} audioBuffer - 音频缓冲区
     */
    validateAudioBuffer(audioBuffer) {
        if (!audioBuffer) {
            throw new Error('音频解码结果为空');
        }
        
        if (audioBuffer.duration <= 0) {
            throw new Error('音频文件时长无效');
        }
        
        if (audioBuffer.numberOfChannels <= 0) {
            throw new Error('音频文件通道数无效');
        }
        
        if (audioBuffer.sampleRate <= 0) {
            throw new Error('音频文件采样率无效');
        }
        
        // 检查是否有音频数据
        let hasAudioData = false;
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            for (let i = 0; i < Math.min(1000, channelData.length); i++) {
                if (Math.abs(channelData[i]) > 0.001) {
                    hasAudioData = true;
                    break;
                }
            }
            if (hasAudioData) break;
        }
        
        if (!hasAudioData) {
            console.warn('⚠️ 警告：音频文件可能是静音的');
        }
    }
    
    /**
     * 将 AudioBuffer 转换为 base64 编码的 WAV 格式
     * @param {AudioBuffer} audioBuffer - 音频缓冲区（可选，默认使用当前加载的音频）
     * @returns {string} base64 编码的 WAV 数据
     */
    audioBufferToBase64(audioBuffer = null) {
        const buffer = audioBuffer || this.audioBuffer;
        
        if (!buffer) {
            throw new Error('没有可用的音频数据');
        }
        
        console.log('📦 开始转换 AudioBuffer 为 base64 WAV 格式...');
        
        try {
            // 转换为 WAV 格式
            const wavArrayBuffer = this.audioBufferToWav(buffer);
            
            // 转换为 base64
            const base64 = this.arrayBufferToBase64(wavArrayBuffer);
            
            const sizeInMB = (base64.length * 0.75) / (1024 * 1024);
            console.log(`✅ AudioBuffer 转换完成: ${sizeInMB.toFixed(2)} MB`);
            
            return base64;
            
        } catch (error) {
            console.error('❌ AudioBuffer 转换失败:', error);
            throw new Error(`音频格式转换失败: ${error.message}`);
        }
    }
    
    /**
     * 将 AudioBuffer 转换为 WAV 格式的 ArrayBuffer
     * @param {AudioBuffer} audioBuffer - 音频缓冲区
     * @returns {ArrayBuffer} WAV 格式的音频数据
     */
    audioBufferToWav(audioBuffer) {
        const length = audioBuffer.length;
        const numberOfChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const bytesPerSample = 2; // 16-bit PCM
        
        // 计算 WAV 文件大小
        const dataLength = length * numberOfChannels * bytesPerSample;
        const headerLength = 44;
        const totalLength = headerLength + dataLength;
        
        console.log('🔧 生成 WAV 文件:', {
            duration: `${audioBuffer.duration.toFixed(2)}s`,
            sampleRate: `${sampleRate} Hz`,
            channels: numberOfChannels,
            bitDepth: '16-bit',
            size: `${(totalLength / 1024 / 1024).toFixed(2)} MB`
        });
        
        // 创建 ArrayBuffer
        const arrayBuffer = new ArrayBuffer(totalLength);
        const view = new DataView(arrayBuffer);
        
        // 写入 WAV 文件头
        this.writeWavHeader(view, {
            totalLength,
            dataLength,
            numberOfChannels,
            sampleRate,
            bytesPerSample
        });
        
        // 写入音频数据
        this.writeWavData(view, audioBuffer, headerLength);
        
        return arrayBuffer;
    }
    
    /**
     * 写入 WAV 文件头
     * @param {DataView} view - DataView 对象
     * @param {Object} params - WAV 参数
     */
    writeWavHeader(view, { totalLength, dataLength, numberOfChannels, sampleRate, bytesPerSample }) {
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
        // RIFF 头
        writeString(0, 'RIFF');
        view.setUint32(4, totalLength - 8, true); // 文件大小 - 8
        writeString(8, 'WAVE');
        
        // fmt 块
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true); // fmt 块大小
        view.setUint16(20, 1, true); // PCM 格式
        view.setUint16(22, numberOfChannels, true); // 通道数
        view.setUint32(24, sampleRate, true); // 采样率
        view.setUint32(28, sampleRate * numberOfChannels * bytesPerSample, true); // 字节率
        view.setUint16(32, numberOfChannels * bytesPerSample, true); // 块对齐
        view.setUint16(34, 16, true); // 位深度
        
        // data 块
        writeString(36, 'data');
        view.setUint32(40, dataLength, true); // 数据大小
    }
    
    /**
     * 写入 WAV 音频数据
     * @param {DataView} view - DataView 对象
     * @param {AudioBuffer} audioBuffer - 音频缓冲区
     * @param {number} offset - 数据偏移量
     */
    writeWavData(view, audioBuffer, offset) {
        const length = audioBuffer.length;
        const numberOfChannels = audioBuffer.numberOfChannels;
        
        // 交错写入多通道数据
        for (let i = 0; i < length; i++) {
            for (let channel = 0; channel < numberOfChannels; channel++) {
                const sample = audioBuffer.getChannelData(channel)[i];
                
                // 将浮点数转换为 16-bit 整数
                const intSample = Math.max(-1, Math.min(1, sample)) * 0x7FFF;
                
                view.setInt16(offset, intSample, true);
                offset += 2;
            }
        }
    }
    
    /**
     * 将 ArrayBuffer 转换为 base64 字符串
     * @param {ArrayBuffer} buffer - 二进制数据
     * @returns {string} base64 字符串
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        
        // 分块处理大文件，避免栈溢出
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, chunk);
        }
        
        return btoa(binary);
    }
    
    /**
     * 获取当前音频信息
     * @returns {Object|null} 音频信息
     */
    getAudioInfo() {
        if (!this.audioBuffer) {
            return null;
        }
        
        return {
            duration: this.audioBuffer.duration,
            sampleRate: this.audioBuffer.sampleRate,
            numberOfChannels: this.audioBuffer.numberOfChannels,
            length: this.audioBuffer.length,
            durationFormatted: this.formatTime(this.audioBuffer.duration)
        };
    }
    
    /**
     * 格式化时间显示
     * @param {number} seconds - 秒数
     * @returns {string} 格式化的时间字符串 (MM:SS)
     */
    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '00:00';
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    /**
     * 检查浏览器兼容性
     * @returns {Object} 兼容性检查结果
     */
    static checkCompatibility() {
        const support = {
            webAudio: !!(window.AudioContext || window.webkitAudioContext),
            fileAPI: !!(window.File && window.FileReader),
            arrayBuffer: !!(window.ArrayBuffer),
            dataView: !!(window.DataView),
            uint8Array: !!(window.Uint8Array)
        };
        
        const isSupported = Object.values(support).every(Boolean);
        
        return {
            isSupported,
            support,
            message: isSupported ? 
                '浏览器完全支持音频处理功能' : 
                '浏览器不支持某些音频处理功能，可能无法正常工作'
        };
    }
    
    /**
     * 清理资源
     */
    dispose() {
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
        
        this.audioContext = null;
        this.audioBuffer = null;
        this.isInitialized = false;
        
        console.log('🧹 AudioProcessor 资源已清理');
    }
}