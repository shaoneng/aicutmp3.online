// 文件上传组件
export class FileUploader {
    constructor(options = {}) {
        this.maxSize = 20 * 1024 * 1024; // 20MB
        this.maxDuration = 600; // 10分钟
        this.supportedTypes = ['audio/mp3', 'audio/wav', 'audio/mpeg'];
        
        // 回调函数
        this.onFileSelected = options.onFileSelected || (() => {});
        this.onFileValidated = options.onFileValidated || (() => {});
        this.onError = options.onError || (() => {});
        
        this.init();
    }
    
    init() {
        this.setupDropZone();
        this.setupFileInput();
        console.log('📁 FileUploader 初始化完成');
    }
    
    setupDropZone() {
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        
        // 拖拽事件处理
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
        
        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFile(files[0]);
            }
        });
        
        // 点击上传区域触发文件选择
        dropZone.addEventListener('click', () => {
            fileInput.click();
        });
    }
    
    setupFileInput() {
        const fileInput = document.getElementById('file-input');
        const fileSelectBtn = document.getElementById('file-select');
        
        // 文件选择按钮
        fileSelectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });
        
        // 文件输入变化
        fileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files.length > 0) {
                this.handleFile(files[0]);
            }
        });
    }
    
    async handleFile(file) {
        console.log('📁 处理文件:', file.name, file.type, file.size);
        
        try {
            // 显示文件加载进度条
            this.showFileLoadingProgress();
            
            // 基本验证
            this.updateLoadingProgress(20, '正在验证文件格式...');
            const validation = await this.validateFile(file);
            
            if (!validation.isValid) {
                this.hideFileLoadingProgress();
                this.onFileValidated(false, validation.error);
                return;
            }
            
            // 显示文件基本信息
            this.updateLoadingProgress(60, '正在加载音频文件...');
            await this.displayFileInfo(file);
            
            // 验证通过，通知主应用
            this.updateLoadingProgress(100, '文件加载完成');
            this.onFileValidated(true);
            
            // 延迟隐藏进度条，让用户看到完成状态
            setTimeout(() => {
                this.hideFileLoadingProgress();
                this.onFileSelected(file);
            }, 500);
            
        } catch (error) {
            console.error('文件处理错误:', error);
            this.hideFileLoadingProgress();
            this.onError('文件处理失败: ' + error.message);
        }
    }
    
    async validateFile(file) {
        // 1. 格式验证
        if (!this.isValidFormat(file)) {
            return {
                isValid: false,
                error: '不支持的音频格式，请选择 MP3 或 WAV 格式的文件'
            };
        }
        
        // 2. 大小验证
        if (file.size > this.maxSize) {
            return {
                isValid: false,
                error: `文件过大，请选择小于 ${this.formatFileSize(this.maxSize)} 的文件`
            };
        }
        
        // 3. 时长验证（需要解码音频）
        try {
            const duration = await this.getAudioDuration(file);
            if (duration > this.maxDuration) {
                return {
                    isValid: false,
                    error: `音频时长过长，请选择小于 ${Math.floor(this.maxDuration / 60)} 分钟的音频文件`
                };
            }
        } catch (error) {
            console.warn('无法获取音频时长，跳过时长验证:', error);
            // 如果无法获取时长，不阻止上传，让后续处理来判断
        }
        
        return { isValid: true };
    }
    
    isValidFormat(file) {
        // 检查 MIME 类型
        if (this.supportedTypes.includes(file.type)) {
            return true;
        }
        
        // 检查文件扩展名（备用方案）
        const fileName = file.name.toLowerCase();
        const validExtensions = ['.mp3', '.wav'];
        return validExtensions.some(ext => fileName.endsWith(ext));
    }
    
    async getAudioDuration(file) {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            const url = URL.createObjectURL(file);
            
            audio.addEventListener('loadedmetadata', () => {
                URL.revokeObjectURL(url);
                resolve(audio.duration);
            });
            
            audio.addEventListener('error', () => {
                URL.revokeObjectURL(url);
                reject(new Error('无法读取音频文件'));
            });
            
            // 设置超时
            setTimeout(() => {
                URL.revokeObjectURL(url);
                reject(new Error('获取音频信息超时'));
            }, 10000);
            
            audio.src = url;
        });
    }
    
    showFileLoadingProgress() {
        // 创建或显示进度条容器
        let progressContainer = document.getElementById('file-loading-progress');
        if (!progressContainer) {
            progressContainer = this.createProgressContainer();
        }
        progressContainer.classList.remove('hidden');
        
        // 重置进度条
        const progressBar = progressContainer.querySelector('.progress-bar');
        const progressText = progressContainer.querySelector('.progress-text');
        progressBar.style.width = '0%';
        progressText.textContent = '准备加载文件...';
    }
    
    updateLoadingProgress(percent, message) {
        const progressContainer = document.getElementById('file-loading-progress');
        if (progressContainer) {
            const progressBar = progressContainer.querySelector('.progress-bar');
            const progressText = progressContainer.querySelector('.progress-text');
            const progressPercent = progressContainer.querySelector('.progress-percent');
            
            progressBar.style.width = `${percent}%`;
            progressText.textContent = message;
            progressPercent.textContent = `${percent}%`;
        }
    }
    
    hideFileLoadingProgress() {
        const progressContainer = document.getElementById('file-loading-progress');
        if (progressContainer) {
            progressContainer.classList.add('hidden');
        }
    }
    
    createProgressContainer() {
        const container = document.createElement('div');
        container.id = 'file-loading-progress';
        container.className = 'hidden mt-4 p-4 bg-white rounded-lg shadow border';
        
        container.innerHTML = `
            <div class="flex items-center mb-2">
                <div class="loading-spinner mr-3"></div>
                <span class="progress-text text-gray-700 font-medium">准备加载文件...</span>
                <span class="progress-percent ml-auto text-sm text-gray-500">0%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="progress-bar bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out" style="width: 0%"></div>
            </div>
        `;
        
        // 插入到上传区域后面
        const uploadSection = document.getElementById('upload-section');
        uploadSection.appendChild(container);
        
        return container;
    }
    
    async displayFileInfo(file) {
        // 获取文件基本信息
        const fileInfo = {
            name: file.name,
            size: this.formatFileSize(file.size),
            type: file.type || '未知格式'
        };
        
        // 尝试获取音频时长
        try {
            const duration = await this.getAudioDuration(file);
            fileInfo.duration = this.formatTime(duration);
        } catch (error) {
            console.warn('无法获取音频时长:', error);
            fileInfo.duration = '未知';
        }
        
        // 更新文件信息显示
        document.getElementById('file-name').textContent = fileInfo.name;
        document.getElementById('file-size').textContent = fileInfo.size;
        document.getElementById('file-duration').textContent = fileInfo.duration;
        
        // 显示文件信息区域
        document.getElementById('file-info').classList.remove('hidden');
        
        console.log('📁 文件信息已显示:', fileInfo);
        return fileInfo;
    }
    
    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '未知';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}