from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandParser


class Command(BaseCommand):
    help = "Create Application User"

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--email", type=str, help="User's email")
        parser.add_argument("--username", type=str, help="User's username")
        parser.add_argument("--password", type=str, help="User's password")

    def handle(self, *args, **options) -> None:
        email: str = options["email"]
        username: str = options["username"]
        password: str = options["password"]

        User = get_user_model()
        if email and username and password:
            if not User.objects.filter(email=email).exists() and not User.objects.filter(username=username).exists():
                User.objects.create_user(email=email, password=password, username=username)
                self.stdout.write(self.style.SUCCESS("User created successfully."))
            else:
                self.stdout.write(self.style.WARNING("User already exists."))
        else:
            self.stdout.write(self.style.ERROR("Please provide --email, --username, and --password arguments."))
