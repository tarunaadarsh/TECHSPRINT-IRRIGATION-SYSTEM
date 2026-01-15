const axios = require('axios');

// Gemini API Service for Image Analysis and Chatbot
class GeminiService {
    constructor() {
        this.API_KEY = process.env.GEMINI_API || process.env.GEMINI_API_KEY || 'AIzaSyABSvEhE-AvT4O_Y-f3YDoi6mofoR7jbWc';
        // Updated Gemini API endpoints - using gemini-1.5-flash for v1beta compatibility
        this.IMAGE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.API_KEY}`;
        this.CHAT_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.API_KEY}`;
    }

    /**
     * Analyze crop image for health status (healthy/rotten/dry/unhealthy)
     * @param {String} base64Image - Base64 encoded image
     * @param {String} cropType - Crop type (Rice, Wheat, Maize, etc.)
     * @param {Object} sensorData - Optional current sensor data
     * @returns {Object} Analysis results with health status
     */
    async analyzeImage(base64Image, cropType = 'Unknown', sensorData = null, language = 'en') {
        try {
            // Map language codes to full language names
            const languageMap = {
                'en': 'English',
                'ta': 'Tamil (தமிழ்)',
                'te': 'Telugu (తెలుగు)',
                'ml': 'Malayalam (മലയാളം)',
                'hi': 'Hindi (हिंदी)'
            };
            const targetLanguage = languageMap[language] || 'English';

            const prompt = `You are an expert agricultural AI. Analyze this crop image comprehensively, integrating the provided sensor data if available.

**CRITICAL INSTRUCTION: You MUST provide your entire response in ${targetLanguage} language ONLY.**
**TRANSLATION RULE:** Translate ALL concepts, reasonings, and scientific explanations into ${targetLanguage}.
- Example (English): "Soil pH (6.5) is optimal for Maize."
- Example (Tamil Target): "மக்காச்சோளத்திற்கு மண்ணின் pH (6.5) உகந்தது."
- Do NOT leave sentences like "Temperature (28°C) is ideal" in English. Translate the surrounding words.
- Keep the numbers and specific entity names (like "pH", "NPK") if they contain no standard translation, but translate the explanation.

${sensorData ? `
CURRENT SENSOR DATA:
- Temperature: ${sensorData.weather?.temperature || 'N/A'}°C
- Humidity: ${sensorData.weather?.humidity || 'N/A'}%
- Soil Moisture: ${sensorData.soil?.moisture || 'N/A'}%
- NPK: N=${sensorData.soil?.nitrogen || 'N/A'}, P=${sensorData.soil?.phosphorus || 'N/A'}, K=${sensorData.soil?.potassium || 'N/A'}
- Soil Type: ${sensorData.soil?.soilType || 'N/A'}
` : ''}

REQUIRED ANALYSIS:
1. **Crop Type Detection**: Identify the exact crop type (e.g., Rice, Wheat, Maize, Tomato, Sugarcane, etc.)
2. **Health Status**: Classify as "perfect", "dry", "rotten", or "diseased".
3. **Disease Analysis** (If diseased):
   - Name the specific disease (e.g., "Leaf Blight", "Rust", etc.)
   - Identify the cause/pathogen (e.g., "Fungal infection due to high humidity", "Viral spread by pests").
4. **Market & Season**:
   - **Market Demand**: Estimate current market demand (High/Medium/Low) and why.
   - **Cultivation Season**: Specify the best season to cultivate this crop.
   - **Cultivation if Diseased**: If diseased, advise when or if it can still be cultivated or if it requires full clearing.
5. **Fertilizer Suggestions**: Suggest specific fertilizers and application methods based on current climatic conditions and crop state.
6. **Soil Suggestion**: Suggest the best soil type or amendments for this specific crop.
7. **Irrigation Requirement**: Based on BOTH the image (visual stress) and sensor data (moisture level), specify clear irrigation needs.

Provide detailed response in JSON format (ensure all values are in ${targetLanguage}):
{
    "cropType": "exact crop name",
    "healthStatus": "perfect|dry|rotten|diseased",
    "diseaseName": "specific disease name or 'None'",
    "diseaseCause": "detailed cause of the disease or 'None'",
    "marketDemand": "High/Medium/Low",
    "marketReason": "explanation of market demand",
    "cultivationSeason": "recommended season",
    "cultivationAdvice": "advice on cultivation if diseased",
    "fertilizerSuggestions": ["fertilizer 1", "fertilizer 2"],
    "soilSuggestion": "best soil/amendments",
    "irrigationStatus": "detailed irrigation plan",
    "moistureLevel": "low|medium|high|optimal",
    "soilLevel": "poor|fair|good|excellent",
    "confidence": 0.0-1.0,
    "issues": ["issue1", "issue2"],
    "recommendations": ["specific recommendation 1", "specific recommendation 2"]
}`;

            const requestBody = {
                contents: [{
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: "image/jpeg",
                                data: base64Image
                            }
                        }
                    ]
                }]
            };

            const response = await axios.post(this.IMAGE_API_URL, requestBody, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            // Parse Gemini response
            const textResponse = response.data.candidates?.[0]?.content?.parts?.[0]?.text ||
                response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            if (!textResponse) {
                throw new Error('No response from Gemini API');
            }

            const analysis = this.parseImageAnalysis(textResponse, cropType);

            return {
                success: true,
                cropType: analysis.cropType,
                healthStatus: analysis.healthStatus,
                diseaseName: analysis.diseaseName,
                diseaseCause: analysis.diseaseCause,
                marketDemand: analysis.marketDemand,
                marketReason: analysis.marketReason,
                cultivationSeason: analysis.cultivationSeason,
                cultivationAdvice: analysis.cultivationAdvice,
                fertilizerSuggestions: analysis.fertilizerSuggestions,
                soilSuggestion: analysis.soilSuggestion,
                irrigationStatus: analysis.irrigationStatus,
                moistureLevel: analysis.moistureLevel,
                soilLevel: analysis.soilLevel,
                confidence: analysis.confidence,
                issues: analysis.issues,
                recommendations: analysis.recommendations,
                rawResponse: textResponse
            };
        } catch (error) {
            console.error('Gemini Image Analysis error:', error.response?.data || error.message);
            // Fallback analysis
            return {
                success: false,
                healthStatus: 'unknown',
                confidence: 0.5,
                issues: [],
                recommendations: ['Unable to analyze image. Please ensure good lighting and clear focus.'],
                error: error.message
            };
        }
    }

    /**
     * Parse Gemini text response to extract structured data
     */
    parseImageAnalysis(textResponse, cropType) {
        // Initialize all fields
        let detectedCropType = cropType || 'Unknown';
        let healthStatus = 'unknown';
        let diseaseName = 'None';
        let diseaseCause = 'None';
        let marketDemand = 'Medium';
        let marketReason = 'N/A';
        let cultivationSeason = 'N/A';
        let cultivationAdvice = 'N/A';
        let fertilizerSuggestions = [];
        let soilSuggestion = 'N/A';
        let irrigationStatus = 'N/A';
        let moistureLevel = 'optimal'; // low, medium, high, optimal
        let soilLevel = 'good'; // poor, fair, good, excellent
        let confidence = 0.7;
        const issues = [];
        const recommendations = [];

        const lowerText = textResponse.toLowerCase();

        // Try to parse JSON first (preferred method)
        try {
            const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                detectedCropType = parsed.cropType || detectedCropType;
                healthStatus = parsed.healthStatus || healthStatus;
                diseaseName = parsed.diseaseName || diseaseName;
                diseaseCause = parsed.diseaseCause || diseaseCause;
                marketDemand = parsed.marketDemand || marketDemand;
                marketReason = parsed.marketReason || marketReason;
                cultivationSeason = parsed.cultivationSeason || cultivationSeason;
                cultivationAdvice = parsed.cultivationAdvice || cultivationAdvice;
                fertilizerSuggestions = parsed.fertilizerSuggestions || fertilizerSuggestions;
                soilSuggestion = parsed.soilSuggestion || soilSuggestion;
                irrigationStatus = parsed.irrigationStatus || irrigationStatus;
                moistureLevel = parsed.moistureLevel || moistureLevel;
                soilLevel = parsed.soilLevel || soilLevel;
                confidence = parsed.confidence || confidence;
                if (parsed.issues) issues.push(...(Array.isArray(parsed.issues) ? parsed.issues : [parsed.issues]));
                if (parsed.recommendations) recommendations.push(...(Array.isArray(parsed.recommendations) ? parsed.recommendations : [parsed.recommendations]));
            }
        } catch (e) {
            console.warn('Could not parse JSON, using keyword extraction');
        }

        // Fallback: Extract from text if JSON parsing failed or incomplete
        if (detectedCropType === 'Unknown' || detectedCropType === cropType) {
            // Try to detect crop type from text
            const cropTypes = ['rice', 'wheat', 'maize', 'corn', 'tomato', 'sugarcane', 'potato', 'cotton', 'soybean'];
            for (const ct of cropTypes) {
                if (lowerText.includes(ct)) {
                    detectedCropType = ct.charAt(0).toUpperCase() + ct.slice(1);
                    break;
                }
            }
        }

        // Extract moisture level
        if (lowerText.includes('moisture') || lowerText.includes('water')) {
            if (lowerText.includes('low moisture') || lowerText.includes('dry soil') || lowerText.includes('dehydrated')) {
                moistureLevel = 'low';
            } else if (lowerText.includes('high moisture') || lowerText.includes('wet') || lowerText.includes('saturated')) {
                moistureLevel = 'high';
            } else if (lowerText.includes('medium moisture') || lowerText.includes('moderate')) {
                moistureLevel = 'medium';
            } else if (lowerText.includes('optimal moisture') || lowerText.includes('adequate')) {
                moistureLevel = 'optimal';
            }
        }

        // Extract soil level
        if (lowerText.includes('soil')) {
            if (lowerText.includes('poor soil') || lowerText.includes('bad soil') || lowerText.includes('degraded')) {
                soilLevel = 'poor';
            } else if (lowerText.includes('fair soil') || lowerText.includes('average soil')) {
                soilLevel = 'fair';
            } else if (lowerText.includes('good soil') || lowerText.includes('healthy soil')) {
                soilLevel = 'good';
            } else if (lowerText.includes('excellent soil') || lowerText.includes('rich soil') || lowerText.includes('fertile')) {
                soilLevel = 'excellent';
            }
        }

        // Extract confidence
        const confidenceMatch = textResponse.match(/confidence[:\s]+([0-9.]+)/i);
        if (confidenceMatch) {
            confidence = Math.min(1.0, Math.max(0.0, parseFloat(confidenceMatch[1])));
        }

        // Generate recommendations if none provided
        if (recommendations.length === 0) {
            if (healthStatus === 'diseased') {
                recommendations.push(`Apply treatment for ${diseaseName || 'detected disease'}`);
                recommendations.push('Check soil moisture and NPK levels');
                recommendations.push('Consider crop rotation if disease persists');
            } else if (healthStatus === 'dry' || moistureLevel === 'low') {
                recommendations.push('Increase irrigation frequency and amount');
                recommendations.push('Monitor soil moisture levels closely');
            } else if (healthStatus === 'perfect') {
                recommendations.push('Continue current irrigation and fertilization schedule');
                recommendations.push('Maintain optimal growing conditions');
            }
        }

        return {
            cropType: detectedCropType,
            healthStatus,
            diseaseName,
            diseaseCause,
            marketDemand,
            marketReason,
            cultivationSeason,
            cultivationAdvice,
            fertilizerSuggestions,
            soilSuggestion,
            irrigationStatus,
            moistureLevel,
            soilLevel,
            confidence,
            issues,
            recommendations
        };
    }

    /**
     * Generate intelligent chatbot response using Gemini (alias for getChatResponse)
     * @param {String} userMessage - User's question
     * @param {Object} context - Current predictions, sensor data, etc.
     * @returns {String} AI-generated response
     */
    async getChatResponse(userMessage, context) {
        return this.generateChatResponse(userMessage, context);
    }

    /**
     * Generate intelligent chatbot response using Gemini
     * @param {String} userMessage - User's question
     * @param {Object} context - Current predictions, sensor data, etc.
     * @returns {String} AI-generated response
     */
    async generateChatResponse(userMessage, context) {
        try {
            const { predictions, sensorData, cropType, imageAnalysis, language = 'en' } = context;

            // Map language codes to full language names
            const languageMap = {
                'en': 'English',
                'ta': 'Tamil (தமிழ்)',
                'te': 'Telugu (తెలుగు)',
                'ml': 'Malayalam (മലയാളം)',
                'hi': 'Hindi (हिंदी)'
            };

            const targetLanguage = languageMap[language] || 'English';

            // Build context prompt with language instruction
            let contextPrompt = `You are "Tridentrix", an expert AI Agriculture Assistant. 
**CRITICAL INSTRUCTION: You MUST provide your entire response in ${targetLanguage} language ONLY.**
**TRANSLATION RULE:** Translate ALL concepts, reasonings, and scientific explanations into ${targetLanguage}.
- Example (English): "Soil pH (6.5) is optimal for Maize."
- Example (Tamil Target): "மக்காச்சோளத்திற்கு மண்ணின் pH (6.5) உகந்தது."
- Do NOT leave sentences like "Temperature (28°C) is ideal" in English. Translate the surrounding words.
- Keep the numbers and specific entity names (like "pH", "NPK") if they contain no standard translation, but translate the explanation.

Even if the user asks in English, your reply must be fully translated to ${targetLanguage}.
Do not include any English text unless it is a specific scientific term that cannot be translated.

Provide helpful, accurate advice based on the following data:\n\n`;

            if (sensorData) {
                contextPrompt += `Current Sensor Data:\n`;
                contextPrompt += `- Temperature: ${sensorData.weather?.temperature || 'N/A'}°C\n`;
                contextPrompt += `- Humidity: ${sensorData.weather?.humidity || 'N/A'}%\n`;
                contextPrompt += `- Soil Moisture: ${sensorData.soil?.moisture || 'N/A'}%\n`;
                contextPrompt += `- NPK Levels: N=${sensorData.soil?.nitrogen || 'N/A'}, P=${sensorData.soil?.phosphorus || 'N/A'}, K=${sensorData.soil?.potassium || 'N/A'}\n`;
                contextPrompt += `- pH Level: ${sensorData.soil?.ph || 'N/A'}\n`;
            }

            if (sensorData) {
                contextPrompt += `Current Sensor Data:\n`;
                contextPrompt += `- Temperature: ${sensorData.weather?.temperature || 'N/A'}°C\n`;
                contextPrompt += `- Humidity: ${sensorData.weather?.humidity || 'N/A'}%\n`;
                contextPrompt += `- Soil Moisture: ${sensorData.soil?.moisture || 'N/A'}%\n`;
                contextPrompt += `- NPK: N=${sensorData.soil?.nitrogen || 'N/A'}, P=${sensorData.soil?.phosphorus || 'N/A'}, K=${sensorData.soil?.potassium || 'N/A'}\n`;
            }

            if (predictions) {
                contextPrompt += `\nML Predictions:\n`;
                contextPrompt += `- Irrigation Status: ${predictions.irrigation?.status || 'N/A'}\n`;
                contextPrompt += `- Health Status: ${predictions.health?.status || 'N/A'}\n`;
                contextPrompt += `- Overall Status: ${predictions.status || 'N/A'}\n`;
                if (predictions.recommendations) {
                    contextPrompt += `- Recommendations: ${predictions.recommendations.join(', ')}\n`;
                }
            }

            if (imageAnalysis) {
                contextPrompt += `\nImage Analysis:\n`;
                contextPrompt += `- Health Status: ${imageAnalysis.healthStatus || 'N/A'}\n`;
                contextPrompt += `- Issues: ${imageAnalysis.issues?.join(', ') || 'None'}\n`;
            }

            if (cropType) {
                contextPrompt += `\nCrop Type: ${cropType}\n`;
            }

            contextPrompt += `\nUser Question: ${userMessage}\n\n`;
            contextPrompt += `Provide a helpful, concise answer in ${targetLanguage} based on this data. If predictions show critical issues, emphasize urgency. Remember: Your entire response must be in ${targetLanguage}.`;

            const requestBody = {
                contents: [{
                    parts: [{ text: contextPrompt }]
                }]
            };

            const response = await axios.post(this.CHAT_API_URL, requestBody, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            const aiResponse = response.data.candidates?.[0]?.content?.parts?.[0]?.text ||
                response.data.candidates?.[0]?.content?.parts?.[0]?.text ||
                'I apologize, but I could not generate a response. Please try again.';

            return {
                success: true,
                response: aiResponse.trim()
            };
        } catch (error) {
            const errorDetails = {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                apiError: error.response?.data?.error?.message,
                code: error.code
            };

            console.error('❌ Gemini Chat Error:', JSON.stringify(errorDetails, null, 2));

            // Provide specific user-friendly error messages based on error type
            let userMessage = 'I apologize, but I encountered an error.';

            if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                userMessage = 'The AI service is taking too long to respond. Please try again in a moment.';
            } else if (error.response?.status === 429) {
                userMessage = 'The AI service has rate limits. Please wait a moment and try again.';
            } else if (error.response?.status === 403 || error.response?.status === 401) {
                userMessage = 'There is an issue with the AI service authentication. The fallback assistant is here to help!';
            } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                userMessage = 'Cannot connect to the AI service. Using local assistance mode.';
            }

            userMessage += '\n\nYou can ask me about:\n• Current irrigation status\n• Soil moisture levels\n• Crop health monitoring\n• NPK nutrient analysis';

            return {
                success: false,
                response: userMessage,
                error: error.message,
                details: errorDetails
            };
        }
    }
    /**
     * Translate content using Gemini API
     * @param {String} text - Text to translate
     * @param {String} targetLangCode - Target language code (ta, te, ml, hi, en)
     * @returns {String} Translated text
     */
    async translateContent(text, targetLangCode) {
        try {
            const languageMap = {
                'en': 'English',
                'ta': 'Tamil',
                'te': 'Telugu',
                'ml': 'Malayalam',
                'hi': 'Hindi'
            };
            const targetLang = languageMap[targetLangCode] || 'English';

            const prompt = `Translate the following agricultural text to ${targetLang}. Return ONLY the translation, no extra text:\n\n"${text}"`;

            const requestBody = {
                contents: [{
                    parts: [{ text: prompt }]
                }]
            };

            const response = await axios.post(this.CHAT_API_URL, requestBody, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            });

            const translation = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
            return translation ? translation.trim() : text;
        } catch (error) {
            console.warn('Translation failed:', error.message);
            return text; // Fallback to original text
        }
    }
}



module.exports = new GeminiService();

