import uvicorn
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from src.config import config
from src.endpoints.dictionary import router as dictionary
from src.endpoints.matchmaking import router as match_router
from src.endpoints.websockets import router as websockets

from src.logconf import opt_logger as log

logger = log.setup_logger("main")

# Создаем единственный экземпляр FastAPI
app = FastAPI()
app.add_middleware(
    CORSMiddleware, # noqa
    allow_origins=["*"],
    allow_credentials=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# Подключаем роутеры
app.include_router(dictionary)
app.include_router(match_router)
app.include_router(websockets)


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=config.this_host,
        port=config.this_port,
        reload=True,
    )