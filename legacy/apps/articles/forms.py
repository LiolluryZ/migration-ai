from django import forms


class ArticleForm(forms.Form):
    """Article editor form with field names matching the RealWorld SELECTORS.md spec."""

    title = forms.CharField(
        max_length=150,
        widget=forms.TextInput(attrs={"class": "form-control form-control-lg", "placeholder": "Article Title"}),
    )
    description = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={"class": "form-control", "placeholder": "What's this article about?"}),
    )
    body = forms.CharField(
        required=False,
        widget=forms.Textarea(
            attrs={"class": "form-control", "placeholder": "Write your article (in markdown)", "rows": 8}
        ),
    )
    tags = forms.CharField(
        required=False,
        widget=forms.HiddenInput(),
    )
