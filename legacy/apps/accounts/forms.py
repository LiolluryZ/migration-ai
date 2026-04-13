from django import forms
from django.contrib.auth import get_user_model

User = get_user_model()

_lg = "form-control form-control-lg"


class LoginForm(forms.Form):
    email = forms.EmailField(widget=forms.EmailInput(attrs={"class": _lg, "placeholder": "Email"}))
    password = forms.CharField(widget=forms.PasswordInput(attrs={"class": _lg, "placeholder": "Password"}))


class RegisterForm(forms.Form):
    username = forms.CharField(max_length=60, widget=forms.TextInput(attrs={"class": _lg, "placeholder": "Username"}))
    email = forms.EmailField(widget=forms.EmailInput(attrs={"class": _lg, "placeholder": "Email"}))
    password = forms.CharField(widget=forms.PasswordInput(attrs={"class": _lg, "placeholder": "Password"}))


class SettingsForm(forms.ModelForm):
    password = forms.CharField(
        required=False,
        widget=forms.PasswordInput(attrs={"class": _lg, "placeholder": "New Password"}),
    )

    class Meta:
        model = User
        fields = ["image", "username", "bio", "email"]
        widgets = {
            "image": forms.URLInput(attrs={"class": "form-control", "placeholder": "URL of profile picture"}),
            "username": forms.TextInput(attrs={"class": _lg, "placeholder": "Username"}),
            "bio": forms.Textarea(attrs={"class": _lg, "placeholder": "Short bio about you", "rows": 8}),
            "email": forms.EmailInput(attrs={"class": _lg, "placeholder": "Email"}),
        }
