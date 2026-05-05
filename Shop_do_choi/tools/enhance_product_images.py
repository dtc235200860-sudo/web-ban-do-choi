from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import cv2
import numpy as np
from PIL import Image


SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
WHITE_THRESHOLD = 245


@dataclass
class ProcessResult:
    source: str
    output: str
    method: str
    width: int
    height: int


def iter_images(root: Path) -> Iterable[Path]:
    for path in root.rglob("*"):
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS:
            yield path


def read_image(path: Path) -> np.ndarray:
    data = np.fromfile(path, dtype=np.uint8)
    image = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"Không đọc được ảnh: {path}")
    return image


def save_image(path: Path, image_rgb: np.ndarray, quality: int = 95) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image_bgr = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)
    ext = path.suffix.lower()
    if ext in {".jpg", ".jpeg"}:
        ok, encoded = cv2.imencode(".jpg", image_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    elif ext == ".png":
        ok, encoded = cv2.imencode(".png", image_bgr, [int(cv2.IMWRITE_PNG_COMPRESSION), 3])
    else:
        ok, encoded = cv2.imencode(".webp", image_bgr, [int(cv2.IMWRITE_WEBP_QUALITY), quality])
    if not ok:
        raise ValueError(f"Không mã hóa được ảnh đầu ra: {path}")
    path.write_bytes(encoded.tobytes())


def largest_component(mask: np.ndarray) -> np.ndarray:
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if num_labels <= 1:
        return mask
    largest_index = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    output = np.zeros_like(mask)
    output[labels == largest_index] = 255
    return output


def mask_from_white_background(image_rgb: np.ndarray) -> tuple[np.ndarray, float]:
    close_to_white = np.all(image_rgb >= WHITE_THRESHOLD, axis=2)
    mask = (~close_to_white).astype(np.uint8) * 255
    kernel = np.ones((5, 5), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    mask = cv2.GaussianBlur(mask, (5, 5), 0)
    _, mask = cv2.threshold(mask, 10, 255, cv2.THRESH_BINARY)
    mask = largest_component(mask)
    ratio = float(np.count_nonzero(mask)) / float(mask.size)
    return mask, ratio


def mask_from_grabcut(image_rgb: np.ndarray) -> np.ndarray:
    # Resize for faster GrabCut processing
    height, width = image_rgb.shape[:2]
    scale = max(width, height) / 1024.0 if max(width, height) > 1024 else 1.0
    
    if scale > 1.0:
        work_w = int(width / scale)
        work_h = int(height / scale)
        work_image = cv2.resize(image_rgb, (work_w, work_h), interpolation=cv2.INTER_LINEAR)
    else:
        work_image = image_rgb
        work_w = width
        work_h = height
    
    rect = (
        max(5, int(work_w * 0.05)),
        max(5, int(work_h * 0.05)),
        max(10, int(work_w * 0.90)),
        max(10, int(work_h * 0.90)),
    )
    grabcut_mask = np.zeros((work_h, work_w), np.uint8)
    bg_model = np.zeros((1, 65), np.float64)
    fg_model = np.zeros((1, 65), np.float64)
    cv2.grabCut(work_image, grabcut_mask, rect, bg_model, fg_model, 3, cv2.GC_INIT_WITH_RECT)
    mask = np.where(
        (grabcut_mask == cv2.GC_FGD) | (grabcut_mask == cv2.GC_PR_FGD),
        255,
        0,
    ).astype(np.uint8)
    
    # Resize back if scaled down
    if scale > 1.0:
        mask = cv2.resize(mask, (width, height), interpolation=cv2.INTER_LINEAR)
    
    kernel = np.ones((5, 5), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    mask = largest_component(mask)
    return mask


def detect_product_mask(image_rgb: np.ndarray) -> tuple[np.ndarray, str]:
    white_mask, ratio = mask_from_white_background(image_rgb)
    if 0.03 <= ratio <= 0.85:
        return white_mask, "white-threshold"

    grabcut_mask = mask_from_grabcut(image_rgb)
    grabcut_ratio = float(np.count_nonzero(grabcut_mask)) / float(grabcut_mask.size)
    if 0.02 <= grabcut_ratio <= 0.95:
        return grabcut_mask, "grabcut"

    fallback = np.full(image_rgb.shape[:2], 255, dtype=np.uint8)
    return fallback, "fallback-full"


def alpha_from_mask(mask: np.ndarray) -> np.ndarray:
    alpha = cv2.GaussianBlur(mask, (7, 7), 0).astype(np.float32) / 255.0
    alpha = np.clip(alpha, 0.0, 1.0)
    return alpha


def crop_to_mask(image_rgb: np.ndarray, alpha: np.ndarray, padding_ratio: float = 0.08) -> tuple[np.ndarray, np.ndarray]:
    non_zero = np.argwhere(alpha > 0.03)
    if non_zero.size == 0:
        return image_rgb, alpha

    y_min, x_min = non_zero.min(axis=0)
    y_max, x_max = non_zero.max(axis=0)

    height, width = image_rgb.shape[:2]
    pad_x = int((x_max - x_min + 1) * padding_ratio)
    pad_y = int((y_max - y_min + 1) * padding_ratio)

    x1 = max(0, x_min - pad_x)
    y1 = max(0, y_min - pad_y)
    x2 = min(width, x_max + pad_x + 1)
    y2 = min(height, y_max + pad_y + 1)

    return image_rgb[y1:y2, x1:x2], alpha[y1:y2, x1:x2]


def enhance_subject(image_rgb: np.ndarray) -> np.ndarray:
    image_bgr = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)
    # Faster denoising with reduced parameters
    denoised = cv2.fastNlMeansDenoisingColored(image_bgr, None, 2, 2, 7, 15)

    lab = cv2.cvtColor(denoised, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l_channel = clahe.apply(l_channel)
    lab = cv2.merge((l_channel, a_channel, b_channel))
    balanced = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    gaussian = cv2.GaussianBlur(balanced, (0, 0), 1.2)
    sharpened = cv2.addWeighted(balanced, 1.5, gaussian, -0.5, 0)

    return cv2.cvtColor(sharpened, cv2.COLOR_BGR2RGB)


def compose_on_white(image_rgb: np.ndarray, alpha: np.ndarray, size: int = 4096) -> np.ndarray:
    h, w = image_rgb.shape[:2]
    scale = min((size * 0.86) / max(w, 1), (size * 0.86) / max(h, 1))
    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))

    resized_img = cv2.resize(image_rgb, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)
    resized_alpha = cv2.resize(alpha, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)
    resized_alpha = np.clip(resized_alpha[..., None], 0.0, 1.0)

    canvas = np.full((size, size, 3), 255, dtype=np.uint8)
    y = (size - new_h) // 2
    x = (size - new_w) // 2

    roi = canvas[y : y + new_h, x : x + new_w].astype(np.float32)
    src = resized_img.astype(np.float32)
    blended = src * resized_alpha + roi * (1.0 - resized_alpha)
    canvas[y : y + new_h, x : x + new_w] = np.clip(blended, 0, 255).astype(np.uint8)
    return canvas


def process_image(path: Path, output_root: Path, input_root: Path, size: int = 4096) -> ProcessResult:
    image_bgr = read_image(path)
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    mask, method = detect_product_mask(image_rgb)
    alpha = alpha_from_mask(mask)

    enhanced = enhance_subject(image_rgb)
    cropped_img, cropped_alpha = crop_to_mask(enhanced, alpha)
    final_image = compose_on_white(cropped_img, cropped_alpha, size=size)

    relative = path.relative_to(input_root)
    output_path = output_root / relative.with_suffix(".jpg")
    save_image(output_path, final_image, quality=95)

    return ProcessResult(
        source=str(path),
        output=str(output_path),
        method=method,
        width=size,
        height=size,
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Tối ưu ảnh sản phẩm về nền trắng, khung vuông 4K, tăng nét cho website bán hàng."
    )
    parser.add_argument("--input", required=True, help="Thư mục ảnh nguồn")
    parser.add_argument("--output", required=True, help="Thư mục lưu ảnh đầu ra")
    parser.add_argument("--size", type=int, default=4096, help="Kích thước vuông đầu ra, mặc định 4096")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    input_root = Path(args.input).expanduser().resolve()
    output_root = Path(args.output).expanduser().resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    results: list[ProcessResult] = []
    images = sorted(iter_images(input_root))
    if not images:
        raise SystemExit(f"Không tìm thấy ảnh trong: {input_root}")

    for image_path in images:
        result = process_image(image_path, output_root, input_root, size=args.size)
        results.append(result)
        print(f"[OK] {image_path.name} -> {Path(result.output).name} ({result.method})")

    report_path = output_root / "processing_report.json"
    report_path.write_text(
        json.dumps([result.__dict__ for result in results], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\nĐã xử lý {len(results)} ảnh.")
    print(f"Thư mục đầu ra: {output_root}")
    print(f"Báo cáo: {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
