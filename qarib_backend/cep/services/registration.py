from cep.models import PendingCitizenRegistration, User


class CitizenRegistrationService:
    @staticmethod
    def create_verified(*, pending: PendingCitizenRegistration) -> User:
        user = User.objects.create_user(
            full_name=pending.full_name,
            email=pending.email,
            phone_number=pending.phone_number,
            password=None,
            role=User.Role.CITIZEN,
        )
        user.password = pending.password_hash
        user.save(update_fields=["password"])
        return user
