from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import json as pyjson

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/swap/ton-to-jetton")
async def swap_ton_to_jetton(request: Request):
    data = await request.json()
    user_address = data["user_address"]
    amount = data["amount"]  # строка, например "1"
    result = subprocess.run(
        [
            "node", "ton-swap/swap.js", user_address, amount
        ],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        return {"error": result.stderr}
    try:
        tx_params = pyjson.loads(result.stdout)
    except Exception:
        return {"error": "Ошибка парсинга ответа"}
    return tx_params 