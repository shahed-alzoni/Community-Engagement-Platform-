from django.db import migrations, models


def normalize_existing_statuses(apps, schema_editor):
    Complaint = apps.get_model('cep', 'Complaint')
    ComplaintStatusEvent = apps.get_model('cep', 'ComplaintStatusEvent')
    Complaint.objects.filter(status__in=['submitted', 'pending_assignment']).update(status='pending')
    ComplaintStatusEvent.objects.filter(status__in=['submitted', 'pending_assignment']).update(status='pending')


class Migration(migrations.Migration):
    dependencies = [('cep', '0013_sync_open_complaint_representatives')]

    operations = [
        migrations.AlterField(
            model_name='complaint', name='status',
            field=models.CharField(max_length=24, choices=[('pending', 'Pending'), ('in_progress', 'In progress'), ('resolved', 'Resolved'), ('rejected', 'Rejected')], default='pending'),
        ),
        migrations.AlterField(
            model_name='complaintstatusevent', name='status',
            field=models.CharField(max_length=24, choices=[('pending', 'Pending'), ('in_progress', 'In progress'), ('resolved', 'Resolved'), ('rejected', 'Rejected')]),
        ),
        migrations.RunPython(normalize_existing_statuses, migrations.RunPython.noop),
    ]
