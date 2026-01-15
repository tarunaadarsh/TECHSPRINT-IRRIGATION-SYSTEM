require('dotenv').config();
const TelegramService = require('./services/telegramService');

console.log('--- Telegram Debug Info ---');
console.log('Working Directory:', process.cwd());
console.log('BOT_TOKEN exists:', !!process.env.TELEGRAM_BOT_TOKEN);
console.log('CHAT_ID exists:', !!process.env.TELEGRAM_CHAT_ID);
if (process.env.TELEGRAM_CHAT_ID) {
    console.log('CHAT_ID length:', process.env.TELEGRAM_CHAT_ID.length);
    console.log('CHAT_ID first 4 chars:', process.env.TELEGRAM_CHAT_ID.substring(0, 4));
} else {
    console.log('CHAT_ID is missing or empty.');
}

(async () => {
    console.log('\n--- Attempting to send message ---');
    try {
        const result = await TelegramService.sendMessage('Debug test message from reproduction script');
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error executing sendMessage:', error);
    }
})();
