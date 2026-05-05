#!/usr/bin/env python
import os
import sys
from pathlib import Path

from dotenv import load_dotenv


def main() -> None:
    base_dir = Path(__file__).resolve().parent
    load_dotenv(base_dir / ".env")
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "toystore.settings")
    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
