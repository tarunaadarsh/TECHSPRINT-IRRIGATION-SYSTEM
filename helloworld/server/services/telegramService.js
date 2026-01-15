const axios = require('axios');

/**
 * Telegram Bot Service
 * Sends alerts and notifications to Telegram
 * Includes rate limiting to prevent overloading
 */
class TelegramService {
    constructor() {
        // SECURITY: Token must come from environment variable only
        this.BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        if (!this.BOT_TOKEN) {
            console.warn('⚠️ TELEGRAM_BOT_TOKEN not set in environment variables. Telegram service disabled.');
            this.enabled = false;
        } else {
            this.enabled = process.env.TELEGRAM_ENABLED !== 'false';
        }
        // Get Chat ID from env or will be set when bot receives first message
        this.CHAT_ID = process.env.TELEGRAM_CHAT_ID || null;
        this.API_URL = this.BOT_TOKEN ? `https://api.telegram.org/bot${this.BOT_TOKEN}` : null;
        
        // Log configuration status
        if (this.BOT_TOKEN && this.CHAT_ID) {
            console.log(`✅ Telegram service configured (Chat ID: ${this.CHAT_ID})`);
        } else if (this.BOT_TOKEN && !this.CHAT_ID) {
            console.log('⚠️ Telegram token set but Chat ID missing. Set TELEGRAM_CHAT_ID in .env or send message to bot.');
        } else {
            console.log('⚠️ Telegram service not configured');
        }
        
        // Rate limiting
        this.lastMessageTime = {};
        this.messageQueue = [];
        this.processingQueue = false;
        this.MIN_DELAY_MS = 2000; // Minimum 2 seconds between messages
        this.MAX_MESSAGES_PER_MINUTE = 10;
        
        // Track sent alerts to avoid duplicates
        this.sentAlerts = new Map();
        this.ALERT_COOLDOWN_MS = 300000; // 5 minutes cooldown for same alert type
    }

    /**
     * Set chat ID (called when bot receives a message)
     */
    setChatId(chatId) {
        this.CHAT_ID = chatId;
        console.log(`✅ Telegram chat ID set: ${chatId}`);
    }

    /**
     * Format sensor data for Telegram message
     */
    formatSensorData(data) {
        if (!data) return 'N/A';
        
        const soil = data.soil || {};
        const weather = data.weather || {};
        
        let formatted = `📊 *Sensor Data:*\n`;
        formatted += `• Moisture: ${soil.moisture?.toFixed(1) || 'N/A'}%\n`;
        formatted += `• Temperature: ${weather.temperature?.toFixed(1) || 'N/A'}°C\n`;
        formatted += `• Humidity: ${weather.humidity?.toFixed(1) || 'N/A'}%\n`;
        formatted += `• NPK: N${soil.nitrogen || 0} P${soil.phosphorus || 0} K${soil.potassium || 0}\n`;
        
        if (data.cropType) {
            formatted += `• Crop: ${data.cropType}\n`;
        }
        if (soil.soilType) {
            formatted += `• Soil Type: ${soil.soilType}\n`;
        }
        if (soil.ph) {
            formatted += `• pH: ${soil.ph.toFixed(2)}\n`;
        }
        if (weather.windSpeed) {
            formatted += `• Wind Speed: ${weather.windSpeed.toFixed(1)} km/h\n`;
        }
        if (weather.chanceOfRain !== undefined) {
            formatted += `• Rain Chance: ${weather.chanceOfRain}%\n`;
        }
        
        return formatted.trim();
    }

    /**
     * Send message with rate limiting
     */
    async sendMessage(text, options = {}) {
        // Check token first
        if (!this.BOT_TOKEN) {
            console.error('❌ TELEGRAM_BOT_TOKEN not set in .env');
            return { success: false, message: 'Bot token not configured' };
        }

        if (!this.enabled) {
            console.log('⚠️ Telegram service is disabled');
            return { success: false, message: 'Telegram service is disabled' };
        }

        if (!this.API_URL) {
            console.error('❌ Telegram API URL not configured');
            return { success: false, message: 'Telegram API not configured' };
        }

        if (!this.CHAT_ID) {
            console.warn('⚠️ Telegram chat ID not set. Check TELEGRAM_CHAT_ID in .env or send message to bot.');
            return { success: false, message: 'Chat ID not configured' };
        }

        // Check rate limiting
        const now = Date.now();
        const lastMessage = this.lastMessageTime[this.CHAT_ID] || 0;
        const timeSinceLastMessage = now - lastMessage;

        if (timeSinceLastMessage < this.MIN_DELAY_MS) {
            // Queue message
            const delay = this.MIN_DELAY_MS - timeSinceLastMessage;
            return new Promise((resolve) => {
                setTimeout(async () => {
                    resolve(await this.sendMessageDirect(text, options));
                }, delay);
            });
        }

        return await this.sendMessageDirect(text, options);
    }

