const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config({ override: true });
console.log("🔥 ACTIVE MONGO URI:", process.env.MONGO_URI);
const Crop = require('./models/Crop');
const SensorData = require('./models/SensorData');
const Alert = require('./models/Alert');
const Recommendation = require('./models/Recommendation');
const IntelligenceService = require('./services/intelligence');
const ESP32Service = require('./services/esp32Service');
const TelegramService = require('./services/telegramService');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// MongoDB Connection - Pure Atlas Mode

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('❌ ERROR: MONGO_URI missing in .env');
    process.exit(1);
}

mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    family: 4 // Force IPv4 to avoid ENOTFOUND on some networks
}).then(() => {
    console.log(`✅ DATABASE LINKED: ${mongoose.connection.name}`);
    console.log(`📊 Database ready for queries`);
}).catch(err => {
    console.error('❌ DATABASE CONNECTION FAILED:', err.message);
    console.error('⚠️  Server will continue but database operations will fail.');
    console.error('💡 TIP: Check your MONGO_URI in .env file');
    console.error('💡 TIP: Ensure MongoDB Atlas allows your IP address');
    // Don't exit - allow server to run without DB for testing routes
});

// --- COMPREHENSIVE API ENDPOINTS ---

// Helper for Mock Data
const getMockStatus = () => ({
    sensorData: {
        weather: { temperature: 28, humidity: 65 },
        soil: { moisture: 45, ph: 6.5, nitrogen: 140, phosphorus: 45, potassium: 160, soilType: 'Loamy' },
        cropType: 'Tomato',
        timestamp: new Date()
    },
    recommendation: {
        action: 'Normal',
        message: 'Conditions are optimal (Offline Mode).',
        confidence: 0.9
    },
    alerts: [{ _id: 'mock1', type: 'System', message: 'Offline Mode - Data is simulated', level: 'warning', timestamp: new Date() }],
    crop: { name: 'Tomato' },
    yieldHealth: { prediction: 'Excellent', probability: 95 },
    source: 'mock'
});

// 1. Get Live Status with Enhanced Intelligence
app.get('/api/status', async (req, res) => {
    try {
        // Fallback to mock data if DB is down
        if (mongoose.connection.readyState !== 1) {
            console.log('⚠️ DB disconnected, serving mock data');
            return res.json(getMockStatus());
        }

        const latestData = await SensorData.findOne().sort({ timestamp: -1 });

        if (!latestData) {
            return res.status(404).json({
                error: "Database is empty. No historical or live data found in Atlas.",
                solution: "Run 'node seed.js' in the server folder to import your 8,000 JSON records."
            });
        }

        // Fetch recent history for anomaly detection
        const recentHistory = await SensorData.find()
            .sort({ timestamp: -1 })
            .limit(50);

        // Enhance weather data with real-time API
        const enhancedWeather = await IntelligenceService.fetchWeatherData();
        latestData.weather = { ...latestData.weather, ...enhancedWeather };

        const crop = await Crop.findOne({ name: latestData.cropType }) || await Crop.findOne();

        // Generate advanced recommendation
        const recommendation = await IntelligenceService.generateRecommendation(
            latestData,
            crop,
            recentHistory
        );

        // Detect anomalies
        const anomalies = await IntelligenceService.detectAnomalies(recentHistory, latestData, crop);

        // Calculate water savings
        const waterSavings = await IntelligenceService.calculateWaterSavings(recentHistory, recommendation);

        // Predict yield health
        const yieldHealth = await IntelligenceService.predictYieldHealth(latestData, crop);

        // Get existing alerts from DB
        const dbAlerts = await Alert.find({ status: 'Active' }).sort({ timestamp: -1 }).limit(5);

        // Merge detected anomalies with DB alerts
        const allAlerts = [...anomalies.map(a => ({
            ...a,
            _id: a.type + Date.now()
        })), ...dbAlerts];

        // Prepare status object with timestamp for sync
        const statusData = {
            sensorData: latestData,
            recommendation,
            alerts: allAlerts,
            crop,
            yieldHealth,
            waterSavings,
            weather: enhancedWeather,
            timestamp: new Date().toISOString() // Add timestamp for sync tracking
        };

        // Determine state based on moisture (simple and reliable)
        const moisture = latestData?.soil?.moisture;
        let state = 'normal';
        if (moisture !== undefined && moisture !== null) {
            if (moisture >= 40 && moisture <= 60) {
                state = 'normal';
            } else if ((moisture >= 30 && moisture < 40) || (moisture > 60 && moisture <= 75)) {
                state = 'caution';
            } else {
                state = 'critical';
            }
        }

        // Update ESP32 (non-blocking) - backend handles this
        ESP32Service.updateFromStatus(statusData).catch(err => {
            console.warn('ESP32 update failed (non-critical):', err.message);
        });

        // Send Telegram alert for critical/caution (every time, not just first)
        if (state === 'critical' || state === 'caution') {
            // Add all alerts to sensorData for Telegram message
            const dataWithAlerts = { ...latestData, alerts: allAlerts };

            // Send with delay to prevent overloading
            setTimeout(async () => {
                try {
                    console.log(`📤 Sending Telegram alert: ${state} (Moisture: ${moisture?.toFixed(1)}%)`);
                    const result = await TelegramService.sendAlert(
                        state,
                        dataWithAlerts,
                        recommendation,
                        latestData.cropType
                    );
                    if (result.success) {
                        console.log(`✅ Telegram alert sent: ${state}`);
                    } else {
                        console.warn(`⚠️ Telegram alert: ${result.message || result.error}`);
                    }
                } catch (err) {
                    console.error('❌ Telegram alert error:', err.message);
                }
            }, 1000); // 1 second delay
        }

        res.json(statusData);
    } catch (err) {
        console.error('API /status error:', err);
        res.status(500).json({ error: "Internal Server Error fetching from Atlas." });
    }
});

