const axios = require('axios');
const GeminiService = require('./geminiService');

// ML Prediction Service
// This service integrates with your FastAPI ML model at http://127.0.0.1:5000/predict
// Falls back to Gemini AI if ML API is unavailable
class MLPredictionService {
    constructor() {
        this.ML_API_URL = process.env.ML_API_URL || 'http://127.0.0.1:5000/predict';
    }

    /**
     * Use Gemini AI to generate intelligent predictions
     */
    async geminiBasedPrediction(mlInput, imageAnalysis) {
        try {
            const prompt = `You are an expert agricultural AI. Analyze the following sensor data and image analysis to predict irrigation needs and crop health.

Sensor Data:
- Temperature: ${mlInput.temperature}°C
- Humidity: ${mlInput.humidity}%
- Soil Moisture: ${mlInput.soil_moisture}%
- Soil Type: ${mlInput.soil_type}
- NPK: N=${mlInput.nitrogen}, P=${mlInput.phosphorus}, K=${mlInput.potassium}
- Crop Type: ${mlInput.crop_type}

Image Analysis:
- Health Status: ${imageAnalysis?.healthStatus || 'unknown'}
- Issues: ${imageAnalysis?.issues?.join(', ') || 'none'}

Provide predictions in JSON format:
{
    "irrigation_status": "less|perfect|too_much|no_water_needed",
    "water_amount": number (L/m²),
    "health_status": "normal|caution|critical",
    "confidence": 0.0-1.0,
    "recommendations": ["rec1", "rec2", "rec3"]
}

Rules:
- If humidity > 70%, irrigation_status = "no_water_needed"
- If soil_moisture < 30%, irrigation_status = "less", water_amount = 40 - soil_moisture
- If soil_moisture > 60%, irrigation_status = "too_much"
- If image health = "rotten" or "unhealthy", health_status = "critical"
- If image health = "dry", health_status = "caution"
- Provide actionable recommendations based on the analysis.`;

            const geminiResponse = await GeminiService.generateChatResponse(prompt, {
                predictions: null,
                sensorData: {
                    weather: { temperature: mlInput.temperature, humidity: mlInput.humidity },
                    soil: {
                        moisture: mlInput.soil_moisture,
                        soilType: mlInput.soil_type,
                        nitrogen: mlInput.nitrogen,
                        phosphorus: mlInput.phosphorus,
                        potassium: mlInput.potassium
                    }
                },
                cropType: mlInput.crop_type,
                imageAnalysis
            });

            // Parse Gemini response
            const responseText = geminiResponse.response || '';
            let parsed = this.parseGeminiPrediction(responseText);

            // If parsing failed, use rule-based
            if (!parsed || !parsed.irrigation_status) {
                return this.ruleBasedPrediction(mlInput);
            }

            return parsed;
        } catch (error) {
            console.error('Gemini prediction error:', error);
            return this.ruleBasedPrediction(mlInput);
        }
    }

    parseGeminiPrediction(text) {
        try {
            // Try to extract JSON from response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            // Fall through to rule-based
        }
        return null;
    }

    /**
     * Predict irrigation and crop health based on sensor data + image analysis
     * @param {Object} sensorData - Current sensor readings (weather, soil)
     * @param {Object} imageAnalysis - Image analysis results from Gemini
     * @param {String} cropType - Selected crop type (Rice, Wheat, etc.)
     * @returns {Object} Prediction results with status and recommendations
     */
    async predict(sensorData, imageAnalysis, cropType) {
        try {
            // Prepare input for ML model
            const mlInput = {
                // Sensor Data (synthesized every 15 min)
                temperature: sensorData?.weather?.temperature || 25,
                humidity: sensorData?.weather?.humidity || 50,
                soil_moisture: sensorData?.soil?.moisture || 40,
                soil_type: sensorData?.soil?.soilType || 'Loamy',
                nitrogen: sensorData?.soil?.nitrogen || 40,
                phosphorus: sensorData?.soil?.phosphorus || 20,
                potassium: sensorData?.soil?.potassium || 30,
                crop_type: cropType || 'Wheat',

                // Image Analysis Results (from Gemini)
                image_health_status: imageAnalysis?.healthStatus || 'unknown', // healthy/unhealthy/rotten/dry
                image_confidence: imageAnalysis?.confidence || 0,
                image_labels: imageAnalysis?.labels || [],

                // Additional context
                timestamp: new Date().toISOString()
            };

            // Call ML API
            let mlPrediction;
            try {
                const response = await axios.post(this.ML_API_URL, mlInput, {
                    timeout: 5000 // 5 second timeout
                });
                mlPrediction = response.data;
            } catch (mlError) {
                console.log('⚠️ ML API not available, using Gemini AI for intelligent predictions');
                // Use Gemini AI for intelligent predictions if ML API is unavailable
                mlPrediction = await this.geminiBasedPrediction(mlInput, imageAnalysis);
            }

            // Process ML output and generate insights
            const insights = this.generateInsights(mlPrediction, mlInput, imageAnalysis);

            return {
                success: true,
                predictions: {
                    irrigation: insights.irrigation,
                    health: insights.health,
                    status: insights.status, // caution/normal/critical
                    recommendations: insights.recommendations,
                    waterAmount: insights.waterAmount,
                    urgency: insights.urgency
                },
                input: mlInput,
                timestamp: new Date()
            };
        } catch (error) {
            console.error('ML Prediction error:', error);
            // Fallback prediction
            return this.ruleBasedPrediction({
                ...sensorData,
                image_health_status: imageAnalysis?.healthStatus || 'unknown',
                crop_type: cropType
            });
        }
    }

