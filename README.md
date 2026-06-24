# NESCO Balance Tracker

NESCO Balance Tracker is a proactive balance and electricity consumption tracker for NESCO (Northern Electricity Supply Company, Bangladesh) prepaid smart meter customers. It automatically fetches your balance, estimates how many days it will last, and alerts you via Telegram when your balance falls below a configured threshold.

> [!WARNING]
> **UNOFFICIAL DATA SOURCE DISCLAIMER**
> This application utilizes a reverse-engineered parser to retrieve details from NESCO's customer panel (`https://customer.nesco.gov.bd/pre/panel`). NESCO does not provide an official API for prepaid meters. This connection may degrade, change, or break at any time without notice. If it does, you can use the **Manual Update** feature to manually override your balance.

---

## Features

- **Automated Fetching**: Retrieves real-time balance, customer info, monthly consumption, and token recharge history.
- **Estimated Days Remaining**: Calculates daily average spend based on historical snapshots to estimate exactly how many days your balance will last.
- **Low-Balance Alerts**: Sends automated messages via Telegram when the balance falls below a threshold (e.g., ৳200).
- **Bangla UI**: Visual dashboard displays in Bengali, including current balance cards, 7-day usage charts, recharge history tables, and AI-driven rule-based insights.
- **Multi-Meter Support**: Add, track, and manage multiple NESCO meters from a single dashboard.

---

## Tech Stack

- **Backend**: FastAPI, SQLAlchemy, SQLite, APScheduler
- **Frontend**: React (Vite), TailwindCSS, Recharts, Lucide Icons
- **Notifications**: Telegram Bot API integration

---

## Setup & Running Guide

### Prerequisites
- Python 3.9+
- Node.js 16+

### 1. Run the Backend Server
Navigate to the root directory and activate the virtual environment:
```bash
# Activate virtual environment
source venv/bin/env/bin/activate  # or venv/bin/activate on Mac/Linux

# Run FastAPI backend using Uvicorn
./venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
The backend server will run at `http://127.0.0.1:8000`. Database migrations and initial seed data for a demo meter (`TEST12345`) will be created automatically.

### 2. Run the Frontend Dev Server
In a new terminal window, navigate to the frontend directory:
```bash
cd frontend
npm install  # Install dependencies if not already done
npm run dev -- --host 127.0.0.1 --port 3000
```
The frontend dev server will start at `http://127.0.0.1:3000/` and automatically proxy API calls to the backend.

---

## Telegram Alert Configuration

To enable automated low-balance Telegram notifications:
1. Create a Telegram Bot by messaging [@BotFather](https://t.me/BotFather) and copy the **HTTP API Bot Token**.
2. Find your Telegram **Chat ID** by messaging [@userinfobot](https://t.me/userinfobot) or [@IDBot](https://t.me/myidbot).
3. Open the NESCO Tracker **Settings** tab in the web interface and enter these values under **টেলিগ্রাম অ্যালার্ট কনফিগারেশন**.
4. Alternatively, you can set them as environment variables before starting the backend:
   ```bash
   export TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
   export TELEGRAM_CHAT_ID="your-chat-id"
   ```

---

## Adding a Real Meter

1. Go to the **Settings (সেটিংস)** tab.
2. In the **নতুন মিটার যোগ করুন (Add New Meter)** form, enter:
   - **মিটার লেবেল (Label)**: e.g., "Home", "Shop"
   - **মিটার নম্বর (Meter/Customer Number)**: Enter your NESCO customer number (from your prepaid bill or card).
   - **অ্যালার্ট সীমা (Alert Threshold)**: e.g., 200 (alerts you when balance falls below ৳200).
3. Click **মিটার যোগ করুন (Add Meter)**.
4. The system will immediately make a connection attempt to NESCO to populate your account balance, customer name, recharge history, and usage stats!

*Note: For testing, adding a meter that starts with `TEST` or `DEMO` will simulate realistic prepaid data, allowing you to try out the dashboard offline.*

---

## Deploying to Render

You can easily deploy both the backend and frontend services to [Render](https://render.com).

### 1. Database Setup
1. Create a **PostgreSQL Database** on Render.
2. Render will automatically generate a connection string.

### 2. Backend Deployment (Web Service)
1. Create a new **Web Service** on Render connected to this repository.
2. Configure the following properties:
   - **Environment**: `Python`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Add the following **Environment Variables**:
   - `DATABASE_URL`: Link your created Render Postgres database (Render automatically injects this if you link the services).
   - `TELEGRAM_BOT_TOKEN`: (Optional) Your Telegram bot token.
   - `TELEGRAM_CHAT_ID`: (Optional) Your Telegram chat ID.
   - `FRONTEND_ORIGIN`: Comma-separated list of allowed frontend origins (e.g. `https://your-frontend.onrender.com`).
   - `CRON_SECRET`: A secure shared secret to authenticate the cron job (e.g. `SomeSuperSecureRandomToken123`).

### 3. Frontend Deployment (Static Site)
1. Create a new **Static Site** on Render connected to this repository.
2. Configure the following:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Publish Directory**: `dist`
3. Add the following **Environment Variables**:
   - `VITE_API_BASE_URL`: The URL of your deployed Render backend web service (e.g. `https://your-backend.onrender.com`).

### 4. Setting up Automated Background Sync
Render's free tier Web Services go to sleep after 15 minutes of inactivity. To ensure your meter balance is monitored and alerts are sent even when the app is asleep, configure an external cron service:
1. Go to [cron-job.org](https://cron-job.org/) (a free web cron service).
2. Create a new cron job configured to run every **2 hours**.
3. Set the Address to: `https://your-backend.onrender.com/api/refresh-all` (HTTP method: `POST`).
4. Under **Headers**, add a custom header:
   - **Key**: `X-Cron-Secret`
   - **Value**: The value of your `CRON_SECRET` environment variable.
5. Save the cron job. This request will wake up the backend server, fetch real-time balances, update the database, and send any necessary Telegram alerts.

---

## Credits
- Built by **Mahbubur Hamim**
- Contact: [hello@movnex.com](mailto:hello@movnex.com)