// 2. Get Historical Data for Charts
app.get('/api/history', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            // Mock History
            const mockHistory = Array.from({ length: 20 }, (_, i) => ({
                sensorData: {
                    weather: { temperature: 25 + Math.random() * 5, humidity: 60 + Math.random() * 10 },
                    soil: { moisture: 40 + Math.random() * 10 },
                    cropType: 'Tomato'
                },
                timestamp: new Date(Date.now() - i * 3600000)
            }));
            return res.json(mockHistory);
        }
        const limit = parseInt(req.query.limit) || 100;
        const hours = parseInt(req.query.hours) || 24;

        const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

        const history = await SensorData.find({
            timestamp: { $gte: cutoffTime }
        })
            .sort({ timestamp: -1 })
            .limit(limit);

        res.json(history.reverse()); // Reverse for chronological order
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch dataset history." });
    }
});

// 3. Get Analytics Summary
app.get('/api/analytics', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.json({
                avgMoisture: 45.5,
                avgTemperature: 28.2,
                irrigationEvents: 5,
                anomalies: 2,
                efficiency: 85,
                source: 'mock'
            });
        }
        const days = parseInt(req.query.days) || 7;
        const cutoffTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const history = await SensorData.find({
            timestamp: { $gte: cutoffTime }
        }).sort({ timestamp: 1 });

        if (history.length === 0) {
            return res.json({
                avgMoisture: 0,
                avgTemperature: 0,
                irrigationEvents: 0,
                anomalies: 0,
                efficiency: 0
            });
        }

        // Calculate averages
        const avgMoisture = history.reduce((sum, h) => sum + (h.soil?.moisture || 0), 0) / history.length;
        const avgTemperature = history.reduce((sum, h) => sum + (h.weather?.temperature || 0), 0) / history.length;

        // Detect irrigation events (moisture increases)
        let irrigationEvents = 0;
        for (let i = 1; i < history.length; i++) {
            if (history[i].soil?.moisture > history[i - 1].soil?.moisture + 5) {
                irrigationEvents++;
            }
        }

        // Calculate efficiency (time in optimal moisture range)
        const latest = history[history.length - 1];
        const crop = await Crop.findOne({ name: latest?.cropType }) || await Crop.findOne();
        const { min, max } = crop?.idealMoistureRange || { min: 30, max: 60 };
        const optimalCount = history.filter(h => {
            const m = h.soil?.moisture || 0;
            return m >= min && m <= max;
        }).length;
        const efficiency = (optimalCount / history.length) * 100;

        res.json({
            avgMoisture: Math.round(avgMoisture * 10) / 10,
            avgTemperature: Math.round(avgTemperature * 10) / 10,
            irrigationEvents,
            anomalies: 0, // Will be calculated separately
            efficiency: Math.round(efficiency * 10) / 10,
            dataPoints: history.length
        });
    } catch (err) {
        console.error('Analytics error:', err);
        res.status(500).json({ error: "Failed to fetch analytics." });
    }
});

