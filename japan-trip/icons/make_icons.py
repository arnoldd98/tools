"""Write the PWA icons (stdlib only): ocean-blue background with a sand-white disc.

Run from the repo root:  python3 japan-trip/icons/make_icons.py
"""
import os
import struct
import zlib

BG = (0x22, 0x73, 0xB3, 0xFF)  # --accent (Okinawa ocean blue)
FG = (0xF7, 0xF5, 0xEF, 0xFF)  # --bg (white sand)
OUT = os.path.dirname(os.path.abspath(__file__))


def png(path, size, radius_frac):
    r = radius_frac * size
    c = (size - 1) / 2
    rows = []
    for y in range(size):
        row = bytearray([0])  # filter: none
        for x in range(size):
            d = ((x - c) ** 2 + (y - c) ** 2) ** 0.5
            # 1px anti-aliased edge
            t = max(0.0, min(1.0, r - d + 0.5))
            row += bytes(round(BG[i] + (FG[i] - BG[i]) * t) for i in range(4))
        rows.append(bytes(row))
    raw = b''.join(rows)

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


for name, size, frac in [
    ('icon-192.png', 192, 0.30),
    ('icon-512.png', 512, 0.30),
    ('icon-maskable-512.png', 512, 0.22),
    ('apple-touch-icon.png', 180, 0.30),
]:
    png(os.path.join(OUT, name), size, frac)
    print('wrote', name)
