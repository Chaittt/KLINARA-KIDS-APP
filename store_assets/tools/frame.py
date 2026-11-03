"""Frame raw screens into store screenshots + build the Play feature graphic.
Usage: python frame.py   (needs Pillow; reads ../raw, writes ../screenshots and ../feature_graphic)"""
import io
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "raw"
LOGO_URL = "https://customer-assets.emergentagent.com/job_a4a69bab-76bd-4aab-b87e-1d820620930f/artifacts/5n8sfahc_logo.jpeg"

CREAM = (245, 241, 232)
TEAL = (47, 107, 107)
TEAL_DARK = (31, 79, 79)
GOLD = (212, 165, 116)
BLUSH = (255, 194, 204)
INK = (26, 58, 58)
SERIF_B = "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf"
SANS = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
SANS_B = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"

HEADLINES = {
    "01_parent_home": ("Your child's day, at a glance", "Attendance, schedule and updates in one place"),
    "02_activity_feed": ("Photos & stories from class", "See what your little star did today"),
    "03_attendance": ("Attendance you can trust", "Daily status and monthly summary"),
    "04_fees_upi": ("Pay fees in seconds with UPI", "Clear dues, due dates and receipts"),
    "05_elthea_grow": ("Watch them GROW", "Optional Elthea development insights"),
    "06_teacher_attendance": ("Made for teachers too", "Mark attendance in a few taps"),
}

SIZES = {"google_play_1080x1920": (1080, 1920), "apple_iphone_6.9in_1320x2868": (1320, 2868)}


def font(path, size):
    return ImageFont.truetype(path, size)


def logo() -> Image.Image:
    data = urllib.request.urlopen(urllib.request.Request(LOGO_URL, headers={"User-Agent": "Mozilla/5.0"})).read()
    return Image.open(io.BytesIO(data)).convert("RGBA")


def rounded(img: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.size[0] - 1, img.size[1] - 1], radius=radius, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def phone(screen: Image.Image, width: int) -> Image.Image:
    """Screen inside a teal-dark bezel with rounded corners and a soft shadow."""
    scale = width / screen.width
    sw, sh = width, int(screen.height * scale)
    scr = rounded(screen.resize((sw, sh), Image.LANCZOS), int(sw * 0.09))
    bez = int(sw * 0.035)
    W, H = sw + 2 * bez, sh + 2 * bez
    pad = int(W * 0.08)
    canvas = Image.new("RGBA", (W + 2 * pad, H + 2 * pad), (0, 0, 0, 0))
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([pad, pad + int(pad * 0.4), pad + W, pad + H + int(pad * 0.4)], radius=int(W * 0.11), fill=(26, 58, 58, 90))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(pad // 2)))
    ImageDraw.Draw(canvas).rounded_rectangle([pad, pad, pad + W, pad + H], radius=int(W * 0.11), fill=TEAL_DARK)
    canvas.alpha_composite(scr, (pad + bez, pad + bez))
    return canvas


def wrap(draw, text, fnt, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=fnt) <= max_w:
            cur = t
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    return lines


def background(w, h) -> Image.Image:
    bg = Image.new("RGBA", (w, h), CREAM)
    d = ImageDraw.Draw(bg)
    d.ellipse([int(-w * 0.35), int(h * 0.55), int(w * 0.55), int(h * 1.15)], fill=(212, 165, 116, 70))
    d.ellipse([int(w * 0.6), int(-h * 0.08), int(w * 1.3), int(h * 0.3)], fill=(255, 194, 204, 90))
    return bg


def screenshot(name: str, size: tuple[int, int], mark: Image.Image) -> Image.Image:
    w, h = size
    bg = background(w, h)
    d = ImageDraw.Draw(bg)
    title, sub = HEADLINES[name]
    tf, sf = font(SERIF_B, int(w * 0.072)), font(SANS, int(w * 0.037))
    y = int(h * 0.05)
    m = mark.resize((int(w * 0.11), int(w * 0.11)), Image.LANCZOS)
    bg.alpha_composite(rounded(m, int(w * 0.025)), ((w - m.width) // 2, y))
    y += m.height + int(h * 0.022)
    for line in wrap(d, title, tf, w * 0.86):
        lw = d.textlength(line, font=tf)
        d.text(((w - lw) / 2, y), line, font=tf, fill=TEAL)
        y += int(tf.size * 1.15)
    y += int(h * 0.006)
    lw = d.textlength(sub, font=sf)
    d.text(((w - lw) / 2, y), sub, font=sf, fill=INK)
    y += int(sf.size * 1.6)
    ph = phone(Image.open(RAW / f"{name}.png"), int(w * 0.68))
    avail = h - y
    if ph.height > avail * 1.25:  # let phone bleed off the bottom a little, like most store shots
        ph = ph.resize((int(ph.width * avail * 1.25 / ph.height), int(avail * 1.25)), Image.LANCZOS)
    bg.alpha_composite(ph, ((w - ph.width) // 2, y))
    return bg.convert("RGB")


def feature_graphic(mark: Image.Image) -> Image.Image:
    w, h = 1024, 500
    bg = Image.new("RGBA", (w, h), TEAL)
    d = ImageDraw.Draw(bg)
    d.ellipse([-120, 300, 360, 700], fill=(31, 79, 79, 255))
    d.ellipse([820, -160, 1180, 200], fill=(212, 165, 116, 120))
    m = rounded(mark.resize((96, 96), Image.LANCZOS), 22)
    bg.alpha_composite(m, (64, 70))
    d.text((64, 190), "Klinara Kids", font=font(SERIF_B, 64), fill=CREAM)
    d.text((66, 268), "Raising Little Stars", font=font(SANS_B, 30), fill=GOLD)
    for i, t in enumerate(["Daily photos & activities", "Attendance & schedule", "Easy UPI fee payments"]):
        yy = 330 + i * 40
        d.ellipse([68, yy + 9, 80, yy + 21], fill=BLUSH)
        d.text((92, yy), t, font=font(SANS, 24), fill=CREAM)
    ph = phone(Image.open(RAW / "01_parent_home.png"), 230)
    bg.alpha_composite(ph, (w - ph.width - 40, 36))
    return bg.convert("RGB")


def main():
    mark = logo()
    for folder, size in SIZES.items():
        out = ROOT / "screenshots" / folder
        out.mkdir(parents=True, exist_ok=True)
        for name in HEADLINES:
            screenshot(name, size, mark).save(out / f"{name}.png", optimize=True)
            print("framed", folder, name)
    fg = ROOT / "feature_graphic"
    fg.mkdir(exist_ok=True)
    feature_graphic(mark).save(fg / "google_play_feature_graphic_1024x500.png", optimize=True)
    print("feature graphic done")


if __name__ == "__main__":
    main()
