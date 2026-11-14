from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def backfill_category_names(apps, schema_editor):
    Complaint = apps.get_model('cep', 'Complaint')
    for complaint in Complaint.objects.select_related('category', 'organization').iterator():
        complaint.category_name_at_submission = (
            complaint.category.name if complaint.category_id
            else complaint.organization.display_name or complaint.organization.name
        )
        complaint.save(update_fields=['category_name_at_submission'])


class Migration(migrations.Migration):
    dependencies = [
        ('cep', '0011_organization_category'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='complaint',
            name='category_name_at_submission',
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name='complaintstatusevent',
            name='actor',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='complaint_status_actions', to=settings.AUTH_USER_MODEL),
        ),
        migrations.RunPython(backfill_category_names, migrations.RunPython.noop),
    ]
