from django.db import models


class Organization(models.Model):
    name = models.CharField(max_length=150)
    normalized_name = models.CharField(max_length=150, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "organizations"
        ordering = ["name"]

    @staticmethod
    def normalize_name(value: str) -> str:
        return " ".join(value.split())

    def save(self, *args, **kwargs):
        self.name = self.normalize_name(self.name)
        self.normalized_name = self.name.casefold()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name
