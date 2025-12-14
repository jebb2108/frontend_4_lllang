from pydantic import BaseModel, Field


class MessageContent(BaseModel):
    """
    Модель содержимого сообщения
    """
    sender: str = Field(..., description="Никнейм пользователя. Не путать с username!")
    text: str = Field(..., description="Слова, которое нужно проверить на статус выученного")
    created_at: str = Field(..., description="Время создания сообщения ISO формата")
    room_id: str = Field(..., description="Комната сессии, где слово было использовано")