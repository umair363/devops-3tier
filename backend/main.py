import os
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./local.db")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class RecordDB(Base):
    __tablename__ = "records"
    id = Column(Integer, primary_key=True, index=True)
    visitor_name = Column(String, index=True)
    text = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

app = FastAPI()

# Allow CORS for local testing, though Nginx handles it in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RecordItem(BaseModel):
    visitor_name: str
    text: str

@app.post("/insert")
def insert_record(item: RecordItem):
    db = SessionLocal()
    new_record = RecordDB(visitor_name=item.visitor_name, text=item.text)
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    db.close()
    return {"message": "Success", "id": new_record.id}

@app.get("/records")
def get_records():
    db = SessionLocal()
    records = db.query(RecordDB).order_by(RecordDB.created_at.desc()).all()
    db.close()
    return records