    /**
     * Rule-based prediction fallback when ML API is unavailable
     */
    ruleBasedPrediction(input) {
        const { temperature, humidity, soil_moisture, image_health_status, crop_type } = input;

        // Determine irrigation need
        let irrigationStatus = 'perfect';
        let waterAmount = 0;
        let urgency = 'normal';

        // High humidity = no irrigation needed
        if (humidity > 70) {
            irrigationStatus = 'no_water_needed';
            waterAmount = 0;
        } else if (soil_moisture < 30) {
            irrigationStatus = 'less';
            // Calculate water amount based on crop type
            const cropType = input.crop_type || 'Wheat';
            waterAmount = this.calculateWaterQuantity(
                cropType,
                soil_moisture,
                { min: 30, max: 50 },
                input.soil_type,
                temperature,
                humidity
            );
            urgency = soil_moisture < 20 ? 'critical' : 'caution';
        } else if (soil_moisture > 60) {
            irrigationStatus = 'too_much';
            waterAmount = 0;
            urgency = 'caution';
        } else {
            irrigationStatus = 'perfect';
            waterAmount = 0;
        }

        // Determine health status from image
        let healthStatus = 'normal';
        if (image_health_status === 'rotten' || image_health_status === 'unhealthy') {
            healthStatus = 'critical';
            urgency = 'critical';
        } else if (image_health_status === 'dry') {
            healthStatus = 'caution';
            urgency = urgency === 'normal' ? 'caution' : urgency;
        } else if (image_health_status === 'healthy') {
            healthStatus = 'normal';
        }

        // Generate recommendations with crop-specific water quantity
        const recommendations = [];
        const cropType = crop_type || 'Wheat';

        if (irrigationStatus === 'less') {
            recommendations.push(`💧 Irrigate ${waterAmount.toFixed(1)} L/m² for ${cropType}. Soil moisture is critically low (${soil_moisture.toFixed(1)}%).`);
            recommendations.push(`⏰ Best time: Early morning (6-7 AM) to minimize evaporation.`);
            recommendations.push(`🌱 Crop-specific: ${cropType} requires ${waterAmount.toFixed(1)} L/m² based on current conditions.`);
        } else if (irrigationStatus === 'too_much') {
            recommendations.push('⚠️ Reduce irrigation. Soil is over-saturated. Risk of root rot.');
            recommendations.push('Monitor soil moisture closely and adjust irrigation schedule.');
        } else if (irrigationStatus === 'no_water_needed') {
            recommendations.push(`✅ No irrigation needed. High humidity (${humidity}%) reduces evaporation.`);
            recommendations.push('Natural moisture retention is sufficient. Monitor for changes.');
        } else {
            recommendations.push('✅ Irrigation levels are optimal. Continue current schedule.');
        }

        if (healthStatus === 'critical') {
            recommendations.push('⚠️ CRITICAL: Crop health issue detected. Apply treatment immediately.');
            recommendations.push('Check for pests, diseases, or nutrient deficiencies.');
        } else if (healthStatus === 'caution') {
            recommendations.push('Monitor crop closely. Early signs of stress detected.');
        }

        return {
            success: true,
            predictions: {
                irrigation: {
                    status: irrigationStatus,
                    message: this.getIrrigationMessage(irrigationStatus, waterAmount, humidity),
                    amount: waterAmount
                },
                health: {
                    status: healthStatus,
                    imageStatus: image_health_status,
                    message: this.getHealthMessage(healthStatus, image_health_status),
                    confidence: 0.7
                },
                status: urgency, // caution/normal/critical
                recommendations: recommendations,
                waterAmount: waterAmount,
                urgency: urgency,
                cropType: cropType
            }
        };
    }

