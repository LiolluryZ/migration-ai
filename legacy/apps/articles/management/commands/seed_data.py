from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from articles.models import Article

User = get_user_model()


class Command(BaseCommand):
    help = "Seed the database with demo users and articles for e2e testing"

    def handle(self, *args, **options):
        if User.objects.filter(username="johndoe").exists():
            self.stdout.write("Seed data already exists, skipping.")
            return

        johndoe = User.objects.create_user(
            email="johndoe@example.com",
            username="johndoe",
            password="password123",
            bio="I work at statefarm",
        )
        janedoe = User.objects.create_user(
            email="janedoe@example.com",
            username="janedoe",
            password="password123",
            bio="Software engineer",
        )

        for i in range(5):
            a = Article.objects.create(
                author=johndoe,
                title=f"How to build webapps {i + 1}",
                summary=f"Web development tips and tricks part {i + 1}",
                content=f"This is the body of article {i + 1} by johndoe. Useful web dev content.",
            )
            a.tags.add("webdev", "coding")

        for i in range(3):
            a = Article.objects.create(
                author=janedoe,
                title=f"Understanding Django {i + 1}",
                summary=f"Django deep dive part {i + 1}",
                content=f"This is the body of article {i + 1} by janedoe about Django internals.",
            )
            a.tags.add("django", "python")

        self.stdout.write(self.style.SUCCESS("Seed data created successfully."))
