from pathlib import Path
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from rest_framework import serializers

from cep.models import Complaint, ComplaintPhoto, ComplaintResolutionPhoto, ComplaintStatusEvent, ComplaintTransferEvent, Organization, OrganizationCategory


IMAGE_SIGNATURES = {
    '.png': b'\x89PNG\r\n\x1a\n',
    '.jpg': b'\xff\xd8\xff',
    '.jpeg': b'\xff\xd8\xff',
    '.webp': b'RIFF',
}


class MapCoordinateField(serializers.DecimalField):
    def to_internal_value(self, data):
        try:
            coordinate = Decimal(str(data))
            if not coordinate.is_finite():
                self.fail('invalid')
            coordinate = coordinate.quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP)
        except (InvalidOperation, TypeError, ValueError):
            self.fail('invalid')
        return super().to_internal_value(coordinate)


class ComplaintPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComplaintPhoto
        fields = ['id', 'created_at']


class ComplaintResolutionPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComplaintResolutionPhoto
        fields = ['id', 'created_at']


class ComplaintStatusEventSerializer(serializers.ModelSerializer):
    resolution_photos = ComplaintResolutionPhotoSerializer(many=True, read_only=True)

    class Meta:
        model = ComplaintStatusEvent
        fields = ['status', 'note', 'created_at', 'resolution_photos']


class ComplaintTransferEventSerializer(serializers.ModelSerializer):
    from_organization_name = serializers.CharField(source='from_organization.citizen_display_name', read_only=True)
    to_organization_name = serializers.CharField(source='to_organization.citizen_display_name', read_only=True)

    class Meta:
        model = ComplaintTransferEvent
        fields = ['from_organization_name', 'to_organization_name', 'created_at']


class ComplaintTransferSerializer(serializers.Serializer):
    organization = serializers.PrimaryKeyRelatedField(queryset=Organization.objects.all())


class ComplaintSerializer(serializers.ModelSerializer):
    organization_name = serializers.SerializerMethodField()
    organization_image_version = serializers.SerializerMethodField()
    category_image_version = serializers.SerializerMethodField()
    photos = ComplaintPhotoSerializer(many=True, read_only=True)
    status_events = ComplaintStatusEventSerializer(many=True, read_only=True)
    transfer_events = serializers.SerializerMethodField()

    def get_transfer_events(self, complaint):
        request = self.context.get('request')
        if not request or request.user.role != 'representative':
            return []
        return ComplaintTransferEventSerializer(complaint.transfer_events.all(), many=True).data

    def get_organization_name(self, complaint):
        return complaint.category_name_at_submission or (complaint.category.name if complaint.category_id else complaint.organization.citizen_display_name)

    def get_organization_image_version(self, complaint):
        return complaint.organization.updated_at.isoformat() if complaint.organization.image else None

    def get_category_image_version(self, complaint):
        return complaint.category.updated_at.isoformat() if complaint.category_id and complaint.category.image else None

    class Meta:
        model = Complaint
        fields = [
            'id', 'reference', 'title', 'description', 'organization', 'category', 'organization_name',
            'organization_image_version', 'category_image_version',
            'location_label', 'latitude', 'longitude', 'status', 'photos', 'status_events', 'transfer_events',
            'created_at', 'updated_at',
        ]


class ComplaintCreateSerializer(serializers.Serializer):
    organization = serializers.PrimaryKeyRelatedField(queryset=Organization.objects.all())
    category = serializers.PrimaryKeyRelatedField(queryset=OrganizationCategory.objects.all(), required=False, allow_null=True)
    title = serializers.CharField(max_length=160, trim_whitespace=True)
    description = serializers.CharField(max_length=5000, trim_whitespace=True)
    location_label = serializers.CharField(max_length=255, required=False, allow_blank=True)
    latitude = MapCoordinateField(max_digits=9, decimal_places=6, min_value=-90, max_value=90)
    longitude = MapCoordinateField(max_digits=9, decimal_places=6, min_value=-180, max_value=180)

    def validate(self, attrs):
        category = attrs.get('category')
        if category and category.organization_id != attrs['organization'].pk:
            raise serializers.ValidationError({'category': 'Choose a category belonging to this organization.'})
        photos = self.context['request'].FILES.getlist('photos')
        if len(photos) > 3:
            raise serializers.ValidationError({'photos': 'Upload no more than 3 photos.'})
        for photo in photos:
            extension = Path(photo.name).suffix.lower()
            signature = IMAGE_SIGNATURES.get(extension)
            if photo.size > 5 * 1024 * 1024:
                raise serializers.ValidationError({'photos': 'Each photo must be 5 MB or smaller.'})
            header = photo.read(12)
            photo.seek(0)
            if not signature or not header.startswith(signature) or (extension == '.webp' and header[8:12] != b'WEBP'):
                raise serializers.ValidationError({'photos': 'Only valid JPEG, PNG, or WebP photos are allowed.'})
        attrs['photos'] = photos
        return attrs


class ComplaintStatusChangeSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[
        Complaint.Status.IN_PROGRESS, Complaint.Status.RESOLVED, Complaint.Status.REJECTED,
    ])
    note = serializers.CharField(max_length=2000, required=False, allow_blank=True, trim_whitespace=True)

    def validate(self, attrs):
        if attrs['status'] == Complaint.Status.REJECTED and not attrs.get('note', '').strip():
            raise serializers.ValidationError({'note': 'A reason is required when rejecting a complaint.'})
        photos = self.context['request'].FILES.getlist('resolution_photos')
        if photos and attrs['status'] != Complaint.Status.RESOLVED:
            raise serializers.ValidationError({'resolution_photos': 'Solution photos are only allowed when resolving a complaint.'})
        if len(photos) > 3:
            raise serializers.ValidationError({'resolution_photos': 'Upload no more than 3 solution photos.'})
        for photo in photos:
            extension = Path(photo.name).suffix.lower()
            signature = IMAGE_SIGNATURES.get(extension)
            if photo.size > 5 * 1024 * 1024:
                raise serializers.ValidationError({'resolution_photos': 'Each photo must be 5 MB or smaller.'})
            header = photo.read(12)
            photo.seek(0)
            if not signature or not header.startswith(signature) or (extension == '.webp' and header[8:12] != b'WEBP'):
                raise serializers.ValidationError({'resolution_photos': 'Only valid JPEG, PNG, or WebP photos are allowed.'})
        attrs['resolution_photos'] = photos
        return attrs
