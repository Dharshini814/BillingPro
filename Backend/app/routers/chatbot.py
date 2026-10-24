import json
import logging
import traceback
import uuid
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from jose import jwt, JWTError

from app.database import get_db
from app.core.security import SECRET_KEY, ALGORITHM
from app.models.user import User
from app.models.customer import Customer
from app.models.chat_history import ChatHistory
from app.schemas.chatbot import (
    ChatMessageRequest,
    ChatMessageResponse,
    ChatHistoryResponse,
    ChatHistoryItem,
    ClearHistoryResponse,
)
from app.services.ai_service import (
    get_ai_provider,
    CUSTOMER_SYSTEM_PROMPT,
    ADMIN_SYSTEM_PROMPT,
    TOOL_DEFINITIONS_CUSTOMER,
    TOOL_DEFINITIONS_ADMIN,
)
from app.services.chatbot_tools import (
    execute_customer_tool,
    execute_admin_tool,
)

router = APIRouter(prefix="/chat", tags=["Chatbot"])

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Authentication Dependencies
# ─────────────────────────────────────────────────────────────────────────────

async def get_current_user(
    token: str = Depends(lambda: None),  # We'll extract from header manually
    db: Session = Depends(get_db),
) -> User:
    """Extract and validate JWT token, return current user."""
    from fastapi import Request, Header

    # This will be overridden by the actual dependency
    pass


def get_current_user_dependency():
    """Create a dependency that extracts user from Authorization header."""
    async def _get_current_user(
        authorization: Optional[str] = Header(None),
        db: Session = Depends(get_db),
    ) -> User:
        if not authorization:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )

        try:
            scheme, token = authorization.split()
            if scheme.lower() != "bearer":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication scheme",
                    headers={"WWW-Authenticate": "Bearer"},
                )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization header",
                headers={"WWW-Authenticate": "Bearer"},
            )

        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id: int = payload.get("user_id")
            if user_id is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token payload",
                    headers={"WWW-Authenticate": "Bearer"},
                )
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if user.status != "Active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is not active",
            )

        return user

    return _get_current_user


get_current_user = get_current_user_dependency()


def get_customer_id(user: User, db: Session) -> int:
    """Get the customer_id associated with the authenticated user."""
    customer = db.query(Customer).filter(func.lower(Customer.email) == user.email.lower()).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer profile not found for this user",
        )
    return customer.id


# ─────────────────────────────────────────────────────────────────────────────
# Chat History Helpers
# ─────────────────────────────────────────────────────────────────────────────

