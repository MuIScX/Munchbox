from fastapi import Security, HTTPException
from fastapi.security.api_key import APIKeyHeader
import os

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

async def verify_api_key(api_key: str = Security(api_key_header)):
    expected = os.getenv("INTAKE_API_KEY")
    if not expected or api_key != expected:
        raise HTTPException(status_code=403, detail="Invalid or missing API key")
    return api_key
