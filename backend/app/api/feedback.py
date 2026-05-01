# app/api/feedback.py
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from app.services.feedback_service import grade_writing, WritingFeedback

router = APIRouter(prefix="/writing/feedback", tags=["Writing Feedback"])


class GradeWritingRequest(BaseModel):
    topic: str = Field(..., min_length=3, max_length=500, description="The essay topic/prompt")
    essay: str = Field(..., min_length=20, max_length=3000, description="User's written essay")

    model_config = {
        "json_schema_extra": {
            "example": {
                "topic": "Describe your favourite hobby",
                "essay": "My hobby is playing football with my friends every weekend. I love this sport because it is fun and good for health...",
            }
        }
    }


class GradeWritingResponse(BaseModel):
    success: bool
    data: WritingFeedback


@router.post(
    "/grade",
    response_model=GradeWritingResponse,
    summary="Grade a writing submission",
    description="Accepts a topic and essay, returns AI feedback with star ratings, grammar fixes, and rewritten sentences.",
)
async def grade_writing_endpoint(body: GradeWritingRequest):
    """
    Called when the user clicks Submit on the frontend.

    - Checks if essay is on topic
    - Rates: Topic / Grammar / Vocabulary / Natural English
    - Lists grammar errors with corrections
    - Rewrites awkward sentences naturally
    - Returns encouragement (no band scores)
    """
    try:
        result = await grade_writing(topic=body.topic, essay=body.essay)
        return GradeWritingResponse(success=True, data=result)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI parsing error: {str(e)}",
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    except Exception as e:
        print(f"❌ Unexpected error in POST /api/writing/feedback/grade: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Something went wrong. Please try again.",
        )