#!/usr/bin/env python3
"""Smooths the stair-stepped alpha edge of the hero mascot PNG.

The cut-out has a hard, blocky transparency mask. This script rebuilds the contour of the
solid shapes at 3x resolution, anti-aliases it, and bleeds the nearest solid colour into the
edge pixels so no dark or light fringe appears. Soft glows and shadows keep their original alpha.

Usage: python3 -I scripts/assets/smooth-mascot-edges.py SOURCE.png OUTPUT.png
Requires Pillow, numpy, and scipy.
"""
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

SCALE = 3          # supersampling factor for the contour
SIGMA = 2.4        # contour smoothing, in source pixels (steps in the cut-out are about 3 px)
EDGE_LOW, EDGE_HIGH = 0.38, 0.62  # smoothstep band that makes the edge soft but crisp
SOLID = 0.5        # alpha above this counts as part of a solid shape


def smoothstep(x, lo, hi):
    t = np.clip((x - lo) / (hi - lo), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def main(src: str, dst: str) -> None:
    img = Image.open(src).convert("RGBA")
    arr = np.asarray(img).astype(np.float32) / 255.0
    rgb, alpha = arr[..., :3], arr[..., 3]
    h, w = alpha.shape

    solid = (alpha >= SOLID).astype(np.float32)
    up = np.asarray(
        Image.fromarray((solid * 255).astype(np.uint8)).resize((w * SCALE, h * SCALE), Image.BICUBIC)
    ).astype(np.float32) / 255.0
    up = ndi.gaussian_filter(up, SIGMA * SCALE)
    contour = smoothstep(up, EDGE_LOW, EDGE_HIGH)
    contour = np.asarray(
        Image.fromarray((contour * 255).astype(np.uint8)).resize((w, h), Image.LANCZOS)
    ).astype(np.float32) / 255.0

    # Keep soft glows and shadows (low alpha), replace the solid contour with the smooth one.
    soft = np.where(alpha < SOLID, alpha, 0.0)
    new_alpha = np.maximum(contour, soft)

    # Bleed solid colour outwards so freshly opaque edge pixels do not pick up stray colours.
    weight = ndi.gaussian_filter(solid, 2.0)
    bled = np.stack(
        [ndi.gaussian_filter(rgb[..., c] * solid, 2.0) / np.maximum(weight, 1e-4) for c in range(3)],
        axis=-1,
    )
    near_edge = (ndi.binary_dilation(solid > 0, iterations=4)) & (solid == 0)
    out_rgb = np.where(near_edge[..., None] & (contour[..., None] > 0), bled, rgb)

    out = np.dstack([out_rgb, new_alpha])
    Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA").save(dst, optimize=True)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
