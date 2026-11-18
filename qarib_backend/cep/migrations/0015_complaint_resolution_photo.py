import cep.models.complaint
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('cep', '0014_four_complaint_statuses')]

    operations = [
        migrations.CreateModel(
            name='ComplaintResolutionPhoto',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file', models.FileField(upload_to=cep.models.complaint.resolution_photo_path)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('status_event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='resolution_photos', to='cep.complaintstatusevent')),
            ],
            options={'db_table': 'complaint_resolution_photos'},
        ),
    ]
