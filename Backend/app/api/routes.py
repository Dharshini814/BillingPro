from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "FastAPI backend is alive"
    }

@router.get("/test")
def test_api():
    return {
        "message": "Test API working fine"
    }