    getIrrigationMessage(status, amount, humidity) {
        const messages = {
            'less': `Water needed: ${amount.toFixed(1)} L/m². Soil moisture is below optimal.`,
            'too_much': 'Over-irrigation detected. Reduce water application.',
            'perfect': 'Irrigation levels are optimal. Continue current schedule.',
            'no_water_needed': `High humidity (${humidity}%) detected. No irrigation needed - natural moisture retention is sufficient.`
        };
        return messages[status] || 'Monitor irrigation levels.';
    }

    /**
     * Calculate water quantity needed based on crop type and current conditions
     */
    calculateWaterQuantity(cropType, currentMoisture, idealMoistureRange, soilType, temperature, humidity) {
        // Crop-specific water requirements (L/m² per irrigation)
        const cropWaterNeeds = {
            'Rice': { base: 50, range: { min: 40, max: 70 } },
            'Wheat': { base: 35, range: { min: 30, max: 50 } },
            'Maize': { base: 40, range: { min: 35, max: 55 } },
            'Tomato': { base: 38, range: { min: 35, max: 60 } },
            'Sugarcane': { base: 45, range: { min: 40, max: 65 } }
        };

        const cropConfig = cropWaterNeeds[cropType] || { base: 35, range: { min: 30, max: 50 } };
        const idealMin = idealMoistureRange?.min || cropConfig.range.min;
        const idealMax = idealMoistureRange?.max || cropConfig.range.max;

        // Calculate deficit
        let waterNeeded = 0;
        if (currentMoisture < idealMin) {
            const deficit = idealMin - currentMoisture;
            // Base water amount adjusted by deficit percentage
            waterNeeded = cropConfig.base * (deficit / idealMin);
        }

        // Adjust for soil type (sandy needs more, clay retains more)
        if (soilType?.toLowerCase().includes('sandy')) {
            waterNeeded *= 1.2; // 20% more for sandy soil
        } else if (soilType?.toLowerCase().includes('clay')) {
            waterNeeded *= 0.8; // 20% less for clay soil
        }

        // Adjust for temperature (higher temp = more evaporation = more water needed)
        if (temperature > 30) {
            waterNeeded *= 1.15; // 15% more in hot weather
        } else if (temperature < 20) {
            waterNeeded *= 0.9; // 10% less in cool weather
        }

        // Adjust for humidity (high humidity = less evaporation = less water needed)
        if (humidity > 70) {
            waterNeeded *= 0.7; // 30% less in high humidity
        } else if (humidity < 40) {
            waterNeeded *= 1.1; // 10% more in low humidity
        }

        return Math.max(0, Math.min(waterNeeded, 100)); // Cap at 100 L/m²
    }

    getHealthMessage(status, imageStatus) {
        const messages = {
            'critical': `CRITICAL: ${imageStatus} condition detected. Immediate action required.`,
            'caution': `CAUTION: ${imageStatus} condition detected. Monitor closely.`,
            'normal': `Healthy crop condition. Continue current practices.`
        };
        return messages[status] || 'Crop health status unknown.';
    }

