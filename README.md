# TON Connect Telegram Mini App Backend

## Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

## Frontend (HTML + JS)

Откройте файл `frontend/index.html` в браузере или задеплойте на любой статиcческий хостинг.

## Интеграция с Telegram Mini App

1. Задеплойте фронтенд (например, на Vercel, Netlify, GitHub Pages).
2. В настройках вашего Telegram-бота укажите URL вашего фронтенда как WebApp.
3. Пользователь сможет открыть мини-приложение через Telegram и подключить TON-кошелек.

---

- Минимальный backend на FastAPI (Python)
- Простой frontend с кнопкой подключения TON Connect
- Готово для интеграции с Telegram Mini App 