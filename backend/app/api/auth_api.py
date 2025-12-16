from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.db import get_db
from app.services.auth_service import (
    register_user,
    login_user,
    get_user_from_token
)

router = APIRouter()
security = HTTPBearer()

# Pydantic models
class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    user_id: str
    email: str
    username: str
    token: str

class MessageResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

# Dependency để lấy current user từ token
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db = Depends(get_db)
):
    """
    Dependency để verify token và lấy user hiện tại
    Sử dụng trong các protected routes
    """
    token = credentials.credentials
    user = get_user_from_token(db, token)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ hoặc đã hết hạn"
        )
    
    return user

# Routes
@router.post("/auth/register", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest, db = Depends(get_db)):
    """API đăng ký user mới"""
    success, message, user_data = register_user(
        db,
        request.email,
        request.username,
        request.password
    )
    
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
    
    return {
        "success": True,
        "message": message,
        "data": user_data
    }

@router.post("/auth/login", response_model=MessageResponse)
async def login(request: LoginRequest, db = Depends(get_db)):
    """API đăng nhập"""
    success, message, user_data = login_user(
        db,
        request.username,
        request.password
    )
    
    if not success:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=message)
    
    return {
        "success": True,
        "message": message,
        "data": user_data
    }

@router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """API lấy thông tin user hiện tại (cần token)"""
    return {
        "success": True,
        "data": current_user
    }

@router.get("/auth/protected")
async def protected_route(current_user: dict = Depends(get_current_user)):
    """
    Example protected route - chỉ user đã đăng nhập mới access được
    Sử dụng Depends(get_current_user) cho bất kỳ route nào cần authentication
    """
    return {
        "success": True,
        "message": f"Hello {current_user['username']}! This is a protected route.",
        "user": current_user
    }