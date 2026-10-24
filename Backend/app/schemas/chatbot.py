from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    conversation_id: Optional[str] = None


class ChatMessageResponse(BaseModel):
    answer: str
    sources: List[str] = []
    conversation_id: str


class ChatHistoryItem(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    timestamp: datetime

    class Config:
        from_attributes = True


class ChatHistoryResponse(BaseModel):
    conversation_id: str
    messages: List[ChatHistoryItem]


class ClearHistoryResponse(BaseModel):
    message: str