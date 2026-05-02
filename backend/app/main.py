from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import register_routes
import os
os.environ["TZ"] = "Asia/Bangkok"
import time
time.tzset()

from app.services import scheduler as sched
from app.routes.restaurant import set_reschedule_fn


@asynccontextmanager
async def lifespan(app: FastAPI):
    set_reschedule_fn(sched.schedule_restaurant)
    sched.start()
    yield
    sched.stop()


app = FastAPI(title="MunchBox API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_routes(app)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=True)
