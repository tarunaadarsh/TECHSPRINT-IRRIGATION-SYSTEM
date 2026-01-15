const express = require('express');
const router = express.Router();
const SensorData = require('../models/SensorData');
const Crop = require('../models/Crop');
const IntelligenceService = require('../services/intelligence');
const GeminiService = require('../services/geminiService');
const MLPredictionService = require('../services/mlPrediction');

// Dynamic AI Chatbot Endpoint using Gemini API
router.post('/', async (req, res) => {
    try {
        const { message, context, cropType, language = 'en' } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Get current sensor data for context (filtered by crop if specified)
        let query = {};
        if (cropType && cropType !== 'All') {
            query.cropType = cropType;
        }
        const latestData = await SensorData.findOne(query).sort({ timestamp: -1 });

        // Get latest ML predictions for this crop
        let predictions = null;
        let imageAnalysis = null;

        if (latestData) {
            // Get recent image analysis if available (from context or fetch)
            if (context?.imageAnalysis) {
                imageAnalysis = context.imageAnalysis;
            }

            // Get ML predictions
            try {
                const predictionResult = await MLPredictionService.predict(
                    latestData,
                    imageAnalysis,
                    cropType || latestData.cropType
                );
                predictions = predictionResult.predictions;
            } catch (predError) {
                console.warn('Could not fetch predictions for chatbot:', predError.message);
            }
        }

        // Use Gemini API for intelligent response with language support
        const geminiResponse = await GeminiService.getChatResponse(message, {
            predictions,
            sensorData: latestData,
            cropType: cropType || latestData?.cropType,
            imageAnalysis,
            language  // Pass language to Gemini service
        });

        if (geminiResponse.success) {
            res.json({
                response: geminiResponse.response,
                timestamp: new Date(),
                source: 'gemini'
            });
        } else {
            // Fallback to rule-based response
            const fallbackResponse = await generateAIResponse(message, {
                latestData,
                predictions,
                cropType: cropType || latestData?.cropType
            });

            res.json({
                response: fallbackResponse,
                timestamp: new Date(),
                source: 'fallback'
            });
        }
    } catch (error) {
        console.error('Chatbot API error:', error);
        res.status(500).json({
            error: 'Failed to process message',
            details: error.message
        });
    }
});