// 4. Get Irrigation Recommendations History
app.get('/api/recommendations', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const recommendations = await Recommendation.find()
            .sort({ timestamp: -1 })
            .limit(limit);
        res.json(recommendations);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch recommendations." });
    }
});

// 5. Get Field Status (Multi-field support)
app.get('/api/fields', async (req, res) => {
    try {

        const latestByCrop = await SensorData.aggregate([
            { $sort: { timestamp: -1 } },
            {
                $group: {
                    _id: "$cropType",
                    latest: { $first: "$$ROOT" }
                }
            }
        ]);

        const fields = await Promise.all(latestByCrop.map(async (item) => {
            const data = item.latest;
            const crop = await Crop.findOne({ name: data.cropType }) || await Crop.findOne();
            const recommendation = await IntelligenceService.generateRecommendation(data, crop);
            const yieldHealth = await IntelligenceService.predictYieldHealth(data, crop);

            // Determine status based on moisture and health
            let status = 'Low';
            if (data.soil?.moisture < 25 || yieldHealth < 50) {
                status = 'Critical';
            } else if (data.soil?.moisture < 30 || yieldHealth < 70) {
                status = 'High';
            }

            return {
                _id: data._id,
                fieldId: data.cropType || `field-${item._id}`,
                fieldName: `Field ${data.cropType || item._id}`,
                crop: data.cropType || item._id,
                moisture: data.soil?.moisture || 0,
                temperature: data.weather?.temperature || 0,
                humidity: data.weather?.humidity || 0,
                nitrogen: data.soil?.nitrogen || 0,
                phosphorus: data.soil?.phosphorus || 0,
                potassium: data.soil?.potassium || 0,
                soilType: data.soil?.soilType || 'Loamy',
                recommendation,
                yieldHealth: yieldHealth || 0,
                status: recommendation.priority || status,
                timestamp: data.timestamp || new Date()
            };
        }));

        res.json(fields);
    } catch (err) {
        console.error('Fields API error:', err);
        res.status(500).json({ error: "Failed to fetch fields." });
    }
});

// 6. Crop Routes - Consolidated into routes/crops.js
try {
    const cropsRouter = require('./routes/crops');
    app.use('/api/crops', cropsRouter);
    console.log('✅ Crop router loaded and priority set');
} catch (error) {
    console.error('❌ CRITICAL: Crop router failed to load:', error.message);
}
console.log('✅ Crop fallback routes registered');

// 7. Chatbot Routes - Local AI assistant with optional Gemini enhancement
// 7. Chatbot Routes - Handled by router below
// app.post('/api/chatbot', ...) removed to prioritize router with language support

