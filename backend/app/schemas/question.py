from typing import Optional

from pydantic import BaseModel, Field, model_validator


class OptionCreate(BaseModel):
    option_text: str = Field(min_length=1)
    is_correct: bool = False


class OptionUpdate(BaseModel):
    id: Optional[int] = None
    option_text: Optional[str] = Field(None, min_length=1)
    is_correct: Optional[bool] = None


class OptionResponse(BaseModel):
    id: int
    option_text: str
    is_correct: bool
    order_index: int
    images: list[dict] = []

    model_config = {"from_attributes": True}


class ImageResponse(BaseModel):
    id: int
    path: str
    order_index: int = 0

    model_config = {"from_attributes": True}


class QuestionCreate(BaseModel):
    type: str = Field(pattern=r"^(multiple_choice|checkbox|short_answer|essay)$")
    question_text: str = Field(min_length=1)
    points: int = Field(default=1, ge=0, le=999)
    is_required: bool = True
    options: list[OptionCreate] = []

    @model_validator(mode="after")
    def validate_options(self):
        if self.type in ("multiple_choice", "checkbox") and not self.options:
            raise ValueError("multiple_choice and checkbox questions require at least 1 option")
        if self.type in ("short_answer", "essay") and self.options:
            raise ValueError("short_answer and essay questions must not have options")
        # Fix #3 — multiple_choice must have exactly 1 correct answer
        if self.type == "multiple_choice":
            correct_count = sum(1 for o in self.options if o.is_correct)
            if correct_count != 1:
                raise ValueError("multiple_choice questions must have exactly 1 correct option")
        return self


class QuestionUpdate(BaseModel):
    type: Optional[str] = Field(None, pattern=r"^(multiple_choice|checkbox|short_answer|essay)$")
    question_text: Optional[str] = Field(None, min_length=1)
    points: Optional[int] = Field(None, ge=0, le=999)
    is_required: Optional[bool] = None
    options: Optional[list[OptionUpdate]] = None

    @model_validator(mode="after")
    def validate_options(self):
        q_type = self.type
        opts = self.options
        if q_type is not None and opts is not None:
            if q_type in ("multiple_choice", "checkbox") and len(opts) == 0:
                raise ValueError("multiple_choice and checkbox questions require at least 1 option")
            if q_type in ("short_answer", "essay") and len(opts) > 0:
                raise ValueError("short_answer and essay questions must not have options")
            if q_type == "multiple_choice":
                correct_count = sum(1 for o in opts if o.is_correct is True)
                if correct_count != 1:
                    raise ValueError("multiple_choice questions must have exactly 1 correct option")
        return self


class QuestionResponse(BaseModel):
    id: int
    type: str
    question_text: str
    points: int
    order_index: int
    is_required: bool
    options: list[OptionResponse] = []
    images: list[dict] = []

    model_config = {"from_attributes": True}


class QuestionListResponse(BaseModel):
    data: list[QuestionResponse]


# Fix #5 — simplified reorder: just a list of IDs in desired order
class ReorderRequest(BaseModel):
    form_id: int
    orders: list[int] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_orders(self):
        if not self.orders:
            raise ValueError("orders must not be empty")
        return self


class MessageResponse(BaseModel):
    message: str
    id: int | None = None