    generateInsights(mlPrediction, input, imageAnalysis) {
        // Use comprehensive image analysis data
        const cropType = imageAnalysis?.cropType || input.crop_type || 'Unknown';
        const diseaseDetected = imageAnalysis?.diseaseDetected || false;
        const diseaseName = imageAnalysis?.diseaseName || 'None';
        const cropCondition = imageAnalysis?.cropCondition || 'perfect';
        const moistureLevel = imageAnalysis?.moistureLevel || 'optimal';
        const soilLevel = imageAnalysis?.soilLevel || 'good';

        // Determine irrigation status based on moisture
        let irrigationStatus = 'perfect';
        const currentMoisture = input.soil_moisture || 40;

        if (moistureLevel === 'low' || currentMoisture < 30) {
            irrigationStatus = 'less';
        } else if (moistureLevel === 'high' || currentMoisture > 60) {
            irrigationStatus = 'too_much';
        } else {
            irrigationStatus = 'perfect';
        }

        // Determine crop condition assessment
        let conditionAssessment = 'perfect';
        if (cropCondition === 'bad' || diseaseDetected) {
            conditionAssessment = 'bad';
        } else if (cropCondition === 'dry' || moistureLevel === 'low') {
            conditionAssessment = 'dry';
        } else {
            conditionAssessment = 'perfect';
        }

        // Process ML model output
        const mlIrrigationStatus = mlPrediction.irrigation_status || mlPrediction.irrigation?.status;
        const mlWaterAmount = mlPrediction.water_amount || mlPrediction.waterAmount || 0;
        const mlHealthStatus = mlPrediction.health_status || mlPrediction.health?.status || 'normal';
        const confidence = mlPrediction.confidence || imageAnalysis?.confidence || 0.85;

        // Use image analysis irrigation status if available, otherwise use ML
        const finalIrrigationStatus = irrigationStatus || mlIrrigationStatus || 'perfect';
        const finalWaterAmount = mlWaterAmount > 0 ? mlWaterAmount : (irrigationStatus === 'less' ? this.calculateWaterQuantity(cropType, currentMoisture, { min: 30, max: 50 }, input.soil_type, input.temperature, input.humidity) : 0);
        const finalHealthStatus = mlHealthStatus;

        // Determine overall status
        let overallStatus = 'normal';
        if (finalHealthStatus === 'critical' || conditionAssessment === 'bad' || finalIrrigationStatus === 'less') {
            overallStatus = 'critical';
        } else if (finalHealthStatus === 'caution' || conditionAssessment === 'dry' || finalIrrigationStatus === 'too_much') {
            overallStatus = 'caution';
        }

        // Generate comprehensive recommendations
        const recommendations = mlPrediction.recommendations || imageAnalysis?.recommendations || [];

        // Add crop type detection
        if (cropType && cropType !== 'Unknown') {
            recommendations.unshift(`🌾 Detected Crop Type: ${cropType}`);
        }

        // Add disease information
        if (diseaseDetected && diseaseName !== 'None') {
            recommendations.push(`🦠 Disease Detected: ${diseaseName} (${imageAnalysis?.diseaseType || 'Unknown Type'})`);
            recommendations.push(`⚠️ Treatment Required: Apply appropriate ${imageAnalysis?.diseaseType || 'disease'} treatment`);
        }

        // Add irrigation recommendations
        if (finalIrrigationStatus === 'less') {
            recommendations.push(`💧 Irrigate ${finalWaterAmount.toFixed(1)} L/m². Soil moisture is below optimal (${input.soil_moisture}%).`);
            recommendations.push(`📊 Moisture Level: ${moistureLevel} (Current: ${input.soil_moisture}%)`);
        } else if (finalIrrigationStatus === 'too_much') {
            recommendations.push('⚠️ Reduce irrigation. Over-saturation detected.');
            recommendations.push(`📊 Moisture Level: ${moistureLevel} (Current: ${input.soil_moisture}%)`);
        } else if (finalIrrigationStatus === 'no_water_needed') {
            recommendations.push(`✅ No irrigation needed. High humidity (${input.humidity}%) provides sufficient moisture.`);
        } else {
            recommendations.push(`✅ Irrigation Status: Perfect (Moisture: ${input.soil_moisture}%)`);
        }

        // Add crop condition
        recommendations.push(`🌱 Crop Condition: ${conditionAssessment.toUpperCase()} (${imageAnalysis?.reason || 'No issues detected'})`);
        recommendations.push(`🌍 Soil Level: ${soilLevel.toUpperCase()}`);

        if (finalHealthStatus === 'critical' || conditionAssessment === 'bad') {
            recommendations.push('🚨 CRITICAL: Immediate action required. Crop health issue detected.');
            if (diseaseDetected) {
                recommendations.push(`• Treat ${diseaseName} immediately`);
            }
            recommendations.push('• Check for pests or nutrient deficiencies');
            recommendations.push('• Review NPK nutrient levels');
        } else if (finalHealthStatus === 'caution' || conditionAssessment === 'dry') {
            recommendations.push('⚠️ CAUTION: Monitor crop closely. Early signs of stress.');
        }

        return {
            cropType: cropType,
            diseaseDetected: diseaseDetected,
            diseaseName: diseaseName,
            diseaseType: imageAnalysis?.diseaseType || 'None',
            cropCondition: conditionAssessment,
            reason: imageAnalysis?.reason || 'No issues detected',
            moistureLevel: moistureLevel,
            soilLevel: soilLevel,
            irrigation: {
                status: finalIrrigationStatus,
                message: this.getIrrigationMessage(finalIrrigationStatus, finalWaterAmount, input.humidity),
                amount: finalWaterAmount,
                assessment: finalIrrigationStatus === 'less' ? 'less' : finalIrrigationStatus === 'too_much' ? 'more' : 'perfect'
            },
            health: {
                status: finalHealthStatus,
                imageStatus: imageAnalysis?.healthStatus || 'unknown',
                message: this.getHealthMessage(finalHealthStatus, imageAnalysis?.healthStatus || 'unknown'),
                confidence: confidence
            },
            status: overallStatus,
            recommendations: recommendations,
            waterAmount: finalWaterAmount,
            urgency: overallStatus
        };
    }

