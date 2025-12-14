import os
from dataclasses import dataclass


@dataclass
class GatewayConfig:
    _local: bool = bool(os.getenv('LOCAL_SERVER'))
    host: str = os.getenv('GATEWAY_HOST')
    port: int = int(os.getenv('GATEWAY_PORT'))

    url: str = None

    def __post_init__(self):
        if not self.url: self.url=f'http{'s'if not self._local else''}://{self.host}:{self.port}'

@dataclass
class Config:

    debug: str = os.getenv('DEBUG')
    log_level: str = os.getenv('LOG_LEVEL')
    this_host: str = os.getenv('THIS_HOST')
    this_port: int = int(os.getenv('THIS_PORT'))

    secret_key: str = os.getenv('SECRET_KEY')

    gateway: "GatewayConfig" = None

    def __post_init__(self):
        if not self.gateway: self.gateway = GatewayConfig()


config = Config()


