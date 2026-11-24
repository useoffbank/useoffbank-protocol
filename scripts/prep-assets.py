# One-off asset prep. Reads brand/, writes src/assets/ (resized logos, favicon traced from pixel grid, og card).
import numpy as np
from PIL import Image
from scipy import ndimage

def premul_resize(im, size):
    a = np.asarray(im.convert('RGBA')).astype(np.float64) / 255.0
    a[..., :3] *= a[..., 3:4]                       # premultiply: transparent black must not bleed
    pm = Image.fromarray((a * 255 + .5).astype(np.uint8), 'RGBA')
    pm = pm.resize((size, size), Image.LANCZOS)
    b = np.asarray(pm).astype(np.float64) / 255.0
    al = b[..., 3:4]
    rgb = np.where(al > 0, b[..., :3] / np.maximum(al, 1e-6), 0)
    out = np.concatenate([np.clip(rgb, 0, 1), al], axis=2)
    return Image.fromarray((out * 255 + .5).astype(np.uint8), 'RGBA')

tr = Image.open('brand/LOGO OFFBANK PNG...png')      # RGBA, pure-black transparent regions
op = Image.open('brand/LOGO OFFBANK PNG.png')        # RGBA fully opaque
for s in (512, 128):
    premul_resize(tr, s).save(f'src/assets/mark-{s}.png', optimize=True)
op.convert('RGB').resize((512, 512), Image.LANCZOS).save('src/assets/logo-512.png', optimize=True)
op.convert('RGB').resize((180, 180), Image.LANCZOS).save('src/assets/apple-touch-icon.png', optimize=True)
Image.open('reference/SAMPUL OFFBANK JPG.jpg.jpeg').convert('RGB').resize((1200, 400), Image.LANCZOS).save('src/assets/og.jpg', quality=88)

# favicon: trace the 7 bars from the real pixel grid of the opaque logo
a = np.asarray(op.convert('RGB'))
mask = a.min(axis=2) > 235
lab, n = ndimage.label(mask)
boxes = []
for i, sl in enumerate(ndimage.find_objects(lab)):
    if (lab[sl] == i + 1).sum() < 2000: continue
    boxes.append((sl[1].start, sl[0].start, sl[1].stop, sl[0].stop))
boxes.sort(key=lambda b: (b[1] > 800, b[1], b[0]))
x0 = min(b[0] for b in boxes); y0 = min(b[1] for b in boxes)
x1 = max(b[2] for b in boxes); y1 = max(b[3] for b in boxes)
k = 22.0 / (y1 - y0); ox = (32 - (x1 - x0) * k) / 2; oy = 5
r = []
for (l, t, rr, bb) in boxes:
    w, h = (rr - l) * k, (bb - t) * k
    rx = w / 2 if w < h else h * .45
    r.append(f'<rect x="{ox+(l-x0)*k:.2f}" y="{oy+(t-y0)*k:.2f}" width="{w:.2f}" height="{h:.2f}" rx="{rx:.2f}"/>')
svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">'
       '<rect width="32" height="32" rx="7" fill="#ff511f"/><g fill="#fefefe">' + ''.join(r) + '</g></svg>')
open('src/assets/favicon.svg', 'w').write(svg)
print(len(boxes), 'bars traced'); print(svg)