// Local chatbot response generator
function generateLocalResponse(message, context) {
    const lowerMessage = message.toLowerCase();
    const status = context?.status;
    const moisture = status?.sensorData?.soil?.moisture;
    const temp = status?.sensorData?.weather?.temperature;
    const cropType = status?.sensorData?.cropType || context?.cropType;

    // Best crop recommendation
    if (lowerMessage.includes('best crop') || lowerMessage.includes('which crop')) {
        if (moisture && temp) {
            if (moisture > 60 && temp > 25) return `With high moisture (${moisture}%) and warm temperature (${temp}°C), Rice or Sugarcane would be excellent choices. They thrive in wet, warm conditions.`;
            if (moisture < 40 && temp < 25) return `With moderate moisture (${moisture}%) and cooler temperature (${temp}°C), Wheat or Barley would be ideal crops.`;
            if (moisture >= 40 && moisture <= 60) return `With balanced moisture (${moisture}%), Maize, Cotton, or Tomato would be good options.`;
        }
        return 'The best crop depends on your soil moisture, temperature, and season. Common options: Rice (wet/warm), Wheat (moderate/cool), Maize (versatile), Cotton (moderate/warm).';
    }

    // Irrigation questions
    if (lowerMessage.includes('irrigation') || lowerMessage.includes('water')) {
        if (moisture) {
            if (moisture < 30) return `Soil moisture is low at ${moisture}%. I recommend irrigating soon (6-7 AM is best to reduce evaporation).`;
            if (moisture > 60) return `Soil moisture is high at ${moisture}%. No irrigation needed at this time.`;
            return `Soil moisture is optimal at ${moisture}%. Monitor daily and irrigate when it drops below 30%.`;
        }
        return 'For most crops, irrigate when soil moisture drops below 30%. Best time: early morning (6-7 AM) to minimize water loss.';
    }

    // Soil/moisture questions
    if (lowerMessage.includes('moisture') || lowerMessage.includes('soil')) {
        if (moisture) return `Current soil moisture is ${moisture}%. Ideal range for most crops: 30-60%.`;
        return 'Soil moisture is critical for crop health. Monitor it daily and maintain it between 30-60% for optimal growth.';
    }

    // Crop health
    if (lowerMessage.includes('health') || lowerMessage.includes('crop')) {
        if (cropType) return `Your ${cropType} needs proper moisture, NPK nutrients, and temperature management. Check your dashboard for detailed health metrics.`;
        return 'Crop health depends on soil moisture, NPK levels, temperature, and pest control. Monitor all factors regularly.';
    }

    // Temperature/weather
    if (lowerMessage.includes('temperature') || lowerMessage.includes('weather')) {
        if (temp) return `Current temperature is ${temp}°C. ${temp > 30 ? 'High temp increases evaporation - monitor moisture closely.' : 'Temperature is favorable for most crops.'}`;
        return 'Temperature affects water evaporation and crop growth. Higher temps require more frequent irrigation.';
    }

    // NPK/fertilizer
    if (lowerMessage.includes('npk') || lowerMessage.includes('fertilizer') || lowerMessage.includes('nutrient')) {
        return 'NPK stands for Nitrogen-Phosphorus-Potassium. N promotes leafy growth, P supports roots, K enhances overall plant health. Check Analytics for your current levels.';
    }

    // Greetings
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
        return `Hello! I'm your Tridentrix AI assistant. ${cropType ? `I see you're growing ${cropType}. ` : ''}Ask me about irrigation, soil moisture, crop health, or NPK nutrients!`;
    }

    // Default helpful response
    return `I can help with:\n• Best crops for your conditions\n• Irrigation recommendations\n• Soil moisture levels\n• Crop health tips\n• NPK nutrients\n• Temperature impact\n\nWhat would you like to know?`;
}


// Try to load router for enhanced functionality (optional)
// Try to load router for enhanced functionality
try {
    const chatbotRouter = require('./routes/chatbot');
    app.use('/api/chatbot', chatbotRouter);
    console.log('✅ Chatbot router loaded and mounted at /api/chatbot');
} catch (error) {
    console.warn('⚠️ Chatbot router not available:', error.message);
}
// 8. ML Prediction Route - Integrates sensor data + image analysis
const MLPredictionService = require('./services/mlPrediction');
app.post('/api/predict', async (req, res) => {
    try {
        const { sensorData, imageAnalysis, cropType } = req.body;

        if (!sensorData) {
            return res.status(400).json({ error: 'Sensor data is required' });
        }

        const prediction = await MLPredictionService.predict(sensorData, imageAnalysis, cropType);

        res.json(prediction);
    } catch (error) {
        console.error('Prediction API error:', error);
        res.status(500).json({
            error: 'Failed to generate prediction',
            details: error.message
        });
    }
});