def save_message(db: Session, user_id: int, conversation_id: str, role: str, content: str) -> ChatHistory:
    """Save a chat message to history."""
    msg = ChatHistory(
        user_id=user_id,
        conversation_id=conversation_id,
        role=role,
        content=content,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


def get_conversation_history(db: Session, user_id: int, conversation_id: str) -> List[ChatHistory]:
    """Get all messages for a conversation."""
    return (
        db.query(ChatHistory)
        .filter(
            ChatHistory.user_id == user_id,
            ChatHistory.conversation_id == conversation_id,
        )
        .order_by(ChatHistory.created_at.asc())
        .all()
    )


def get_user_conversations(db: Session, user_id: int) -> List[str]:
    """Get list of conversation IDs for a user."""
    return [
        row[0] for row in
        db.query(ChatHistory.conversation_id)
        .filter(ChatHistory.user_id == user_id)
        .distinct()
        .order_by(desc(ChatHistory.created_at))
        .all()
    ]


def clear_conversation(db: Session, user_id: int, conversation_id: str) -> int:
    """Delete all messages in a conversation."""
    result = db.query(ChatHistory).filter(
        ChatHistory.user_id == user_id,
        ChatHistory.conversation_id == conversation_id,
    ).delete()
    db.commit()
    return result


# ─────────────────────────────────────────────────────────────────────────────
# AI Response Generation
# ─────────────────────────────────────────────────────────────────────────────

async def generate_ai_response(
    user: User,
    customer_id: Optional[int],
    message: str,
    conversation_history: List[ChatHistory],
    db: Session,
) -> tuple[str, List[str]]:
    """
    Generate AI response using tools.
    Returns (answer, sources).
    """
    provider = get_ai_provider()

    if not provider.is_configured():
        logger.warning("AI provider not configured, using mock responses")

    # Determine role and select appropriate tools/prompt
    is_admin = user.role == "admin"
    system_prompt = ADMIN_SYSTEM_PROMPT if is_admin else CUSTOMER_SYSTEM_PROMPT
    tool_definitions = TOOL_DEFINITIONS_ADMIN if is_admin else TOOL_DEFINITIONS_CUSTOMER

    # Build conversation messages
    messages = [{"role": "system", "content": system_prompt}]

    # Add conversation history (last 10 messages to keep context manageable)
    for hist in conversation_history[-10:]:
        messages.append({"role": hist.role, "content": hist.content})

    # Add current user message
    messages.append({"role": "user", "content": message})

    sources = []
    max_tool_calls = 3  # Prevent infinite loops

    for _ in range(max_tool_calls):
        response = await provider.generate_response(
            messages=messages,
            tools=tool_definitions,
            temperature=0.3,
            max_tokens=1500,
        )

        content = response.get("content", "")
        tool_calls = response.get("tool_calls")

        if not tool_calls:
            # No tool calls, return the response
            return content, sources

        # Execute tool calls
        for tool_call in tool_calls:
            tool_name = tool_call["name"]
            try:
                arguments = json.loads(tool_call["arguments"]) if isinstance(tool_call["arguments"], str) else tool_call["arguments"]
            except json.JSONDecodeError:
                arguments = {}

            logger.info(f"Executing tool: {tool_name} with args: {arguments}")

            if is_admin:
                result = execute_admin_tool(db, tool_name, arguments)
            else:
                if customer_id is None:
                    result = {"error": "Customer ID not available"}
                else:
                    result = execute_customer_tool(db, customer_id, tool_name, arguments)

            # Add tool result to messages for next iteration
            messages.append({
                "role": "assistant",
                "content": content,
                "tool_calls": [tool_call],
            })
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call["id"],
                "name": tool_name,
                "content": json.dumps(result),
            })

            # Track sources
            if isinstance(result, dict) and not result.get("error"):
                sources.append(f"{tool_name}: {json.dumps(result)[:200]}")
            elif isinstance(result, list) and result:
                sources.append(f"{tool_name}: {len(result)} items returned")

    # If we exhausted tool calls, make a final request without tools
    final_response = await provider.generate_response(
        messages=messages,
        tools=None,
        temperature=0.3,
        max_tokens=1500,
    )

    return final_response.get("content", "I apologize, but I couldn't complete that request."), sources


# ─────────────────────────────────────────────────────────────────────────────
# API Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/message", response_model=ChatMessageResponse)
async def send_message(
    request: ChatMessageRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Send a message to the AI chatbot and get a response.
    """
    # Validate message
    if not request.message or not request.message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty",
        )

    # Get or create conversation ID
    conversation_id = request.conversation_id or str(uuid.uuid4())

    # Get customer_id for non-admin users
    customer_id = None
    if user.role != "admin":
        customer = db.query(Customer).filter(func.lower(Customer.email) == user.email.lower()).first()
        if customer:
            customer_id = customer.id
        else:
            # User exists but no customer profile - this shouldn't happen normally
            customer_id = None

    # Save user message
    save_message(db, user.id, conversation_id, "user", request.message.strip())

    # Get conversation history
    history = get_conversation_history(db, user.id, conversation_id)

    # Generate AI response
    try:
        answer, sources = await generate_ai_response(
            user=user,
            customer_id=customer_id,
            message=request.message.strip(),
            conversation_history=history,
            db=db,
        )
    except Exception as e:
        logger.error(f"Error generating AI response: {e}")
        logger.error(traceback.format_exc())
        answer = "I'm sorry, I encountered an error processing your request. Please try again."
        sources = []

    # Save assistant response
    save_message(db, user.id, conversation_id, "assistant", answer)

    return ChatMessageResponse(
        answer=answer,
        sources=sources,
        conversation_id=conversation_id,
    )


@router.get("/history/{conversation_id}", response_model=ChatHistoryResponse)
def get_chat_history(
    conversation_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get chat history for a specific conversation.
    """
    history = get_conversation_history(db, user.id, conversation_id)

    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    return ChatHistoryResponse(
        conversation_id=conversation_id,
        messages=[
            ChatHistoryItem(
                role=msg.role,
                content=msg.content,
                timestamp=msg.created_at,
            )
            for msg in history
        ],
    )


@router.get("/history", response_model=List[str])
def list_conversations(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List all conversation IDs for the current user.
    """
    return get_user_conversations(db, user.id)


@router.delete("/history/{conversation_id}", response_model=ClearHistoryResponse)
def clear_chat_history(
    conversation_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Clear chat history for a specific conversation.
    """
    deleted = clear_conversation(db, user.id, conversation_id)

    if deleted == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    return ClearHistoryResponse(
        message=f"Cleared {deleted} messages from conversation",
    )