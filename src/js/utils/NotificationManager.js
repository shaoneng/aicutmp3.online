// 通知管理器
export class NotificationManager {
    constructor() {
        this.notification = document.getElementById('notification');
        this.notificationText = document.getElementById('notification-text');
        this.currentTimeout = null;
    }
    
    showSuccess(message) {
        this.show(message, 'success');
    }
    
    showError(message) {
        this.show(message, 'error');
    }
    
    showInfo(message) {
        this.show(message, 'info');
    }
    
    showWarning(message) {
        this.show(message, 'warning');
    }
    
    show(message, type = 'info') {
        // 清除之前的定时器
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
        }
        
        // 设置消息内容
        this.notificationText.textContent = message;
        
        // 清除之前的样式类
        this.notification.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg';
        
        // 根据类型添加样式
        switch (type) {
            case 'success':
                this.notification.classList.add('bg-green-500', 'text-white');
                break;
            case 'error':
                this.notification.classList.add('bg-red-500', 'text-white');
                break;
            case 'warning':
                this.notification.classList.add('bg-yellow-500', 'text-white');
                break;
            case 'info':
            default:
                this.notification.classList.add('bg-blue-500', 'text-white');
                break;
        }
        
        // 显示通知
        this.notification.classList.remove('hidden');
        
        // 自动隐藏
        const duration = type === 'error' ? 5000 : 3000; // 错误消息显示更久
        this.currentTimeout = setTimeout(() => {
            this.hide();
        }, duration);
        
        console.log(`📢 ${type.toUpperCase()}: ${message}`);
    }
    
    hide() {
        this.notification.classList.add('hidden');
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
            this.currentTimeout = null;
        }
    }
}