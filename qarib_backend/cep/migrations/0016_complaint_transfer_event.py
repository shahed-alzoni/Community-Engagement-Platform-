from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [('cep', '0015_complaint_resolution_photo'), migrations.swappable_dependency(settings.AUTH_USER_MODEL)]

    operations = [
        migrations.CreateModel(
            name='ComplaintTransferEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('actor', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='complaint_transfers', to=settings.AUTH_USER_MODEL)),
                ('complaint', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='transfer_events', to='cep.complaint')),
                ('from_organization', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='+', to='cep.organization')),
                ('to_organization', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='+', to='cep.organization')),
            ],
            options={'db_table': 'complaint_transfer_events', 'ordering': ['created_at', 'id']},
        ),
    ]
