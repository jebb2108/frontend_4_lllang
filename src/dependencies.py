from src.services.connection import connection_service

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.services.connection import ConnectionService

async def get_ws_connection() -> "ConnectionService":
    return connection_service