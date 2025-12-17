# app/api/progress.py
from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel, Field
from typing import List, Optional
from pymongo.database import Database

from app.db import get_db
from app.services.progress_service import ProgressService
from app.services.auth_service import get_user_from_token

router = APIRouter(prefix="/progress", tags=["Progress"])

# Pydantic Models
class SaveProgressRequest(BaseModel):
    lesson_id: str = Field(..., description="ID của lesson")
    score: int = Field(..., ge=0, le=4, description="Số câu đúng (0-4)")
    total_questions: int = Field(default=4, ge=1, description="Tổng số câu hỏi")

class ProgressResponse(BaseModel):
    id: str
    user_id: str
    lesson_id: str
    completion_count: int
    total_attempts: int
    last_score: int
    best_score: int
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class UserStatsResponse(BaseModel):
    lessons_started: int
    total_completed: int
    total_attempts: int
    average_best_score: float
    current_streak: int = Field(default=0, description="Số ngày học liên tiếp")
    longest_streak: int = Field(default=0, description="Streak dài nhất từng đạt")
    last_active_date: Optional[str] = Field(None, description="Ngày học gần nhất")

class AllProgressResponse(BaseModel):
    progress: List[ProgressResponse]
    stats: UserStatsResponse

class StreakResponse(BaseModel):
    current_streak: int = Field(..., description="Số ngày học liên tiếp hiện tại")
    longest_streak: int = Field(..., description="Streak dài nhất từng đạt được")
    last_active_date: Optional[str] = Field(None, description="Ngày học gần nhất")
    total_active_days: int = Field(..., description="Tổng số ngày đã học")

class LearningCalendarResponse(BaseModel):
    year: int
    month: int
    active_dates: List[str] = Field(..., description="Danh sách các ngày đã học trong tháng")
    total_days: int = Field(..., description="Tổng số ngày đã học trong tháng")


def get_current_user(authorization: str = Header(...), db: Database = Depends(get_db)):
    """
    Dependency để lấy user từ Authorization header
    """
    try:
        # Extract token từ "Bearer <token>"
        if not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization header format"
            )
        
        token = authorization.replace("Bearer ", "")
        
        # Dùng auth_service có sẵn
        user = get_user_from_token(db, token)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        return user
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Auth error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )


@router.post("", response_model=ProgressResponse, status_code=status.HTTP_201_CREATED)
async def save_progress(
    data: SaveProgressRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db)
):
    """
    Lưu hoặc cập nhật progress của user cho một lesson
    
    - **lesson_id**: ID của lesson
    - **score**: Số câu trả lời đúng (0-4)
    - **total_questions**: Tổng số câu hỏi (mặc định 4)
    
    **Note**: Mỗi lần hoàn thành lesson sẽ tự động cập nhật streak
    """
    try:
        user_id = current_user.get("user_id")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found"
            )
        
        progress_service = ProgressService(db)
        
        # Validate score
        if data.score > data.total_questions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Score cannot be greater than total questions ({data.total_questions})"
            )
        
        result = progress_service.save_progress(
            user_id=user_id,
            lesson_id=data.lesson_id,
            score=data.score,
            total_questions=data.total_questions
        )
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in save_progress endpoint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save progress"
        )


@router.get("/lesson/{lesson_id}", response_model=ProgressResponse)
async def get_lesson_progress(
    lesson_id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db)
):
    """Lấy progress của user cho một lesson cụ thể"""
    try:
        user_id = current_user.get("user_id")
        
        progress_service = ProgressService(db)
        result = progress_service.get_user_progress(user_id, lesson_id)
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Progress not found for this lesson"
            )
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in get_lesson_progress endpoint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get progress"
        )


@router.get("/all", response_model=AllProgressResponse)
async def get_all_progress(
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db)
):
    """
    Lấy tất cả progress và thống kê của user
    
    Thống kê bao gồm:
    - Lessons started/completed
    - Total attempts
    - Average score
    - Current streak (số ngày học liên tiếp)
    - Longest streak (streak dài nhất)
    """
    try:
        user_id = current_user.get("user_id")
        
        progress_service = ProgressService(db)
        progress_list = progress_service.get_all_user_progress(user_id)
        stats = progress_service.get_user_stats(user_id)
        
        return {
            "progress": progress_list,
            "stats": stats
        }
    
    except Exception as e:
        print(f"❌ Error in get_all_progress endpoint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get progress"
        )


@router.get("/stats", response_model=UserStatsResponse)
async def get_user_stats(
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db)
):
    """
    Lấy thống kê tổng quan của user
    
    Bao gồm:
    - Số lesson đã học
    - Tổng số lần hoàn thành
    - Điểm trung bình
    - **Current streak**: Số ngày học liên tiếp
    - **Longest streak**: Streak dài nhất từng đạt
    """
    try:
        user_id = current_user.get("user_id")
        
        progress_service = ProgressService(db)
        stats = progress_service.get_user_stats(user_id)
        
        return stats
    
    except Exception as e:
        print(f"❌ Error in get_user_stats endpoint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get stats"
        )
    

@router.get("/streak", response_model=StreakResponse)
async def get_user_streak(
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db)
):
    """
    Lấy chi tiết streak học tập của user
    
    Returns:
    - **current_streak**: Số ngày học liên tiếp hiện tại
    - **longest_streak**: Streak dài nhất từng đạt được
    - **last_active_date**: Ngày học gần nhất
    - **total_active_days**: Tổng số ngày đã học
    
    **Rules**:
    - Học 1 hoặc nhiều lesson trong 1 ngày = 1 streak
    - Phải học liên tiếp không có ngày bỏ
    - Streak reset nếu bỏ 1 ngày
    """
    try:
        user_id = current_user.get("user_id")

        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found"
            )

        progress_service = ProgressService(db)
        streak_data = progress_service.get_user_streak(user_id)

        return streak_data

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in get_user_streak endpoint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get streak"
        )


@router.get("/calendar/{year}/{month}", response_model=LearningCalendarResponse)
async def get_learning_calendar(
    year: int,
    month: int,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db)
):
    """
    Lấy calendar các ngày đã học trong tháng
    
    **Use case**: Hiển thị heatmap/calendar UI (giống GitHub contribution)
    
    **Parameters**:
    - year: Năm (2020-2100)
    - month: Tháng (1-12)
    
    **Example**: 
    - GET /progress/calendar/2025/1
    - Returns: ["2025-01-01", "2025-01-03", "2025-01-05", ...]
    """
    try:
        user_id = current_user.get("user_id")

        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found"
            )

        # Validate year and month
        if year < 2020 or year > 2100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Year must be between 2020 and 2100"
            )
        
        if month < 1 or month > 12:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Month must be between 1 and 12"
            )

        progress_service = ProgressService(db)
        active_dates = progress_service.get_learning_calendar(user_id, year, month)

        return {
            "year": year,
            "month": month,
            "active_dates": active_dates,
            "total_days": len(active_dates)
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in get_learning_calendar endpoint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get learning calendar"
        )


@router.delete("/lesson/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lesson_progress(
    lesson_id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db)
):
    """
    Xóa progress của user cho một lesson (dùng để reset)
    
    **Warning**: Không xóa learning logs (streak vẫn giữ nguyên)
    """
    try:
        user_id = current_user.get("user_id")
        
        progress_service = ProgressService(db)
        deleted = progress_service.delete_progress(user_id, lesson_id)
        
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Progress not found for this lesson"
            )
        
        return None
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in delete_lesson_progress endpoint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete progress"
        )