async function generateAIResponse(userMessage, context) {
    const lowerInput = userMessage.toLowerCase();
    const { latestData, cropTypes, allCrops } = context;

    // CROP RECOMMENDATION LOGIC
    if (lowerInput.includes('recommend') || lowerInput.includes('suggest') ||
        lowerInput.includes('best crop') || lowerInput.includes('what crop') ||
        lowerInput.includes('which crop') || lowerInput.includes('crop for')) {

        return await generateCropRecommendation(userMessage, latestData, allCrops);
    }

    // IRRIGATION QUERIES
    if (lowerInput.includes('irrigation') || lowerInput.includes('water') ||
        lowerInput.includes('irrigate') || lowerInput.includes('watering')) {

        if (latestData) {
            const crop = await Crop.findOne({ name: latestData.cropType }) || await Crop.findOne();
            const recentHistory = await SensorData.find().sort({ timestamp: -1 }).limit(50);
            const recommendation = await IntelligenceService.generateRecommendation(
                latestData, crop, recentHistory
            );

            if (recommendation.action === 'Irrigate') {
                return `🌊 **Irrigation Recommendation:**\n\nBased on current soil moisture (${latestData.soil?.moisture || 'N/A'}%) and weather conditions, I recommend:\n\n• **Action:** ${recommendation.amount} L/m² for ${recommendation.duration} minutes\n• **Best Time:** ${recommendation.recommendedTime}\n• **Reason:** ${recommendation.reason}\n\n💡 **Tip:** Early morning irrigation (6-7 AM) minimizes evaporation and maximizes water efficiency.`;
            } else {
                return `✅ **Irrigation Status:**\n\n${recommendation.reason}\n\nCurrent soil moisture: ${latestData.soil?.moisture || 'N/A'}%\nTemperature: ${latestData.weather?.temperature || 'N/A'}°C\n\n${recommendation.hoursUntilNext ? `Next check recommended in ${recommendation.hoursUntilNext} hours.` : 'Continue monitoring your dashboard for updates.'}`;
            }
        }
        return `💧 **Irrigation Guidance:**\n\nOptimal irrigation depends on:\n• Soil moisture levels (target: 30-60% for most crops)\n• Weather conditions (temperature, humidity, rainfall forecast)\n• Crop type and growth stage\n• Soil type (sandy, loamy, clay)\n\nFor personalized recommendations, ensure your sensors are connected and check your dashboard for real-time data.`;
    }

    // SOIL & MOISTURE QUERIES
    if (lowerInput.includes('moisture') || lowerInput.includes('soil') ||
        lowerInput.includes('dry') || lowerInput.includes('wet')) {

        if (latestData) {
            const moisture = latestData.soil?.moisture || 0;
            const soilType = latestData.soil?.soilType || 'Unknown';
            const cropType = latestData.cropType || 'Unknown';
            const crop = await Crop.findOne({ name: cropType });

            const idealRange = crop ? `${crop.idealMoistureRange?.min || 30}-${crop.idealMoistureRange?.max || 60}%` : '30-60%';
            const status = moisture < 30 ? '⚠️ LOW' : moisture > 60 ? '✅ ADEQUATE' : '✅ OPTIMAL';

            return `🌱 **Soil Moisture Analysis:**\n\n• **Current Level:** ${moisture.toFixed(1)}% (${status})\n• **Soil Type:** ${soilType}\n• **Crop:** ${cropType}\n• **Ideal Range:** ${idealRange}\n\n${moisture < 30 ? '⚠️ **Action Needed:** Soil moisture is low. Consider irrigation soon to prevent crop stress.' : moisture > 60 ? '✅ **Status:** Moisture levels are adequate. Monitor for over-irrigation.' : '✅ **Status:** Moisture is in optimal range. Continue current irrigation schedule.'}\n\n💡 Different crops have different moisture needs. Check the Crops tab for crop-specific recommendations.`;
        }
        return `🌱 **Soil Moisture Guide:**\n\nOptimal soil moisture varies by crop:\n• **Wheat:** 30-50%\n• **Rice:** 40-70%\n• **Maize:** 35-55%\n• **Tomato:** 35-60%\n• **Sugarcane:** 40-65%\n\n💡 **Tips:**\n• Monitor moisture at root depth\n• Adjust irrigation based on weather\n• Use soil type to determine water retention\n• Check NPK levels for complete soil health`;
    }

    // CROP HEALTH QUERIES
    if (lowerInput.includes('health') || lowerInput.includes('yield') ||
        lowerInput.includes('disease') || lowerInput.includes('problem')) {

        if (latestData) {
            const crop = await Crop.findOne({ name: latestData.cropType }) || await Crop.findOne();
            const yieldHealth = await IntelligenceService.predictYieldHealth(latestData, crop);
            const healthStatus = yieldHealth >= 80 ? '🟢 EXCELLENT' : yieldHealth >= 60 ? '🟡 GOOD' : yieldHealth >= 40 ? '🟠 MODERATE' : '🔴 NEEDS ATTENTION';

            return `🏥 **Crop Health Assessment:**\n\n• **Health Score:** ${yieldHealth}% (${healthStatus})\n• **Crop:** ${latestData.cropType || 'Unknown'}\n• **NPK Levels:**\n  - Nitrogen: ${latestData.soil?.nitrogen || 'N/A'} mg/kg\n  - Phosphorus: ${latestData.soil?.phosphorus || 'N/A'} mg/kg\n  - Potassium: ${latestData.soil?.potassium || 'N/A'} mg/kg\n\n${yieldHealth < 60 ? '⚠️ **Recommendations:**\n• Check irrigation schedule\n• Review NPK nutrient levels\n• Monitor for pests/diseases\n• Consider soil pH testing' : '✅ **Status:** Crop health looks good! Continue monitoring and maintain current practices.'}`;
        }
        return `🏥 **Crop Health Factors:**\n\nCrop health depends on:\n• Soil moisture levels\n• NPK nutrient balance\n• Temperature and humidity\n• Pest and disease presence\n• Soil pH\n• Irrigation schedule\n\n💡 Upload photos of your crops for AI-powered disease detection and health analysis.`;
    }

    // WEATHER QUERIES
    if (lowerInput.includes('weather') || lowerInput.includes('temperature') ||
        lowerInput.includes('temp') || lowerInput.includes('climate')) {

        if (latestData) {
            const temp = latestData.weather?.temperature || 0;
            const humidity = latestData.weather?.humidity || 0;
            const rainChance = latestData.weather?.chanceOfRain || 0;

            return `🌤️ **Weather Conditions:**\n\n• **Temperature:** ${temp}°C\n• **Humidity:** ${humidity}%\n• **Rain Probability:** ${rainChance}%\n\n${temp > 30 ? '🌡️ **High Temperature Alert:** Increased evaporation expected. Monitor moisture levels closely and consider more frequent irrigation.' : temp < 20 ? '❄️ **Cool Conditions:** Reduced evaporation. Irrigation needs may be lower.' : '✅ **Moderate Temperature:** Ideal conditions for most crops.'}\n\n${rainChance > 50 ? '🌧️ **Rain Expected:** Consider delaying irrigation. Natural rainfall may be sufficient.' : ''}`;
        }
        return `🌤️ **Weather Impact on Agriculture:**\n\nWeather significantly affects crop management:\n• **High Temperature:** Increases evaporation → more irrigation needed\n• **Low Temperature:** Reduces growth → adjust fertilization\n• **High Humidity:** Reduces evaporation → less irrigation needed\n• **Rainfall:** Natural irrigation → delay manual watering\n\n💡 Check your dashboard for real-time weather data and forecasts.`;
    }

    // NUTRIENT/fertilizer QUERIES
    if (lowerInput.includes('fertilizer') || lowerInput.includes('nutrient') ||
        lowerInput.includes('npk') || lowerInput.includes('nitrogen') ||
        lowerInput.includes('phosphorus') || lowerInput.includes('potassium')) {

        if (latestData) {
            const n = latestData.soil?.nitrogen || 0;
            const p = latestData.soil?.phosphorus || 0;
            const k = latestData.soil?.potassium || 0;

            return `🧪 **NPK Nutrient Analysis:**\n\n• **Nitrogen (N):** ${n} mg/kg ${n < 40 ? '⚠️ (Low - promotes leaf growth)' : '✅'}\n• **Phosphorus (P):** ${p} mg/kg ${p < 20 ? '⚠️ (Low - supports root development)' : '✅'}\n• **Potassium (K):** ${k} mg/kg ${k < 30 ? '⚠️ (Low - enhances overall health)' : '✅'}\n\n💡 **Recommendations:**\n${n < 40 ? '• Consider nitrogen-rich fertilizer (Urea, Ammonium Nitrate)\n' : ''}${p < 20 ? '• Add phosphorus fertilizer (Superphosphate)\n' : ''}${k < 30 ? '• Supplement with potassium (Potash)\n' : ''}${n >= 40 && p >= 20 && k >= 30 ? '✅ NPK levels are balanced. Continue current fertilization schedule.' : 'Check the Analytics tab for detailed nutrient trends.'}`;
        }
        return `🧪 **NPK Nutrients Explained:**\n\n• **Nitrogen (N):** Promotes leaf growth and green color\n• **Phosphorus (P):** Supports root development and flowering\n• **Potassium (K):** Enhances overall plant health and disease resistance\n\n💡 Balanced NPK levels are crucial for optimal crop growth. Check your Analytics tab for nutrient trends.`;
    }

    // GENERAL AGRICULTURE QUESTIONS
    if (lowerInput.includes('help') || lowerInput.includes('what can') ||
        lowerInput.includes('how to') || lowerInput.includes('guide')) {

        return `🌾 **AI Agriculture Assistant - How Can I Help?**\n\nI can assist you with:\n\n📊 **Data Analysis:**\n• Current soil moisture, temperature, humidity\n• NPK nutrient levels\n• Crop health scores\n• Irrigation recommendations\n\n🌱 **Crop Management:**\n• Crop recommendations based on soil/climate\n• Optimal planting times\n• Growth stage identification\n• Disease detection\n\n💧 **Water Management:**\n• Irrigation scheduling\n• Water savings calculations\n• Anomaly detection (leaks, over-irrigation)\n• Weather-based recommendations\n\n🔍 **Smart Features:**\n• Upload photos for AI analysis\n• Real-time alerts and notifications\n• Historical data trends\n• Multi-crop monitoring\n\n💬 **Try asking:**\n• "Recommend a crop for my soil"\n• "What's my current moisture?"\n• "Do I need to irrigate?"\n• "Analyze my crop health"`;
    }

    // DEFAULT - Contextual response
    const contextualResponse = `🤖 **AI Assistant Response:**\n\nI understand you're asking about "${userMessage}".\n\n${latestData ? `Based on your current data:\n• Crop: ${latestData.cropType || 'Not specified'}\n• Moisture: ${latestData.soil?.moisture?.toFixed(1) || 'N/A'}%\n• Temperature: ${latestData.weather?.temperature || 'N/A'}°C\n\n` : ''}💡 **I can help you with:**\n• Crop recommendations\n• Irrigation scheduling\n• Soil analysis\n• Crop health monitoring\n• Nutrient management\n• Weather impact analysis\n\n**Try asking:**\n• "Recommend a crop for sandy soil"\n• "What's my irrigation status?"\n• "Analyze my crop health"\n• "What nutrients do I need?"`;

    return contextualResponse;
}

