from pathlib import Path

from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from cep.models import Organization, User


IMAGE_SIGNATURES = {
    '.png': (b'\x89PNG\r\n\x1a\n', 'image/png'),
    '.jpg': (b'\xff\xd8\xff', 'image/jpeg'),
    '.jpeg': (b'\xff\xd8\xff', 'image/jpeg'),
    '.webp': (b'RIFF', 'image/webp'),
}


class OrganizationImageUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        user = request.user
        if not user.is_active or user.role != User.Role.ORGANIZATION_REPRESENTATIVE:
            return Response({'detail': 'Representative access is required.'}, status=status.HTTP_403_FORBIDDEN)
        assignment = getattr(user, 'active_organization_assignment', None)
        if assignment is None:
            return Response({'detail': 'No organization is assigned to this account.'}, status=status.HTTP_403_FORBIDDEN)
        image = request.FILES.get('image')
        if image is None:
            return Response({'image': ['Choose an image.']}, status=status.HTTP_400_BAD_REQUEST)
        signature, content_type = IMAGE_SIGNATURES.get(Path(image.name).suffix.lower(), (None, None))
        header = image.read(12)
        image.seek(0)
        if (not signature or image.size > 5 * 1024 * 1024 or not header.startswith(signature)
                or image.content_type != content_type
                or (content_type == 'image/webp' and header[8:12] != b'WEBP')):
            return Response({'image': ['Choose a valid JPEG, PNG, or WebP image up to 5 MB.']}, status=status.HTTP_400_BAD_REQUEST)
        organization = assignment.organization
        previous_image = organization.image.name
        organization.image.save(image.name, image, save=True)
        if previous_image:
            organization.image.storage.delete(previous_image)
        return Response({'organization_id': organization.pk, 'image_version': organization.updated_at.isoformat()})


class OrganizationImageView(APIView):
    permission_classes = []
    authentication_classes = []

    def get(self, request, pk):
        organization = get_object_or_404(Organization, pk=pk)
        if not organization.image:
            raise Http404
        try:
            response = FileResponse(organization.image.open('rb'), content_type=IMAGE_SIGNATURES.get(Path(organization.image.name).suffix.lower(), (None, 'application/octet-stream'))[1])
        except FileNotFoundError:
            raise Http404
        response['X-Content-Type-Options'] = 'nosniff'
        response['Content-Security-Policy'] = "default-src 'none'; sandbox"
        return response
