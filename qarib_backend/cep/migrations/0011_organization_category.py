import cep.models.organization_category
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('cep', '0010_organization_display_name')]

    operations = [
        migrations.CreateModel(
            name='OrganizationCategory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=150)),
                ('image', models.FileField(upload_to=cep.models.organization_category.category_image_path)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='categories', to='cep.organization')),
            ],
            options={'db_table': 'organization_categories', 'ordering': ['created_at', 'id']},
        ),
        migrations.AddField(
            model_name='complaint',
            name='category',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='complaints', to='cep.organizationcategory'),
        ),
    ]
