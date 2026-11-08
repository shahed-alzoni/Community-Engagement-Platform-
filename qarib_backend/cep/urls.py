from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from cep.views import (
    CitizenRegistrationView,
    AdminLoginView,
    AdminUserCreateView,
    AdminUserDeactivateView,
    AdminUserDetailUpdateView,
    AdminUserListView,
    AdminUserStatusView,
    AvailableOrganizationListView,
    LoginView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RepresentativeInitialPasswordChangeView,
    RepresentativeLoginView,
)


app_name = "cep"

urlpatterns = [
    path("auth/register/", CitizenRegistrationView.as_view(), name="citizen-register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/admin/login/", AdminLoginView.as_view(), name="admin-login"),
    path("auth/representative/login/", RepresentativeLoginView.as_view(), name="representative-login"),
    path("auth/representative/change-initial-password/", RepresentativeInitialPasswordChangeView.as_view(), name="representative-change-initial-password"),
    path("admin/users/", AdminUserCreateView.as_view(), name="admin-user-create"),
    path("admin/users/list/", AdminUserListView.as_view(), name="admin-user-list"),
    path(
        "admin/users/<int:user_id>/",
        AdminUserDetailUpdateView.as_view(),
        name="admin-user-detail-update",
    ),
    path(
        "admin/users/<int:user_id>/status/",
        AdminUserStatusView.as_view(),
        name="admin-user-status",
    ),
    path(
        "admin/organizations/available/",
        AvailableOrganizationListView.as_view(),
        name="available-organization-list",
    ),
    path(
        "admin/users/<int:user_id>/deactivate/",
        AdminUserDeactivateView.as_view(),
        name="admin-user-deactivate",
    ),
    path(
        "auth/password-reset/request/",
        PasswordResetRequestView.as_view(),
        name="password-reset-request",
    ),
    path(
        "auth/password-reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
]
