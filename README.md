# BUYCART — Campus Group-Buying App 🛒

A full-stack mobile app that lets students team up on group orders to split delivery
costs. Built as my graduation project.

> **Author:** Jason Huang · [Portfolio](https://jkahj.github.io/portfolio) · jason.huang920922@gmail.com

---

## ✨ Features

- **Group ordering** — create an order, let others join, and split the delivery fee
- **Reputation & credit-tier system** — users earn scores based on reliability; tiers rank trustworthy buyers
- **Real-time push notifications** — order updates, joins, comments, and status changes
- **Comments & likes** — discuss orders, reply to comments, like posts
- **Ratings & reviews** — rate other users after an order completes
- **Profile & photo uploads** — avatars and order images
- **Auth** — email/password registration & login, password reset, optional Google OAuth

## 🛠 Tech Stack

| Layer      | Technology |
|------------|-----------|
| Mobile app | React Native, Expo (SDK 54), React Navigation, React Native Paper |
| Backend    | FastAPI, Uvicorn, SQLAlchemy |
| Database   | MySQL (PyMySQL) |
| Other      | Expo push notifications, image upload, reputation engine |

The frontend has **25+ screens** and the backend exposes a full REST API
(users, orders, comments, notifications, reviews, reputation tiers, likes).

---

## 📂 Project Structure

```
campus-group-order/
├── frontend/          # React Native (Expo) mobile app
│   ├── screens/       # 25+ app screens
│   ├── components/    # reusable UI components
│   ├── utils/         # API service, auth, notifications
│   └── config/        # API + OAuth configuration
└── backend/           # FastAPI + MySQL REST API
    ├── app/           # api.py (routes), main.py
    └── database/      # SQLAlchemy models, schema SQL, db_config
```

---

## 🚀 Running Locally

### Backend (FastAPI + MySQL)

```bash
cd backend
python -m venv venv
venv\Scripts\activate            # Windows  (source venv/bin/activate on macOS/Linux)
pip install -r requirements.txt

# configure database
copy .env.example .env           # then edit .env with your MySQL credentials
mysql -u root -p buycart < database/buycart_schema.sql

python start.py                  # serves on http://localhost:8001  (docs at /docs)
```

### Frontend (Expo)

```bash
cd frontend
npm install
# point the app at your backend:
set EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:8001   # Windows
npx expo start                    # scan the QR code with Expo Go
```

---

## ☁️ Deploying the Backend

A `render.yaml` blueprint is included. The app reads its config from environment
variables (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `PORT`) — no
secrets are committed. See `render.yaml` for details.

---

## 🔒 Note

User-uploaded photos and `.env` files are excluded from this repository for privacy.
Database credentials are supplied via environment variables only.
