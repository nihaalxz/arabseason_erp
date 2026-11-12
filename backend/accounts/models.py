from django.contrib.auth.models import AbstractUser
from django.db import models

class CustomUser(AbstractUser):
    ROLE_CHOICES = (
        ('Admin', 'Admin'),
        ('User', 'User'),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='Admin')
    access_list = models.JSONField(default=list, blank=True)
    is_cash_staff = models.BooleanField(default=False, db_index=True, help_text="Designates user as cashbook staff with restricted allowance and expense-only cashbook access")