async function generateCropRecommendation(userMessage, latestData, allCrops) {
    const lowerInput = userMessage.toLowerCase();

    // Extract soil/climate information from message or use current data
    const soilType = latestData?.soil?.soilType || extractSoilType(userMessage);
    const temperature = latestData?.weather?.temperature || extractTemperature(userMessage);
    const moisture = latestData?.soil?.moisture;

    // Crop recommendation logic
    const recommendations = [];

    // High moisture crops (Rice, Sugarcane)
    if (moisture > 50 || lowerInput.includes('wet') || lowerInput.includes('high moisture')) {
        recommendations.push({
            crop: 'Rice',
            reason: 'Rice thrives in high moisture conditions (40-70%). Perfect for water-rich areas.',
            yield: 'High',
            waterNeed: 'Very High',
            season: 'Kharif (Monsoon)'
        });
        recommendations.push({
            crop: 'Sugarcane',
            reason: 'Sugarcane requires consistent moisture (40-65%). Ideal for tropical/subtropical regions.',
            yield: 'Very High',
            waterNeed: 'High',
            season: 'Year-round'
        });
    }

    // Medium moisture crops (Wheat, Maize, Tomato)
    if (moisture >= 30 && moisture <= 60 || !moisture) {
        recommendations.push({
            crop: 'Wheat',
            reason: 'Wheat is versatile and grows well in moderate moisture (30-50%). Suitable for most soil types.',
            yield: 'High',
            waterNeed: 'Medium',
            season: 'Rabi (Winter)'
        });
        recommendations.push({
            crop: 'Maize',
            reason: 'Maize adapts well to various conditions (35-55% moisture). Good for diverse climates.',
            yield: 'High',
            waterNeed: 'Medium-High',
            season: 'Kharif (Monsoon)'
        });
        recommendations.push({
            crop: 'Tomato',
            reason: 'Tomato requires consistent moisture (35-60%). Great for commercial farming.',
            yield: 'Very High',
            waterNeed: 'Medium',
            season: 'Year-round (with protection)'
        });
    }

    // Low moisture/drought-resistant crops
    if (moisture < 30 || lowerInput.includes('dry') || lowerInput.includes('arid')) {
        recommendations.push({
            crop: 'Millet',
            reason: 'Millet is drought-resistant and requires minimal water. Perfect for arid regions.',
            yield: 'Medium',
            waterNeed: 'Low',
            season: 'Kharif (Monsoon)'
        });
        recommendations.push({
            crop: 'Sorghum',
            reason: 'Sorghum is highly drought-tolerant. Ideal for water-scarce areas.',
            yield: 'Medium-High',
            waterNeed: 'Low',
            season: 'Kharif (Monsoon)'
        });
    }

    // Soil type-based recommendations
    if (soilType) {
        if (soilType.toLowerCase().includes('sandy')) {
            recommendations.push({
                crop: 'Groundnut',
                reason: 'Groundnut grows well in sandy soil with good drainage.',
                yield: 'Medium',
                waterNeed: 'Low-Medium',
                season: 'Kharif (Monsoon)'
            });
        } else if (soilType.toLowerCase().includes('clay')) {
            recommendations.push({
                crop: 'Rice',
                reason: 'Clay soil retains water well, perfect for rice cultivation.',
                yield: 'High',
                waterNeed: 'Very High',
                season: 'Kharif (Monsoon)'
            });
        }
    }

    // Default recommendations if no specific conditions
    if (recommendations.length === 0) {
        recommendations.push(
            {
                crop: 'Wheat',
                reason: 'Versatile crop suitable for most conditions. Moderate water needs (30-50% moisture).',
                yield: 'High',
                waterNeed: 'Medium',
                season: 'Rabi (Winter)'
            },
            {
                crop: 'Maize',
                reason: 'Adaptable crop with good yield potential. Moderate-high water needs (35-55% moisture).',
                yield: 'High',
                waterNeed: 'Medium-High',
                season: 'Kharif (Monsoon)'
            },
            {
                crop: 'Tomato',
                reason: 'High-value crop with excellent commercial potential. Moderate water needs (35-60% moisture).',
                yield: 'Very High',
                waterNeed: 'Medium',
                season: 'Year-round'
            }
        );
    }

    // Format response
    let response = `🌾 **Crop Recommendations Based on Your Conditions:**\n\n`;

    if (latestData) {
        response += `**Current Conditions:**\n`;
        response += `• Soil Type: ${latestData.soil?.soilType || 'Unknown'}\n`;
        response += `• Moisture: ${latestData.soil?.moisture?.toFixed(1) || 'N/A'}%\n`;
        response += `• Temperature: ${latestData.weather?.temperature || 'N/A'}°C\n\n`;
    }

    response += `**Top Recommendations:**\n\n`;

    recommendations.slice(0, 3).forEach((rec, idx) => {
        response += `${idx + 1}. **${rec.crop}** 🌱\n`;
        response += `   • ${rec.reason}\n`;
        response += `   • Yield Potential: ${rec.yield}\n`;
        response += `   • Water Need: ${rec.waterNeed}\n`;
        response += `   • Best Season: ${rec.season}\n\n`;
    });

    response += `💡 **Next Steps:**\n`;
    response += `• Check soil pH and NPK levels\n`;
    response += `• Consider local climate patterns\n`;
    response += `• Plan irrigation system accordingly\n`;
    response += `• Consult local agricultural extension services\n\n`;
    response += `📊 For detailed analysis, check your dashboard's Crops tab.`;

    return response;
}

function extractSoilType(message) {
    const lower = message.toLowerCase();
    if (lower.includes('sandy')) return 'Sandy';
    if (lower.includes('clay')) return 'Clay';
    if (lower.includes('loam')) return 'Loamy';
    return null;
}

function extractTemperature(message) {
    const match = message.match(/(\d+)\s*(?:degree|°|temp)/i);
    return match ? parseInt(match[1]) : null;
}

module.exports = router;

