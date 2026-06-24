import os
import datetime
import random
import requests
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from .database import get_db, engine, Base
from . import models, schemas, insights
from .nesco_client import NescoClient

# Initialize Database
Base.metadata.create_all(bind=engine)

app = FastAPI(title="NESCO Balance Tracker API")

# Enable CORS
frontend_origin_env = os.environ.get("FRONTEND_ORIGIN", "*")
if frontend_origin_env == "*":
    origins = ["*"]
else:
    origins = [origin.strip() for origin in frontend_origin_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper functions for calculations

def calculate_meter_metrics(db: Session, meter_id: int, current_balance: float):
    """
    Calculates daily average spend and estimated days remaining based on snapshots from the last 7 days.
    """
    seven_days_ago = datetime.datetime.now() - datetime.timedelta(days=7)
    snapshots = db.query(models.BalanceSnapshot).filter(
        models.BalanceSnapshot.meter_id == meter_id,
        models.BalanceSnapshot.fetched_at >= seven_days_ago
    ).order_by(models.BalanceSnapshot.fetched_at.asc()).all()

    if not snapshots or len(snapshots) < 2:
        return 50.0, 999.0  # default fallbacks

    total_drops = 0.0
    for i in range(1, len(snapshots)):
        diff = snapshots[i-1].balance - snapshots[i].balance
        # Sum drops, ignore recharges (negative diff) and database adjustments
        if 0 < diff < 5000:
            total_drops += diff

    time_span_seconds = (snapshots[-1].fetched_at - snapshots[0].fetched_at).total_seconds()
    time_span_days = time_span_seconds / (24 * 3600)

    # Fallback to a default if data spans less than 6 hours
    if time_span_days < 0.25:
        daily_average = 50.0
    else:
        daily_average = total_drops / time_span_days
        if daily_average <= 0:
            daily_average = 50.0

    # Sensible bounds
    daily_average = max(5.0, min(daily_average, 2000.0))
    days_remaining = current_balance / daily_average

    return round(daily_average, 2), round(days_remaining, 1)

def send_telegram_notification(db: Session, meter: models.Meter, balance: float, days_remaining: float):
    """
    Sends a low-balance alert to Telegram if a bot token and chat ID are configured.
    """
    settings = db.query(models.AppSettings).first()
    bot_token = settings.telegram_bot_token if settings else None
    chat_id = settings.telegram_chat_id if settings else None

    # Fallback to environment variables
    if not bot_token:
        bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not chat_id:
        chat_id = os.environ.get("TELEGRAM_CHAT_ID")

    if not bot_token or not chat_id:
        print("Telegram Bot Token or Chat ID not configured. Skipping alert.")
        return

    message = (
        f"⚠️ *কম ব্যালেন্স অ্যালার্ট! (NESCO Low Balance)*\n\n"
        f"মিটার লেবেল: {meter.label}\n"
        f"মিটার নম্বর: `{meter.meter_number}`\n"
        f"গ্রাহক: {meter.customer_name or 'N/A'}\n"
        f"বর্তমান ব্যালেন্স: *৳{balance:.2f}*\n"
        f"অ্যালার্ট সীমা: ৳{meter.alert_threshold:.2f}\n"
        f"চলবে (প্রাক্কলিত): *{days_remaining:.1f} দিন*\n\n"
        f"অনুগ্রহ করে দ্রুত আপনার মিটার রিচার্জ করুন!"
    )

    try:
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": message,
            "parse_mode": "Markdown"
        }
        resp = requests.post(url, json=payload, timeout=10)
        if resp.status_code == 200:
            print(f"Telegram notification sent for meter {meter.meter_number}")
            return True
        else:
            print(f"Failed to send Telegram notification: {resp.text}")
    except Exception as e:
        print(f"Error sending Telegram notification: {str(e)}")
    return False

