from rest_framework.permissions import BasePermission

from cep.models import User


class IsSystemAdmin(BasePermission):
    message = "System Admin access is required."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and user.role == User.Role.SYSTEM_ADMIN
        )
