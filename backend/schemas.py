from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class MeterCreate(BaseModel):
    meter_number: str = Field(..., description="NESCO prepaid meter or customer number")
    label: str = Field(..., description="Label for the meter, e.g. Home, Office")
    alert_threshold: float = Field(200.0, description="Alert threshold in Taka")

class MeterUpdate(BaseModel):
    label: Optional[str] = None
    alert_threshold: Optional[float] = None

class MeterResponse(BaseModel):
    id: int
    meter_number: str
    label: str
    alert_threshold: float
    customer_name: Optional[str] = None
    latest_balance: Optional[float] = None
    days_remaining: Optional[float] = None
    is_stale: Optional[bool] = False
    last_fetched_at: Optional[datetime] = None
    status: Optional[str] = "normal"
    due_notice: Optional[str] = None

    class Config:
        from_attributes = True

class BalanceSnapshotResponse(BaseModel):
    id: int
    meter_id: int
    balance: float
    fetched_at: datetime
    is_manual: bool
    is_stale: bool

    class Config:
        from_attributes = True

class ManualBalanceCreate(BaseModel):
    balance: float

class SettingsResponse(BaseModel):
    telegram_chat_id: Optional[str] = None

    class Config:
        from_attributes = True

class SettingsUpdate(BaseModel):
    telegram_chat_id: Optional[str] = None

class TelegramBotInfoResponse(BaseModel):
    is_configured: bool
    bot_username: Optional[str] = None
    is_linked: bool
    chat_id: Optional[str] = None

