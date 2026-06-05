from pathlib import Path
import struct


def build_icon(size: int = 32) -> bytes:
    pixels = bytearray()
    center = (size - 1) / 2
    radius_squared = (size * 0.49) ** 2

    # ICO stores DIB pixels bottom-up in BGRA order.
    for y in range(size - 1, -1, -1):
        for x in range(size):
            dx = x - center
            dy = y - center
            alpha = 255 if dx * dx + dy * dy <= radius_squared else 0
            blue = max(0, min(255, 230 - x * 3))
            green = max(0, min(255, 80 + y * 5))
            red = max(0, min(255, 110 + x * 4))
            pixels.extend([blue, green, red, alpha])

    and_mask_stride = ((size + 31) // 32) * 4
    and_mask = bytes(and_mask_stride * size)
    image_size = 40 + len(pixels) + len(and_mask)

    icon_dir = struct.pack("<HHH", 0, 1, 1)
    dir_entry = struct.pack("<BBBBHHII", size, size, 0, 0, 1, 32, image_size, 6 + 16)
    bitmap_info_header = struct.pack(
        "<IIIHHIIIIII",
        40,
        size,
        size * 2,
        1,
        32,
        0,
        len(pixels) + len(and_mask),
        0,
        0,
        0,
        0,
    )

    return icon_dir + dir_entry + bitmap_info_header + bytes(pixels) + and_mask


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    icon_path = root / "src-tauri" / "icons" / "icon.ico"
    icon_path.parent.mkdir(parents=True, exist_ok=True)
    icon_path.write_bytes(build_icon())
    print(f"Wrote {icon_path} ({icon_path.stat().st_size} bytes)")
