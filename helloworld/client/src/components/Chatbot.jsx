import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';
import axios from 'axios';

const API_BASE = 'http://localhost:5001/api';

const Chatbot = ({ status, history, analytics }) => {
    const { t, i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        {
            id: 1,
            text: t('chatbot.greeting'),
            sender: 'bot',
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);

    // Update greeting when language changes
    useEffect(() => {
        setMessages([
            {
                id: 1,
                text: t('chatbot.greeting'),
                sender: 'bot',
                timestamp: new Date()
            }
        ]);
    }, [i18n.language, t]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage = {
            id: Date.now(),
            text: input,
            sender: 'user',
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        const userInputCopy = input;
        setInput('');
        setIsTyping(true);

        try {
            // Try the backend AI first
            const response = await axios.post(`${API_BASE}/chatbot`, {
                message: userInputCopy,
                language: i18n.language,
                cropType: status?.sensorData?.cropType || null,
                context: {
                    status,
                    history,
                    analytics
                }
            }, {
                timeout: 10000
            });

            if (response.data && response.data.response) {
                setMessages(prev => [...prev, {
                    id: Date.now() + 1,
                    text: response.data.response,
                    sender: 'bot',
                    timestamp: new Date()
                }]);
            } else {
                throw new Error('Invalid response');
            }
        } catch (error) {
            console.warn('AI connection failed, using local assistant:', error.message);
            // Fallback to local expert response
            const botResponse = generateBotResponse(userInputCopy);
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                text: botResponse,
                sender: 'bot',
                timestamp: new Date()
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    const generateBotResponse = (userInput) => {
        const lowerInput = userInput.toLowerCase();
        const currentMoisture = status?.sensorData?.soil?.moisture;
        const currentTemp = status?.sensorData?.weather?.temperature;
        const currentHumidity = status?.sensorData?.weather?.humidity;
        const cropType = status?.sensorData?.cropType;
        const recommendation = status?.recommendation;
        const yieldHealth = status?.yieldHealth;

        // Dynamic responses based on actual data
        if (lowerInput.includes('irrigation') || lowerInput.includes('water') || lowerInput.includes('irrigate')) {
            if (recommendation) {
                if (recommendation.action === 'Irrigate') {
                    return `Based on current conditions, I recommend ${recommendation.action.toLowerCase()}ing ${recommendation.amount} L/m² for ${recommendation.duration} minutes. Best time: ${recommendation.recommendedTime}. ${recommendation.reason}`;
                } else if (recommendation.action === 'Delay') {
                    return `${recommendation.reason} ${recommendation.hoursUntilNext ? `Next check in ${recommendation.hoursUntilNext} hours.` : ''}`;
                } else {
                    return recommendation.reason || "Current irrigation status is optimal. No action needed at this time.";
                }
            }
            return "Based on current soil moisture and weather conditions, I recommend checking the irrigation schedule. Optimal irrigation timing is usually early morning (6-7 AM) to minimize evaporation.";
        }

        if (lowerInput.includes('moisture') || lowerInput.includes('soil')) {
            if (currentMoisture !== undefined) {
                const moistureStatus = currentMoisture < 30 ? 'low' : currentMoisture > 60 ? 'high' : 'optimal';
                return `Current soil moisture is ${currentMoisture.toFixed(1)}%, which is ${moistureStatus}. ${cropType ? `For ${cropType}, the ideal range is typically 30-60%.` : ''} ${moistureStatus === 'low' ? 'Consider irrigation soon.' : moistureStatus === 'high' ? 'Moisture levels are adequate.' : 'Moisture is in the optimal range.'}`;
            }
            return "Soil moisture levels are critical for crop health. The ideal range varies by crop type - for example, Wheat needs 30-50% moisture, while Rice needs 40-70%.";
        }

        if (lowerInput.includes('temperature') || lowerInput.includes('temp') || lowerInput.includes('weather')) {
            if (currentTemp !== undefined) {
                return `Current temperature is ${currentTemp}°C with ${currentHumidity}% humidity. ${currentTemp > 30 ? 'High temperatures may increase water evaporation. Monitor moisture levels closely.' : currentTemp < 20 ? 'Cooler temperatures reduce evaporation. Irrigation needs may be lower.' : 'Temperature is in a comfortable range for most crops.'}`;
            }
            return "Temperature and weather conditions significantly affect irrigation needs. Higher temperatures increase evaporation, requiring more frequent irrigation.";
        }

        if (lowerInput.includes('crop') || lowerInput.includes('health') || lowerInput.includes('yield')) {
            if (yieldHealth !== undefined) {
                const healthStatus = yieldHealth >= 80 ? 'excellent' : yieldHealth >= 60 ? 'good' : yieldHealth >= 40 ? 'moderate' : 'needs attention';
                return `Your crop health score is ${yieldHealth}%, which is ${healthStatus}. ${cropType ? `Current crop: ${cropType}.` : ''} ${yieldHealth < 60 ? 'Consider checking soil nutrients (NPK levels) and irrigation schedule to improve health.' : 'Crop health looks good! Continue monitoring.'}`;
            }
            return "Crop health depends on multiple factors: soil moisture, NPK levels (Nitrogen, Phosphorus, Potassium), temperature, and humidity.";
        }

        if (lowerInput.includes('fertilizer') || lowerInput.includes('nutrient') || lowerInput.includes('npk') || lowerInput.includes('nitrogen') || lowerInput.includes('phosphorus') || lowerInput.includes('potassium')) {
            const nitrogen = status?.sensorData?.soil?.nitrogen;
            const phosphorus = status?.sensorData?.soil?.phosphorus;
            const potassium = status?.sensorData?.soil?.potassium;

            if (nitrogen !== undefined || phosphorus !== undefined || potassium !== undefined) {
                return `Current NPK levels: Nitrogen ${nitrogen || 'N/A'} mg/kg, Phosphorus ${phosphorus || 'N/A'} mg/kg, Potassium ${potassium || 'N/A'} mg/kg. ${nitrogen && nitrogen < 40 ? 'Nitrogen levels are low - consider fertilization.' : ''} ${phosphorus && phosphorus < 20 ? 'Phosphorus may need supplementation.' : ''} Check the Analytics tab for detailed nutrient trends.`;
            }
            return "NPK levels are essential for crop growth. Nitrogen promotes leaf growth, Phosphorus supports root development, and Potassium enhances overall plant health.";
        }

        if (lowerInput.includes('anomaly') || lowerInput.includes('alert') || lowerInput.includes('problem') || lowerInput.includes('issue')) {
            const alerts = status?.alerts || [];
            if (alerts.length > 0) {
                const alertList = alerts.slice(0, 3).map(a => `- ${a.type}: ${a.message}`).join('\n');
                return `I found ${alerts.length} active alert(s):\n\n${alertList}\n\nCheck the Alerts tab for more details and recommended actions.`;
            }
            return "No active alerts detected. All systems are operating normally. Continue monitoring your dashboard for any changes.";
        }

        if (lowerInput.includes('savings') || lowerInput.includes('efficiency') || lowerInput.includes('save')) {
            const savings = status?.waterSavings;
            if (savings && savings.percentage > 0) {
                return `Great news! Your optimized irrigation system has saved ${savings.percentage}% water compared to fixed schedules. That's approximately ${savings.saved} L/m² saved. This translates to significant cost savings and better water conservation!`;
            }
            return "Water savings are calculated by comparing optimized irrigation schedules with fixed schedules. Our AI system typically saves 30-45% water by irrigating only when needed.";
        }

        if (lowerInput.includes('hello') || lowerInput.includes('hi') || lowerInput.includes('hey') || lowerInput.includes('help')) {
            return `Hello! I'm your AI Agriculture Assistant. ${cropType ? `I see you're monitoring ${cropType}. ` : ''}I can help you with:\n• Irrigation recommendations\n• Soil moisture analysis\n• Crop health monitoring\n• NPK nutrient levels\n• Weather impact\n• Water savings\n• Alert explanations\n\nWhat would you like to know?`;
        }

        if (lowerInput.includes('current') || lowerInput.includes('status') || lowerInput.includes('now')) {
            return `Current Status:\n• Crop: ${cropType || 'Not specified'}\n• Moisture: ${currentMoisture?.toFixed(1) || 'N/A'}%\n• Temperature: ${currentTemp || 'N/A'}°C\n• Humidity: ${currentHumidity || 'N/A'}%\n• Health Score: ${yieldHealth || 'N/A'}%\n${recommendation ? `• Recommendation: ${recommendation.action}` : ''}`;
        }

        // Default response with context
        return `I understand you're asking about "${userInput}". ${currentMoisture ? `Currently, your soil moisture is ${currentMoisture.toFixed(1)}%` : ''} ${cropType ? `for ${cropType}.` : ''} For more detailed information, check your dashboard tabs or ask me about specific topics like irrigation, moisture, temperature, crop health, or nutrients. How else can I help?`;
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <>
            {/* Chatbot Toggle Button */}
            <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 w-16 h-16 bg-agri-green-500 text-white rounded-full shadow-[0_0_30px_rgba(34,197,94,0.5)] flex items-center justify-center z-50 hover:bg-agri-green-600 transition-colors"
            >
                {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
            </motion.button>

            {/* Chatbot Window */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.9 }}
                        className="fixed bottom-24 right-6 w-96 h-[600px] bg-[#0c0c0c] border border-agri-green-500/30 rounded-3xl shadow-[0_0_50px_rgba(34,197,94,0.3)] flex flex-col z-50 overflow-hidden"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-agri-green-500/20 to-agri-blue-500/20 p-4 border-b border-agri-green-500/30">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-agri-green-500 rounded-full flex items-center justify-center">
                                    <Bot size={20} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="font-black text-white text-sm uppercase">{t('chatbot.title')}</h3>
                                    <p className="text-xs text-slate-400">{t('chatbot.subtitle')}</p>
                                </div>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.map((message) => (
                                <motion.div
                                    key={message.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    {message.sender === 'bot' && (
                                        <div className="w-8 h-8 bg-agri-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                                            <Bot size={16} className="text-agri-green-500" />
                                        </div>
                                    )}
                                    <div
                                        className={`max-w-[75%] rounded-2xl p-3 ${message.sender === 'user'
                                            ? 'bg-agri-green-500 text-white'
                                            : 'bg-white/5 text-slate-200 border border-white/10'
                                            }`}
                                    >
                                        <p className="text-sm leading-relaxed whitespace-pre-line">{message.text}</p>
                                        <p className="text-xs mt-1 opacity-60">
                                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    {message.sender === 'user' && (
                                        <div className="w-8 h-8 bg-agri-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                                            <User size={16} className="text-agri-green-500" />
                                        </div>
                                    )}
                                </motion.div>
                            ))}

                            {isTyping && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex gap-3 justify-start"
                                >
                                    <div className="w-8 h-8 bg-agri-green-500/20 rounded-full flex items-center justify-center">
                                        <Bot size={16} className="text-agri-green-500" />
                                    </div>
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                                        <div className="flex gap-1">
                                            <motion.div
                                                className="w-2 h-2 bg-agri-green-500 rounded-full"
                                                animate={{ y: [0, -8, 0] }}
                                                transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                                            />
                                            <motion.div
                                                className="w-2 h-2 bg-agri-green-500 rounded-full"
                                                animate={{ y: [0, -8, 0] }}
                                                transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                                            />
                                            <motion.div
                                                className="w-2 h-2 bg-agri-green-500 rounded-full"
                                                animate={{ y: [0, -8, 0] }}
                                                transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-4 border-t border-white/10">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder={t('chatbot.placeholder')}
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-agri-green-500/50"
                                />
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={handleSend}
                                    className="w-12 h-12 bg-agri-green-500 text-white rounded-xl flex items-center justify-center hover:bg-agri-green-600 transition-colors"
                                >
                                    <Send size={18} />
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default Chatbot;

