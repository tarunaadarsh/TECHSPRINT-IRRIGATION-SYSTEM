import { useTranslation } from 'react-i18next'; // Added

const PhotoUpload = ({ selectedField, onClose, onAnalysisComplete }) => {
    const { i18n } = useTranslation(); // Added
    const [isOpen, setIsOpen] = useState(false);
    // ... (rest of local state)

    // ... (handleUpload logic)

    // Call Gemini API for image analysis with sensor data
    const geminiResponse = await callGeminiImageAPI(base64Image, cropType, sensorData, i18n.language); // Added language

    // ...

    const callGeminiImageAPI = async (base64Image, cropType, sensorData, language) => { // Added language param
        // Convert to base64 if needed (remove data:image prefix)
        const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

        const response = await fetch(`${API_BASE}/analyze-image`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: base64Data,
                cropType: cropType,
                sensorData: sensorData,
                language: language // Added
            })
        });
        // ...

        if (!response.ok) {
            throw new Error(`API error: ${response.statusText}`);
        }

        const result = await response.json();

        // Ensure all comprehensive fields are present
        return {
            success: result.success !== false,
            cropType: result.cropType,
            diseaseDetected: result.diseaseDetected,
            diseaseName: result.diseaseName,
            diseaseType: result.diseaseType,
            cropCondition: result.cropCondition,
            reason: result.reason,
            moistureLevel: result.moistureLevel,
            soilLevel: result.soilLevel,
            healthStatus: result.healthStatus,
            confidence: result.confidence,
            issues: result.issues,
            recommendations: result.recommendations,
            diseaseCause: result.diseaseCause, // New field
            cultivationAdvice: result.cultivationAdvice, // New field
            marketDemand: result.marketDemand, // New field
            marketReason: result.marketReason, // New field
            cultivationSeason: result.cultivationSeason, // New field
            soilSuggestion: result.soilSuggestion, // New field
            fertilizerSuggestions: result.fertilizerSuggestions, // New field
            irrigationStatus: result.irrigationStatus // New field
        };
    };

    const callMLPredictionAPI = async (imageAnalysis, cropType, sensorData) => {
        try {
            // sensorData is now passed in

            // Fallback to defaults if no sensor data
            if (!sensorData) {
                sensorData = {
                    weather: { temperature: 25, humidity: 60 },
                    soil: { moisture: 35, soilType: 'Loamy', nitrogen: 40, phosphorus: 20, potassium: 30 }
                };
            }

            const response = await fetch(`${API_BASE}/predict`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sensorData,
                    imageAnalysis: {
                        healthStatus: imageAnalysis.healthStatus,
                        confidence: imageAnalysis.confidence,
                        issues: imageAnalysis.issues
                    },
                    cropType
                })
            });

            if (!response.ok) {
                throw new Error(`ML API error: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('ML Prediction error:', error);
            // Return prediction based on image analysis only
            return {
                predictions: {
                    irrigation: {
                        status: imageAnalysis.healthStatus === 'dry' ? 'less' : 'perfect',
                        message: imageAnalysis.healthStatus === 'dry' ? 'Water needed' : 'Irrigation optimal'
                    },
                    health: {
                        status: imageAnalysis.healthStatus === 'rotten' || imageAnalysis.healthStatus === 'unhealthy' ? 'critical' :
                            imageAnalysis.healthStatus === 'dry' ? 'caution' : 'normal',
                        imageStatus: imageAnalysis.healthStatus
                    },
                    status: imageAnalysis.healthStatus === 'rotten' || imageAnalysis.healthStatus === 'unhealthy' ? 'critical' :
                        imageAnalysis.healthStatus === 'dry' ? 'caution' : 'normal',
                    recommendations: imageAnalysis.recommendations || []
                }
            };
        }
    };

    const fileToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                // Remove data:image/...;base64, prefix
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = error => reject(error);
        });
    };

    const callGoogleVisionAPI = async (base64Image) => {
        const API_KEY = 'AIzaSyD3DPnnd54Kb0JPC6T6y1E82zLrXVF-elo';
        const API_URL = `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`;

        const requestBody = {
            requests: [
                {
                    image: {
                        content: base64Image
                    },
                    features: [
                        { type: 'LABEL_DETECTION', maxResults: 10 },
                        { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
                        { type: 'TEXT_DETECTION', maxResults: 5 }
                    ]
                }
            ]
        };

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`Google Vision API error: ${response.statusText}`);
        }

        return await response.json();
    };

    const processVisionResponse = (visionResponse, filename) => {
        const detections = [];
        const recommendations = [];
        const labels = [];
        let confidence = 0;

        if (visionResponse.responses && visionResponse.responses[0]) {
            const response = visionResponse.responses[0];

            // Process labels
            if (response.labelAnnotations) {
                response.labelAnnotations.forEach(label => {
                    labels.push({
                        name: label.description,
                        confidence: (label.score * 100).toFixed(1)
                    });

                    // Detect agricultural objects
                    const labelLower = label.description.toLowerCase();
                    if (labelLower.includes('leaf') || labelLower.includes('plant') ||
                        labelLower.includes('crop') || labelLower.includes('vegetable') ||
                        labelLower.includes('agriculture') || labelLower.includes('farm')) {
                        detections.push({
                            type: 'Plant/Leaf',
                            confidence: (label.score * 100).toFixed(1),
                            status: 'Detected',
                            details: label.description
                        });
                        confidence = Math.max(confidence, label.score * 100);
                    }

                    if (labelLower.includes('soil') || labelLower.includes('dirt') ||
                        labelLower.includes('earth') || labelLower.includes('ground')) {
                        detections.push({
                            type: 'Soil',
                            confidence: (label.score * 100).toFixed(1),
                            status: 'Detected',
                            details: label.description
                        });
                        confidence = Math.max(confidence, label.score * 100);
                    }
                });
            }

            // Process objects
            if (response.localizedObjectAnnotations) {
                response.localizedObjectAnnotations.forEach(obj => {
                    const objLower = obj.name.toLowerCase();
                    if (objLower.includes('plant') || objLower.includes('vegetable') ||
                        objLower.includes('fruit') || objLower.includes('crop')) {
                        detections.push({
                            type: obj.name,
                            confidence: (obj.score * 100).toFixed(1),
                            status: 'Object Detected',
                            details: `Detected ${obj.name} in image`
                        });
                        confidence = Math.max(confidence, obj.score * 100);
                    }
                });
            }

            // Generate recommendations based on detected objects
            const allLabels = labels.map(l => l.name.toLowerCase()).join(' ');

            if (allLabels.includes('leaf') || allLabels.includes('plant')) {
                if (allLabels.includes('disease') || allLabels.includes('yellow') ||
                    allLabels.includes('brown') || allLabels.includes('spot')) {
                    recommendations.push('⚠️ Potential disease detected. Consider applying fungicide and checking soil moisture levels.');
                    recommendations.push('Monitor for pest infestation and ensure proper NPK nutrient levels.');
                } else {
                    recommendations.push('✅ Plant appears healthy. Continue current irrigation and fertilization schedule.');
                    recommendations.push('Maintain optimal soil moisture (30-60%) for continued growth.');
                }
            }

            if (allLabels.includes('soil') || allLabels.includes('dirt')) {
                recommendations.push('🌱 Soil analysis: Check moisture levels and NPK nutrients for optimal crop growth.');
                recommendations.push('Consider soil testing for pH and nutrient composition.');
            }

            if (allLabels.includes('crop') || allLabels.includes('field')) {
                recommendations.push('🌾 Crop field detected. Monitor growth stage and adjust irrigation accordingly.');
                recommendations.push('Check for signs of stress, pests, or nutrient deficiencies.');
            }
        }

        // Default if no specific detections
        if (detections.length === 0) {
            detections.push({
                type: 'Agricultural Scene',
                confidence: '70',
                status: 'General Analysis',
                details: 'Agricultural context detected'
            });
            recommendations.push('Image analyzed successfully. For detailed analysis, ensure good lighting and clear focus on the subject.');
            confidence = 70;
        }

        return {
            detections,
            recommendations: recommendations.length > 0 ? recommendations : [
                'Image analyzed successfully. For detailed analysis, ensure good lighting and clear focus on the subject.'
            ],
            confidence: confidence || 75,
            labels: labels.slice(0, 5) // Top 5 labels
        };
    };

    const analyzeImage = (filename) => {
        // Mock object detection - provide a comprehensive report
        const isHealthy = Math.random() > 0.6;

        return {
            cropType: filename.toLowerCase().includes('wheat') ? 'Wheat' : 'Maize',
            healthStatus: isHealthy ? 'perfect' : 'diseased',
            diseaseName: isHealthy ? 'None' : 'Leaf Blight',
            diseaseCause: isHealthy ? 'None' : 'Fungal infection due to recent rain and high humidity.',
            marketDemand: 'High',
            marketReason: 'Strong export demand and limited supply in current quarter.',
            cultivationSeason: 'September - March',
            cultivationAdvice: isHealthy ? 'Continue current maintenance.' : 'Consider early harvesting if infection spreads to >30% of the field.',
            fertilizerSuggestions: ['NPK 19-19-19', 'Organic Compost', 'Zinc Sulfate'],
            soilSuggestion: 'Loamy soil with pH 6.0-7.0 is ideal.',
            irrigationStatus: 'Increase watering by 20% due to dry weather forecast.',
            moistureLevel: 'low',
            soilLevel: 'good',
            confidence: 0.85,
            issues: isHealthy ? [] : ['Fungal infection', 'Low nitrogen'],
            recommendations: isHealthy ?
                ['Maintain current irrigation', 'Monitor for pests'] :
                ['Apply fungicide', 'Check soil NPK levels'],
            detections: [{
                type: 'Plant Health',
                confidence: 85,
                status: isHealthy ? 'Healthy' : 'Disease Detected'
            }]
        };
    };

    const handleClose = () => {
        setIsOpen(false);
        setSelectedFile(null);
        setPreview(null);
        setResult(null);
        setPredictions(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        if (onClose) {
            onClose();
        }
    };

    return (
        <>
            {/* Upload Button Removed - Only available through field cards */}

            {/* Upload Modal */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={handleClose}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#0c0c0c] border border-agri-green-500/30 rounded-3xl shadow-[0_0_50px_rgba(34,197,94,0.3)] max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                        >
                            {/* Header */}
                            <div className="bg-gradient-to-r from-agri-green-500/20 to-blue-500/20 p-6 border-b border-agri-green-500/30 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                                        <ImageIcon size={24} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-white text-lg uppercase">
                                            {selectedField ? `${selectedField.crop} Analysis` : 'Photo Analysis'}
                                        </h3>
                                        <p className="text-xs text-slate-400">
                                            {selectedField ? `Field: ${selectedField.fieldName || selectedField.crop}` : 'AI-Powered Object Detection'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleClose}
                                    className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
                                >
                                    <X size={20} className="text-white" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-6">
                                {/* Upload Area */}
                                {!preview && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="border-2 border-dashed border-agri-green-500/30 rounded-2xl p-12 text-center hover:border-agri-green-500/50 transition-colors cursor-pointer"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Upload size={48} className="mx-auto text-agri-green-500 mb-4" />
                                        <p className="text-white font-bold mb-2">Click to upload or drag and drop</p>
                                        <p className="text-slate-400 text-sm">Supports: JPG, PNG, WebP</p>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileSelect}
                                            className="hidden"
                                        />
                                    </motion.div>
                                )}

                                {/* Preview */}
                                {preview && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="relative rounded-2xl overflow-hidden border border-white/10"
                                    >
                                        <img src={preview} alt="Preview" className="w-full h-auto" />
                                        {isUploading && (
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                <div className="text-center">
                                                    <div className="w-16 h-16 border-4 border-agri-green-500/20 border-t-agri-green-500 rounded-full animate-spin mx-auto mb-4"></div>
                                                    <p className="text-white font-bold">Analyzing image...</p>
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                {/* Results */}
                                {result && result.success && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="space-y-4"
                                    >
                                        {/* Comprehensive Analysis results */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Health & Disease Card */}
                                            <div className="bg-agri-green-500/10 border border-agri-green-500/30 rounded-2xl p-4">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <CheckCircle size={24} className="text-agri-green-500" />
                                                    <h4 className="font-black text-white uppercase">Health Analysis</h4>
                                                </div>
                                                <div className="space-y-4">
                                                    <div className="bg-white/5 rounded-xl p-3">
                                                        <p className="text-xs text-slate-400 mb-1">Detected Crop</p>
                                                        <p className="text-lg font-black text-white">{result.cropType}</p>
                                                    </div>
                                                    <div className="bg-white/5 rounded-xl p-3">
                                                        <p className="text-xs text-slate-400 mb-1">Status</p>
                                                        <p className={`text-lg font-black ${result.healthStatus === 'perfect' ? 'text-agri-green-400' :
                                                            result.healthStatus === 'diseased' ? 'text-red-400' : 'text-orange-400'
                                                            }`}>{result.healthStatus?.toUpperCase()}</p>
                                                    </div>
                                                    {result.healthStatus === 'diseased' && (
                                                        <>
                                                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                                                                <p className="text-xs text-red-300 mb-1">Disease</p>
                                                                <p className="text-md font-bold text-white">{result.diseaseName}</p>
                                                            </div>
                                                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                                                                <p className="text-xs text-red-300 mb-1">Cause</p>
                                                                <p className="text-sm text-slate-300">{result.diseaseCause}</p>
                                                            </div>
                                                            <div className="bg-white/5 rounded-xl p-3">
                                                                <p className="text-xs text-slate-400 mb-1">Cultivation Advice</p>
                                                                <p className="text-sm text-slate-300">{result.cultivationAdvice}</p>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Market & Season Card */}
                                            <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <ImageIcon size={24} className="text-blue-400" />
                                                    <h4 className="font-black text-white uppercase">Market & Season</h4>
                                                </div>
                                                <div className="space-y-4">
                                                    <div className="bg-white/5 rounded-xl p-3">
                                                        <p className="text-xs text-slate-400 mb-1">Market Demand</p>
                                                        <p className="text-md font-bold text-white mb-1">{result.marketDemand} Demand</p>
                                                        <p className="text-xs text-slate-400">{result.marketReason}</p>
                                                    </div>
                                                    <div className="bg-white/5 rounded-xl p-3">
                                                        <p className="text-xs text-slate-400 mb-1">Optimal Season</p>
                                                        <p className="text-md font-bold text-white">{result.cultivationSeason}</p>
                                                    </div>
                                                    <div className="bg-white/5 rounded-xl p-3">
                                                        <p className="text-xs text-slate-400 mb-1">Soil Recommendation</p>
                                                        <p className="text-sm text-slate-300">{result.soilSuggestion}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Fertilizer & Irrigation Card */}
                                        <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4">
                                            <div className="flex items-center gap-3 mb-3">
                                                <Droplets size={24} className="text-purple-400" />
                                                <h4 className="font-black text-white uppercase">Care & Irrigation</h4>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-xs text-slate-400 mb-2">Fertilizer Suggestions</p>
                                                    <ul className="space-y-2">
                                                        {result.fertilizerSuggestions?.map((f, i) => (
                                                            <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                                                <span className="text-purple-400 font-bold">•</span>
                                                                <span>{f}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-400 mb-1">Irrigation Status</p>
                                                    <p className="text-sm text-slate-300 mb-3">{result.irrigationStatus}</p>
                                                    {predictions?.waterAmount > 0 && (
                                                        <div className="bg-blue-500/20 rounded-xl p-3 border border-blue-500/30">
                                                            <p className="text-xs text-blue-300 mb-1">Water Amount</p>
                                                            <p className="text-xl font-black text-white">{predictions.waterAmount.toFixed(1)} L/m²</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* AI Recommendations list */}
                                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                                            <h4 className="font-black text-white uppercase mb-3 text-xs tracking-widest opacity-60">AI Recommendations</h4>
                                            <ul className="space-y-2">
                                                {result.recommendations.map((rec, idx) => (
                                                    <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                                                        <span className="text-agri-green-500 mt-1">•</span>
                                                        <span>{rec}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </motion.div>
                                )}

                                {result && !result.success && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4"
                                    >
                                        <p className="text-red-400">{result.error}</p>
                                    </motion.div>
                                )}

                                {/* Actions */}
                                {preview && !result && (
                                    <div className="flex gap-4">
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={handleUpload}
                                            disabled={isUploading}
                                            className="flex-1 bg-agri-green-500 text-white py-4 rounded-xl font-black uppercase tracking-wider hover:bg-agri-green-600 transition-colors disabled:opacity-50"
                                        >
                                            {isUploading ? 'Analyzing...' : 'Analyze Image'}
                                        </motion.button>
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => {
                                                setSelectedFile(null);
                                                setPreview(null);
                                                if (fileInputRef.current) {
                                                    fileInputRef.current.value = '';
                                                }
                                            }}
                                            className="px-6 py-4 bg-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-colors"
                                        >
                                            Change
                                        </motion.button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default PhotoUpload;

