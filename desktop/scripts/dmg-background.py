# Renders the DMG window background, build/dmg/background.png and its @2x
# twin, from the waves picture in build/dmg/source. Needs Python 3 and Pillow.
#
#   python3 desktop/scripts/dmg-background.py
#
# Run it after `npm install` at the repository root, which provides Geist, the
# app's font (SIL Open Font License), through Next.js.
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
here = Path(__file__).resolve().parent.parent
src = here / "build/dmg/source/waves.png"
font_path = str(here.parent / "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf")
out_dir = here / "build/dmg"
W, H = 761, 406
APP, APPS = (225, 160), (535, 160)
waves = Image.open(src).convert("RGB")
crop_h = round(waves.width * H / W)
top = (waves.height - crop_h) // 2
waves = waves.crop((0, top, waves.width, top + crop_h))

def bezier(p0, p1, p2, p3, n=200):
    pts = []
    for i in range(n + 1):
        t = i / n
        pts.append(tuple((1-t)**3*a + 3*(1-t)**2*t*b + 3*(1-t)*t**2*c + t**3*d for a, b, c, d in zip(p0, p1, p2, p3)))
    return pts

def render(scale):
    img = waves.resize((W * scale, H * scale), Image.LANCZOS).convert("RGBA")
    # Arrow, drawn at 4x and scaled down for smooth edges.
    ss = scale * 4
    layer = Image.new("RGBA", (W * ss, H * ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    p0, p1, p2, p3 = (318, 152), (352, 120), (408, 120), (442, 152)
    pts = [(x * ss, y * ss) for x, y in bezier(p0, p1, p2, p3)]
    width = round(3 * ss)
    d.line(pts, fill=(255, 255, 255, 235), width=width, joint="curve")
    for x, y in (pts[0], pts[-1]):
        r = width / 2
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, 235))
    # Arrowhead along the curve's end direction.
    ex, ey = pts[-1]
    ang = math.atan2(p3[1] - p2[1], p3[0] - p2[0])
    for side in (-1, 1):
        a = ang + math.pi + side * math.radians(38)
        hx, hy = ex + math.cos(a) * 14 * ss, ey + math.sin(a) * 14 * ss
        d.line([(ex, ey), (hx, hy)], fill=(255, 255, 255, 235), width=width)
        r = width / 2
        d.ellipse((hx - r, hy - r, hx + r, hy + r), fill=(255, 255, 255, 235))
    layer = layer.resize((W * scale, H * scale), Image.LANCZOS)
    img.alpha_composite(layer)
    # Light pills behind the icon names: Finder always draws names in black
    # over a background picture. Centred 82 points below each icon, sized
    # to the names in Finder's 12-point label font.
    pills = Image.new("RGBA", (W * ss, H * ss), (0, 0, 0, 0))
    pd = ImageDraw.Draw(pills)
    for (cx, cy), text_w in ((APP, 66), (APPS, 69)):
        w, h, y = text_w + 16, 22, cy + 82
        pd.rounded_rectangle(
            ((cx - w / 2) * ss, (y - h / 2) * ss, (cx + w / 2) * ss, (y + h / 2) * ss),
            radius=6 * ss, fill=(245, 245, 245, 235))
    img.alpha_composite(pills.resize((W * scale, H * scale), Image.LANCZOS))
    # Instruction text, white, centred near the bottom.
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(font_path, 17 * scale)
    text = "Drag to Applications to install"
    d.text((W * scale / 2, 336 * scale), text, font=font, fill=(255, 255, 255, 240), anchor="mm")
    return img.convert("RGB")

render(1).save(f"{out_dir}/background.png", optimize=True)
render(2).save(f"{out_dir}/background@2x.png", optimize=True)
