from typing import TYPE_CHECKING

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.params import Query

from src.config import config
from src.dependencies import get_ws_connection
from src.exc import FailToCreateToken
from src.logconf import opt_logger as log
from src.models import Profile
from src.validators.tokens import create_token

if TYPE_CHECKING:
    from src.services.connection import ConnectionService

router = APIRouter(prefix="/usr/v0")
logger = log.setup_logger("endpoints")


@router.get("/check_user")
async def check_user_handler(
        user_id: str = Query(..., description="User ID")
):
    """Проверяет, существует ли пользователь в БД"""
    try:
        async with httpx.AsyncClient() as client:
            url = config.gateway.url + f'/user_exists?user_id={user_id}'
            resp = await client.get(url=url)
            if resp.status_code == 200:
                return {"user_exists": resp.json()}
            else:
                raise HTTPException(status_code=resp.status_code, detail=resp.text)

    except Exception as e:
        logger.error(f'Error in check_user_handler: {e}')
        raise HTTPException(status_code=500, detail='Internal Server Error')



@router.post("/register")
async def register_user_handler(
        user_data: Profile,
):
    # Сохранение в базу данных профиля пользователя
    try:
        async with httpx.AsyncClient() as client:
            url = config.gateway.url + f'/update_profile'
            resp = await client.post(url=url, content=user_data.model_dump_json())
            if resp.status_code == 200:
                return 200
            else:
                raise HTTPException(status_code=resp.status_code, detail=resp.text)

    except Exception as e:
        logger.error(f'Error in register_user_handler: {e}')
        raise HTTPException(status_code=500, detail='Internal Server Error')


@router.get("/user_info")
async def get_user_info_handler(
        user_id: int = Query(..., description="User ID")
):
    async with httpx.AsyncClient() as client:
        url = config.gateway.url + f'/users?user_id={user_id}&target_field=all'
        resp = await client.get(url=url)
        if resp.status_code == 200:
            user_info = resp.json()

            return {
                'user_id': user_id,
                'username': user_info.get("username"),
                'gender': user_info.get('gender'),
                'criteria': {
                    'language': user_info.get('language'),
                    'fluency': user_info.get('fluency'),
                    'topics': user_info.get('topics'),
                    'dating': user_info.get('dating')
                },
                'lang_code': user_info.get('lang_code')
            }
        else:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)

@router.get("/create_token")
async def create_token_handler(
        user_id: int = Query(..., description="ID пользователя"),
        room_id: str = Query(..., description="Уникальный идентификатор комнаты"),
):
    """ Обработчик создания токена """
    try:
        async with httpx.AsyncClient() as client:
            url = config.gateway.url + f'user_exists?user_id={user_id}'
            resp = await client.get(url=url)
            if resp.status_code == 200 and resp.json() is True:
                resp = await client.get(url=config.gateway.url+f'users?user_id{user_id}&target_field=nickname')
                nickname = resp.json().get('nickname')
                # Создаю токен для аутентификации сессии
                token = await create_token(user_id, nickname, room_id)
                return {"token": token}
            else:
                raise HTTPException(
                    status_code=resp.status_code, detail=resp.text
                )

    except FailToCreateToken:
        raise HTTPException(status_code=500, detail="Error creating token")

    except Exception as e:
        logger.error(f"Error in create_token_handler: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")





###### HTTP endpoints для взаимодействия с чатом! ######

@router.get("/chat/rooms/{room_id}/status")
async def get_room_status(room_id: str):
    """Получение статуса комнаты"""
    connection: "ConnectionService" = await get_ws_connection()

    online_users = connection.get_online_users(room_id)
    return {
        "room_id": room_id,
        "user_count": len(online_users),
        "online_users": online_users
    }


@router.post("/notify_session_end")
async def notify_session_end(request: dict):
    """Уведомление всех участников комнаты о завершении сессии"""
    try:
        logger.info(f"=== NOTIFY_SESSION_END CALLED ===")
        logger.info(f"Request data: {request}")

        room_id = request.get("room_id")
        reason = request.get("reason", "Session ended")

        if not room_id:
            logger.error("room_id is missing")
            raise HTTPException(status_code=400, detail="room_id is required")

        connection: "ConnectionService" = await get_ws_connection()

        # Логируем информацию о комнате
        logger.info(f"Active connections: {connection.active_connections}")
        logger.info(f"Room {room_id} connections: {connection.active_connections.get(room_id, {})}")

        # Получаем список пользователей в комнате
        users_in_room = list(connection.active_connections.get(room_id, {}).keys())
        logger.info(f"Users in room {room_id}: {users_in_room}")

        # Отправляем уведомление всем в комнате
        await connection.broadcast_to_room({
            "type": "session_ended",
            "reason": reason
        }, room_id)

        logger.info(f"Session end notification sent successfully to room {room_id}")
        return {"status": "success", "message": "Session end notification sent"}

    except Exception as e:
        logger.error(f"Error notifying session end: {e}")
        raise HTTPException(status_code=500, detail=str(e))