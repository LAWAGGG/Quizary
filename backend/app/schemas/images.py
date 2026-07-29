from pydantic import BaseModel, Field


class ImageLinkRequest(BaseModel):
    type: str = Field(pattern=r"^(file|link)$")
    path: str = Field(min_length=1)


class ImageResponse(BaseModel):
    id: int
    path: str
    type: str

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    message: str
