from pathlib import Path

from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from cep.models import OrganizationCategory, User
from cep.serializers.organization_category import OrganizationCategoryWriteSerializer, category_data, IMAGE_SIGNATURES


class IsAssignedRepresentative(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_active
                    and user.role == User.Role.ORGANIZATION_REPRESENTATIVE
                    and getattr(user, 'active_organization_assignment', None))


class OrganizationCategoryListCreateView(APIView):
    permission_classes = [IsAssignedRepresentative]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        organization = request.user.active_organization_assignment.organization
        return Response([category_data(category) for category in organization.categories.all()])

    def post(self, request):
        organization = request.user.active_organization_assignment.organization
        serializer = OrganizationCategoryWriteSerializer(data=request.data, context={'organization': organization})
        serializer.is_valid(raise_exception=True)
        category = OrganizationCategory.objects.create(organization=organization, **serializer.validated_data)
        return Response(category_data(category), status=status.HTTP_201_CREATED)


class OrganizationCategoryUpdateView(APIView):
    permission_classes = [IsAssignedRepresentative]
    parser_classes = [MultiPartParser, FormParser]

    def patch(self, request, pk):
        organization = request.user.active_organization_assignment.organization
        category = get_object_or_404(OrganizationCategory, pk=pk, organization=organization)
        serializer = OrganizationCategoryWriteSerializer(data=request.data, context={'organization': organization, 'instance': category})
        serializer.is_valid(raise_exception=True)
        category.name = serializer.validated_data['name']
        update_fields = ['name', 'updated_at']
        if 'image' in serializer.validated_data:
            category.image = serializer.validated_data['image']
            update_fields.append('image')
        category.save(update_fields=update_fields)
        return Response(category_data(category))


class OrganizationCategoryImageView(APIView):
    permission_classes = []
    authentication_classes = []

    def get(self, request, pk):
        category = get_object_or_404(OrganizationCategory, pk=pk)
        if not category.image:
            raise Http404
        try:
            content_type = IMAGE_SIGNATURES.get(Path(category.image.name).suffix.lower(), (None, 'application/octet-stream'))[1]
            response = FileResponse(category.image.open('rb'), content_type=content_type)
        except FileNotFoundError:
            raise Http404
        response['X-Content-Type-Options'] = 'nosniff'
        response['Content-Security-Policy'] = "default-src 'none'; sandbox"
        return response
