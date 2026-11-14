from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('cep', '0009_organization_image'),
    ]

    operations = [
        migrations.AddField(
            model_name='organization',
            name='display_name',
            field=models.CharField(blank=True, max_length=150),
        ),
    ]
