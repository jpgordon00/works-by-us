"""Rebuild the share-card glyph masks with Pillow and the site's licensed font."""

import json
import struct
import zlib
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

media = Path(__file__).resolve().parents[1] / "src" / "media"
size = 88
font = ImageFont.truetype(str(media / "space-grotesk.woff2"), size)
font.set_variation_by_axes([620])


def mask(character):
    # The site's webfont is a Latin subset. Supply the two extra glyphs
    # used in catalog questions about Erdős statements and circuit complexity.
    if character == "Ω":
        bitmap = Image.new("L", (68, 68))
        draw = ImageDraw.Draw(bitmap)
        draw.arc((4, 2, 64, 64), 125, 415, fill=255, width=7)
        draw.rectangle((3, 59, 18, 65), fill=255)
        draw.rectangle((49, 59, 65, 65), fill=255)
        return bitmap, 0, -65, 70
    if character in "őŐ":
        base = "o" if character == "ő" else "O"
        x, y, right, bottom = font.getbbox(base, anchor="ls")
        bitmap = Image.new("L", (right - x, bottom - y + 18))
        draw = ImageDraw.Draw(bitmap)
        draw.text((-x, -y + 18), base, font=font, fill=255, anchor="ls")
        center = bitmap.width // 2
        for shift in (-7, 6):
            draw.polygon([(center + shift - 6, 13), (center + shift + 2, 0),
                          (center + shift + 10, 0), (center + shift, 13)], fill=255)
        return bitmap, x, y - 18, font.getlength(base)
    x, y, right, bottom = font.getbbox(character, anchor="ls")
    bitmap = Image.new("L", (right - x, bottom - y))
    ImageDraw.Draw(bitmap).text((-x, -y), character, font=font, fill=255, anchor="ls")
    return bitmap, x, y, font.getlength(character)


characters = [chr(i) for i in range(32, 127)] + [chr(i) for i in range(160, 256)]
characters += list("őŐΩ–—‘’“”•…′″€↑↓−")
glyphs = {}
pixels = bytearray()
for character in characters:
    bitmap, x, y, advance = mask(character)
    glyphs[character] = [len(pixels), bitmap.width, bitmap.height, x, y, round(advance, 2)]
    pixels.extend(bitmap.point(lambda value: round(value / 255 * 31)).tobytes())
header = json.dumps({"size": size, "glyphs": glyphs}, separators=(",", ":")).encode()
blob = struct.pack(">I", len(header)) + header + pixels
(media / "share-glyphs.bin").write_bytes(zlib.compress(blob, level=9))