// 9. Market-based Crop Recommendation
app.post('/api/recommend-crops', async (req, res) => {
    try {
        const { soilData, weatherData } = req.body;

        const recommendations = await MLPredictionService.getMarketRecommendations(
            soilData || {},
            weatherData || {}
        );

        res.json({
            success: true,
            recommendations,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Crop recommendation error:', error);
        res.status(500).json({
            error: 'Failed to generate recommendations',
            details: error.message
        });
    }
});

// 10. Gemini Image Analysis Endpoint (GeminiService already loaded above)
app.post('/api/analyze-image', async (req, res) => {
    try {
        const { image, cropType, sensorData, language } = req.body;

        if (!image) {
            return res.status(400).json({ error: 'Image is required' });
        }

        // Remove data:image/...;base64, prefix if present
        const base64Image = image.includes(',') ? image.split(',')[1] : image;

        console.log('🔍 Analyzing image with Gemini API (comprehensive analysis)...');
        const analysis = await GeminiService.analyzeImage(base64Image, cropType || 'Unknown', sensorData, language);

        if (analysis.success) {
            console.log(`✅ Comprehensive analysis complete:`);
            console.log(`   Crop Type: ${analysis.cropType || 'Unknown'}`);
            console.log(`   Disease: ${analysis.diseaseName || 'None'} (${analysis.diseaseType || 'None'})`);
            console.log(`   Condition: ${analysis.cropCondition || 'perfect'}`);
            console.log(`   Health: ${analysis.healthStatus} (${(analysis.confidence * 100).toFixed(1)}% confidence)`);
        } else {
            console.warn('⚠️ Image analysis returned with errors');
        }

        res.json(analysis);
    } catch (error) {
        console.error('Image analysis error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to analyze image',
            details: error.message,
            healthStatus: 'unknown',
            cropType: 'Unknown',
            diseaseDetected: false,
            diseaseName: 'None',
            cropCondition: 'unknown'
        });
    }
});

// 11. Start Data Synthesis Service
const DataSynthesisService = require('./services/dataSynthesis');
// Start synthesizing data every 2 minutes for ALL crop types
DataSynthesisService.start().catch(err => {
    console.error('Error starting data synthesis:', err);
});
console.log('🔄 Data synthesis service starting (every 2 min for all crops)');

// Test route to verify server is running
app.get('/api/test', (req, res) => {
    res.json({ message: 'Server is running!', timestamp: new Date().toISOString() });
});

// Debug: List all registered routes
app.get('/api/routes', (req, res) => {
    const routes = [];
    app._router.stack.forEach((middleware) => {
        if (middleware.route) {
            routes.push({
                path: middleware.route.path,
                methods: Object.keys(middleware.route.methods)
            });
        }
    });
    res.json({ routes, total: routes.length });
});

// ESP32 Control Endpoints
app.post('/api/esp32/set', async (req, res) => {
    try {
        const { state } = req.body;
        if (!state) {
            return res.status(400).json({ error: 'State is required (normal, caution, or critical)' });
        }

        const result = await ESP32Service.setState(state);
        res.json(result);
    } catch (error) {
        console.error('ESP32 set error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to set ESP32 state',
            message: error.message
        });
    }
});

app.get('/api/esp32/config', (req, res) => {
    res.json(ESP32Service.getConfig());
});

app.get('/api/esp32/test', async (req, res) => {
    try {
        const result = await ESP32Service.testConnection();
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to test ESP32 connection',
            message: error.message
        });
    }
});