def check_low_balance_alerts(db: Session, meter: models.Meter, balance: float, days_remaining: float):
    """
    Triggers an alert if balance is below threshold and no alert has been sent for this low-balance period.
    """
    if balance >= meter.alert_threshold:
        return

    # Find the last snapshot where the balance was above the threshold.
    # An alert is sent once per "drop" below the threshold.
    last_good_snapshot = db.query(models.BalanceSnapshot).filter(
        models.BalanceSnapshot.meter_id == meter.id,
        models.BalanceSnapshot.balance >= meter.alert_threshold
    ).order_by(models.BalanceSnapshot.fetched_at.desc()).first()

    alert_query = db.query(models.Alert).filter(models.Alert.meter_id == meter.id)
    if last_good_snapshot:
        alert_query = alert_query.filter(models.Alert.triggered_at > last_good_snapshot.fetched_at)
    
    existing_alert = alert_query.order_by(models.Alert.triggered_at.desc()).first()

    if existing_alert and existing_alert.sent:
        # Already sent an alert for this drop period
        return

    if not existing_alert:
        # Create alert entry
        existing_alert = models.Alert(
            meter_id=meter.id,
            balance_at_trigger=balance,
            sent=False
        )
        db.add(existing_alert)
        db.commit()
        db.refresh(existing_alert)

    # Try sending notification
    sent_successfully = send_telegram_notification(db, meter, balance, days_remaining)
    if sent_successfully:
        existing_alert.sent = True
        db.commit()

def fetch_and_save_balance(db: Session, meter: models.Meter) -> models.BalanceSnapshot:
    """
    Performs a live NESCO balance fetch and saves it. On failure, replicates the last successful
    snapshot marked as stale.
    """
    client = NescoClient(meter.meter_number)
    try:
        data = client.fetch_all()
        # Save customer name if not set
        if not meter.customer_name and data.get("customer_name"):
            meter.customer_name = data["customer_name"]
            db.commit()

        snapshot = models.BalanceSnapshot(
            meter_id=meter.id,
            balance=data["balance"],
            fetched_at=datetime.datetime.now(),
            is_manual=False,
            is_stale=False
        )
        db.add(snapshot)
        db.commit()
        db.refresh(snapshot)

        # Trigger alert checks
        daily_average, days_remaining = calculate_meter_metrics(db, meter.id, data["balance"])
        check_low_balance_alerts(db, meter, data["balance"], days_remaining)

        return snapshot

    except Exception as e:
        print(f"Error fetching live data for meter {meter.meter_number}: {str(e)}")
        # Get the last successful snapshot to serve stale data
        last_snap = db.query(models.BalanceSnapshot).filter(
            models.BalanceSnapshot.meter_id == meter.id
        ).order_by(models.BalanceSnapshot.fetched_at.desc()).first()

        if last_snap:
            # Save a copy as stale
            stale_snap = models.BalanceSnapshot(
                meter_id=meter.id,
                balance=last_snap.balance,
                fetched_at=datetime.datetime.now(),
                is_manual=last_snap.is_manual,
                is_stale=True
            )
            db.add(stale_snap)
            db.commit()
            db.refresh(stale_snap)
            return stale_snap
        else:
            # If no snapshot exists at all, save a 0.0 balance stale snapshot
            stale_snap = models.BalanceSnapshot(
                meter_id=meter.id,
                balance=0.0,
                fetched_at=datetime.datetime.now(),
                is_manual=False,
                is_stale=True
            )
            db.add(stale_snap)
            db.commit()
            db.refresh(stale_snap)
            return stale_snap

# Background scheduler job
def scheduled_balance_fetch():
    db = next(get_db())
    try:
        meters = db.query(models.Meter).all()
        for meter in meters:
            fetch_and_save_balance(db, meter)
    except Exception as e:
        print(f"Error in background fetch task: {str(e)}")
    finally:
        db.close()

# Scheduler Startup/Shutdown
scheduler = BackgroundScheduler()

@app.on_event("startup")
def startup_event():
    # Database seeding
    db = next(get_db())
    try:
        # Check if settings exist, if not create empty settings
        settings = db.query(models.AppSettings).first()
        if not settings:
            new_settings = models.AppSettings(telegram_bot_token=None, telegram_chat_id=None)
            db.add(new_settings)
            db.commit()

        # Seed initial test meter
        meters_count = db.query(models.Meter).count()
        if meters_count == 0:
            print("Seeding database with test meter and 10 days of snapshots...")
            test_meter = models.Meter(
                meter_number="TEST12345",
                label="বাসা (Home)",
                alert_threshold=200.0,
                customer_name="মাহবুবুর রহমান হামিম"
            )
            db.add(test_meter)
            db.commit()
            db.refresh(test_meter)

            # Seed 10 days of snapshots (every 2 hours)
            now = datetime.datetime.now()
            current_balance = 1050.0
            snapshots_to_seed = []

            # 10 days * 12 snapshots/day = 120 snapshots
            for i in range(120, -1, -1):
                fetched_time = now - datetime.timedelta(hours=i * 2)
                
                # Recharge 5 days ago (60 snapshots ago)
                if i == 60:
                    current_balance += 1000.0

                # Consume electricity
                consumption = random.uniform(3.5, 6.5)
                current_balance -= consumption
                if current_balance < 0:
                    current_balance = 0.0

                snapshot = models.BalanceSnapshot(
                    meter_id=test_meter.id,
                    balance=round(current_balance, 2),
                    fetched_at=fetched_time,
                    is_manual=False,
                    is_stale=False
                )
                snapshots_to_seed.append(snapshot)
            
            db.add_all(snapshots_to_seed)
            db.commit()
            print("Seeding complete.")

    finally:
        db.close()

    # Start APScheduler: runs every 2 hours
    scheduler.add_job(
        scheduled_balance_fetch,
        IntervalTrigger(hours=2),
        id="nesco_balance_fetcher",
        replace_existing=True
    )
    scheduler.start()
    print("APScheduler started.")

