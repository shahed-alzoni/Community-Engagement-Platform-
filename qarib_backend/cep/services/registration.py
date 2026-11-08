from django.db import transaction

from cep.models import User


class CitizenRegistrationService:
    @staticmethod
    @transaction.atomic
    def register(*, full_name: str, email: str, phone_number: str, password: str) -> User:
        return User.objects.create_user(
            full_name=full_name,
            email=email,
            phone_number=phone_number,
            password=password,
            role=User.Role.CITIZEN,
        )
