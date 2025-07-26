// 音频剪辑工具主应用
import { FileUploader } from './components/FileUploader.js';
import { AudioProcessor } from './components/AudioProcessor.js';
import { WaveformPlayer } from './components/WaveformPlayer.js';
import { TranscriptionService } from './services/TranscriptionService.js';
import { NotificationManager } from './utils/NotificationManager.js';

class AudioEditorApp {
    constructor() {
        this.fileUploader = null;
        this.audioProcessor = null;
        this.waveformPlayer = null;
        this.transcriptionService = null;
        this.notificationManager = null;
        this.currentAudioBuffer = null;
        this.currentFile = null;
        this.currentTranscriptionData = null;

        this.init();
    }

    async init() {
        console.log('🚀 音频剪辑工具启动中...');

        // 检查浏览器兼容性
        if (!this.checkBrowserSupport()) {
            return;
        }

        // 添加调试信息
        console.log('🔍 开始初始化组件...');

        // 初始化组件
        this.notificationManager = new NotificationManager();
        
        this.fileUploader = new FileUploader({
            onFileSelected: this.handleFileSelected.bind(this),
            onFileValidated: this.handleFileValidated.bind(this),
            onError: this.handleError.bind(this)
        });

        this.audioProcessor = new AudioProcessor({
            onAudioLoaded: this.handleAudioLoaded.bind(this),
            onAudioError: this.handleError.bind(this),
            onProgress: this.handleAudioProgress.bind(this)
        });

        console.log('🔍 初始化 WaveformPlayer...');
        this.waveformPlayer = new WaveformPlayer({
            containerId: 'waveform',
            onRegionCreated: (region) => {
                // region.start, region.end
                // 可以添加到剪辑列表，或实时展示
                console.log('App收到了新选区', region);
            },
            onReady: this.handleWaveformReady.bind(this),
            onPlay: this.handleWaveformPlay.bind(this),
            onPause: this.handleWaveformPause.bind(this),
            onSeek: this.handleWaveformSeek.bind(this),
            onTimeUpdate: this.handleWaveformTimeUpdate.bind(this),
            onError: this.handleError.bind(this)
        });
        console.log('✅ WaveformPlayer 初始化完成');

        this.transcriptionService = new TranscriptionService({
            onTranscriptionStart: this.handleTranscriptionStart.bind(this),
            onTranscriptionComplete: this.handleTranscriptionComplete.bind(this),
            onTranscriptionError: this.handleTranscriptionError.bind(this)
        });

        // 设置本地 Workers 端点
        this.transcriptionService.setWorkerEndpoint('https://api.aicutmp3.online/api/transcribe');

        // 绑定重试按钮
        document.getElementById('retry-transcription').addEventListener('click', () => {
            this.retryTranscription();
        });

        // 绑定播放控制按钮
        document.getElementById('play-pause').addEventListener('click', () => {
            this.togglePlayPause();
        });

        this.notificationManager.showSuccess('应用初始化完成');
        console.log('✅ 音频剪辑工具启动完成');
    }

    checkBrowserSupport() {
        const errors = [];

        // Web Audio API检查
        if (!window.AudioContext && !window.webkitAudioContext) {
            errors.push('Web Audio API');
        }

        // File API检查
        if (!window.File || !window.FileReader) {
            errors.push('File API');
        }

        // Fetch API检查
        if (!window.fetch) {
            errors.push('Fetch API');
        }

        if (errors.length > 0) {
            this.notificationManager.showError(
                `浏览器不支持以下功能: ${errors.join(', ')}。请使用 Chrome 90+、Firefox 88+ 或 Safari 14+`
            );
            return false;
        }

        return true;
    }

