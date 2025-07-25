// WaveSurfer 波形播放器组件
export class WaveformPlayer {
    constructor(options = {}) {
        // 配置选项
        this.containerId = options.containerId || 'waveform-container';
        this.height = options.height || 128;
        this.waveColor = options.waveColor || '#007bff';
        this.progressColor = options.progressColor || '#0056b3';
        this.cursorColor = options.cursorColor || '#ff0000';
        this.responsive = options.responsive !== false;
        this.regionsOptions = options.regionsOptions || {
            dragSelection: { slop: 2 } // 允许直接拖拽新建
        };
        
        // WaveSurfer 实例
        this.wavesurfer = null;
        this.isInitialized = false;
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        
        // 回调函数
        this.onReady = options.onReady || (() => {});
        this.onPlay = options.onPlay || (() => {});
        this.onPause = options.onPause || (() => {});
        this.onSeek = options.onSeek || (() => {});
        this.onTimeUpdate = options.onTimeUpdate || (() => {});
        this.onError = options.onError || (() => {});
        
        console.log('🌊 WaveformPlayer 初始化完成');
    }
    
    /**
     * 初始化 WaveSurfer 实例
     */
    async initializeWaveSurfer() {
        if (this.isInitialized) {
            return this.wavesurfer;
        }
        
        try {
            // 动态导入 WaveSurfer
            const WaveSurfer = await this.loadWaveSurfer();
            
            // 检查容器是否存在
            const container = document.getElementById(this.containerId);
            if (!container) {
                throw new Error(`找不到波形容器: ${this.containerId}`);
            }
            
            // 创建 WaveSurfer 实例
            this.wavesurfer = WaveSurfer.create({
                container: container,
                height: this.height,
                waveColor: this.waveColor,
                progressColor: this.progressColor,
                cursorColor: this.cursorColor,
                responsive: this.responsive,
                normalize: true,
                backend: 'WebAudio',
                mediaControls: false,
                interact: true,
                hideScrollbar: true,
                barWidth: 2,
                barGap: 1,
                barRadius: 1,
                // 新增
                plugins: [
                    window.WaveSurfer.regions.create(this.regionsOptions)
                ]
            });
            
            // 绑定事件监听器
            this.bindEvents();
            
            this.isInitialized = true;
            console.log('🌊 WaveSurfer 初始化成功');
            
            return this.wavesurfer;
            
        } catch (error) {
            console.error('❌ WaveSurfer 初始化失败:', error);
            this.onError(`波形显示初始化失败: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * 动态加载 WaveSurfer 库
     */
    async loadWaveSurfer() {
        console.log('🔍 开始加载 WaveSurfer 库...');
        
        try {
            // 尝试从 CDN 加载 WaveSurfer 7.x
            console.log('🔍 尝试从主 CDN 加载 WaveSurfer...');
            const module = await import('https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.esm.js');
            console.log('✅ 主 CDN 加载成功:', module);
            return module.default || module.WaveSurfer || module;
        } catch (error) {
            console.warn('❌ 从主 CDN 加载 WaveSurfer 失败，尝试备用 CDN:', error);
            
            try {
                // 备用 CDN
                console.log('🔍 尝试从备用 CDN 加载 WaveSurfer...');
                const module = await import('https://cdn.skypack.dev/wavesurfer.js@7');
                console.log('✅ 备用 CDN 加载成功:', module);
                return module.default || module.WaveSurfer || module;
            } catch (error2) {
                console.warn('❌ 从备用 CDN 加载失败，检查全局变量:', error2);
                
                // 检查是否已经在页面中加载
                if (window.WaveSurfer) {
                    console.log('✅ 找到全局 WaveSurfer 变量:', window.WaveSurfer);
                    return window.WaveSurfer;
                }
                
                console.error('❌ 所有 WaveSurfer 加载方式都失败了');
                throw new Error('无法加载 WaveSurfer 库，请检查网络连接或手动引入库文件');
            }
        }
    }
    
    /**
     * 绑定 WaveSurfer 事件监听器
     */
    bindEvents() {
        if (!this.wavesurfer) return;
        
        // 波形准备就绪
        this.wavesurfer.on('ready', () => {
            this.duration = this.wavesurfer.getDuration();
            console.log('🌊 波形渲染完成，时长:', this.formatTime(this.duration));
            this.onReady(this.duration);
            this.updateTimeDisplay();
        });
        
        // 播放开始
        this.wavesurfer.on('play', () => {
            this.isPlaying = true;
            console.log('▶️ 音频开始播放');
            this.onPlay();
            this.updatePlayButton();
        });
        
        // 播放暂停
        this.wavesurfer.on('pause', () => {
            this.isPlaying = false;
            console.log('⏸️ 音频暂停播放');
            this.onPause();
            this.updatePlayButton();
        });
        
        // 播放结束
        this.wavesurfer.on('finish', () => {
            this.isPlaying = false;
            console.log('⏹️ 音频播放结束');
            this.onPause();
            this.updatePlayButton();
        });
        
        // 时间更新
        this.wavesurfer.on('audioprocess', (currentTime) => {
            this.currentTime = currentTime;
            this.onTimeUpdate(currentTime, this.duration);
            this.updateTimeDisplay();
        });
        
        // 拖拽跳转
        this.wavesurfer.on('seek', (progress) => {
            const seekTime = progress * this.duration;
            this.currentTime = seekTime;
            console.log('🎯 跳转到时间:', this.formatTime(seekTime));
            this.onSeek(seekTime);
            this.updateTimeDisplay();
        });
        
        // 点击跳转
        this.wavesurfer.on('click', (progress) => {
            const clickTime = progress * this.duration;
            console.log('👆 点击跳转到时间:', this.formatTime(clickTime));
        });
        
        // 错误处理
        this.wavesurfer.on('error', (error) => {
            console.error('❌ WaveSurfer 错误:', error);
            this.onError(`波形播放器错误: ${error.message || error}`);
        });

        // 波形选区相关事件
        this.wavesurfer.on('region-created', region => {
            console.log('🟦 选区创建:', region.start, region.end);
            // 可以通过回调抛给主应用
            if (this.onRegionCreated) this.onRegionCreated(region);
        });

        this.wavesurfer.on('region-updated', region => {
            console.log('🟦 选区更新:', region.start, region.end);
            if (this.onRegionUpdated) this.onRegionUpdated(region);
        });

        this.wavesurfer.on('region-removed', region => {
            console.log('🟦 选区移除:', region.id);
            if (this.onRegionRemoved) this.onRegionRemoved(region);
        });
        
    }
    
    /**
     * 加载音频数据
     * @param {AudioBuffer|Blob|string} audioData - 音频数据
     */
    async loadAudio(audioData) {
        try {
            // 确保 WaveSurfer 已初始化
            await this.initializeWaveSurfer();
            
            console.log('🌊 开始加载音频到波形显示器...');
            
            if (audioData instanceof AudioBuffer) {
                // WaveSurfer 7.x 版本：从 AudioBuffer 加载
                // 需要将 AudioBuffer 转换为 Blob 或 URL
                const wavBlob = this.audioBufferToWavBlob(audioData);
                const url = URL.createObjectURL(wavBlob);
                await this.wavesurfer.load(url);
                // 清理 URL
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            } else if (audioData instanceof Blob) {
                // 从 Blob 加载
                const url = URL.createObjectURL(audioData);
                await this.wavesurfer.load(url);
                // 清理 URL
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            } else if (typeof audioData === 'string') {
                // 从 URL 加载
                await this.wavesurfer.load(audioData);
            } else {
                throw new Error('不支持的音频数据格式');
            }
            
            console.log('✅ 音频加载到波形显示器成功');
            
        } catch (error) {
            console.error('❌ 音频加载失败:', error);
            this.onError(`音频加载失败: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * 播放/暂停切换
     */
    togglePlayPause() {
        if (!this.wavesurfer) {
            console.warn('⚠️ WaveSurfer 未初始化');
            return;
        }
        
        try {
            this.wavesurfer.playPause();
        } catch (error) {
            console.error('❌ 播放/暂停操作失败:', error);
            this.onError(`播放控制失败: ${error.message}`);
        }
    }
    
    /**
     * 播放音频
     */
    play() {
        if (!this.wavesurfer) {
            console.warn('⚠️ WaveSurfer 未初始化');
            return;
        }
        
        try {
            this.wavesurfer.play();
        } catch (error) {
            console.error('❌ 播放失败:', error);
            this.onError(`播放失败: ${error.message}`);
        }
    }
    
    /**
     * 暂停音频
     */
    pause() {
        if (!this.wavesurfer) {
            console.warn('⚠️ WaveSurfer 未初始化');
            return;
        }
        
        try {
            this.wavesurfer.pause();
        } catch (error) {
            console.error('❌ 暂停失败:', error);
            this.onError(`暂停失败: ${error.message}`);
        }
    }
    
    /**
     * 跳转到指定时间
     * @param {number} time - 时间（秒）
     */
    seekTo(time) {
        if (!this.wavesurfer || !this.duration) {
            console.warn('⚠️ WaveSurfer 未准备就绪');
            return;
        }
        
        try {
            const progress = Math.max(0, Math.min(1, time / this.duration));
            this.wavesurfer.seekTo(progress);
            console.log('🎯 跳转到时间:', this.formatTime(time));
        } catch (error) {
            console.error('❌ 跳转失败:', error);
            this.onError(`跳转失败: ${error.message}`);
        }
    }
    
    /**
     * 设置音量
     * @param {number} volume - 音量 (0-1)
     */
    setVolume(volume) {
        if (!this.wavesurfer) {
            console.warn('⚠️ WaveSurfer 未初始化');
            return;
        }
        
        try {
            const clampedVolume = Math.max(0, Math.min(1, volume));
            this.wavesurfer.setVolume(clampedVolume);
            console.log('🔊 音量设置为:', Math.round(clampedVolume * 100) + '%');
        } catch (error) {
            console.error('❌ 音量设置失败:', error);
        }
    }
    
    /**
     * 获取当前播放时间
     * @returns {number} 当前时间（秒）
     */
    getCurrentTime() {
        return this.currentTime;
    }
    
    /**
     * 获取音频总时长
     * @returns {number} 总时长（秒）
     */
    getDuration() {
        return this.duration;
    }
    
    /**
     * 获取播放状态
     * @returns {boolean} 是否正在播放
     */
    isPlayingAudio() {
        return this.isPlaying;
    }
    
    /**
     * 更新播放按钮状态
     */
    updatePlayButton() {
        const playButton = document.getElementById('play-button');
        if (playButton) {
            const icon = playButton.querySelector('i') || playButton;
            if (this.isPlaying) {
                icon.textContent = '⏸️';
                icon.title = '暂停';
                playButton.setAttribute('aria-label', '暂停播放');
            } else {
                icon.textContent = '▶️';
                icon.title = '播放';
                playButton.setAttribute('aria-label', '开始播放');
            }
        }
    }
    
    /**
     * 更新时间显示
     */
    updateTimeDisplay() {
        const currentTimeElement = document.getElementById('current-time');
        const durationElement = document.getElementById('duration-time');
        
        if (currentTimeElement) {
            currentTimeElement.textContent = this.formatTime(this.currentTime);
        }
        
        if (durationElement) {
            durationElement.textContent = this.formatTime(this.duration);
        }
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
     * 设置波形颜色
     * @param {string} waveColor - 波形颜色
     * @param {string} progressColor - 进度颜色
     */
    setColors(waveColor, progressColor) {
        if (!this.wavesurfer) return;
        
        try {
            if (waveColor) {
                this.wavesurfer.setWaveColor(waveColor);
                this.waveColor = waveColor;
            }
            
            if (progressColor) {
                this.wavesurfer.setProgressColor(progressColor);
                this.progressColor = progressColor;
            }
            
            console.log('🎨 波形颜色已更新');
        } catch (error) {
            console.error('❌ 颜色设置失败:', error);
        }
    }
    
    /**
     * 缩放波形
     * @param {number} zoom - 缩放级别
     */
    zoom(zoom) {
        if (!this.wavesurfer) return;
        
        try {
            const clampedZoom = Math.max(1, Math.min(1000, zoom));
            this.wavesurfer.zoom(clampedZoom);
            console.log('🔍 波形缩放级别:', clampedZoom);
        } catch (error) {
            console.error('❌ 缩放失败:', error);
        }
    }
    
    /**
     * 将 AudioBuffer 转换为 WAV Blob
     * @param {AudioBuffer} audioBuffer - 音频缓冲区
     * @returns {Blob} WAV 格式的 Blob
     */
    audioBufferToWavBlob(audioBuffer) {
        const length = audioBuffer.length;
        const numberOfChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const bytesPerSample = 2; // 16-bit PCM
        
        // 计算 WAV 文件大小
        const dataLength = length * numberOfChannels * bytesPerSample;
        const headerLength = 44;
        const totalLength = headerLength + dataLength;
        
        // 创建 ArrayBuffer
        const arrayBuffer = new ArrayBuffer(totalLength);
        const view = new DataView(arrayBuffer);
        
        // 写入 WAV 文件头
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
        // RIFF 头
        writeString(0, 'RIFF');
        view.setUint32(4, totalLength - 8, true);
        writeString(8, 'WAVE');
        
        // fmt 块
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numberOfChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numberOfChannels * bytesPerSample, true);
        view.setUint16(32, numberOfChannels * bytesPerSample, true);
        view.setUint16(34, 16, true);
        
        // data 块
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
        
        return new Blob([arrayBuffer], { type: 'audio/wav' });
    }
    
    /**
     * 获取波形数据
     * @returns {Array} 波形数据数组
     */
    getWaveformData() {
        if (!this.wavesurfer) return null;
        
        try {
            // WaveSurfer 7.x 版本可能没有 exportPCM 方法
            // 尝试获取解码器或其他方式获取数据
            if (this.wavesurfer.getDecodedData) {
                const decodedData = this.wavesurfer.getDecodedData();
                if (decodedData && decodedData.getChannelData) {
                    return decodedData.getChannelData(0);
                }
            }
            
            // 如果没有可用的方法，返回 null
            console.warn('⚠️ 当前 WaveSurfer 版本不支持导出波形数据');
            return null;
        } catch (error) {
            console.error('❌ 获取波形数据失败:', error);
            return null;
        }
    }
    
    /**
     * 检查浏览器兼容性
     * @returns {Object} 兼容性检查结果
     */
    static checkCompatibility() {
        const support = {
            webAudio: !!(window.AudioContext || window.webkitAudioContext),
            canvas: !!window.HTMLCanvasElement,
            audioElement: !!window.HTMLAudioElement,
            mediaSource: !!window.MediaSource,
            webGL: !!window.WebGLRenderingContext
        };
        
        const isSupported = support.webAudio && support.canvas && support.audioElement;
        
        return {
            isSupported,
            support,
            message: isSupported ? 
                '浏览器完全支持波形显示功能' : 
                '浏览器不支持某些波形显示功能，可能影响使用体验'
        };
    }
    
    /**
     * 清理资源
     */
    dispose() {
        if (this.wavesurfer) {
            try {
                this.wavesurfer.destroy();
            } catch (error) {
                console.warn('⚠️ WaveSurfer 销毁时出现警告:', error);
            }
        }
        
        this.wavesurfer = null;
        this.isInitialized = false;
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        
        console.log('🧹 WaveformPlayer 资源已清理');
    }
}