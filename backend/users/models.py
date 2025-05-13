from django.contrib.auth.models import AbstractUser
from django.db import models

class CustomUser(AbstractUser):
    """
    Extends Django's built-in user with a phone_number field.
    Inherits: first_name, last_name, username, password, email, etc.
    """
    phone_number = models.CharField(max_length=20, blank=True)

    def __str__(self):
        return self.username