    async handleFileSelected(file) {
        console.log('📁 文件已选择:', file.name);
        this.currentFile = file;

        try {
            // 显示主要内容区域
            document.getElementById('main-content').classList.remove('hidden');

            // 步骤1: 开始语音识别（优先处理，让用户更快看到结果）
            console.log('🔍 步骤1: 开始语音识别...');
            this.showLoading('正在进行语音识别...');
            await this.startTranscriptionWithFile(file);
            console.log('✅ 步骤1: 语音识别完成');

            // 步骤2: 解码音频文件（用于波形显示）
            console.log('🔍 步骤2: 开始解码音频文件...');
            this.showLoading('正在解码音频文件...');
            this.currentAudioBuffer = await this.audioProcessor.decodeAudio(file);
            console.log('✅ 步骤2: 音频解码完成', this.currentAudioBuffer);

            // 步骤3: 加载音频到波形播放器
            console.log('🔍 步骤3: 开始渲染波形...');
            this.showLoading('正在渲染波形...');
            
            // 检查波形容器是否存在
            const waveformContainer = document.getElementById('waveform');
            if (!waveformContainer) {
                throw new Error('波形容器 #waveform 不存在');
            }
            console.log('✅ 波形容器存在:', waveformContainer);
            
            await this.waveformPlayer.loadAudio(this.currentAudioBuffer);
            console.log('✅ 步骤3: 波形渲染完成');

        } catch (error) {
            console.error('❌ 文件处理失败:', error);
            console.error('❌ 错误堆栈:', error.stack);
            this.handleError('文件处理失败: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async handleFileValidated(isValid, errorMessage) {
        if (!isValid) {
            this.handleError(errorMessage);
        }
    }



    async decodeAudioFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const audioBuffer = await audioContext.decodeAudioData(e.target.result);

                    // 显示音频时长
                    const duration = this.formatTime(audioBuffer.duration);
                    document.getElementById('file-duration').textContent = duration;

                    resolve(audioBuffer);
                } catch (error) {
                    reject(new Error('音频解码失败，请检查文件格式'));
                }
            };
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsArrayBuffer(file);
        });
    }

    async startTranscriptionWithFile(file) {
        console.log('🎤 开始语音识别（使用原始文件）...');
        await this.transcriptionService.transcribeFromFile(file);
    }

    // 保留原方法，用于需要AudioBuffer的场景（如音频处理）
    async startTranscription(audioBuffer, mimeType) {
        console.log('🎤 开始语音识别（使用AudioBuffer）...');
        await this.transcriptionService.transcribe(audioBuffer, mimeType);
    }

    // 延迟解码：只在需要音频处理时才解码
    async decodeAudioWhenNeeded() {
        if (!this.currentAudioBuffer && this.currentFile) {
            console.log('🔄 按需解码音频文件...');
            this.showLoading('正在解码音频文件...');
            
            try {
                this.currentAudioBuffer = await this.decodeAudioFile(this.currentFile);
                console.log('✅ 音频解码完成');
            } catch (error) {
                console.error('❌ 音频解码失败:', error);
                throw error;
            } finally {
                this.hideLoading();
            }
        }
        return this.currentAudioBuffer;
    }

    handleTranscriptionStart() {
        console.log('🎤 语音识别开始');
        document.getElementById('transcript-loading').classList.remove('hidden');
        document.getElementById('transcript-content').classList.add('hidden');
        document.getElementById('transcript-error').classList.add('hidden');
    }

    handleTranscriptionComplete(transcriptionData) {
        console.log('✅ 语音识别完成:', transcriptionData);
        console.log('🔍 转录数据详情:', JSON.stringify(transcriptionData, null, 2));

        document.getElementById('transcript-loading').classList.add('hidden');
        document.getElementById('transcript-error').classList.add('hidden');

        if (transcriptionData && transcriptionData.segments && transcriptionData.segments.length > 0) {
            console.log('📝 准备显示文本段落:', transcriptionData.segments.length, '个');
            this.currentTranscriptionData = transcriptionData; // 保存转录数据
            this.displayTranscription(transcriptionData);
            document.getElementById('transcript-content').classList.remove('hidden');
            this.notificationManager.showSuccess('语音识别完成，正在加载波形...');
            
            // 转录完成后，开始后台处理波形（不阻塞用户查看转录结果）
            // this.processWaveformInBackground();
        } else {
            console.error('❌ 转录数据格式错误:', transcriptionData);
            this.handleTranscriptionError('未检测到清晰的语音内容');
        }
    }

    handleTranscriptionError(error) {
        console.error('❌ 语音识别失败:', error);
        document.getElementById('transcript-loading').classList.add('hidden');
        document.getElementById('transcript-content').classList.add('hidden');
        document.getElementById('transcript-error').classList.remove('hidden');

        this.notificationManager.showError('语音识别失败: ' + error);
    }

    // 音频处理事件处理
    handleAudioLoaded(audioBuffer, audioInfo) {
        console.log('🎵 音频加载完成:', audioInfo);
        this.currentAudioBuffer = audioBuffer;
        
        // 更新文件时长显示
        document.getElementById('file-duration').textContent = audioInfo.durationFormatted;
        document.getElementById('total-time').textContent = audioInfo.durationFormatted;
    }

    handleAudioProgress(percent, message) {
        console.log(`🔄 音频处理进度: ${percent}% - ${message}`);
        // 可以在这里更新进度条
    }

    // 波形播放器事件处理
    handleWaveformReady(duration) {
        console.log('🌊 波形准备就绪，时长:', duration);
        document.getElementById('total-time').textContent = this.formatTime(duration);
        
        // 启用播放按钮
        const playButton = document.getElementById('play-pause');
        playButton.disabled = false;
        playButton.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    handleWaveformPlay() {
        console.log('▶️ 波形播放开始');
        const playButton = document.getElementById('play-pause');
        playButton.textContent = '⏸️ 暂停';
    }

    handleWaveformPause() {
        console.log('⏸️ 波形播放暂停');
        const playButton = document.getElementById('play-pause');
        playButton.textContent = '▶️ 播放';
    }

    handleWaveformSeek(time) {
        console.log('🎯 波形跳转到:', this.formatTime(time));
        document.getElementById('current-time').textContent = this.formatTime(time);
    }

    handleWaveformTimeUpdate(currentTime, duration) {
        document.getElementById('current-time').textContent = this.formatTime(currentTime);
        
        // 高亮当前播放位置对应的文本段落
        this.highlightCurrentSegment(currentTime);
    }

    // 播放控制
    togglePlayPause() {
        if (this.waveformPlayer) {
            this.waveformPlayer.togglePlayPause();
        }
    }

    // 高亮当前播放位置对应的文本段落
    highlightCurrentSegment(currentTime) {
        if (!this.currentTranscriptionData || !this.currentTranscriptionData.segments) {
            return;
        }

        const segments = document.querySelectorAll('.transcript-segment');
        let activeSegmentIndex = -1;

        // 找到当前时间对应的文本段落
        this.currentTranscriptionData.segments.forEach((segmentData, index) => {
            const startTime = segmentData.startTime || 0;
            const endTime = segmentData.endTime || 0;
            
            if (currentTime >= startTime && currentTime <= endTime) {
                activeSegmentIndex = index;
            }
        });

        // 更新高亮状态
        segments.forEach((segment, index) => {
            if (index === activeSegmentIndex) {
                segment.classList.add('bg-blue-100', 'border-blue-300');
                // 滚动到当前段落
                segment.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                segment.classList.remove('bg-blue-100', 'border-blue-300');
            }
        });
    }

    displayTranscription(transcriptionData) {
        const container = document.getElementById('transcript-text');
        container.innerHTML = '';

        transcriptionData.segments.forEach((segment, index) => {
            const segmentDiv = document.createElement('div');
            segmentDiv.className = 'transcript-segment segment-ripple p-5 mb-4 rounded-xl cursor-pointer fade-in';
            
            // 添加延迟动画效果
            segmentDiv.style.animationDelay = `${index * 0.1}s`;
            
            const text = segment.text || '';
            // 优先使用格式化的时间戳，如果没有则转换秒数
            const startTime = segment.startTimeFormatted || this.formatTimeStamp(segment.startTime || 0);
            const endTime = segment.endTimeFormatted || this.formatTimeStamp(segment.endTime || 0);
            
            segmentDiv.innerHTML = `
                <div class="flex items-start space-x-4">
                    <div class="flex-shrink-0">
                        <span class="segment-number inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold">
                            ${index + 1}
                        </span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between mb-3">
                            <div class="flex items-center space-x-2">
                                <span class="segment-time font-mono text-xs">
                                    ${startTime}
                                </span>
                                <span class="text-gray-400">→</span>
                                <span class="segment-time font-mono text-xs">
                                    ${endTime}
                                </span>
                            </div>
                            <div class="segment-icon">
                                <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m-9-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                            </div>
                        </div>
                        <p class="segment-text leading-relaxed">
                            ${text}
                        </p>
                        <div class="mt-2 text-xs text-gray-500">
                            点击跳转到 ${startTime}
                        </div>
                    </div>
                </div>
            `;

            // 点击跳转功能和波纹效果
            segmentDiv.addEventListener('click', () => {
                console.log(`🎯 点击段落 ${index + 1}: ${text} (${segment.startTime}s - ${segment.endTime}s)`);
                
                // 波纹效果
                segmentDiv.classList.add('active');
                setTimeout(() => {
                    segmentDiv.classList.remove('active');
                }, 600);
                
                // 跳转到音频位置
                if (this.waveformPlayer && segment.startTime !== undefined) {
                    this.waveformPlayer.seekTo(segment.startTime);
                }
            });

            // 鼠标悬停效果
            segmentDiv.addEventListener('mouseenter', () => {
                segmentDiv.style.transform = 'translateX(8px)';
            });

            segmentDiv.addEventListener('mouseleave', () => {
                segmentDiv.style.transform = 'translateX(0)';
            });

            container.appendChild(segmentDiv);
        });

        // 添加总结信息
        if (transcriptionData.segments.length > 0) {
            const summaryDiv = document.createElement('div');
            summaryDiv.className = 'mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg fade-in';
            summaryDiv.style.animationDelay = `${transcriptionData.segments.length * 0.1 + 0.2}s`;
            
            const totalDuration = transcriptionData.totalDuration || 0;
            const minutes = Math.floor(totalDuration / 60);
            const seconds = Math.floor(totalDuration % 60);
            
            summaryDiv.innerHTML = `
                <div class="flex items-center text-blue-800">
                    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span class="text-sm font-medium">
                        转录完成：共 ${transcriptionData.segments.length} 个文本段落，总时长 ${minutes}:${seconds.toString().padStart(2, '0')}
                    </span>
                </div>
            `;
            
            container.appendChild(summaryDiv);
        }
    }

    // 格式化时间戳显示（用于转录结果）
    formatTimeStamp(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    

    async retryTranscription() {
        if (this.currentAudioBuffer && this.currentFile) {
            await this.startTranscription(this.currentAudioBuffer, this.currentFile.type);
        }
    }

    handleError(message) {
        console.error('❌ 错误:', message);
        this.notificationManager.showError(message);
        this.hideLoading();
    }

    showLoading(message = '处理中...') {
        document.getElementById('loading-text').textContent = message;
        document.getElementById('loading-overlay').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.add('hidden');
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    window.audioEditorApp = new AudioEditorApp();
    console.log('🔍 应用实例已暴露到 window.audioEditorApp');
});
