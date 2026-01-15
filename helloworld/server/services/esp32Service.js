const axios = require('axios');

/**
 * ESP32 Service
 * Sends HTTP requests to ESP32 device to control LEDs and buzzer
 * Based on alert severity and system status
 */
class ESP32Service {
    constructor() {
        // ESP32 IP address - can be configured via environment variable
        this.esp32IP = process.env.ESP32_IP || '192.168.1.100';
        this.esp32Port = process.env.ESP32_PORT || '80';
        this.enabled = process.env.ESP32_ENABLED !== 'false'; // Enabled by default
        this.timeout = 3000; // 3 second timeout
        this.lastState = null; // Track last state to avoid duplicate requests
    }

    /**
     * Get the full ESP32 URL
     */
    getESP32URL() {
        return `http://${this.esp32IP}:${this.esp32Port}`;
    }

    /**
     * Send state to ESP32
     * @param {string} state - 'normal', 'caution', or 'critical'
     * @returns {Promise<Object>} Response object with success status
     */
    async setState(state) {
        if (!this.enabled) {
            console.log('⚠️ ESP32 service is disabled');
            return { success: false, message: 'ESP32 service is disabled' };
        }

        // Validate state
        const validStates = ['normal', 'caution', 'critical'];
        if (!validStates.includes(state)) {
            return { 
                success: false, 
                message: `Invalid state. Must be one of: ${validStates.join(', ')}` 
            };
        }

        // Avoid duplicate requests
        if (this.lastState === state) {
            return { 
                success: true, 
                message: `State already set to ${state}`, 
                skipped: true 
            };
        }

        try {
            const url = `${this.getESP32URL()}/set?state=${state}`;
            console.log(`📡 Sending ESP32 command: ${state} -> ${url}`);

            const response = await axios.get(url, {
                timeout: this.timeout,
                validateStatus: () => true // Accept all status codes
            });

            if (response.status === 200 && response.data === 'OK') {
                this.lastState = state;
                console.log(`✅ ESP32 state set to: ${state}`);
                return {
                    success: true,
                    state,
                    message: `ESP32 state set to ${state}`,
                    timestamp: new Date()
                };
            } else {
                console.warn(`⚠️ ESP32 responded with status ${response.status}: ${response.data}`);
                return {
                    success: false,
                    state,
                    message: `ESP32 responded with status ${response.status}`,
                    timestamp: new Date()
                };
            }
        } catch (error) {
            if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                console.warn(`⚠️ ESP32 not reachable at ${this.esp32IP}. Is it connected?`);
            } else {
                console.error(`❌ ESP32 communication error:`, error.message);
            }
            return {
                success: false,
                state,
                message: error.message || 'Failed to communicate with ESP32',
                error: error.code,
                timestamp: new Date()
            };
        }
    }

    /**
     * Determine ESP32 state based on alert severity
     * @param {Array} alerts - Array of alert objects
     * @param {Object} recommendation - Recommendation object with priority
     * @returns {string} State: 'normal', 'caution', or 'critical'
     */
    determineStateFromAlerts(alerts = [], recommendation = null) {
        // Check for critical alerts
        const criticalAlerts = alerts.filter(a => 
            a.severity === 'Critical' || 
            a.priority === 'Critical' ||
            a.type === 'Leak' ||
            (a.type === 'Dry Stress' && a.severity === 'Critical')
        );

        if (criticalAlerts.length > 0) {
            return 'critical';
        }

        // Check for high priority alerts or recommendation
        const highAlerts = alerts.filter(a => 
            a.severity === 'High' || 
            a.priority === 'High'
        );

        if (highAlerts.length > 0 || recommendation?.priority === 'High') {
            return 'caution';
        }

        // Check recommendation priority
        if (recommendation?.priority === 'Critical') {
            return 'critical';
        }

        if (recommendation?.priority === 'Medium' || recommendation?.action === 'Irrigate') {
            return 'caution';
        }

        // Default to normal
        return 'normal';
    }

    /**
     * Automatically update ESP32 based on system status
     * @param {Object} status - System status object with alerts and recommendation
     * @returns {Promise<Object>} Response object
     */
    async updateFromStatus(status) {
        if (!status) {
            return { success: false, message: 'No status provided' };
        }

        const alerts = status.alerts || [];
        const recommendation = status.recommendation || null;

        const state = this.determineStateFromAlerts(alerts, recommendation);
        return await this.setState(state);
    }

    /**
     * Get current ESP32 configuration
     */
    getConfig() {
        return {
            enabled: this.enabled,
            ip: this.esp32IP,
            port: this.esp32Port,
            url: this.getESP32URL(),
            lastState: this.lastState
        };
    }

    /**
     * Test ESP32 connection
     */
    async testConnection() {
        try {
            const url = `${this.getESP32URL()}/set?state=normal`;
            const response = await axios.get(url, {
                timeout: this.timeout,
                validateStatus: () => true
            });
            return {
                success: response.status === 200,
                status: response.status,
                message: response.status === 200 ? 'ESP32 is reachable' : 'ESP32 responded but with error',
                url
            };
        } catch (error) {
            return {
                success: false,
                message: `Cannot reach ESP32: ${error.message}`,
                error: error.code,
                url: this.getESP32URL()
            };
        }
    }
}

// Export singleton instance
module.exports = new ESP32Service();

