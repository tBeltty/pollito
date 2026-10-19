#!/usr/bin/env python3
"""Removes the green-screen background from the Pollito mascot and writes a clean RGBA PNG.

Steps: find the background that is connected to the image border, derive a soft alpha from how
green each edge pixel is, un-mix the green that bled into anti-aliased edges, remove remaining
green spill, fill the green seen through the left glasses lens with the surrounding colour, and
crop to the artwork.

Usage: python3 -I scripts/assets/key-chroma-mascot.py SOURCE.png OUTPUT.png [--margin 24]
Requires Pillow, numpy, and scipy.
"""
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def smoothstep(x, lo, hi):
    t = np.clip((x - lo) / (hi - lo), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def main(src: str, dst: str, margin: int) -> None:
    rgb = np.asarray(Image.open(src).convert("RGB")).astype(np.float32) / 255.0
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h, w = g.shape

    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.median(border, axis=0)                      # key colour, about (0.06, 0.94, 0.05)
    bg_excess = bg[1] - max(bg[0], bg[2])

    excess = g - np.maximum(r, b)                       # how green a pixel is
    strong = excess > 0.4 * bg_excess
    labels, count = ndi.label(strong)
    edge_labels = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))) - {0}
    background = np.isin(labels, list(edge_labels))
    interior_green = strong & ~background               # green seen through the glasses lens

    # Only pixels next to the real background may become transparent.
    zone = ndi.binary_dilation(background, iterations=4)
    alpha = np.where(zone, 1.0 - smoothstep(excess / bg_excess, 0.12, 0.85), 1.0)
    alpha = np.where(background, 0.0, alpha)

    # Un-mix: pixel = a * foreground + (1 - a) * bg  ->  foreground.
    safe = np.maximum(alpha, 1e-3)[..., None]
    fg = np.clip((rgb - (1 - alpha[..., None]) * bg) / safe, 0, 1)
    fg = np.where((alpha < 1)[..., None], fg, rgb)

    # Remove what green is left on the anti-aliased rim. Only colour changes here, never alpha,
    # so the soft edge stays smooth. Warm colours (cream, yellow) never have green above the
    # average of red and blue, so any extra is the screen bleeding in.
    rim = (alpha < 1) & (alpha > 0)
    limit = np.maximum(fg[..., 0], fg[..., 2])
    fg[..., 1] = np.where(rim, np.minimum(fg[..., 1], limit), fg[..., 1])
    cap = 0.5 * (fg[..., 0] + fg[..., 2]) + 0.04
    fg[..., 1] = np.where(rim & (alpha < 0.995), np.minimum(fg[..., 1], cap), fg[..., 1])

    # The left glasses lens shows the green screen: repaint it with the chick's yellow, which is
    # what the right lens shows. The black rim is left untouched so its edge stays smooth.
    lens_zone = ndi.binary_dilation(interior_green, iterations=7)
    tinted = lens_zone & (excess > 0.02)
    # Never touch pixels next to the real background: that is the rim's outer edge.
    hole = (ndi.binary_dilation(interior_green, iterations=2) | tinted) & ~zone
    yellow = (~hole) & (fg[..., 0] > 0.9) & (fg[..., 1] > 0.68) & (fg[..., 2] < 0.55) & (alpha > 0.99)
    known = yellow.astype(np.float32)
    weight = ndi.gaussian_filter(known, 9.0)
    # Neutralise leftover green spill on the rim first (colour only), then blend the yellow
    # fill in with a half-pixel feather so the inner edge of the rim stays anti-aliased.
    limit = np.maximum(fg[..., 0], fg[..., 2])
    spill_zone = lens_zone & ~zone
    fg[..., 1] = np.where(spill_zone, np.minimum(fg[..., 1], limit), fg[..., 1])
    feather = np.clip(ndi.gaussian_filter(hole.astype(np.float32), 0.9) * 1.6, 0, 1)
    feather = np.where(spill_zone | hole, feather, 0.0)
    for c in range(3):
        filled = ndi.gaussian_filter(fg[..., c] * known, 9.0) / np.maximum(weight, 1e-4)
        fg[..., c] = fg[..., c] * (1 - feather) + filled * feather
    alpha = np.where(hole, 1.0, alpha)

    out = np.dstack([fg, alpha])
    ys, xs = np.where(alpha > 0.02)
    y0, y1 = max(ys.min() - margin, 0), min(ys.max() + margin + 1, h)
    x0, x1 = max(xs.min() - margin, 0), min(xs.max() + margin + 1, w)
    out = out[y0:y1, x0:x1]
    Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA").save(dst, optimize=True)
    print(f"wrote {dst} ({x1 - x0}x{y1 - y0})")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    margin = int(sys.argv[sys.argv.index("--margin") + 1]) if "--margin" in sys.argv else 24
    args = [a for a in args if a != str(margin)]
    if len(args) != 2:
        sys.exit(__doc__)
    main(args[0], args[1], margin)
