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
            raise ValueError("Tipe soal multiple_choice dan checkbox wajib memiliki minimal 1 opsi")
        if self.type in ("short_answer", "essay") and self.options:
            raise ValueError("Tipe soal short_answer dan essay tidak boleh memiliki opsi")
        return self


class QuestionUpdate(BaseModel):
    type: Optional[str] = Field(None, pattern=r"^(multiple_choice|checkbox|short_answer|essay)$")
    question_text: Optional[str] = Field(None, min_length=1)
    points: Optional[int] = Field(None, ge=0, le=999)
    is_required: Optional[bool] = None
    options: Optional[list[OptionUpdate]] = None

    @model_validator(mode="after")
    def validate_options(self):
        if "type" in self.model_fields_set and self.options is not None:
            if self.type in ("multiple_choice", "checkbox") and len(self.options) == 0:
                raise ValueError("Tipe soal multiple_choice dan checkbox wajib memiliki minimal 1 opsi")
            if self.type in ("short_answer", "essay") and len(self.options) > 0:
                raise ValueError("Tipe soal short_answer dan essay tidak boleh memiliki opsi")
        return self


class QuestionResponse(BaseModel):
    id: int
    type: str
    question_text: str
    points: int
    order_index: int
    is_required: bool
    options: list[OptionResponse] = []

    model_config = {"from_attributes": True}


class QuestionListResponse(BaseModel):
    data: list[QuestionResponse]


class ReorderItem(BaseModel):
    id: int
    order_index: int = Field(ge=0)


class ReorderRequest(BaseModel):
    form_id: int
    orders: list[ReorderItem]

    @model_validator(mode="after")
    def validate_orders(self):
        if not self.orders:
            raise ValueError("orders tidak boleh kosong")
        return self


class MessageResponse(BaseModel):
    message: str
    id: int | None = None