    /**
     * Send message directly to Telegram
     */
    async sendMessageDirect(text, options = {}) {
        if (!this.API_URL) {
            return { success: false, error: 'Telegram API URL not configured. Check TELEGRAM_BOT_TOKEN in .env' };
        }
        
        try {
            const response = await axios.post(`${this.API_URL}/sendMessage`, {
                chat_id: this.CHAT_ID,
                text: text,
                parse_mode: 'Markdown',
                disable_web_page_preview: true,
                ...options
            }, {
                timeout: 5000
            });

            this.lastMessageTime[this.CHAT_ID] = Date.now();
            console.log('✅ Telegram message sent');
            return { success: true, messageId: response.data.result.message_id };
        } catch (error) {
            console.error('❌ Telegram send error:', error.response?.data || error.message);
            return { 
                success: false, 
                error: error.response?.data?.description || error.message 
            };
        }
    }

    /**
     * Send alert for critical/caution states
     */
    async sendAlert(state, sensorData, recommendation = null, cropName = null) {
        // Use moisture-based key for cooldown (allows updates when moisture changes)
        const moisture = sensorData?.soil?.moisture;
        const alertKey = `${state}-${cropName || 'general'}-${moisture ? Math.floor(moisture) : 'unknown'}`;
        const lastSent = this.sentAlerts.get(alertKey);
        const now = Date.now();

        // Shorter cooldown - allow updates when moisture changes significantly
        if (lastSent && (now - lastSent) < 60000) { // 1 minute cooldown
            console.log(`⏭️ Alert ${alertKey} in cooldown, skipping`);
            return { success: false, message: 'Alert in cooldown' };
        }

        const emoji = state === 'critical' ? '🔴' : state === 'caution' ? '🟡' : '🟢';
        const title = state === 'critical' ? '🚨 CRITICAL ALERT' : state === 'caution' ? '⚠️ CAUTION ALERT' : '✅ NORMAL STATUS';
        
        let message = `${emoji} *${title}*\n\n`;
        
        if (cropName) {
            message += `🌾 *Crop:* ${cropName}\n`;
        }
        
        message += `📊 *Status:* ${state.toUpperCase()}\n`;
        message += `🕐 *Time:* ${new Date().toLocaleString()}\n\n`;
        
        // Format sensor data with all details
        message += this.formatSensorData(sensorData);
        
        // Add alerts if available
        if (sensorData && sensorData.alerts && sensorData.alerts.length > 0) {
            message += `\n\n🚨 *Active Alerts:*\n`;
            sensorData.alerts.slice(0, 3).forEach(alert => {
                message += `• ${alert.type || 'Alert'}: ${alert.message || 'N/A'}\n`;
            });
        }
        
        if (recommendation) {
            message += `\n\n💡 *Recommendation:*\n`;
            message += `• Action: ${recommendation.action || 'N/A'}\n`;
            message += `• Reason: ${recommendation.reason || 'N/A'}\n`;
            if (recommendation.amount) {
                message += `• Water Amount: ${recommendation.amount} L/m²\n`;
            }
            if (recommendation.duration) {
                message += `• Duration: ${recommendation.duration} minutes\n`;
            }
            if (recommendation.recommendedTime) {
                message += `• Best Time: ${recommendation.recommendedTime}\n`;
            }
        }

        console.log(`📤 Sending Telegram alert: ${state} for ${cropName || 'general'}`);
        const result = await this.sendMessage(message);
        
        if (result.success) {
            this.sentAlerts.set(alertKey, now);
            console.log(`✅ Telegram alert sent successfully`);
        } else {
            console.error(`❌ Telegram alert failed: ${result.message || result.error}`);
        }
        
        return result;
    }

    /**
     * Send status update
     */
    async sendStatusUpdate(statusData) {
        const message = `📊 *Tridentrix Status Update*\n\n${this.formatSensorData(statusData.sensorData)}`;
        return await this.sendMessage(message);
    }

    /**
     * Get bot info
     */
    async getBotInfo() {
        try {
            const response = await axios.get(`${this.API_URL}/getMe`);
            return { success: true, bot: response.data.result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Set webhook (optional, for production)
     */
    async setWebhook(url) {
        try {
            const response = await axios.post(`${this.API_URL}/setWebhook`, { url });
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// Export singleton instance
module.exports = new TelegramService();

