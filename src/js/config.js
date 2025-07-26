// 应用配置
export const CONFIG = {
    // Workers API 端点
    // 本地测试: 'http://localhost:8787'
    // 生产环境: 'https://audio-editor-api.your-username.workers.dev'
    // 根据环境选择端点
    WORKER_ENDPOINT: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:8787'  // 本地开发
        : '/api/transcribe',       // 生产环境使用同域路径


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
