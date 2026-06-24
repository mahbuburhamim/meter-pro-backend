from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from .database import Base
import datetime

class Meter(Base):
    __tablename__ = "meters"

    id = Column(Integer, primary_key=True, index=True)
    meter_number = Column(String, unique=True, index=True, nullable=False)
    label = Column(String, nullable=False)
    alert_threshold = Column(Float, default=200.0)
    customer_name = Column(String, nullable=True)

    snapshots = relationship("BalanceSnapshot", back_populates="meter", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="meter", cascade="all, delete-orphan")

class BalanceSnapshot(Base):
    __tablename__ = "balance_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    meter_id = Column(Integer, ForeignKey("meters.id"), nullable=False)
    balance = Column(Float, nullable=False)
    fetched_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_manual = Column(Boolean, default=False)
    is_stale = Column(Boolean, default=False)

    meter = relationship("Meter", back_populates="snapshots")

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    meter_id = Column(Integer, ForeignKey("meters.id"), nullable=False)
    triggered_at = Column(DateTime, default=datetime.datetime.utcnow)
    balance_at_trigger = Column(Float, nullable=False)
    sent = Column(Boolean, default=False)

    meter = relationship("Meter", back_populates="alerts")

class AppSettings(Base):
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, index=True)
    telegram_bot_token = Column(String, nullable=True)
    telegram_chat_id = Column(String, nullable=True)
