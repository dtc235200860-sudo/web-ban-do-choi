from django.core.management.base import BaseCommand

from toystore.seeding import seed_demo_data


class Command(BaseCommand):
    help = "Tạo dữ liệu mẫu cho website bán đồ chơi"

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="Xóa dữ liệu cũ và tạo lại dữ liệu mẫu")

    def handle(self, *args, **options):
        result = seed_demo_data(force=options["force"])
        self.stdout.write(self.style.SUCCESS(f"Seed dữ liệu thành công: {result}"))