    /**
     * Get comprehensive crop recommendations based on market demand, climate, and soil pH
     */
    async getMarketRecommendations(soilData, weatherData) {
        const soilPH = soilData?.ph || 6.5;
        const moisture = soilData?.moisture || 40;
        const temp = weatherData?.temperature || 25;
        const humidity = weatherData?.humidity || 60;
        const soilType = soilData?.soilType || 'Loamy';

        // Comprehensive market demand data with seasons
        const marketDemand = {
            'Rice': {
                demand: 'high',
                price: 'high',
                season: 'kharif_jun_oct',
                bestSeason: 'monsoon',
                phRange: { min: 5.5, max: 7.0 },
                tempRange: { min: 20, max: 35 },
                moistureRange: { min: 40, max: 70 }
            },
            'Wheat': {
                demand: 'very_high',
                price: 'high',
                season: 'rabi_oct_mar',
                bestSeason: 'winter',
                phRange: { min: 6.0, max: 7.5 },
                tempRange: { min: 15, max: 25 },
                moistureRange: { min: 30, max: 50 }
            },
            'Maize': {
                demand: 'high',
                price: 'medium',
                season: 'kharif_jun_sep',
                bestSeason: 'monsoon',
                phRange: { min: 5.8, max: 7.0 },
                tempRange: { min: 18, max: 30 },
                moistureRange: { min: 35, max: 55 }
            },
            'Tomato': {
                demand: 'very_high',
                price: 'very_high',
                season: 'year_round_oct_feb',
                bestSeason: 'winter',
                phRange: { min: 6.0, max: 7.0 },
                tempRange: { min: 18, max: 28 },
                moistureRange: { min: 35, max: 60 }
            },
            'Sugarcane': {
                demand: 'high',
                price: 'medium',
                season: 'year_round_feb_may',
                bestSeason: 'spring',
                phRange: { min: 6.0, max: 7.5 },
                tempRange: { min: 20, max: 35 },
                moistureRange: { min: 45, max: 70 }
            },
            'Cotton': {
                demand: 'high',
                price: 'medium',
                season: 'kharif_jun_dec',
                bestSeason: 'monsoon',
                phRange: { min: 5.5, max: 8.0 },
                tempRange: { min: 21, max: 30 },
                moistureRange: { min: 40, max: 65 }
            },
            'Potato': {
                demand: 'very_high',
                price: 'high',
                season: 'rabi_oct_feb',
                bestSeason: 'winter',
                phRange: { min: 4.8, max: 5.5 },
                tempRange: { min: 15, max: 25 },
                moistureRange: { min: 30, max: 50 }
            }
        };

        // Filter crops based on conditions
        const suitableCrops = [];

        for (const [crop, market] of Object.entries(marketDemand)) {
            const suitability = this.calculateSuitability(crop, soilData, weatherData, market);
            if (suitability.score > 50) {
                suitableCrops.push({
                    crop,
                    suitability: suitability.score,
                    market: {
                        demand: market.demand,
                        price: market.price,
                        season: market.season,
                        bestSeason: market.bestSeason
                    },
                    reason: suitability.reason,
                    reasons: suitability.structuredReasons,
                    phMatch: suitability.phMatch,
                    climateMatch: suitability.climateMatch
                });
            }
        }

        // Sort by market demand + suitability
        suitableCrops.sort((a, b) => {
            const demandScore = { 'very_high': 30, 'high': 20, 'medium': 10, 'low': 5 };
            const aScore = a.suitability + demandScore[a.market.demand] + (a.phMatch ? 10 : 0) + (a.climateMatch ? 10 : 0);
            const bScore = b.suitability + demandScore[b.market.demand] + (b.phMatch ? 10 : 0) + (b.climateMatch ? 10 : 0);
            return bScore - aScore;
        });

        return suitableCrops.slice(0, 5); // Top 5 recommendations
    }

