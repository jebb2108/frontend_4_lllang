from typing import Dict, Any

from pydantic import BaseModel, Field


class MessageContent(BaseModel):
    """
    Модель содержимого сообщения
    """
    sender: str = Field(..., description="Никнейм пользователя. Не путать с username!")
    text: str = Field(..., description="Слова, которое нужно проверить на статус выученного")
    created_at: str = Field(..., description="Время создания сообщения ISO формата")
    room_id: str = Field(..., description="Комната сессии, где слово было использовано")

class UserIdRequest(BaseModel):
    user_id: int = Field(..., gt=0, description="ID пользователя")

class MatchRequestModel(BaseModel):
    """ Модель запроса на поиск матча """
    user_id: int = Field(..., gt=0, description="ID пользователя")
    username: str = Field(..., min_length=1, max_length=100, description="Имя пользователя")
    gender: str = Field(..., min_length=1, max_length=20, description="Пол пользователя")
    criteria: Dict[str, Any] = Field(..., description="Критерии поиска")
    lang_code: str = Field(..., min_length=1, max_length=10, description="Код языка")
    action: str = Field(..., description="Запрос на вступление либо выход из очереди")
