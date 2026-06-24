from typing import List, Dict, Any
import datetime

def generate_insight(snapshots: List[Dict[str, Any]], daily_average: float, current_balance: float, days_remaining: float) -> str:
    """
    Generates a Bangla insight sentence based on balance snapshots and usage statistics.
    Keep this function isolated so it can later be swapped for an LLM call.
    """
    if not snapshots or len(snapshots) < 2:
        return "পর্যাপ্ত তথ্য নেই। ব্যালেন্স ট্র্যাকিং শুরু করতে দিন।"

    # Calculate today's usage
    today = datetime.date.today()
    today_snapshots = [s for s in snapshots if s["fetched_at"].date() == today]
    
    # Sort today's snapshots by time
    today_snapshots.sort(key=lambda x: x["fetched_at"])
    
    today_spend = 0.0
    if len(today_snapshots) >= 2:
        # Sum the drops today
        for i in range(1, len(today_snapshots)):
            diff = today_snapshots[i-1]["balance"] - today_snapshots[i]["balance"]
            if 0 < diff < 1000:  # Ignore increases (recharges) and extreme anomalies
                today_spend += diff
    elif len(snapshots) >= 2:
        # Fallback to the latest difference
        last_snap = snapshots[-1]
        prev_snap = snapshots[-2]
        diff = prev_snap["balance"] - last_snap["balance"]
        if 0 < diff < 1000:
            today_spend = diff

    # Rule-based insights
    if current_balance <= 0:
        return "আপনার মিটার ব্যালেন্স শেষ হয়ে গেছে! অনুগ্রহ করে অবিলম্বে রিচার্জ করুন।"

    if days_remaining <= 3:
        return f"সতর্কতা: আপনার ব্যালেন্স আগামী {round(days_remaining, 1)} দিনের মধ্যে ফুরিয়ে যাবে। দ্রুত রিচার্জ করুন।"

    if today_spend > daily_average * 1.3:
        return f"আজকের বিদ্যুৎ খরচ গড়ের চেয়ে বেশি (৳{round(today_spend, 2)})। অপ্রয়োজনীয় বৈদ্যুতিক যন্ত্রপাতি বন্ধ রাখুন।"
    
    if today_spend < daily_average * 0.7 and today_spend > 0:
        return "আজকের বিদ্যুৎ খরচ স্বাভাবিক গড়ের চেয়ে কম। চমৎকার সাশ্রয়!"
    
    if daily_average > 0:
        return f"আপনার দৈনিক গড় খরচ ৳{round(daily_average, 2)}। বর্তমান ব্যালেন্স দিয়ে মিটারটি প্রায় {round(days_remaining, 1)} দিন চলবে।"

    return "ব্যালেন্স স্বাভাবিক আছে। রিচার্জ ট্র্যাক করতে থাকুন।"
