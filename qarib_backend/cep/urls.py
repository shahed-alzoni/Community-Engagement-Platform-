from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from cep.views.organization_image import OrganizationImageUploadView, OrganizationImageView
from cep.views.organization_category import OrganizationCategoryListCreateView, OrganizationCategoryUpdateView, OrganizationCategoryImageView
from cep.views.complaint import CitizenResolutionPhotoView, RepresentativeComplaintListView, RepresentativeComplaintDetailView, RepresentativeComplaintPhotoView, RepresentativeComplaintStatusView, RepresentativeResolutionPhotoView, RepresentativeTransferOrganizationListView, RepresentativeComplaintTransferView

from cep.views import (
    CitizenRegistrationView,
    CitizenRegistrationConfirmView,
    CitizenRegistrationResendView,
    AdminLoginView,
    AdminUserCreateView,
    AdminUserDeactivateView,
    AdminUserDetailUpdateView,
    AdminUserListView,
    AdminUserStatusView,
    AvailableOrganizationListView,
    LoginView,
    EmailChangeConfirmView,
    EmailChangeRequestView,
    LogoutView,
    PasswordResetConfirmView,
    PasswordChangeView,
    CitizenComplaintDetailView,
    CitizenComplaintListCreateView,
    CitizenComplaintPhotoView,
    ComplaintOrganizationListView,
    PasswordResetRequestView,
    RepresentativeInitialPasswordChangeView,
    RepresentativeLoginView,
    ProfileView,
)


app_name = "cep"

urlpatterns = [
    path("auth/register/", CitizenRegistrationView.as_view(), name="citizen-register"),
    path("auth/register/confirm/", CitizenRegistrationConfirmView.as_view(), name="citizen-register-confirm"),
    path("auth/register/resend/", CitizenRegistrationResendView.as_view(), name="citizen-register-resend"),
    path("auth/email-change/request/", EmailChangeRequestView.as_view(), name="email-change-request"),
    path("auth/email-change/confirm/", EmailChangeConfirmView.as_view(), name="email-change-confirm"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/password-change/", PasswordChangeView.as_view(), name="password-change"),
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
    path("profile/", ProfileView.as_view(), name="profile"),
    path("profile/organization-image/", OrganizationImageUploadView.as_view(), name="organization-image-upload"),
    path("profile/categories/", OrganizationCategoryListCreateView.as_view(), name="organization-categories"),
    path("profile/categories/<int:pk>/", OrganizationCategoryUpdateView.as_view(), name="organization-category-update"),
    path("organizations/<int:pk>/image/", OrganizationImageView.as_view(), name="organization-image"),
    path("categories/<int:pk>/image/", OrganizationCategoryImageView.as_view(), name="organization-category-image"),
    path("complaints/organizations/", ComplaintOrganizationListView.as_view(), name="complaint-organizations"),
    path("complaints/", CitizenComplaintListCreateView.as_view(), name="citizen-complaints"),
    path("complaints/<int:pk>/", CitizenComplaintDetailView.as_view(), name="citizen-complaint-detail"),
    path("complaints/<int:pk>/photos/<int:photo_id>/", CitizenComplaintPhotoView.as_view(), name="citizen-complaint-photo"),
    path("complaints/<int:pk>/resolution-photos/<int:photo_id>/", CitizenResolutionPhotoView.as_view(), name="citizen-resolution-photo"),
    path("representative/complaints/", RepresentativeComplaintListView.as_view(), name="representative-complaints"),
    path("representative/transfer-organizations/", RepresentativeTransferOrganizationListView.as_view(), name="representative-transfer-organizations"),
    path("representative/complaints/<int:pk>/", RepresentativeComplaintDetailView.as_view(), name="representative-complaint-detail"),
    path("representative/complaints/<int:pk>/transfer/", RepresentativeComplaintTransferView.as_view(), name="representative-complaint-transfer"),
    path("representative/complaints/<int:pk>/status/", RepresentativeComplaintStatusView.as_view(), name="representative-complaint-status"),
    path("representative/complaints/<int:pk>/photos/<int:photo_id>/", RepresentativeComplaintPhotoView.as_view(), name="representative-complaint-photo"),
    path("representative/complaints/<int:pk>/resolution-photos/<int:photo_id>/", RepresentativeResolutionPhotoView.as_view(), name="representative-resolution-photo"),
]
