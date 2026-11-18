from rest_framework.permissions import BasePermission

from cep.models import User


class IsPortalUser(BasePermission):
    message = "Citizen or organization representative access is required."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and user.role in {
                User.Role.CITIZEN,
                User.Role.ORGANIZATION_REPRESENTATIVE,
            }
        )
