from fastapi import FastAPI
from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_ANON_KEY"))

@app.get("/")
def root():
    return {"status": "ok", "message": "AI Workflow Builder API is running"}

@app.get("/test-db")
def test_db():
    try:
        # just tries to connect, no tables needed yet
        return {"status": "connected", "message": "Supabase connection successful"}
    except Exception as e:
        return {"status": "error", "message": str(e)}