from django.db import transaction

from cep.models import User


class ProfileService:
    @staticmethod
    @transaction.atomic
    def update(
        *, user: User, full_name: str | None = None,
        email: str | None = None, phone_number: str | None = None,
    ) -> User:
        updated_fields = ["updated_at"]
        for field, value in {
            "full_name": full_name,
            "email": email,
            "phone_number": phone_number,
        }.items():
            if value is not None:
                setattr(user, field, value)
                updated_fields.append(field)
        user.save(update_fields=updated_fields)
        return user
