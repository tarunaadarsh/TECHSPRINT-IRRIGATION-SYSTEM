const Recommendation = require('../models/Recommendation');
const Alert = require('../models/Alert');
const axios = require('axios');

/**
 * Intelligence Service
 * Advanced irrigation intelligence with weather-aware predictions, anomaly detection, and water savings.
 */
const IntelligenceService = {

    /**
     * Crop-specific moisture thresholds and water requirements
     */
    cropConfig: {
        'Rice': { min: 40, max: 70, waterPerIrrigation: 50, rootDepth: 20 },
        'Wheat': { min: 30, max: 50, waterPerIrrigation: 35, rootDepth: 30 },
        'Maize': { min: 35, max: 60, waterPerIrrigation: 40, rootDepth: 40 },
        'Tomato': { min: 35, max: 60, waterPerIrrigation: 30, rootDepth: 30 },
        'Cotton': { min: 40, max: 65, waterPerIrrigation: 45, rootDepth: 50 },
        'Sugarcane': { min: 45, max: 70, waterPerIrrigation: 55, rootDepth: 60 },
        'Tobacco': { min: 30, max: 55, waterPerIrrigation: 32, rootDepth: 35 },
        'Default': { min: 30, max: 60, waterPerIrrigation: 40, rootDepth: 30 }
    },

    /**
     * Fetches real-time weather data from OpenWeatherMap API
     */
    async fetchWeatherData(lat = 20.5937, lon = 78.9629) {
        try {
            const apiKey = process.env.OPENWEATHER_API_KEY || 'demo_key';
            if (apiKey === 'demo_key') {
                // Return simulated weather if no API key
                return {
                    temperature: 28,
                    humidity: 65,
                    chanceOfRain: Math.random() * 40,
                    windSpeed: 8 + Math.random() * 10,
                    solarRadiation: 400 + Math.random() * 200,
                    forecast: { nextRainHours: null, nextRainChance: 0 }
                };
            }
            
            const response = await axios.get(
                `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
            );
            
            const forecastResponse = await axios.get(
                `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
            );

            const current = response.data;
            const forecast = forecastResponse.data.list.slice(0, 4); // Next 12 hours
            
            // Calculate chance of rain from forecast
            const rainForecast = forecast.find(f => f.weather[0].main === 'Rain');
            const chanceOfRain = rainForecast ? Math.min(100, (rainForecast.pop || 0) * 100) : 0;
            const nextRainHours = rainForecast ? Math.floor((new Date(rainForecast.dt * 1000) - Date.now()) / (1000 * 60 * 60)) : null;

            return {
                temperature: current.main.temp,
                humidity: current.main.humidity,
                chanceOfRain: Math.round(chanceOfRain),
                windSpeed: current.wind?.speed * 3.6 || 0, // Convert m/s to km/h
                solarRadiation: current.clouds ? (100 - current.clouds.all) * 5 : 500,
                forecast: {
                    nextRainHours,
                    nextRainChance: Math.round(chanceOfRain)
                }
            };
        } catch (error) {
            console.error('Weather API error:', error.message);
            // Fallback to simulated data
            return {
                temperature: 28,
                humidity: 65,
                chanceOfRain: Math.random() * 40,
                windSpeed: 8 + Math.random() * 10,
                solarRadiation: 400 + Math.random() * 200,
                forecast: { nextRainHours: null, nextRainChance: 0 }
            };
        }
    },

    /**
     * Calculates Evapotranspiration (ET) based on weather conditions
     */
    calculateET(weather, cropType) {
        const { temperature, humidity, windSpeed, solarRadiation } = weather;
        const cropCoefficient = this.cropConfig[cropType]?.kc || 0.8;
        
        // Simplified ET calculation (Penman-Monteith simplified)
        const vaporPressureDeficit = (1 - humidity / 100) * 0.611 * Math.exp(17.27 * temperature / (237.3 + temperature));
        const et0 = (0.408 * solarRadiation * vaporPressureDeficit + 0.063 * windSpeed * vaporPressureDeficit) / (temperature + 237.3);
        const etc = et0 * cropCoefficient;
        
        return Math.max(0, etc * 24); // Daily ET in mm/day
    },

    /**
     * Advanced irrigation recommendation with weather-aware predictions
     */
    async generateRecommendation(currentData, crop, historicalData = []) {
        if (!currentData || !currentData.soil) return { action: "Pending", reason: "Collecting initial data..." };

        const { moisture, temp: soilTemp } = currentData.soil;
        const weather = currentData.weather || {};
        const cropType = currentData.cropType || crop?.name || 'Default';
        const config = this.cropConfig[cropType] || this.cropConfig['Default'];
        const { min, max, waterPerIrrigation } = config;

        // Calculate ET and water deficit
        const dailyET = this.calculateET(weather, cropType);
        const moistureDeficit = max - moisture;
        const isBelowThreshold = moisture < min;
        const isAboveThreshold = moisture > max * 1.1; // 10% buffer for over-irrigation

        // Determine irrigation need
        let action = "Maintain";
        let amount = 0;
        let duration = 0;
        let recommendedTime = this.getOptimalIrrigationTime(weather);
        let hoursUntilNext = null;
        let reason = "Moisture levels are optimal.";

        // Over-irrigation detection
        if (isAboveThreshold) {
            action = "Stop";
            reason = `Moisture (${moisture.toFixed(1)}%) exceeds safe range. Risk of waterlogging.`;
            return { action, reason, amount: 0, duration: 0, recommendedTime: "N/A", hoursUntilNext: 24 };
        }

        // Check rain forecast
        const { forecast } = weather;
        const rainInNextHours = forecast?.nextRainHours;
        const rainChance = weather.chanceOfRain || 0;

        if (isBelowThreshold) {
            if (rainInNextHours && rainInNextHours < 6 && rainChance > 50) {
                action = "Delay";
                reason = `Rain expected in ${rainInNextHours} hours (${rainChance}% chance). Delaying irrigation.`;
                hoursUntilNext = rainInNextHours + 2; // Check again after rain
            } else {
                action = "Irrigate";
                // Calculate precise water amount based on deficit and ET
                const deficitVolume = (moistureDeficit / 100) * config.rootDepth * 10; // L/m²
                const etCompensation = dailyET * 0.5; // Compensate for next 12h ET
                amount = Math.max(waterPerIrrigation * 0.5, Math.min(waterPerIrrigation * 1.5, deficitVolume + etCompensation));
                
                // Duration based on typical irrigation rate (1.5 L/m² per minute)
                duration = Math.ceil(amount / 1.5);
                hoursUntilNext = this.calculateNextIrrigationTime(moisture, max, dailyET);
                reason = `Moisture (${moisture.toFixed(1)}%) below threshold (${min}%). Deficit: ${moistureDeficit.toFixed(1)}%.`;
            }
        } else if (moisture < (min + max) / 2) {
            // In lower half of optimal range - prepare for irrigation soon
            action = "Monitor";
            hoursUntilNext = this.calculateNextIrrigationTime(moisture, max, dailyET);
            reason = `Moisture in lower optimal range. Next irrigation in ~${Math.ceil(hoursUntilNext)} hours.`;
        }

        return {
            action,
            reason,
            amount: Math.round(amount * 10) / 10,
            duration,
            recommendedTime,
            hoursUntilNext: hoursUntilNext ? Math.ceil(hoursUntilNext) : null,
            priority: this.getPriority(action, moisture, min, max),
            et: Math.round(dailyET * 10) / 10
        };
    },

    /**
     * Calculates optimal irrigation time (early morning/evening to minimize evaporation)
     */
    getOptimalIrrigationTime(weather) {
        const hour = new Date().getHours();
        const temp = weather.temperature || 28;
        
        // Prefer early morning (5-7 AM) or evening (6-8 PM) when temperature is lower
        if (hour >= 5 && hour < 7) return "06:00 AM";
        if (hour >= 18 && hour < 20) return "07:00 PM";
        if (hour < 5 || hour >= 20) return "06:00 AM (Tomorrow)";
        return "06:00 AM (Tomorrow)";
    },

    /**
     * Calculates hours until next irrigation needed
     */
    calculateNextIrrigationTime(currentMoisture, targetMoisture, dailyET) {
        const deficit = targetMoisture - currentMoisture;
        if (deficit <= 0) return 24;
        
        const hourlyET = dailyET / 24;
        const hoursToThreshold = deficit / (hourlyET / 10); // Approximate
        
        return Math.max(1, Math.min(48, hoursToThreshold));
    },

    /**
     * Gets priority level for recommendation
     */
    getPriority(action, moisture, min, max) {
        if (action === "Irrigate") {
            if (moisture < min * 0.7) return "Critical";
            if (moisture < min) return "High";
            return "Medium";
        }
        if (action === "Stop") return "High";
        return "Low";
    },

    /**
     * Advanced anomaly detection: Leaks, over-irrigation, dry stress
     */
    async detectAnomalies(history, currentData, crop) {
        if (!history || history.length < 5) return [];

        const anomalies = [];
        const latest = currentData || history[history.length - 1];
        const recent = history.slice(-10); // Last 10 records
        
        if (!latest.soil) return anomalies;

        const { moisture } = latest.soil;
        const cropType = latest.cropType || crop?.name || 'Default';
        const config = this.cropConfig[cropType] || this.cropConfig['Default'];
        const { min, max } = config;

        // 1. Leak Detection: Sudden moisture drop not explained by weather
        if (history.length >= 2) {
            const previous = history[history.length - 2];
            const rateOfChange = moisture - previous.soil?.moisture;
            const timeDiff = (new Date(latest.timestamp) - new Date(previous.timestamp)) / (1000 * 60 * 60); // hours
            
            if (rateOfChange < -8 && timeDiff < 2) {
                // Check if weather explains the drop
                const weatherEvaporation = this.calculateET(latest.weather || {}, cropType) * (timeDiff / 24);
                const expectedDrop = weatherEvaporation / 10; // Approximate moisture drop
                
                if (Math.abs(rateOfChange) > Math.abs(expectedDrop) * 2) {
                    anomalies.push({
                        type: 'Leak',
                        severity: 'High',
                        message: `Sudden moisture drop of ${Math.abs(rateOfChange).toFixed(1)}% in ${timeDiff.toFixed(1)} hours. Possible leak or pipe break.`,
                        confidence: Math.min(95, 70 + Math.abs(rateOfChange) * 2),
                        field: latest.field || 'Field 1',
                        timestamp: latest.timestamp || new Date(),
                        status: 'Active'
                    });
                }
            }
        }

        // 2. Dry Stress Detection: Extended period below threshold
        const lowMoistureCount = recent.filter(r => r.soil?.moisture < min).length;
        if (moisture < min * 0.8 && lowMoistureCount >= 5) {
            anomalies.push({
                type: 'Dry Stress',
                severity: moisture < min * 0.6 ? 'Critical' : 'High',
                message: `Soil moisture (${moisture.toFixed(1)}%) below threshold for extended period. Crop stress risk.`,
                confidence: Math.min(95, 75 + (min - moisture) * 2),
                field: latest.field || 'Field 1',
                timestamp: latest.timestamp || new Date(),
                status: 'Active'
            });
        }

        // 3. Over-Irrigation Detection: Moisture consistently above safe range
        const highMoistureCount = recent.filter(r => r.soil?.moisture > max * 1.1).length;
        if (moisture > max * 1.15 && highMoistureCount >= 3) {
            anomalies.push({
                type: 'Over-Irrigation',
                severity: moisture > max * 1.3 ? 'High' : 'Medium',
                message: `Moisture (${moisture.toFixed(1)}%) exceeds safe range. Risk of waterlogging and root rot.`,
                confidence: Math.min(90, 60 + (moisture - max) * 1.5),
                field: latest.field || 'Field 1',
                timestamp: latest.timestamp || new Date(),
                status: 'Active'
            });
        }

        // 4. Abnormal Pattern Detection: Unusual variance
        if (recent.length >= 5) {
            const moistureValues = recent.map(r => r.soil?.moisture).filter(v => v != null);
            const mean = moistureValues.reduce((a, b) => a + b, 0) / moistureValues.length;
            const variance = moistureValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / moistureValues.length;
            const stdDev = Math.sqrt(variance);
            
            if (stdDev > 15) {
                anomalies.push({
                    type: 'Abnormal Pattern',
                    severity: 'Medium',
                    message: `High moisture variability detected (σ=${stdDev.toFixed(1)}%). Possible sensor issue or inconsistent irrigation.`,
                    confidence: Math.min(85, 50 + stdDev * 2),
                    field: latest.field || 'Field 1',
                    timestamp: latest.timestamp || new Date(),
                    status: 'Active'
                });
            }
        }

        return anomalies;
    },

    /**
     * Calculates water savings compared to fixed schedule baseline
     */
    async calculateWaterSavings(historicalData, currentRecommendation) {
        if (!historicalData || historicalData.length < 7) {
            return { saved: 0, percentage: 0, baseline: 0, optimized: 0 };
        }

        // Fixed schedule baseline: irrigate every day with fixed amount
        const days = Math.ceil((new Date(historicalData[0].timestamp) - new Date(historicalData[historicalData.length - 1].timestamp)) / (1000 * 60 * 60 * 24));
        const baselineAmount = 40 * days; // 40 L/m² per day (typical fixed schedule)
        
        // Calculate actual optimized usage from recommendations
        const last7Days = historicalData.slice(0, Math.min(168, historicalData.length)); // Last 7 days (assuming hourly data)
        const irrigationEvents = last7Days.filter((record, index) => {
            if (index === 0) return false;
            const prev = last7Days[index - 1];
            return record.soil?.moisture < prev.soil?.moisture * 0.95; // Detected irrigation event
        }).length;
        
        const avgIrrigationAmount = currentRecommendation?.amount || 35;
        const optimizedAmount = irrigationEvents * avgIrrigationAmount;
        
        const saved = Math.max(0, baselineAmount - optimizedAmount);
        const percentage = baselineAmount > 0 ? (saved / baselineAmount) * 100 : 0;

        return {
            saved: Math.round(saved * 10) / 10,
            percentage: Math.round(percentage * 10) / 10,
            baseline: Math.round(baselineAmount * 10) / 10,
            optimized: Math.round(optimizedAmount * 10) / 10,
            irrigationEvents,
            daysAnalyzed: Math.min(7, days)
        };
    },

    /**
     * Predicts Yield Health (0-100) based on NPK, pH, moisture, and environmental factors.
     */
    async predictYieldHealth(data, crop) {
        if (!data || !data.soil || !data.weather) return 0;
        const { nitrogen, phosphorus, potassium, ph, moisture } = data.soil;
        const { temperature, solarRadiation, humidity } = data.weather;

        // ML weights (Optimized for crop health)
        const weights = { n: 0.15, p: 0.1, k: 0.1, ph: 0.1, moisture: 0.35, temp: 0.1, sun: 0.1 };

        // Normalized scores (0-1)
        const nScore = Math.max(0, Math.min(1, 1 - Math.abs(80 - (nitrogen || 0)) / 80));
        const pScore = Math.max(0, Math.min(1, 1 - Math.abs(45 - (phosphorus || 0)) / 45));
        const kScore = Math.max(0, Math.min(1, 1 - Math.abs(50 - (potassium || 0)) / 50));
        const phScore = ph ? Math.max(0, Math.min(1, 1 - Math.abs(6.5 - ph) / 3)) : 0.7;

        const cropType = data.cropType || crop?.name || 'Default';
        const config = this.cropConfig[cropType] || this.cropConfig['Default'];
        const { min, max } = config;
        
        // Moisture score: optimal range gets 1.0, outside gets penalized
        let moistureScore = 0.5;
        if (moisture >= min && moisture <= max) {
            moistureScore = 1.0;
        } else if (moisture < min) {
            moistureScore = Math.max(0.2, moisture / min);
        } else {
            moistureScore = Math.max(0.3, 1 - (moisture - max) / (max * 0.5));
        }

        // Temperature score: optimal range 20-30°C
        const tempScore = temperature ? Math.max(0, Math.min(1, 1 - Math.abs(25 - temperature) / 15)) : 0.7;
        
        // Solar radiation score
        const sunScore = solarRadiation ? Math.min(1, solarRadiation / 600) : 0.6;

        const finalScore = (
            (nScore * weights.n) +
            (pScore * weights.p) +
            (kScore * weights.k) +
            (phScore * weights.ph) +
            (moistureScore * weights.moisture) +
            (tempScore * weights.temp) +
            (sunScore * weights.sun)
        ) * 100;

        return Math.max(0, Math.min(100, Math.round(finalScore)));
    },

    /**
     * Simulated Leaf Disease Detection
     * In a real app, this would use a CNN model.
     */
    async analyzeLeaf(cropType) {
        const diseases = {
            'Tomato': ['Bacterial Spot', 'Early Blight', 'Late Blight', 'Leaf Mold'],
            'Rice': ['Brown Spot', 'Leaf Blast', 'Neck Blast'],
            'Wheat': ['Brown Rust', 'Yellow Rust', 'Stem Rust']
        };

        const cropDiseases = diseases[cropType] || ['Healthy', 'Mildew', 'Pest Attack'];
        const randomDisease = cropDiseases[Math.floor(Math.random() * cropDiseases.length)];
        const confidence = 85 + Math.random() * 10;
        const impact = 10 + Math.random() * 40;

        return {
            diseaseName: randomDisease,
            confidence: confidence.toFixed(1),
            severity: impact > 30 ? 'Severe' : 'Moderate',
            yieldImpact: impact.toFixed(1),
            treatment: "Apply recommended fungicide and adjust nitrogen levels."
        };
    }
};

module.exports = IntelligenceService;
