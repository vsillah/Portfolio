#!/usr/bin/env python3
"""Raster L07-01 brief states for local source-composition review."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

HERE = Path(__file__).resolve().parent
FONT_BOLD = "/System/Library/Fonts/Avenir Next.ttc"
W, H = 1920, 1080


def font(size):
    return ImageFont.truetype(FONT_BOLD, size=size, index=0)


def paper(draw, box, radius=24):
    x0, y0, x1, y1 = box
    draw.rounded_rectangle((x0 + 11, y0 + 17, x1 + 11, y1 + 17), radius, fill=(0, 0, 0, 90))
    draw.rounded_rectangle(box, radius, fill=(242, 224, 190, 255), outline=(202, 157, 86, 255), width=5)
    draw.rounded_rectangle((x0 + 13, y0 + 13, x1 - 13, y1 - 13), radius - 6, outline=(255, 244, 219, 145), width=3)
    # Subtle grain stays within the complete paper object.
    for y in range(y0 + 25, y1 - 18, 17):
        for x in range(x0 + 20, x1 - 18, 19):
            v = (x * 7 + y * 11) % 13
            if v < 3:
                draw.point((x, y), fill=(155, 116, 73, 70))


def state_image(state, expanded=False):
    image = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(image, "RGBA")
    if expanded:
        box = (205, 68, 1715, 865)
        left = 285
        right = 1635
        heading_size, row_size = 76, 72
        rows = [300, 415, 530]
    else:
        box = (42, 55, 982, 818)
        left = 96
        right = 932
        heading_size, row_size = 62, 60
        rows = [305, 420, 535]
    paper(d, box)
    x0, y0, x1, y1 = box
    # Full clipboard clip, built as raster shapes rather than a crop.
    cx = (x0 + x1) // 2
    d.rounded_rectangle((cx - 115, y0 - 10, cx + 115, y0 + 42), 13, fill=(119, 74, 34, 255), outline=(224, 172, 71, 255), width=5)
    d.rounded_rectangle((cx - 68, y0 - 25, cx + 68, y0 + 25), 13, fill=(213, 155, 56, 255), outline=(255, 217, 131, 255), width=4)
    d.ellipse((cx - 17, y0 - 20, cx + 17, y0 + 14), fill=(53, 44, 34, 255))
    heading = "SESSION OPTION BRIEF"
    hfont = font(heading_size)
    bounds = d.textbbox((0, 0), heading, font=hfont)
    d.text((cx - (bounds[2] - bounds[0]) / 2, y0 + 84), heading, font=hfont, fill=(19, 58, 64, 255), stroke_width=0)
    d.line((left, y0 + 206, right, y0 + 206), fill=(167, 125, 71, 190), width=4)
    names = ["Room note", "Attendance note", "Facilitator note"]
    for i, name in enumerate(names):
        row_y = rows[i]
        d.rounded_rectangle((left, row_y - 16, right, row_y + 94), 15, fill=(255, 246, 226, 255), outline=(180, 137, 87, 220), width=2)
        d.rounded_rectangle((left + 20, row_y + 12, left + 77, row_y + 69), 8, fill=(15, 65, 69, 255))
        if state >= 1:
            number = str(i + 1)
            number_width = d.textbbox((0, 0), number, font=font(38))[2]
            d.text((left + 48 - number_width / 2, row_y + 12), number, font=font(38), fill=(246, 225, 172, 255))
            d.text((left + 98, row_y - 7), name, font=font(row_size), fill=(16, 58, 64, 255))
    if state >= 2:
        claim = "Confirmed"
        claim_y = rows[2] + 114
        status_color = (142, 54, 43, 255)
        if state == 2:
            d.text((left + 100, claim_y), claim, font=font(row_size), fill=(16, 58, 64, 255))
        elif state == 3:
            d.text((left + 100, claim_y), claim, font=font(row_size), fill=status_color)
            width = d.textbbox((0, 0), claim, font=font(row_size))[2]
            d.line((left + 95, claim_y + 39, left + 105 + width, claim_y + 39), fill=status_color, width=9)
            d.text((left + 120 + width, claim_y + 2), "WRONG", font=font(45), fill=status_color)
        else:
            d.text((left + 100, claim_y), "Available for review", font=font(row_size), fill=(18, 92, 76, 255))
    if expanded and state >= 5:
        footer = "Polished draft. Wrong staffing claim." if state == 5 else "What did the requirement omit?"
        d.text((left + 90, 735), footer, font=font(70), fill=(105, 51, 34, 255))
    return image


def background():
    image = Image.new("RGB", (W, H))
    pixels = image.load()
    for y in range(H):
        for x in range(W):
            band = ((x + y // 3) // 60) % 2
            grain = ((x * 13 + y * 29) % 19) // 8
            pixels[x, y] = (9 + band + grain, 35 + band + grain, 49 + band + grain)
    d = ImageDraw.Draw(image)
    d.rectangle((0, 0, W - 1, H - 1), outline=(160, 112, 49), width=3)
    d.line((0, 1014, W, 1014), fill=(137, 94, 45), width=3)
    return image


def main():
    bg = background()
    bg.save(HERE / "studio-field.png", optimize=True)
    for state in range(5):
        state_image(state).save(HERE / f"brief-presenter-{state}.png", optimize=True)
    for state in range(4, 7):
        state_image(state, expanded=True).save(HERE / f"brief-expanded-{state}.png", optimize=True)


if __name__ == "__main__":
    main()
