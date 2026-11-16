from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers import quotes, runtime
app.include_router(quotes.router)
app.include_router(runtime.router)

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_ANON_KEY"))

@app.get("/")
def root():
    return {"status": "ok", "message": "AI Workflow Builder API is running"}

@app.get("/test-db")
def test_db():
    try:
        return {"status": "connected", "message": "Supabase connection successful"}
    except Exception as e:
        return {"status": "error", "message": str(e)}