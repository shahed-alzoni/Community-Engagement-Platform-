from cep.models import User
from cep.services.login import LoginService


class AdminLoginService:
    @staticmethod
    def login(*, email: str, password: str, request=None) -> dict:
        return LoginService.login(
            email=email,
            password=password,
            request=request,
            required_role=User.Role.SYSTEM_ADMIN,
        )