    calculateSuitability(crop, soilData, weatherData, marketData) {
        let score = 40;
        const reasons = [];
        const structuredReasons = [];
        let phMatch = false;
        let climateMatch = false;

        const moisture = soilData?.moisture || 40;
        const temp = weatherData?.temperature || 25;
        const humidity = weatherData?.humidity || 60;
        const soilType = soilData?.soilType || 'Loamy';
        const ph = soilData?.ph || 6.5;

        if (!marketData) {
            // Fallback if market data not provided
            marketData = {
                phRange: { min: 6.0, max: 7.0 },
                tempRange: { min: 20, max: 30 },
                moistureRange: { min: 30, max: 50 }
            };
        }

        // pH matching
        if (ph >= marketData.phRange.min && ph <= marketData.phRange.max) {
            score += 20;
            phMatch = true;
            reasons.push(`Soil pH (${ph.toFixed(1)}) is optimal for ${crop}`);
            structuredReasons.push({ key: 'market.reasons.phOptimal', params: { val: ph.toFixed(1), crop } });
        } else {
            reasons.push(`Soil pH (${ph.toFixed(1)}) may need adjustment for ${crop}`);
            structuredReasons.push({ key: 'market.reasons.phAdjust', params: { val: ph.toFixed(1), crop } });
        }

        // Temperature matching
        if (temp >= marketData.tempRange.min && temp <= marketData.tempRange.max) {
            score += 20;
            climateMatch = true;
            reasons.push(`Temperature (${temp}°C) is ideal for ${crop}`);
            structuredReasons.push({ key: 'market.reasons.tempIdeal', params: { val: temp, crop } });
        } else if (temp < marketData.tempRange.min) {
            reasons.push(`Temperature (${temp}°C) is below optimal for ${crop}`);
            structuredReasons.push({ key: 'market.reasons.tempLow', params: { val: temp, crop } });
        } else {
            reasons.push(`Temperature (${temp}°C) is above optimal for ${crop}`);
            structuredReasons.push({ key: 'market.reasons.tempHigh', params: { val: temp, crop } });
        }

        // Moisture matching
        if (moisture >= marketData.moistureRange.min && moisture <= marketData.moistureRange.max) {
            score += 20;
            reasons.push(`Moisture (${moisture}%) is suitable for ${crop}`);
            structuredReasons.push({ key: 'market.reasons.moistureSuitable', params: { val: moisture, crop } });
        } else if (moisture < marketData.moistureRange.min) {
            reasons.push(`Moisture (${moisture}%) is low for ${crop}, irrigation needed`);
            structuredReasons.push({ key: 'market.reasons.moistureLow', params: { val: moisture, crop } });
        } else {
            reasons.push(`Moisture (${moisture}%) is high for ${crop}, may need drainage`);
            structuredReasons.push({ key: 'market.reasons.moistureHigh', params: { val: moisture, crop } });
        }

        // Soil type matching
        if (crop === 'Rice' && soilType === 'Clay') {
            score += 10;
            reasons.push('Clay soil is ideal for Rice');
            structuredReasons.push({ key: 'market.reasons.soilIdeal', params: { soil: soilType, crop } });
        } else if (crop === 'Wheat' && (soilType === 'Loamy' || soilType === 'Sandy Loam')) {
            score += 10;
            reasons.push(`${soilType} soil is suitable for Wheat`);
            structuredReasons.push({ key: 'market.reasons.soilSuitable', params: { soil: soilType, crop } });
        } else if (crop === 'Maize' && (soilType === 'Loamy' || soilType === 'Sandy Loam')) {
            score += 10;
            reasons.push(`${soilType} soil is suitable for Maize`);
            structuredReasons.push({ key: 'market.reasons.soilSuitable', params: { soil: soilType, crop } });
        }

        // Humidity consideration
        if (humidity >= 50 && humidity <= 80) {
            score += 5;
            reasons.push(`Humidity (${humidity}%) is favorable`);
            structuredReasons.push({ key: 'market.reasons.humidityFavorable', params: { val: humidity } });
        }

        return {
            score: Math.min(100, score),
            reason: reasons.join('. '),
            structuredReasons,
            phMatch,
            climateMatch
        };
    }
}

module.exports = new MLPredictionService();

