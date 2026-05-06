from __future__ import annotations

import json
import mimetypes
import urllib.error
import urllib.request

from django.conf import settings
from django.db.models import Sum
from django.http import FileResponse, Http404
from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.orders.models import Order, OrderItem, ORDER_STATUS_LABELS
from apps.products.models import Product, SiteConfig
from toystore.api import IsAdminRole, api_error, api_ok
from toystore.seeding import copy_banner_files, seed_demo_data


@ensure_csrf_cookie
def frontend_index(request):
    return render(request, "index.html")


def frontend_asset(request, asset_type: str, asset_path: str):
    base = settings.FRONTEND_DIR / asset_type
    target = (base / asset_path).resolve()
    if not str(target).startswith(str(base.resolve())) or not target.exists() or not target.is_file():
        raise Http404("Asset not found")
    content_type, _ = mimetypes.guess_type(str(target))
    return FileResponse(open(target, "rb"), content_type=content_type or "application/octet-stream")


def _media_urls(subdir: str) -> list[str]:
    base_dir = settings.MEDIA_ROOT / subdir
    if subdir == "banners" and not base_dir.exists():
        copy_banner_files()
    if not base_dir.exists():
        return []
    files = [p for p in base_dir.rglob("*") if p.is_file()]
    return [settings.MEDIA_URL + str(p.relative_to(settings.MEDIA_ROOT)).replace("\\", "/") for p in sorted(files)]


class SeedView(APIView):
    def post(self, request):
        return api_ok(seed_demo_data())


class BannersView(APIView):
    def get(self, request):
        return api_ok(_media_urls("banners"))


class MediaToysView(APIView):
    def get(self, request):
        return api_ok(_media_urls("products"))


class MediaBannersView(APIView):
    def get(self, request):
        return api_ok(_media_urls("banners"))


class ConfigView(APIView):
    def get(self, request):
        config = SiteConfig.get_solo()
        return api_ok(config.to_dict())

    def put(self, request):
        if not request.user.is_authenticated or not (request.user.is_superuser or getattr(request.user, "role", "") == "admin"):
            return api_error("Bạn không có quyền cập nhật cấu hình.", 403)
        config = SiteConfig.get_solo()
        payload = request.data if isinstance(request.data, dict) else {}
        config.update_from_dict(payload)
        return api_ok(config.to_dict())


def _build_gemini_payload(message: str, history: list[dict]) -> dict:
    contents = []
    for item in history[-10:]:
        role = "model" if item.get("sender") == "bot" else "user"
        text = str(item.get("text") or "").strip()
        if text:
            contents.append({"role": role, "parts": [{"text": text}]})
    contents.append({"role": "user", "parts": [{"text": message}]})
    # Include strict system instruction to constrain assistant behavior
    system_text = (
        "Bạn là trợ lý AI chính thức của website bán đồ chơi ToyStore.\n\n"
        "Nhiệm vụ của bạn:\n"
        "- Tư vấn sản phẩm\n"
        "- Hỗ trợ khách hàng\n"
        "- Giải đáp thông tin liên quan đến đồ chơi\n\n"
        "NGUYÊN TẮC BẮT BUỘC:\n\n"
        "1. Chỉ được trả lời dựa trên:\n"
        "   - Lịch sử hội thoại được cung cấp\n"
        "   - Thông tin có trong hệ thống website\n\n"
        "2. Tuyệt đối không được:\n"
        "   - Tự tạo sản phẩm không tồn tại\n"
        "   - Tự đặt giá tiền\n"
        "   - Tự suy đoán tồn kho\n"
        "   - Tự bịa chương trình khuyến mãi\n\n"
        "3. Nếu không có đủ thông tin:\n"
        "   Phải trả lời:\n"
        "   \"Xin lỗi, hiện tại tôi chưa có thông tin về nội dung này trong hệ thống. \n"
        "   Bạn vui lòng kiểm tra lại trên website hoặc cung cấp thêm chi tiết.\"\n\n"
        "4. Nếu người dùng hỏi ngoài lĩnh vực bán đồ chơi:\n"
        "   Lịch sự từ chối và đưa cuộc hội thoại về chủ đề sản phẩm.\n\n"
        "5. Câu trả lời cần:\n"
        "   - Ngắn gọn\n"
        "   - Rõ ràng\n"
        "   - Thân thiện\n"
        "   - Mang tính tư vấn bán hàng\n\n"
        "Vai trò của bạn là trợ lý bán hàng, không phải chatbot đa năng."
    )

    return {
        "systemInstruction": {"parts": [{"text": system_text}]},
        "contents": contents,
        "generationConfig": {
            "temperature": 0.7,
            "topP": 0.95,
            "maxOutputTokens": 512,
        },
    }


class GeminiChatView(APIView):
    def post(self, request):
        api_key = settings.__dict__.get("GEMINI_API_KEY") or getattr(settings, "GEMINI_API_KEY", "")
        if not api_key:
            return api_error("Chưa cấu hình GEMINI_API_KEY trong file .env.", 500)

        message = str(request.data.get("message") or "").strip()
        history = request.data.get("history") or []
        if not message:
            return api_error("Thiếu nội dung tin nhắn.")

        payload = _build_gemini_payload(message, history if isinstance(history, list) else [])
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            return api_error(f"Gemini API lỗi: {detail or exc.reason}", 502)
        except Exception as exc:
            return api_error(f"Không thể kết nối Gemini API: {exc}", 502)

        candidates = data.get("candidates") or []
        text = ""
        if candidates:
            parts = ((candidates[0].get("content") or {}).get("parts") or [])
            text = "\n".join(str(p.get("text") or "").strip() for p in parts if p.get("text"))
        if not text:
            text = "Xin lỗi, mình chưa nhận được phản hồi phù hợp từ Gemini."
        return api_ok({"reply": text})


class RevenueReportView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        orders = Order.objects.exclude(status="cancelled")
        by_date = {}
        by_month = {}
        for order in orders:
            date_key = order.date.strftime("%d/%m/%Y")
            month_key = order.date.strftime("%m/%Y")
            by_date[date_key] = by_date.get(date_key, 0) + float(order.total)
            by_month[month_key] = by_month.get(month_key, 0) + float(order.total)
        return api_ok({"by_date": by_date, "by_month": by_month})


class InventoryReportView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        queryset = Product.objects.all()
        data = {
            "out_of_stock": queryset.filter(stock=0).count(),
            "low_stock": queryset.filter(stock__gt=0, stock__lte=10).count(),
            "normal_stock": queryset.filter(stock__gt=10, stock__lte=50).count(),
            "excess_stock": queryset.filter(stock__gt=50).count(),
        }
        return api_ok(data)


class TopProductsReportView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        items = (
            OrderItem.objects.values("product__id", "product__name")
            .annotate(total_sold=Sum("quantity"))
            .order_by("-total_sold")[:5]
        )
        return api_ok(list(items))


class OrdersStatsReportView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        stats = {key: Order.objects.filter(status=key).count() for key in ORDER_STATUS_LABELS.keys()}
        return api_ok(stats)