@app.on_event("shutdown")
def shutdown_event():
    scheduler.shutdown()
    print("APScheduler shut down.")


# API Endpoints

@app.post("/api/meters", response_model=schemas.MeterResponse)
def add_meter(meter_data: schemas.MeterCreate, db: Session = Depends(get_db)):
    # Check if meter already exists
    existing = db.query(models.Meter).filter(models.Meter.meter_number == meter_data.meter_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Meter with this number already exists")

    new_meter = models.Meter(
        meter_number=meter_data.meter_number,
        label=meter_data.label,
        alert_threshold=meter_data.alert_threshold
    )
    db.add(new_meter)
    db.commit()
    db.refresh(new_meter)

    # Perform initial balance fetch
    fetch_and_save_balance(db, new_meter)
    
    # Calculate initial metrics
    latest_snap = db.query(models.BalanceSnapshot).filter(
        models.BalanceSnapshot.meter_id == new_meter.id
    ).order_by(models.BalanceSnapshot.fetched_at.desc()).first()

    balance = latest_snap.balance if latest_snap else 0.0
    daily_average, days_remaining = calculate_meter_metrics(db, new_meter.id, balance)

    return schemas.MeterResponse(
        id=new_meter.id,
        meter_number=new_meter.meter_number,
        label=new_meter.label,
        alert_threshold=new_meter.alert_threshold,
        customer_name=new_meter.customer_name,
        latest_balance=balance,
        days_remaining=days_remaining,
        is_stale=latest_snap.is_stale if latest_snap else False,
        last_fetched_at=latest_snap.fetched_at if latest_snap else None
    )

@app.get("/api/meters", response_model=List[schemas.MeterResponse])
def list_meters(db: Session = Depends(get_db)):
    meters = db.query(models.Meter).all()
    results = []
    for meter in meters:
        latest_snap = db.query(models.BalanceSnapshot).filter(
            models.BalanceSnapshot.meter_id == meter.id
        ).order_by(models.BalanceSnapshot.fetched_at.desc()).first()

        balance = latest_snap.balance if latest_snap else 0.0
        daily_average, days_remaining = calculate_meter_metrics(db, meter.id, balance)

        results.append(schemas.MeterResponse(
            id=meter.id,
            meter_number=meter.meter_number,
            label=meter.label,
            alert_threshold=meter.alert_threshold,
            customer_name=meter.customer_name,
            latest_balance=balance,
            days_remaining=days_remaining,
            is_stale=latest_snap.is_stale if latest_snap else False,
            last_fetched_at=latest_snap.fetched_at if latest_snap else None
        ))
    return results

@app.patch("/api/meters/{id}/settings", response_model=schemas.MeterResponse)
def update_meter_settings(id: int, data: schemas.MeterUpdate, db: Session = Depends(get_db)):
    meter = db.query(models.Meter).filter(models.Meter.id == id).first()
    if not meter:
        raise HTTPException(status_code=404, detail="Meter not found")

    if data.label is not None:
        meter.label = data.label
    if data.alert_threshold is not None:
        meter.alert_threshold = data.alert_threshold
    db.commit()
    db.refresh(meter)

    latest_snap = db.query(models.BalanceSnapshot).filter(
        models.BalanceSnapshot.meter_id == meter.id
    ).order_by(models.BalanceSnapshot.fetched_at.desc()).first()

    balance = latest_snap.balance if latest_snap else 0.0
    daily_average, days_remaining = calculate_meter_metrics(db, meter.id, balance)

    return schemas.MeterResponse(
        id=meter.id,
        meter_number=meter.meter_number,
        label=meter.label,
        alert_threshold=meter.alert_threshold,
        customer_name=meter.customer_name,
        latest_balance=balance,
        days_remaining=days_remaining,
        is_stale=latest_snap.is_stale if latest_snap else False,
        last_fetched_at=latest_snap.fetched_at if latest_snap else None
    )

@app.post("/api/meters/{id}/refresh", response_model=schemas.BalanceSnapshotResponse)
def force_refresh_balance(id: int, db: Session = Depends(get_db)):
    meter = db.query(models.Meter).filter(models.Meter.id == id).first()
    if not meter:
        raise HTTPException(status_code=404, detail="Meter not found")

    snapshot = fetch_and_save_balance(db, meter)
    return snapshot

@app.post("/api/meters/{id}/manual-balance", response_model=schemas.BalanceSnapshotResponse)
def manual_balance_override(id: int, override: schemas.ManualBalanceCreate, db: Session = Depends(get_db)):
    meter = db.query(models.Meter).filter(models.Meter.id == id).first()
    if not meter:
        raise HTTPException(status_code=404, detail="Meter not found")

    snapshot = models.BalanceSnapshot(
        meter_id=meter.id,
        balance=override.balance,
        fetched_at=datetime.datetime.now(),
        is_manual=True,
        is_stale=False
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)

    # Recalculate and trigger alert if below threshold
    daily_average, days_remaining = calculate_meter_metrics(db, meter.id, override.balance)
    check_low_balance_alerts(db, meter, override.balance, days_remaining)

    return snapshot

@app.delete("/api/meters/{id}")
def delete_meter(id: int, db: Session = Depends(get_db)):
    meter = db.query(models.Meter).filter(models.Meter.id == id).first()
    if not meter:
        raise HTTPException(status_code=404, detail="Meter not found")
    db.delete(meter)
    db.commit()
    return {"message": "Meter deleted successfully"}

@app.get("/api/meters/{id}/history")
def get_meter_history(id: int, range_str: str = Query("7d", alias="range", pattern="^(7d|30d|1y)$"), db: Session = Depends(get_db)):
    meter = db.query(models.Meter).filter(models.Meter.id == id).first()
    if not meter:
        raise HTTPException(status_code=404, detail="Meter not found")

    # Define date filter
    now = datetime.datetime.now()
    if range_str == "7d":
        start_date = now - datetime.timedelta(days=7)
    elif range_str == "30d":
        start_date = now - datetime.timedelta(days=30)
    else:  # 1y
        start_date = now - datetime.timedelta(days=365)

    # Query snapshots in range ordered ascending
    snapshots = db.query(models.BalanceSnapshot).filter(
        models.BalanceSnapshot.meter_id == id,
        models.BalanceSnapshot.fetched_at >= start_date
    ).order_by(models.BalanceSnapshot.fetched_at.asc()).all()

    # Calculate aggregate metrics
    latest_snap = snapshots[-1] if snapshots else None
    balance = latest_snap.balance if latest_snap else 0.0
    daily_average, days_remaining = calculate_meter_metrics(db, id, balance)

    # Group usage by day
    # We iterate and calculate usage between transitions
    daily_usage = {}
    
    # Initialize dictionary with zeros for all days in range to avoid empty gaps in chart
    days_count = 7 if range_str == "7d" else (30 if range_str == "30d" else 365)
    for d in range(days_count):
        day_date = (now - datetime.timedelta(days=d)).strftime("%Y-%m-%d")
        daily_usage[day_date] = {"usage": 0.0, "balance": 0.0}

    # Sum drops on each day
    for i in range(1, len(snapshots)):
        diff = snapshots[i-1].balance - snapshots[i].balance
        if 0 < diff < 5000:
            date_str = snapshots[i].fetched_at.strftime("%Y-%m-%d")
            if date_str in daily_usage:
                daily_usage[date_str]["usage"] += diff

    # Fill daily ending balances
    for date_str in daily_usage:
        # Find the last snapshot on that day
        day_snaps = [s for s in snapshots if s.fetched_at.strftime("%Y-%m-%d") == date_str]
        if day_snaps:
            daily_usage[date_str]["balance"] = round(day_snaps[-1].balance, 2)
        else:
            # Fallback to the balance of the closest preceding snapshot
            prev_snap = db.query(models.BalanceSnapshot).filter(
                models.BalanceSnapshot.meter_id == id,
                models.BalanceSnapshot.fetched_at < datetime.datetime.strptime(date_str, "%Y-%m-%d")
            ).order_by(models.BalanceSnapshot.fetched_at.desc()).first()
            if prev_snap:
                daily_usage[date_str]["balance"] = round(prev_snap.balance, 2)

    # Format the daily usage list for charts
    history_list = []
    for date_str, data in daily_usage.items():
        history_list.append({
            "date": date_str,
            "usage": round(data["usage"], 2),
            "balance": round(data["balance"], 2)
        })
    history_list.sort(key=lambda x: x["date"])

    # Calculate month spend (total consumption in the current calendar month)
    current_month_start = datetime.datetime(now.year, now.month, 1)
    month_snapshots = db.query(models.BalanceSnapshot).filter(
        models.BalanceSnapshot.meter_id == id,
        models.BalanceSnapshot.fetched_at >= current_month_start
    ).order_by(models.BalanceSnapshot.fetched_at.asc()).all()

    month_spend = 0.0
    for i in range(1, len(month_snapshots)):
        diff = month_snapshots[i-1].balance - month_snapshots[i].balance
        if 0 < diff < 5000:
            month_spend += diff

    estimated_bill = daily_average * 30

    # Fetch live extra info (recharge history & monthly consumption) from NESCO Client
    recharge_history = []
    monthly_consumption = []
    
    client = NescoClient(meter.meter_number)
    try:
        # This will either fetch live or serve simulated demo data
        nesco_data = client.fetch_all()
        recharge_history = nesco_data.get("recharge_history", [])
        monthly_consumption = nesco_data.get("monthly_consumption", [])
    except Exception as e:
        print(f"Error fetching extra NESCO details for history: {str(e)}")

    # Generate Bangla insight sentence
    snapshot_dicts = [{"balance": s.balance, "fetched_at": s.fetched_at} for s in snapshots]
    bangla_insight = insights.generate_insight(snapshot_dicts, daily_average, balance, days_remaining)

    # Highest daily spend in range
    highest_daily_spend = max([h["usage"] for h in history_list]) if history_list else 0.0

    return {
        "history": history_list,
        "recharges": recharge_history,
        "monthly_consumption": monthly_consumption,
        "insight": bangla_insight,
        "daily_average": daily_average,
        "days_remaining": days_remaining,
        "month_spend": round(month_spend, 2),
        "estimated_bill": round(estimated_bill, 2),
        "highest_daily_spend": round(highest_daily_spend, 2),
        "total_spend": round(sum([h["usage"] for h in history_list]), 2)
    }

@app.get("/api/settings", response_model=schemas.SettingsResponse)
def get_app_settings(db: Session = Depends(get_db)):
    settings = db.query(models.AppSettings).first()
    if not settings:
        return schemas.SettingsResponse(telegram_bot_token="", telegram_chat_id="")
    return settings

@app.post("/api/settings", response_model=schemas.SettingsResponse)
def update_app_settings(data: schemas.SettingsUpdate, db: Session = Depends(get_db)):
    settings = db.query(models.AppSettings).first()
    if not settings:
        settings = models.AppSettings()
        db.add(settings)
    
    if data.telegram_bot_token is not None:
        settings.telegram_bot_token = data.telegram_bot_token
    if data.telegram_chat_id is not None:
        settings.telegram_chat_id = data.telegram_chat_id
    
    db.commit()
    db.refresh(settings)
    return settings

@app.post("/api/refresh-all")
def refresh_all_meters(request: Request, db: Session = Depends(get_db)):
    cron_secret_env = os.environ.get("CRON_SECRET")
    if not cron_secret_env:
        raise HTTPException(
            status_code=500,
            detail="CRON_SECRET environment variable is not configured on server."
        )
    
    auth_header = request.headers.get("X-Cron-Secret")
    if auth_header != cron_secret_env:
        raise HTTPException(
            status_code=401,
            detail="Unauthorized: Invalid cron secret."
        )
        
    meters = db.query(models.Meter).all()
    results = []
    for meter in meters:
        try:
            fetch_and_save_balance(db, meter)
            results.append({"meter": meter.meter_number, "status": "refreshed"})
        except Exception as e:
            results.append({"meter": meter.meter_number, "status": "failed", "error": str(e)})
            
    return {"refreshed": True, "results": results}
