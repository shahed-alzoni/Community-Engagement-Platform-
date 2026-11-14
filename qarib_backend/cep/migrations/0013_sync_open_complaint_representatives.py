from django.db import migrations


def sync_open_complaints(apps, schema_editor):
    Complaint = apps.get_model('cep', 'Complaint')
    Assignment = apps.get_model('cep', 'OrganizationRepresentativeAssignment')
    open_complaints = Complaint.objects.filter(status__in=['submitted', 'pending_assignment', 'in_progress'])
    open_complaints.update(assigned_representative=None)
    for assignment in Assignment.objects.filter(ended_at__isnull=True, representative__is_active=True).iterator():
        open_complaints.filter(organization_id=assignment.organization_id).update(
            assigned_representative_id=assignment.representative_id,
        )


class Migration(migrations.Migration):
    dependencies = [('cep', '0012_complaint_category_snapshot_and_event_actor')]

    operations = [migrations.RunPython(sync_open_complaints, migrations.RunPython.noop)]
