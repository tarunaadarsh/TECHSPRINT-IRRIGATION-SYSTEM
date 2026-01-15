import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const languages = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
    { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
    { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिंदी' }
];

const LanguageSelector = () => {
    const { i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);

    const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

    const handleLanguageChange = (langCode) => {
        i18n.changeLanguage(langCode);
        localStorage.setItem('selectedLanguage', langCode);
        setIsOpen(false);
    };

    return (
        <div className="relative">
            {/* Selector Button */}
            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all duration-200 backdrop-blur-sm"
            >
                <Globe size={18} className="text-agri-green-500" />
                <span className="text-sm font-medium text-white">{currentLanguage.nativeName}</span>
                <ChevronDown
                    size={16}
                    className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </motion.button>

            {/* Dropdown Menu */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Options */}
                        <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute top-full left-0 mt-2 w-56 bg-[#0c0c0c] border border-agri-green-500/30 rounded-xl shadow-[0_0_30px_rgba(34,197,94,0.2)] overflow-hidden z-50 backdrop-blur-xl"
                        >
                            <div className="p-1">
                                {languages.map((lang, index) => (
                                    <motion.button
                                        key={lang.code}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        onClick={() => handleLanguageChange(lang.code)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 ${currentLanguage.code === lang.code
                                                ? 'bg-agri-green-500/20 text-agri-green-500'
                                                : 'text-slate-300 hover:bg-white/5 hover:text-white'
                                            }`}
                                    >
                                        <div className="flex-1">
                                            <div className="text-sm font-medium">{lang.nativeName}</div>
                                            <div className="text-xs opacity-60">{lang.name}</div>
                                        </div>

                                        {/* Check mark for selected language */}
                                        {currentLanguage.code === lang.code && (
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                className="w-5 h-5 bg-agri-green-500 rounded-full flex items-center justify-center"
                                            >
                                                <svg
                                                    className="w-3 h-3 text-white"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={3}
                                                        d="M5 13l4 4L19 7"
                                                    />
                                                </svg>
                                            </motion.div>
                                        )}
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default LanguageSelector;
