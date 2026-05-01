# app/api/writing.py
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from app.db import get_db
from app.services.writing_service import WritingService
from typing import Optional

router = APIRouter()


@router.get("/writing/questions")
def get_questions(
    skip: int = Query(0, ge=0, description="Số questions bỏ qua"),
    limit: int = Query(20, ge=1, le=100, description="Số questions tối đa (1-100)"),
    topic: Optional[str] = Query(None, description="Lọc theo chủ đề (vd: Education, Health)"),
    difficulty: Optional[str] = Query(None, pattern="^(easy|medium|hard)$", description="Lọc theo độ khó"),
    search: Optional[str] = Query(None, description="Tìm kiếm theo keyword"),
    db=Depends(get_db),
):
    """
    Lấy danh sách questions với pagination.
    Các filter có thể kết hợp với nhau (vd: topic + search, topic + difficulty).

    Returns:
        { "questions": [...], "total": 1000, "skip": 0, "limit": 20, "has_more": true }
    """
    collection = db["topicwriting"]
    service = WritingService(collection)

    if search:
        questions, total = service.search_prompts(search, skip, limit, topic=topic)
    elif difficulty:
        questions, total = service.get_prompts_by_difficulty(difficulty, skip, limit, topic=topic)
    else:
        questions, total = service.get_prompts_paginated(skip, limit, topic=topic)

    return JSONResponse(content={
        "questions": questions,
        "total":     total,
        "skip":      skip,
        "limit":     limit,
        "has_more":  skip + len(questions) < total,
    })


# /random phải đứng TRƯỚC /{question_id} để FastAPI không nhầm "random" là một id
@router.get("/writing/questions/random")
def get_random_question(
    topic: Optional[str] = Query(None, description="Random trong chủ đề cụ thể"),
    db=Depends(get_db),
):
    """
    Lấy random một question.
    Nếu truyền topic thì random trong chủ đề đó.

    Returns:
        { "id": "quora_123", "question": "...", "topic": "Education" }
    """
    collection = db["topicwriting"]
    service = WritingService(collection)

    question = service.get_random_prompt(topic=topic)

    if not question:
        detail = f"No questions found for topic '{topic}'" if topic else "No questions available"
        raise HTTPException(status_code=404, detail=detail)

    return JSONResponse(content=question)


@router.get("/writing/questions/{question_id}")
def get_question_by_id(question_id: str, db=Depends(get_db)):
    """
    Lấy question theo custom id (vd: "quora_0", "quora_123").

    Returns:
        { "id": "quora_0", "question": "...", "topic": "Education" }
    """
    collection = db["topicwriting"]
    service = WritingService(collection)

    question = service.get_prompt_by_id(question_id)

    if not question:
        raise HTTPException(
            status_code=404,
            detail=f"Question with id '{question_id}' not found",
        )

    return JSONResponse(content=question)


# ─── TOPICS ──────────────────────────────────────────────────────

# NOTE: /search phải đứng TRƯỚC /topics nếu dùng prefix chung,
# nhưng ở đây path đầy đủ nên không bị conflict.
@router.get("/writing/topics/search")
def search_topics(
    q: str = Query(..., min_length=1, description="Từ khoá tìm topic"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=50, description="Tối đa 50 mỗi lần"),
    db=Depends(get_db),
):
    """
    Tìm kiếm topic theo từ khoá — dùng cho search box ở FE.
    Gõ từng ký tự sẽ trả về các topic khớp, mỗi lần tối đa 50.

    Ví dụ: ?q=heal → [{ "topic": "Health & Medicine", "count": 987 }]

    Returns:
        { "topics": [...], "total": 5, "skip": 0, "limit": 50, "has_more": false }
    """
    collection = db["topicwriting"]
    service = WritingService(collection)

    topics, total = service.search_topics(q, skip=skip, limit=limit)

    return JSONResponse(content={
        "topics":   topics,
        "total":    total,
        "skip":     skip,
        "limit":    limit,
        "has_more": skip + len(topics) < total,
    })


@router.get("/writing/topics")
def get_topics(db=Depends(get_db)):
    """
    Lấy danh sách tất cả topic kèm số lượng question.
    Dùng để hiển thị menu chọn chủ đề ở frontend.

    Returns:
        { "topics": [{ "topic": "Education", "count": 1234 }, ...] }
    """
    collection = db["topicwriting"]
    service = WritingService(collection)

    return JSONResponse(content={"topics": service.get_topics()})


@router.get("/writing/stats")
def get_writing_stats(
    topic: Optional[str] = Query(None, description="Thống kê trong chủ đề cụ thể"),
    db=Depends(get_db),
):
    """
    Thống kê tổng quan về writing questions.

    Returns:
        { "total": 10000, "easy_count": 3000, "medium_count": 4000, "hard_count": 3000, "topic": null }
    """
    collection = db["topicwriting"]
    service = WritingService(collection)

    _, easy_count   = service.get_prompts_by_difficulty("easy",   0, 1, topic=topic)
    _, medium_count = service.get_prompts_by_difficulty("medium", 0, 1, topic=topic)
    _, hard_count   = service.get_prompts_by_difficulty("hard",   0, 1, topic=topic)

    return JSONResponse(content={
        "total":        service.get_total_count(topic=topic),
        "easy_count":   easy_count,
        "medium_count": medium_count,
        "hard_count":   hard_count,
        "topic":        topic,
    })