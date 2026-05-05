#!/usr/bin/env python
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'toystore.settings')
sys.path.insert(0, r'd:\DuAnPy\Shop_do_choi\Shop_do_choi')
django.setup()

from apps.accounts.models import User

print("=" * 70)
print("TẠO TÀI KHOẢN NGƯỜI DÙNG")
print("=" * 70)

# Tạo admin
admin_email = "admin@toystore.com"
admin_password = "Admin@123456"

try:
    if User.objects.filter(username=admin_email).exists():
        print(f"\n⚠️  Tài khoản '{admin_email}' đã tồn tại")
    else:
        admin = User.objects.create_superuser(
            username=admin_email,
            email=admin_email,
            password=admin_password,
            first_name="Admin",
            last_name="ToyStore"
        )
        print(f"\n✅ Tạo ADMIN thành công")
        print(f"   Email: {admin_email}")
        print(f"   Mật khẩu: {admin_password}")
        print(f"   Loại: Superuser")
except Exception as e:
    print(f"\n❌ Lỗi khi tạo admin: {e}")

# Tạo user thường
user_email = "user@toystore.com"
user_password = "User@123456"

try:
    if User.objects.filter(username=user_email).exists():
        print(f"\n⚠️  Tài khoản '{user_email}' đã tồn tại")
    else:
        user = User.objects.create_user(
            username=user_email,
            email=user_email,
            password=user_password,
            first_name="User",
            last_name="ToyStore"
        )
        print(f"\n✅ Tạo USER thành công")
        print(f"   Email: {user_email}")
        print(f"   Mật khẩu: {user_password}")
        print(f"   Loại: Regular user")
except Exception as e:
    print(f"\n❌ Lỗi khi tạo user: {e}")

print("\n" + "=" * 70)
print("DANH SÁCH TÀI KHOẢN HIỆN CÓ")
print("=" * 70)

users = User.objects.all().order_by('-is_superuser', 'username')
for u in users:
    user_type = "🔑 ADMIN (Superuser)" if u.is_superuser else "👤 User"
    print(f"\n{user_type}")
    print(f"  └─ Username: {u.username}")
    print(f"  └─ Email: {u.email}")
    print(f"  └─ Name: {u.first_name} {u.last_name}")
    print(f"  └─ Created: {u.date_joined}")

print("\n" + "=" * 70)