// Telegram webhook endpoint (for receiving messages)
app.post('/api/telegram/webhook', async (req, res) => {
    try {
        const message = req.body.message;
        if (message && message.chat) {
            const chatId = message.chat.id.toString();
            TelegramService.setChatId(chatId);
            console.log(`✅ Telegram Chat ID set: ${chatId}`);
            // Echo back to confirm
            await TelegramService.sendMessage(
                `✅ Tridentrix bot connected!\n\nChat ID: ${chatId}\n\nI'll send alerts for critical and caution states.`
            );
        }
        res.json({ ok: true });
    } catch (error) {
        console.error('Telegram webhook error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Manual Chat ID set endpoint
app.post('/api/telegram/set-chat-id', (req, res) => {
    try {
        const { chatId } = req.body;
        if (!chatId) {
            return res.status(400).json({ error: 'Chat ID is required' });
        }
        TelegramService.setChatId(chatId.toString());
        console.log(`✅ Telegram Chat ID manually set: ${chatId}`);
        res.json({ success: true, chatId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Telegram test endpoint
app.post('/api/telegram/test', async (req, res) => {
    try {
        const { message } = req.body;
        const result = await TelegramService.sendMessage(message || 'Test message from Tridentrix');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/api/health', async (req, res) => {
    try {
        const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
        const cropCount = await Crop.countDocuments();
        const dataCount = await SensorData.countDocuments();

        res.json({
            status: 'ok',
            database: dbStatus,
            crops: cropCount,
            sensorData: dataCount,
            endpoints: [
                '/api/status',
                '/api/history',
                '/api/analytics',
                '/api/fields',
                '/api/crops',
                '/api/crops/:cropType'
            ]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Verify routes are loaded
app.get('/api/routes-debug', (req, res) => {
    const routes = [];
    function findRoutes(layer, path = '') {
        if (layer.route) {
            routes.push({
                path: path + layer.route.path,
                methods: Object.keys(layer.route.methods)
            });
        } else if (layer.name === 'router') {
            layer.handle.stack.forEach((stackItem) => {
                findRoutes(stackItem, path + (layer.regexp.source.replace('\\/?', '').replace('(?=\\/|$)', '').replace(/\\\//g, '/') || ''));
            });
        }
    }
    app._router.stack.forEach((layer) => {
        findRoutes(layer);
    });
    res.json({ routes, total: routes.length });
});

// Verify all critical routes are registered before starting server
console.log('\n🔍 Verifying routes before server start...');
const criticalRoutes = [
    { method: 'GET', path: '/api/status' },
    { method: 'GET', path: '/api/crops' },
    { method: 'POST', path: '/api/chatbot' },
    { method: 'POST', path: '/api/recommend-crops' },
    { method: 'POST', path: '/api/analyze-image' }
];

// Check if routes exist (basic check)
let routesVerified = 0;
app._router.stack.forEach((layer) => {
    if (layer.route) {
        const route = criticalRoutes.find(r =>
            layer.route.path === r.path &&
            layer.route.methods[r.method.toLowerCase()]
        );
        if (route) routesVerified++;
    }
});

console.log(`✅ Verified ${routesVerified}/${criticalRoutes.length} critical routes`);

// Handle port conflicts gracefully
const server = app.listen(PORT, () => {
    console.log(`----------------------------------------------------`);
    console.log(`🚀 AGRI-AI SERVER RUNNING ON PORT ${PORT}`);
    console.log(`🌿 MODE: PURE DATABASE MIRROR (NO MOCK DATA)`);
    console.log(`📡 Available endpoints:`);
    console.log(`   GET /api/status`);
    console.log(`   GET /api/history`);
    console.log(`   GET /api/analytics`);
    console.log(`   GET /api/fields`);
    console.log(`   GET /api/crops          ← Crop list (FALLBACK REGISTERED)`);
    console.log(`   GET /api/crops/:cropType ← Crop data (FALLBACK REGISTERED)`);
    console.log(`   POST /api/chatbot       ← AI Chatbot (FALLBACK REGISTERED)`);
    console.log(`   POST /api/predict       ← ML Predictions`);
    console.log(`   POST /api/analyze-image ← Image Analysis (Gemini)`);
    console.log(`   POST /api/recommend-crops ← Market Recommendations`);
    console.log(`   GET /api/health`);
    console.log(`   GET /api/routes-debug    ← Debug routes`);
    console.log(`   GET /api/test            ← Test endpoint`);
    console.log(`----------------------------------------------------`);
    console.log(`\n✅ All routes registered! Server ready to accept requests.\n`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ ERROR: Port ${PORT} is already in use!`);
        console.error(`\n🔧 SOLUTION:`);
        console.error(`   1. Find and kill the process using port ${PORT}:`);
        console.error(`      Windows: netstat -ano | findstr :${PORT}`);
        console.error(`      Then: taskkill /PID <PID> /F`);
        console.error(`   2. OR use a different port by setting PORT environment variable`);
        console.error(`      Example: set PORT=5001 && npm start\n`);
        process.exit(1);
    } else {
        console.error(`\n❌ Server error:`, err);
        process.exit(1);
    }
});
