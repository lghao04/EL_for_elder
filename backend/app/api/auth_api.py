from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional
import cloudinary
import cloudinary.uploader
import os

from app.db import get_db
from app.services.auth_service import (
    register_user,
    login_user,
    get_user_from_token,
    update_profile,
    update_account_name,
    update_profile_image,
)

# Cloudinary config
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)

router = APIRouter()
security = HTTPBearer()

# ── Pydantic models ───────────────────────────────────────────────────────────

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

class UpdateProfileRequest(BaseModel):
    account_name: Optional[str] = None
    profile_image: Optional[str] = None

class UpdateAccountNameRequest(BaseModel):
    account_name: str

class UpdateProfileImageRequest(BaseModel):
    image_url: str

# ── Dependencies ──────────────────────────────────────────────────────────────

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=Depends(get_db)
):
    token = credentials.credentials
    user = get_user_from_token(db, token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ hoặc đã hết hạn"
        )
    return user

# ── Auth routes ───────────────────────────────────────────────────────────────

@router.post("/auth/register", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest, db=Depends(get_db)):
    success, message, user_data = register_user(
        db, request.email, request.username, request.password
    )
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
    return {"success": True, "message": message, "data": user_data}


@router.post("/auth/login", response_model=MessageResponse)
async def login(request: LoginRequest, db=Depends(get_db)):
    success, message, user_data = login_user(
        db, request.username, request.password
    )
    if not success:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=message)
    return {"success": True, "message": message, "data": user_data}


@router.get("/auth/me", response_model=MessageResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return {"success": True, "message": "OK", "data": current_user}


@router.get("/auth/protected")
async def protected_route(current_user: dict = Depends(get_current_user)):
    return {
        "success": True,
        "message": f"Hello {current_user['username']}!",
        "user": current_user
    }

# ── Profile routes ────────────────────────────────────────────────────────────

@router.post("/profile/upload-image", response_model=MessageResponse)
async def upload_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload ảnh lên Cloudinary, trả về URL"""
    # Validate loại file
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chỉ chấp nhận ảnh jpg/png/webp"
        )

    contents = await file.read()

    # Validate dung lượng 2MB
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ảnh không được vượt quá 2MB"
        )

    try:
        result = cloudinary.uploader.upload(
            contents,
            folder="avatars",
            public_id=f"user_{current_user['user_id']}",  # Overwrite ảnh cũ
            overwrite=True,
            transformation=[{"width": 400, "height": 400, "crop": "fill"}]
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload thất bại: {str(e)}"
        )

    return {
        "success": True,
        "message": "Upload ảnh thành công",
        "data": {"image_url": result["secure_url"]}
    }


@router.put("/profile", response_model=MessageResponse)
async def update_user_profile(
    request: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Cập nhật account_name và/hoặc profile_image"""
    success, message, updated = update_profile(
        db,
        user_id=current_user['user_id'],
        account_name=request.account_name,
        image_url=request.profile_image
    )
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
    return {"success": True, "message": message, "data": updated}


@router.patch("/profile/name", response_model=MessageResponse)
async def update_user_account_name(
    request: UpdateAccountNameRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    success, message, updated = update_account_name(
        db,
        user_id=current_user['user_id'],
        account_name=request.account_name
    )
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
    return {"success": True, "message": message, "data": updated}


@router.patch("/profile/image", response_model=MessageResponse)
async def update_user_profile_image(
    request: UpdateProfileImageRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    success, message, updated = update_profile_image(
        db,
        user_id=current_user['user_id'],
        image_url=request.image_url
    )
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
    return {"success": True, "message": message, "data": updated}