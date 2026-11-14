from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from cep.models import Complaint, ComplaintPhoto, ComplaintResolutionPhoto, Organization, OrganizationCategory, User
from cep.serializers import ComplaintCreateSerializer, ComplaintSerializer
from cep.serializers.complaint import ComplaintStatusChangeSerializer
from cep.services.complaint import ComplaintService


class IsCitizen(BasePermission):
    message = 'Citizen access is required.'

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_active and user.role == User.Role.CITIZEN)


class IsAssignedRepresentative(BasePermission):
    message = 'An active organization representative is required.'

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_active
                    and user.role == User.Role.ORGANIZATION_REPRESENTATIVE
                    and getattr(user, 'active_organization_assignment', None))


class ComplaintOrganizationListView(APIView):
    permission_classes = [IsCitizen]

    def get(self, request):
        return Response([
            {'id': organization.pk, 'name': organization.citizen_display_name,
             'category_id': None,
             'image_version': organization.updated_at.isoformat() if organization.image else None}
            for organization in Organization.objects.order_by('name')
        ] + [
            {'id': category.organization_id, 'name': category.name,
             'category_id': category.pk,
             'image_version': category.updated_at.isoformat() if category.image else None}
            for category in OrganizationCategory.objects.select_related('organization').order_by('organization__name', 'created_at', 'id')
        ])


class CitizenComplaintListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsCitizen]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        queryset = Complaint.objects.filter(citizen=self.request.user).select_related('organization', 'category').prefetch_related('photos', 'status_events__resolution_photos')
        reference = self.request.query_params.get('reference', '').strip().upper()
        return queryset.filter(reference=reference) if reference else queryset

    def get_serializer_class(self):
        return ComplaintCreateSerializer if self.request.method == 'POST' else ComplaintSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        complaint = ComplaintService.create(citizen=request.user, **serializer.validated_data)
        return Response(ComplaintSerializer(complaint).data, status=status.HTTP_201_CREATED)


class CitizenComplaintDetailView(generics.RetrieveAPIView):
    permission_classes = [IsCitizen]
    serializer_class = ComplaintSerializer

    def get_queryset(self):
        return Complaint.objects.filter(citizen=self.request.user).select_related('organization', 'category').prefetch_related('photos', 'status_events__resolution_photos')


class CitizenComplaintPhotoView(APIView):
    permission_classes = [IsCitizen]

    def get(self, request, pk, photo_id):
        photo = get_object_or_404(ComplaintPhoto, pk=photo_id, complaint_id=pk, complaint__citizen=request.user)
        extension = photo.file.name.rsplit('.', 1)[-1].lower()
        content_type = {'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp'}[extension]
        response = FileResponse(photo.file.open('rb'), content_type=content_type)
        response['X-Content-Type-Options'] = 'nosniff'
        response['Cache-Control'] = 'private, no-store'
        response['Content-Disposition'] = 'inline'
        return response


def private_photo_response(photo):
    extension = photo.file.name.rsplit('.', 1)[-1].lower()
    content_type = {'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp'}[extension]
    response = FileResponse(photo.file.open('rb'), content_type=content_type)
    response['X-Content-Type-Options'] = 'nosniff'
    response['Cache-Control'] = 'private, no-store'
    response['Content-Disposition'] = 'inline'
    return response


class CitizenResolutionPhotoView(APIView):
    permission_classes = [IsCitizen]

    def get(self, request, pk, photo_id):
        photo = get_object_or_404(ComplaintResolutionPhoto, pk=photo_id, status_event__complaint_id=pk, status_event__complaint__citizen=request.user, status_event__status=Complaint.Status.RESOLVED)
        return private_photo_response(photo)


class RepresentativeComplaintListView(generics.ListAPIView):
    permission_classes = [IsAssignedRepresentative]
    serializer_class = ComplaintSerializer

    def get_queryset(self):
        organization_id = self.request.user.active_organization_assignment.organization_id
        return Complaint.objects.filter(organization_id=organization_id).select_related('organization', 'category').prefetch_related('photos', 'status_events__resolution_photos')


class RepresentativeComplaintDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAssignedRepresentative]
    serializer_class = ComplaintSerializer

    def get_queryset(self):
        organization_id = self.request.user.active_organization_assignment.organization_id
        return Complaint.objects.filter(organization_id=organization_id).select_related('organization', 'category').prefetch_related('photos', 'status_events__resolution_photos')


class RepresentativeComplaintStatusView(APIView):
    permission_classes = [IsAssignedRepresentative]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def patch(self, request, pk):
        serializer = ComplaintStatusChangeSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        complaint = ComplaintService.change_status(
            complaint_id=pk, representative=request.user, **serializer.validated_data,
        )
        if complaint is None:
            from rest_framework.exceptions import NotFound
            raise NotFound('Complaint not found.')
        return Response(ComplaintSerializer(complaint).data)


class RepresentativeResolutionPhotoView(APIView):
    permission_classes = [IsAssignedRepresentative]

    def get(self, request, pk, photo_id):
        organization_id = request.user.active_organization_assignment.organization_id
        photo = get_object_or_404(ComplaintResolutionPhoto, pk=photo_id, status_event__complaint_id=pk, status_event__complaint__organization_id=organization_id, status_event__status=Complaint.Status.RESOLVED)
        return private_photo_response(photo)


class RepresentativeComplaintPhotoView(APIView):
    permission_classes = [IsAssignedRepresentative]

    def get(self, request, pk, photo_id):
        organization_id = request.user.active_organization_assignment.organization_id
        photo = get_object_or_404(ComplaintPhoto, pk=photo_id, complaint_id=pk, complaint__organization_id=organization_id)
        extension = photo.file.name.rsplit('.', 1)[-1].lower()
        content_type = {'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp'}[extension]
        response = FileResponse(photo.file.open('rb'), content_type=content_type)
        response['X-Content-Type-Options'] = 'nosniff'
        response['Cache-Control'] = 'private, no-store'
        response['Content-Disposition'] = 'inline'
        return response
