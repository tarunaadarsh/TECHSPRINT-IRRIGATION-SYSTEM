🌾 AgriWater AI - Intelligent Irrigation & Crop Management
AgriWater AI is a state-of-the-art agricultural monitoring and irrigation system that leverages AI, Machine Learning, and IoT to optimize farming operations. By combining real-time sensor data, Gemini-powered image analysis, and market intelligence, it provides farmers with actionable insights to maximize yield and minimize water waste.

Project Banner Tech Stack

🚀 Key Features
1. 🔍 AI-Powered Image Analysis (Gemini Vision)
Upload crop images for instant, high-precision analysis:

Crop Identification: Automatically detects crop type (Rice, Wheat, Maize, etc.).
Disease Diagnostics: Identifies diseases (Leaf Blight, Rust, etc.) and classifies them (Fungal/Bacterial/Viral).
Health Assessment: Categorizes crop condition as "Perfect", "Bad", or "Dry".
Soil & Moisture: Estimates soil quality and moisture levels from visual cues.
2. 💧 Intelligent Irrigation Management
Smart Recommendations: Calculates precise water requirements (L/m²) based on real-time sensor data.
Irrigation Status: Real-time alerts for "Under-irrigation", "Optimal", or "Over-irrigation".
Data Synthesis: Automatic sensor data updates every 2 minutes.
3. 📈 Market-Based Crop Recommendations
Strategic Suggestions: Recommends crops based on market demand (Very High to Medium).
Environmental Matching: Validates compatibility with local soil pH and climate conditions.
Seasonal Planning: Supports Kharif, Rabi, and Year-round crop cycles.
4. 🛰️ IoT & Hardware Integration (ESP32)
Real-world alerting system using ESP32 hardware:

Visual Alerts: RGB LED indicators (Green: Normal, Blue: Caution, Red: Critical).
Audio Alerts: Buzzer patterns for critical leak detection or water stress.
Web Console: Remote hardware status monitoring and testing.
5. 🎨 Modern & Responsive UI
Dynamic Dashboard: Fully interactive UI with real-time updates.
Fluid Animations: Powered by Framer Motion for a premium user experience.
Comprehensive Analytics: Visualized historical data and health trends.
🛠️ Technology Stack
Frontend: React.js, Vite, Framer Motion, Vanilla CSS (Premium Aesthetics)
Backend: Node.js, Express.js
Database: MongoDB (Atlas)
AI/ML: Google Gemini Pro Vision API, ML Prediction Models
Hardware: ESP32, Sensors (Soil Moisture, Temperature, Humidity)
Communication: HTTP/REST, MQTT-ready
📋 Project Structure
agri/
├── client/          # React frontend (Vite)
├── server/          # Node.js backend (Express)
├── arduino/         # ESP32 Firmware/Code
└── ...              # Documentation and configuration files
⚡ Quick Start
1. Prerequisites
Node.js (v16+)
MongoDB Atlas Account
Gemini API Key
2. Backend Setup
cd server
npm install
cp .env.example .env  # Add your MONGO_URI and GEMINI_API_KEY
npm run dev
3. Frontend Setup
cd client
npm install
npm run dev
4. Access the App
The application will be running at http://localhost:5173. Ensure your backend is running on port 5000 (or as configured in .env).

📡 API Endpoints
Endpoint	Method	Description
/api/analyze-image	POST	Analyze crop image via Gemini AI
/api/predict	POST	Get ML-based irrigation predictions
/api/recommend-crops	GET	Get market-based crop suggestions
/api/status	GET	Fetch live sensor data and system status
/api/esp32/set	POST	Manually control hardware state
🛡️ License
Distributed under the ISC License. See LICENSE for more information.

Developed with ❤️ for the Agriculture Community.

THE DEPLOYED DASHBOARD:

DEMO VIDEO LINK : https://drive.google.com/file/d/1aGGfYs5SqJ5seuq-3EDsXXVzr3q2b2ZN/view?usp=sharing CIRCUIT OF THE BUZZER DETECTION : https://drive.google.com/file/d/1WXIT6_fP-WNiBZZDXdSer4ogX4dbS8FT/view?usp=sharing TELEGRAM BOT NOTIFICATION : https://drive.google.com/file/d/1_15wJw6JEdN5iZKvofXuFWtu3xQQe1-B/view?usp=sharing BASIC NOTIFICATION DETECTING BUZZER REAL TIME HARDWARE: https://drive.google.com/file/d/1VZq86mLnjZjni6r44hXLByiKelzD5_97/view?usp=sharing

FLOW OF THE PROJECT: INPUT(CROP IMAGE+GENERATIVE INPUT DATA OF THE WEATHER,SOIL PH, HUMIDITY,ETC)-->DEEP LEARNING MODEL(FOR THE CONDITION OF THE CROP)+ML MODEL(PREDICTIVE ANALYSIS OF OUTPUT)-->GEMINI FOR THE CHATBOT SUGGESTION + MARKET DEMAND(FOR SELLING THE SUITABLE CROP DURING THE PARTICULAR SEASON OR TIME) ====> RESULTED IN THE ENTIRE DASHBOARD
