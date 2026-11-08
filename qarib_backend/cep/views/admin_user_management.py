from django.db.models import Count, Prefetch, Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from cep.models import Organization, OrganizationRepresentativeAssignment, User
from cep.permissions import IsSystemAdmin
from cep.serializers import (
    AdminManagedUserSerializer,
    AdminUserDetailSerializer,
    AdminUserStatusSerializer,
    AdminUserUpdateSerializer,
    AdminUserCreateSerializer,
    AvailableOrganizationSerializer,
)
from cep.services import AdminUserManagementService


class AdminUserCreateView(generics.CreateAPIView):
    serializer_class = AdminUserCreateSerializer
    permission_classes = [IsSystemAdmin]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            AdminManagedUserSerializer(user).data,
            status=status.HTTP_201_CREATED,
        )


class AdminUsersPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class AdminUserListView(generics.ListAPIView):
    serializer_class = AdminManagedUserSerializer
    permission_classes = [IsSystemAdmin]
    pagination_class = AdminUsersPagination

    def get_queryset(self):
        assignments = OrganizationRepresentativeAssignment.objects.select_related(
            "organization"
        ).order_by("-assigned_at")
        queryset = User.objects.prefetch_related(
            Prefetch(
                "organization_assignments",
                queryset=assignments,
                to_attr="prefetched_assignments",
            )
        ).exclude(role=User.Role.SYSTEM_ADMIN).order_by("-created_at")

        search = self.request.query_params.get("search", "").strip()
        role = self.request.query_params.get("role", "").strip()
        account_status = self.request.query_params.get("status", "").strip()
        if search:
            queryset = queryset.filter(
                Q(full_name__icontains=search) | Q(email__icontains=search)
            )
        if role in {User.Role.CITIZEN, User.Role.ORGANIZATION_REPRESENTATIVE}:
            queryset = queryset.filter(role=role)
        if account_status == "active":
            queryset = queryset.filter(is_active=True)
        elif account_status == "inactive":
            queryset = queryset.filter(is_active=False)
        return queryset

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        managed_users = User.objects.exclude(role=User.Role.SYSTEM_ADMIN)
        response.data["summary"] = managed_users.aggregate(
            total=Count("id"),
            active=Count("id", filter=Q(is_active=True)),
            citizens=Count("id", filter=Q(role=User.Role.CITIZEN)),
            representatives=Count(
                "id", filter=Q(role=User.Role.ORGANIZATION_REPRESENTATIVE)
            ),
        )
        return response


class AvailableOrganizationListView(generics.ListAPIView):
    serializer_class = AvailableOrganizationSerializer
    permission_classes = [IsSystemAdmin]
    pagination_class = None

    def get_queryset(self):
        queryset = Organization.objects.filter(
            active_representative_assignment__isnull=True
        ).order_by("name")
        search = self.request.query_params.get("search", "").strip()
        return queryset.filter(name__icontains=search) if search else queryset


class AdminUserDetailUpdateView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsSystemAdmin]
    lookup_url_kwarg = "user_id"

    def get_queryset(self):
        return User.objects.prefetch_related(
            "organization_assignments__organization"
        )

    def get_serializer_class(self):
        return AdminUserUpdateSerializer if self.request.method in {"PUT", "PATCH"} else AdminUserDetailSerializer

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        user = self.get_object()
        serializer = AdminUserUpdateSerializer(user, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(AdminUserDetailSerializer(user).data, status=status.HTTP_200_OK)


class AdminUserStatusView(APIView):
    permission_classes = [IsSystemAdmin]

    def patch(self, request, user_id: int):
        serializer = AdminUserStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = get_object_or_404(User, pk=user_id)
        user = AdminUserManagementService.set_active_status(
            user=user,
            is_active=serializer.validated_data["is_active"],
        )
        return Response(AdminManagedUserSerializer(user).data, status=status.HTTP_200_OK)


class AdminUserDeactivateView(APIView):
    permission_classes = [IsSystemAdmin]

    def patch(self, request, user_id: int):
        user = get_object_or_404(User, pk=user_id)
        user = AdminUserManagementService.deactivate_user(user=user)
        return Response(AdminManagedUserSerializer(user).data, status=status.HTTP_200_OK)
