from pathlib import Path

from rest_framework import serializers

from cep.models import OrganizationCategory

IMAGE_SIGNATURES = {
    '.png': (b'\x89PNG\r\n\x1a\n', 'image/png'),
    '.jpg': (b'\xff\xd8\xff', 'image/jpeg'),
    '.jpeg': (b'\xff\xd8\xff', 'image/jpeg'),
    '.webp': (b'RIFF', 'image/webp'),
}


class OrganizationCategoryWriteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150, trim_whitespace=True)
    image = serializers.FileField(required=False)

    def validate_image(self, image):
        signature, content_type = IMAGE_SIGNATURES.get(Path(image.name).suffix.lower(), (None, None))
        header = image.read(12)
        image.seek(0)
        if (not signature or image.size > 5 * 1024 * 1024 or not header.startswith(signature)
                or image.content_type != content_type
                or (content_type == 'image/webp' and header[8:12] != b'WEBP')):
            raise serializers.ValidationError('Choose a valid JPEG, PNG, or WebP image up to 5 MB.')
        return image

    def validate(self, attrs):
        organization = self.context['organization']
        instance = self.context.get('instance')
        if instance is None and 'image' not in attrs:
            raise serializers.ValidationError({'image': 'Choose an image for this category.'})
        name = attrs['name']
        if name.casefold() == organization.citizen_display_name.casefold():
            raise serializers.ValidationError({'name': 'This name is already used by your organization.'})
        existing = OrganizationCategory.objects.filter(organization=organization, name__iexact=name)
        if instance:
            existing = existing.exclude(pk=instance.pk)
        if existing.exists():
            raise serializers.ValidationError({'name': 'This name is already used by your organization.'})
        return attrs


def category_data(category):
    return {
        'id': category.pk,
        'name': category.name,
        'image_version': category.updated_at.isoformat() if category.image else None,
    }
