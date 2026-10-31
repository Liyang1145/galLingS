import sys, os, shutil, struct, json, ctypes, cv2, numpy as np
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')
SCRATCH_DIR = r'.'
sys.path.append(SCRATCH_DIR)
from moc3_renderer import *
from texture_warper import warp_canvas_to_texture_island

MODEL_DIR = os.path.dirname(MOC_PATH)
BACKUP_DIR = os.path.join(SCRATCH_DIR, 'backup_orig')
os.makedirs(BACKUP_DIR, exist_ok=True)

# 0. Backup original files if not already backed up
for fname, src_p in [
    ('大肥鱼.moc3', MOC_PATH),
    ('texture_00.png', os.path.join(TEX_DIR, 'texture_00.png')),
    ('texture_01.png', os.path.join(TEX_DIR, 'texture_01.png')),
    ('texture_03.png', os.path.join(TEX_DIR, 'texture_03.png')),
    ('texture_04.png', os.path.join(TEX_DIR, 'texture_04.png')),
    ('大肥鱼.png', os.path.join(MODEL_DIR, '大肥鱼.png')),
]:
    bak_p = os.path.join(BACKUP_DIR, fname)
    if not os.path.exists(bak_p) and os.path.exists(src_p):
        shutil.copy2(src_p, bak_p)
        print(f'Backed up {fname} -> {bak_p}')

# Always read from clean backup so script is idempotent!
with open(os.path.join(BACKUP_DIR, '大肥鱼.moc3'), 'rb') as f:
    moc_bytes = bytearray(f.read())

# ==============================================================================
# 1. PATCH .MOC3 BINARY (OUTFIT + HEAD ACCESSORIES + NOSE SLASH)
# ==============================================================================
offsets = struct.unpack_from('<160I', moc_bytes, 64)

# Sec 53: Parameter defaults -> set Clothes1 (idx 19) = 1.0
struct.pack_into('<f', moc_bytes, offsets[53] + 19 * 4, 1.0)

# Sec 48: ArtMesh MaskCounts -> set MaskCount = 0 and cflag = 4 (Normal, non-inverted)
for am_idx in [601, 396, 251, 286, 638, 392]:
    struct.pack_into('<i', moc_bytes, offsets[48] + am_idx * 4, 0)
    moc_bytes[offsets[42] + am_idx] = 4

# Also set MaskCount = 0 on tail overlay meshes (687..713) since we pre-clip them at 4096x4096 in texture_03.png
for am_idx in range(687, 714):
    struct.pack_into('<i', moc_bytes, offsets[48] + am_idx * 4, 0)

# Sec 42: ArtMesh ConstantFlags -> set cflag = 4 (Normal blend) for AM 290
moc_bytes[offsets[42] + 290] = 4

# Sec 68: ArtMesh Keyform Opacities -> hide unused maid ArtMeshes, headband, hairpin, harsh nose line, and noisy eye overlays
kf_op_begins = np.frombuffer(moc_bytes, dtype=np.int32, count=715, offset=offsets[35])
kf_op_counts = np.frombuffer(moc_bytes, dtype=np.int32, count=715, offset=offsets[36])
vcnts = np.frombuffer(moc_bytes, dtype=np.int32, count=715, offset=offsets[43])

st0 = evaluate_moc(bytes(moc_bytes))
hide_parts = {
    15, 24, 25, 29, 33, 37, 39,
    65, 66, 68, 73, 74, 75, 76,
    80, 81, 82, 83, 84, 85, 86, 87, 88, 130
}
hide_ams = set()
for i in range(715):
    if int(st0['am_part'][i]) in hide_parts:
        hide_ams.add(i)

hide_ams.update([
    # Harsh vertical nose line
    516,
    # Eye overlays: only hide the black-outlined heart (AM 10, 79) so all vibrant iris sparkles/glows and eyelashes stay active!
    10, 79,
    # Part 34 collar shadows & shoulder frills
    385, 386, 387, 397, 638, 392,
    # Part 23 collar frills & bow shadows
    241, 242, 243, 244, 245, 246, 247, 248, 378, 381, 249,
    # Part 26 & 67 extra bra/frill meshes (keep 268, 269, 251)
    250, 252, 382, 264, 265, 266, 267, 384, 613,
    # Part 30 & 79 waist buttons/frills (keep 290, 286)
    288, 289, 390, 534, 535, 287, 389, 391, 677,
    # Part 77 & 78 sleeve ribbons (keep 601, 396)
    602, 603, 604, 393, 394, 395,
    # Part 91 & 92 maid forearm cuffs (keep 596, 594, 360, 362)
    592, 593, 595, 597, 598, 599, 600, 356, 357, 358, 359, 361, 363, 364, 679, 680,
    # Part 32 & 36 maid apron/bows/frills (keep 314, 318, 319, 345, 346, 347, 351, 352)
    310, 311, 312, 313, 315, 316, 317, 320, 321, 322, 323, 348, 349, 350, 353, 354,
    # Part 89 & 90 thigh garter bows & vertical straps (keep 538..544, 559, 560..565)
    545, 546, 547, 548, 549, 550, 551, 552, 553, 554, 555, 556, 557, 558,
    566, 567, 568, 569, 570, 571, 572, 573, 574, 575, 576, 577, 578, 579,
    # Part 95 muddy dark-grey smudge/shadow on whale tail (AM 693..697)
    693, 694, 695, 696, 697
])

keep_ams = [
    344, 290, 286, 268, 269, 251,
    601, 396, 596, 594, 360, 362,
    314, 318, 319, 345, 346, 347, 351, 352
]
hide_ams.difference_update(keep_ams)

def get_sec71_pts(am_idx, kf=0, buf=moc_bytes):
    b = int(kf_op_begins[am_idx]) + kf
    vc = int(vcnts[am_idx])
    pos_idx = int(np.frombuffer(buf, dtype=np.int32, count=1, offset=offsets[70] + b * 4)[0])
    pts = np.frombuffer(buf, dtype=np.float32, count=vc * 2, offset=offsets[71] + pos_idx * 4).reshape(vc, 2).copy()
    return pts, pos_idx, vc

def set_sec71_pts(pos_idx, vc, pts, buf=moc_bytes):
    buf[offsets[71] + pos_idx * 4 : offsets[71] + (pos_idx + vc * 2) * 4] = pts.astype(np.float32).tobytes()

# Reshape upper eyelash, crease, eyelashes, sclera, and lower eyelid in lockstep using linear 0.02 probe
upper_arch_ams = [
    33, 34, 47, 48, 112, 113, 98, 99,
    25, 26, 27, 119, 120, 121,
    30, 31, 32, 114, 115, 116,
    28, 29, 39, 40, 41, 42, 43,
    103, 104, 105, 106, 107, 117, 118
]
lower_lid_ams = [44, 45, 46, 100, 101, 102, 35, 36, 37, 38, 108, 109, 110, 111]
sclera_ams = [22, 23, 24, 95, 96, 97]
arch_ams = upper_arch_ams + lower_lid_ams + sclera_ams

moc_dy = bytearray(moc_bytes)
for am_idx in arch_ams:
    pts, pos_idx, vc = get_sec71_pts(am_idx, 0, moc_dy)
    pts[:, 1] += 0.02
    set_sec71_pts(pos_idx, vc, pts, moc_dy)

st_dy = evaluate_moc(bytes(moc_dy))
for am_idx in arch_ams:
    pts, pos_idx, vc = get_sec71_pts(am_idx)
    c0 = st0['positions'][am_idx] * 0.4
    c_dy = st_dy['positions'][am_idx] * 0.4
    dy_per_002 = c_dy[:, 1] - c0[:, 1]
    x04, y04 = c0[:, 0], c0[:, 1]
    is_right_viewer = (x04.mean() > 750.0)
    eye_cx = 825.0 if is_right_viewer else 674.5
    dx_temple = np.clip((x04 - eye_cx) / 52.0, -1.0, 1.0) if is_right_viewer else np.clip((eye_cx - x04) / 52.0, -1.0, 1.0)
    s2 = np.sin(0.5 * np.pi * dx_temple) ** 2
    corner_lift = np.where(dx_temple >= 0.0, -7.5 * s2, -5.5 * s2)
    if am_idx in lower_lid_ams:
        tgt_dy04 = 1.0 * (1.0 - 0.75 * s2)
    elif am_idx in sclera_ams:
        arch_y = 605.0 + 32.0 * s2
        w_upper = np.clip(1.0 - (y04 - arch_y) / 34.0, 0.0, 1.0)
        upper_dy = 1.6 + corner_lift
        lower_dy = 1.0 * (1.0 - 0.85 * s2)
        tgt_dy04 = upper_dy * w_upper + lower_dy * (1.0 - w_upper)
    else:
        tgt_dy04 = 1.6 + corner_lift
    d_pts_y = 0.02 * (tgt_dy04 / np.maximum(np.abs(dy_per_002), 0.03)) * np.sign(dy_per_002)
    pts[:, 1] = pts[:, 1] + d_pts_y
    set_sec71_pts(pos_idx, vc, pts)

# Anchor-extend upper eyelash spikes (AM 25, 26, 27 left; AM 119, 120, 121 right)
for am_idx in [25, 26, 27, 119, 120, 121]:
    pts, pos_idx, vc = get_sec71_pts(am_idx)
    c0 = st0['positions'][am_idx] * 0.4
    is_right_viewer = (c0[:, 0].mean() > 750.0)
    y_min, y_max = c0[:, 1].min(), c0[:, 1].max()
    w_tip = np.clip((y_max - c0[:, 1]) / max(y_max - y_min, 1.0), 0.0, 1.0)
    X = np.column_stack([c0, np.ones(vc)])
    M, _, _, _ = np.linalg.lstsq(X, pts, rcond=None)
    dx_tip = (2.4 if is_right_viewer else -2.4) * (w_tip ** 1.15)
    dy_tip = -2.6 * (w_tip ** 1.15)
    pts_new = pts + np.column_stack([dx_tip, dy_tip]) @ M[:2, :]
    set_sec71_pts(pos_idx, vc, pts_new)

# Anchor-extend outer wing eyelashes (AM 28, 29 left; AM 117, 118 right)
for am_idx in [28, 29, 117, 118]:
    pts, pos_idx, vc = get_sec71_pts(am_idx)
    c0 = st0['positions'][am_idx] * 0.4
    is_right_viewer = (c0[:, 0].mean() > 750.0)
    x_min, x_max = c0[:, 0].min(), c0[:, 0].max()
    w_tip = np.clip((c0[:, 0] - x_min) / max(x_max - x_min, 1.0), 0.0, 1.0) if is_right_viewer else np.clip((x_max - c0[:, 0]) / max(x_max - x_min, 1.0), 0.0, 1.0)
    X = np.column_stack([c0, np.ones(vc)])
    M, _, _, _ = np.linalg.lstsq(X, pts, rcond=None)
    dx_tip = (3.4 if is_right_viewer else -3.4) * (w_tip ** 1.15)
    dy_tip = -1.5 * (w_tip ** 1.15)
    pts_new = pts + np.column_stack([dx_tip, dy_tip]) @ M[:2, :]
    set_sec71_pts(pos_idx, vc, pts_new)

# Anchor-extend lower eyelashes (AM 35, 36, 37, 38 left; AM 108, 109, 110, 111 right)
for am_idx in [35, 36, 37, 38, 108, 109, 110, 111]:
    pts, pos_idx, vc = get_sec71_pts(am_idx)
    c0 = st0['positions'][am_idx] * 0.4
    is_right_viewer = (c0[:, 0].mean() > 750.0)
    y_min, y_max = c0[:, 1].min(), c0[:, 1].max()
    w_tip = np.clip((c0[:, 1] - y_min) / max(y_max - y_min, 1.0), 0.0, 1.0)
    X = np.column_stack([c0, np.ones(vc)])
    M, _, _, _ = np.linalg.lstsq(X, pts, rcond=None)
    dx_tip = (1.2 if is_right_viewer else -1.2) * (w_tip ** 1.15)
    dy_tip = 2.0 * (w_tip ** 1.15)
    pts_new = pts + np.column_stack([dx_tip, dy_tip]) @ M[:2, :]
    set_sec71_pts(pos_idx, vc, pts_new)

# Blend parent Mouth Warp Deformer (sec60[3141..3143] -> sec60[3144..3146]) so all mouth layers
# (AM 51, 64 lip lines, AM 52..55 lip masks, AM 62 skin cover, AM 65 cavity mask, AM 1..5 teeth/tongue)
# deform in 100% lockstep with zero clipping across all mouth openings!
sec60 = np.frombuffer(moc_bytes, dtype=np.int32, count=(offsets[61] - offsets[60]) // 4, offset=offsets[60])
for offset_k, w_smile in [(0, 0.55), (1, 0.35), (2, 0.25)]:
    lo_0, hi_0 = int(sec60[3141 + offset_k]), int(sec60[3141 + offset_k + 1])
    lo_1, hi_1 = int(sec60[3144 + offset_k]), int(sec60[3144 + offset_k + 1])
    pts_0 = np.frombuffer(moc_bytes, dtype=np.float32, count=hi_0 - lo_0, offset=offsets[71] + lo_0 * 4).copy()
    pts_1 = np.frombuffer(moc_bytes, dtype=np.float32, count=hi_1 - lo_1, offset=offsets[71] + lo_1 * 4).copy()
    pts_blend = (1.0 - w_smile) * pts_0 + w_smile * pts_1
    moc_bytes[offsets[71] + lo_0 * 4 : offsets[71] + hi_0 * 4] = pts_blend.astype(np.float32).tobytes()

# Lift AM 344 upper-shoulder collar vertices in Sec 71 & Sec 78 by up to 52px (in 0.4x)
# so AM 344 covers 100% of the upper sailor collar (y_04 down to 774) as a single unbroken full-width mesh!
b_344 = int(kf_op_begins[344])
vc_344 = int(np.frombuffer(moc_bytes, dtype=np.int32, count=715, offset=offsets[43])[344])
uv_b_344 = int(np.frombuffer(moc_bytes, dtype=np.int32, count=715, offset=offsets[44])[344])
pos_idx_344 = int(np.frombuffer(moc_bytes, dtype=np.int32, count=1, offset=offsets[70] + b_344 * 4)[0])
pts_344 = np.frombuffer(moc_bytes, dtype=np.float32, count=vc_344 * 2, offset=offsets[71] + pos_idx_344 * 4).reshape(vc_344, 2).copy()
uvs_344 = np.frombuffer(moc_bytes, dtype=np.float32, count=vc_344 * 2, offset=offsets[78] + uv_b_344 * 4).reshape(vc_344, 2).copy()
pos0_344 = st0['positions'][344] * 0.4
x0_04, y0_04 = pos0_344[:, 0], pos0_344[:, 1]
k_py_344, _ = np.polyfit(y0_04, pts_344[:, 1], 1)
k_uy_344, _ = np.polyfit(y0_04, uvs_344[:, 1], 1)
w_x_344 = np.clip((np.abs(x0_04 - 749.8) - 30.0) / 52.0, 0.0, 1.0)
w_y_344 = np.clip((860.0 - y0_04) / 38.0, 0.0, 1.0)
dy_04_344 = 52.0 * w_x_344 * w_y_344
pts_344[:, 1] -= dy_04_344 * k_py_344
uvs_344[:, 1] -= dy_04_344 * k_uy_344
moc_bytes[offsets[71] + pos_idx_344 * 4 : offsets[71] + (pos_idx_344 + vc_344 * 2) * 4] = pts_344.astype(np.float32).tobytes()
moc_bytes[offsets[78] + uv_b_344 * 4 : offsets[78] + (uv_b_344 + vc_344 * 2) * 4] = uvs_344.astype(np.float32).tobytes()

sec68_base = offsets[68]
for am_idx in hide_ams:
    b = int(kf_op_begins[am_idx])
    c = int(kf_op_counts[am_idx])
    for k in range(c):
        struct.pack_into('<f', moc_bytes, sec68_base + (b + k) * 4, 0.0)

for am_idx in keep_ams:
    b = int(kf_op_begins[am_idx])
    c = int(kf_op_counts[am_idx])
    for k in range(c):
        struct.pack_into('<f', moc_bytes, sec68_base + (b + k) * 4, 1.0)

# Verify moc3 consistency via official Live2DCubismCore
core = CubismCore()
aligned_moc = ctypes.create_string_buffer(len(moc_bytes) + 64)
addr = ctypes.addressof(aligned_moc)
offset_align = (64 - (addr % 64)) % 64
moc_ptr = ctypes.c_void_p(addr + offset_align)
ctypes.memmove(moc_ptr, bytes(moc_bytes), len(moc_bytes))
is_consistent = core.HasMocConsistency(moc_ptr, len(moc_bytes))
print(f'csmHasMocConsistency = {is_consistent}')
assert is_consistent == 1, 'MOC3 consistency check failed!'

st = evaluate_moc(bytes(moc_bytes))

# ==============================================================================
# 2. APPLY FACE & HEAD UPGRADES TO TEXTURE_00 & TEXTURE_01
# ==============================================================================
tex0 = np.array(Image.open(os.path.join(BACKUP_DIR, 'texture_00.png')).convert('RGBA'))
tex1 = np.array(Image.open(os.path.join(BACKUP_DIR, 'texture_01.png')).convert('RGBA'))

# --- 2.1 MOUTH: Soft warm rosy-brown lip line locked to exact UV spine of AM 51 & AM 64 ---
tex0[3734:3752, 3798:3905] = 0
yy_m, xx_m = np.mgrid[3734:3752, 3798:3905]
dx_m = (xx_m - 3851.5) / 41.5
target_ty = 3743.5 - 1.1 * np.exp(-(dx_m / 0.45) ** 2)
dist_y = np.abs(yy_m - target_ty)
end_taper = np.clip((1.02 - np.abs(dx_m)) * 3.0, 0.0, 1.0)
half_thick = 1.45 * (0.70 + 0.30 * (1.0 - dx_m ** 2))
line_alpha = np.clip((half_thick + 0.65 - dist_y) / 1.2, 0.0, 1.0) * end_taper
mouth_patch = np.zeros((18, 107, 4), dtype=np.uint8)
mouth_patch[..., 0] = np.clip(152.0 + (yy_m - target_ty) * 6.0, 128, 178).astype(np.uint8)
mouth_patch[..., 1] = np.clip(82.0 + (yy_m - target_ty) * 4.0, 62, 105).astype(np.uint8)
mouth_patch[..., 2] = np.clip(78.0 + (yy_m - target_ty) * 4.0, 58, 100).astype(np.uint8)
mouth_patch[..., 3] = np.round(line_alpha * 235.0).astype(np.uint8)
tex0[3734:3752, 3798:3905] = mouth_patch

# Keep AM 62 [4676:4894, 2646:2922] 100% opaque in alpha (it is the lip skin occluder masking the inner mouth cavity!)

# --- 2.2 EYEBROWS & UPPER EYELID ---
eb = tex0[4630:4692, 2030:2256].astype(np.float32)
eb_a = eb[..., 3] / 255.0
eb_lum = (0.299 * eb[..., 0] + 0.587 * eb[..., 1] + 0.114 * eb[..., 2]) / 255.0
t_lum = np.clip((eb_lum - 0.18) / 0.35, 0.0, 1.0)
eb[..., 0] = 68.0 + t_lum * 50.0
eb[..., 1] = 42.0 + t_lum * 34.0
eb[..., 2] = 36.0 + t_lum * 29.0
eb[..., 3] = np.clip((eb_a ** 1.25) * 255.0, 0.0, 255.0)
tex0[4630:4692, 2030:2256] = eb.astype(np.uint8)

# Soften inner brow crease AM 81, 50
tex0[1614:1660, 3854:3952, 3] = (tex0[1614:1660, 3854:3952, 3].astype(np.float32) * 0.30).astype(np.uint8)

# Clean dark grey smudge on outer upper eyelid AM 86, 88
el = tex0[6337:6445, 3690:3928].astype(np.float32)
el[..., 0] = 255.0
el[..., 1] = 238.0
el[..., 2] = 231.0
el[..., 3] *= 0.65
tex0[6337:6445, 3690:3928] = el.astype(np.uint8)

# --- 2.3 NOSE ---
tex0[95:140, 2680:2712, 3] = (tex0[95:140, 2680:2712, 3].astype(np.float32) * 0.35).astype(np.uint8)
tex0[2249:2783, 3466:3616, 3] = (tex0[2249:2783, 3466:3616, 3].astype(np.float32) * 0.45).astype(np.uint8)

# --- 2.4 VIBRANT CRYSTAL-BLUE IRIS (PANEL 2 COLOR TONE) & EXPRESSIVE EYELASH EFFECT ---
bak_v1_dir = os.path.join(SCRATCH_DIR, 'backup_v1_sailor')
t0_v1 = np.array(Image.open(os.path.join(bak_v1_dir, 'texture_00.png')).convert('RGBA'))
t1_v1 = np.array(Image.open(os.path.join(bak_v1_dir, 'texture_01.png')).convert('RGBA'))

# Copy Panel 2's vibrant crystal-cyan/sapphire iris & pupil textures directly from backup_v1_sailor
tex0[6449:6584, 3690:3955] = t0_v1[6449:6584, 3690:3955]
tex1[6809:6883, 1072:1143] = t1_v1[6809:6883, 1072:1143]
tex1[6601:6675, 3850:3921] = t1_v1[6601:6675, 3850:3921]
tex0[1661:1729, 3854:3922] = t0_v1[1661:1729, 3854:3922]
tex0[1725:1783, 3910:3961] = t0_v1[1725:1783, 3910:3961]
tex0[1865:1912, 3866:3930] = t0_v1[1865:1912, 3866:3930]

# Deepen inner pupil core AM 18, 70 slightly so it has crisp depth while preserving Panel 2's bright crystal-cyan/sapphire tone
p18 = tex0[1725:1783, 3910:3961].astype(np.float32)
p18[..., 0] *= 0.55
p18[..., 1] *= 0.60
p18[..., 2] = np.clip(p18[..., 2] * 0.85, 0, 255)
tex0[1725:1783, 3910:3961] = p18.astype(np.uint8)

# Sharpen & darken upper, outer-wing, and lower eyelash spikes so the eyelash effect is crisp and well-defined
for (x0, y0, x1, y1) in [
    (2682, 145, 2714, 180),   # AM 25, 121 upper-inner lash spike
    (2682, 313, 2708, 327),   # AM 26, 120 inner lash flick
    (3866, 2001, 3926, 2031), # AM 27, 119 upper-outer lash spike
    (3866, 1921, 3949, 1949), # AM 28, 118 outer wing upper lash
    (3866, 1809, 3939, 1858), # AM 29, 117 outer wing lower lash
    (2682, 217, 2709, 238),   # AM 35, 111 outer-lower lash cluster
    (2682, 425, 2692, 433),   # AM 36, 110 lower lash 1
    (2682, 393, 2690, 405),   # AM 37, 109 lower lash 2
    (2698, 385, 2710, 395),   # AM 38, 108 lower lash 3
]:
    lp = tex0[y0:y1, x0:x1].astype(np.float32)
    lp[..., :3] *= 0.65
    lp[..., 3] = np.clip(lp[..., 3] * 1.32, 0, 255)
    tex0[y0:y1, x0:x1] = lp.astype(np.uint8)

# --- 2.5 EAR BOWS & FIN EARS: Smooth Royal-Blue to Sky-Cyan Gradient ---
for (x0, y0, x1, y1) in [(3858, 569, 3934, 729), (3858, 1313, 3932, 1450), (3858, 1729, 3904, 1803)]:
    p = tex0[y0:y1, x0:x1].astype(np.float32)
    p[..., 0] = np.clip(p[..., 0] * 1.15 + 32.0, 0, 255)
    p[..., 1] = np.clip(p[..., 1] * 1.32 + 45.0, 0, 255)
    p[..., 2] = np.clip(p[..., 2] * 1.18 + 28.0, 0, 255)
    tex0[y0:y1, x0:x1] = p.astype(np.uint8)

# Fin-ear upper surface AM 452, 458 [1602:2097, 7025:7380]:
# Use distance transform from alpha border so the entire interior (including the bottom-right tip)
# smoothly transitions from royal azure at the top-left base to bright sky-cyan near the lower scalloped edge!
ear_p = tex0[7025:7380, 1602:2097].astype(np.float32)
eh, ew = ear_p.shape[:2]
ey, ex = np.mgrid[0:eh, 0:ew].astype(np.float32)
ear_mask = (ear_p[..., 3] > 180).astype(np.uint8)
dist_in = cv2.distanceTransform(ear_mask, cv2.DIST_L2, 5)
# Smooth interior weight (0 at outer 2px outline, 1.0 inside > 5px)
w_in = np.clip((dist_in - 2.0) / 3.5, 0.0, 1.0)
# Progress toward bottom scalloped edge and tip
t_ear = np.clip((ex / float(ew) * 0.45 + ey / float(eh) * 0.65), 0.0, 1.0)
ear_lum = (0.299 * ear_p[..., 0] + 0.587 * ear_p[..., 1] + 0.114 * ear_p[..., 2]) / 255.0
# Target gradient: top-left base [35, 135, 235] -> lower scalloped edge [115, 215, 255]
tgt_er = 28.0 + t_ear * 95.0 + ear_lum * 35.0
tgt_eg = 115.0 + t_ear * 95.0 + ear_lum * 40.0
tgt_eb = 220.0 + t_ear * 30.0 + ear_lum * 20.0
ear_p[..., 0] = np.clip(ear_p[..., 0] * (1.0 - 0.85 * w_in) + tgt_er * (0.85 * w_in), 0, 255)
ear_p[..., 1] = np.clip(ear_p[..., 1] * (1.0 - 0.85 * w_in) + tgt_eg * (0.85 * w_in), 0, 255)
ear_p[..., 2] = np.clip(ear_p[..., 2] * (1.0 - 0.85 * w_in) + tgt_eb * (0.85 * w_in), 0, 255)
tex0[7025:7380, 1602:2097] = ear_p.astype(np.uint8)

# --- 2.6 LOWER CHEEK / JAWLINE SLIMMING across all 5 1:1 Face Islands ---
face_islands = [
    (90,  2690, 3233, 3435, 4130), # AM 8, 90, 91, 646 (main face & mask)
    (7,   2410, 5001, 3217, 5635), # AM 7 (face blush)
    (56,  2410, 4137, 3159, 4993), # AM 56 (face outline)
    (61,  2210, 5641, 3017, 6275), # AM 61 (lower face shadow)
    (57,  2714, 2329, 3459, 3226), # AM 57 (face base 2)
]
for am_idx, tx0, ty0, tx1, ty1 in face_islands:
    pos = st['positions'][am_idx]
    uv = st['uvs'][am_idx]
    tris = st['tris'][am_idx]
    tw, th = tex0.shape[1], tex0.shape[0]
    ox_c = np.median(pos[:, 0] - uv[:, 0] * tw)
    oy_c = np.median(pos[:, 1] - uv[:, 1] * th)
    patch = tex0[ty0:ty1, tx0:tx1].copy().astype(np.float32)
    ph, pw = patch.shape[:2]
    uv_mask = np.zeros((ph, pw), dtype=np.uint8)
    uv_local = np.column_stack([uv[:, 0] * tw - tx0, uv[:, 1] * th - ty0])
    for tri in tris:
        cv2.fillConvexPoly(uv_mask, np.round(uv_local[tri]).astype(np.int32), 255)
    uv_mask = cv2.dilate(uv_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))) > 0

    py, px = np.mgrid[0:ph, 0:pw].astype(np.float32)
    cx = (px + tx0) + ox_c
    cy = (py + ty0) + oy_c
    t_y = np.clip((cy - 1580.0) / (1915.0 - 1580.0), 0.0, 1.0)
    w_slim = (np.sin(np.pi * t_y) ** 2) * 0.058
    cx_src = 1874.5 + (cx - 1874.5) / (1.0 - w_slim)
    px_src = (cx_src - ox_c) - tx0
    a_norm = patch[..., 3:4] / 255.0
    patch[..., :3] *= a_norm
    warped = cv2.remap(patch, px_src.astype(np.float32), py.astype(np.float32), interpolation=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0,0,0,0))
    nz = warped[..., 3] > 1e-3
    warped[nz, :3] /= (warped[nz, 3:4] / 255.0)
    warped_u8 = np.clip(warped, 0, 255).astype(np.uint8)
    tex0[ty0:ty1, tx0:tx1][uv_mask] = warped_u8[uv_mask]

# ==============================================================================
# 3. SEGMENT & WARP SAILOR OUTFIT + BARE FOREARMS INTO TEXTURE_01
# ==============================================================================
ref_rgba = np.array(Image.open(r'<USERPROFILE>/.gemini/antigravity/brain/33e5f995-4aba-4a93-b802-635da89a96ac/.user_uploaded/media_1793375720480_9eb13c9b.png').convert('RGBA'))
under_rgba = np.array(Image.open(os.path.join(SCRATCH_DIR, 'underlying_body_and_hair.png')).convert('RGBA'))

s, ox, oy = 0.4648, -76.3, -121.3
M_r2m = np.array([[1.0/s, 0, -ox/s], [0, 1.0/s, -oy/s]], dtype=np.float32)
ref_m = cv2.warpAffine(ref_rgba[..., :3], M_r2m, (1499, 3078), flags=cv2.INTER_LANCZOS4, borderValue=(255,255,255))
blur = cv2.GaussianBlur(ref_m, (0, 0), 1.2)
ref_sharp = np.clip(ref_m.astype(np.float32) * 1.35 - blur.astype(np.float32) * 0.35, 0, 255).astype(np.uint8)

R, G, B = ref_m[..., 0].astype(np.int32), ref_m[..., 1].astype(np.int32), ref_m[..., 2].astype(np.int32)
yy, xx = np.mgrid[0:3078, 0:1499]

white_cand = ((R >= 246) & (G >= 246) & (B >= 246)).astype(np.uint8)
_, w_labels = cv2.connectedComponents(white_cand)
is_ext_white_bg = (w_labels == w_labels[0, 0])

is_skin = (R > 195) & (G > 145) & (B > 135) & (R > B + 8) & (~is_ext_white_bg)
is_bright_blue_hair = (B > 110) & (B - R > 28)

ref_collar_clean = ref_sharp.copy()
# Clean the right-side inner white collar zone (where Part 113's thin right hair strand crosses x in [823..862], y in [775..885]):
# The inner white collar zone on the right sits between the V-neck inner edge and the inner navy stripe (x ~ 863..872).
poly_right_white_inner = np.array([
    [827, 776], [844, 782], [860, 795], [863, 835], [852, 875], [835, 910],
    [795, 935], [779, 920], [797, 880], [811, 840], [823, 800]
], dtype=np.int32)
rw_mask = np.zeros((3078, 1499), dtype=np.uint8)
cv2.fillPoly(rw_mask, [poly_right_white_inner], 255)
# Replace any blue hair or dark hair-outline pixels inside rw_mask with clean collar white [245, 247, 252]
is_hair_in_rw = (rw_mask > 0) & ((B > R + 6) | (R < 215))
ref_collar_clean[is_hair_in_rw] = [245, 247, 252]
# Draw subtle 1.2px collar border along the right inner V-neck edge before mirroring
pts_rv = np.array([[827, 776], [822, 815], [812, 855], [796, 895], [776, 932], [750, 960]], dtype=np.int32)
cv2.polylines(ref_collar_clean, [pts_rv], False, (125, 135, 168), 1, lineType=cv2.LINE_AA)

# Mirror the clean right collar & shoulder (x in [750..949], y in [774..905]) onto the left side (x in [550..749])
# so both left and right collars are 100% hair-free and 100% bilaterally symmetric around x = 749.5!
ref_collar_clean[774:905, 550:750] = ref_collar_clean[774:905, 750:950][:, ::-1]
# Also mirror the lower V-neck inner border (y in [905..962], x in [750..800]) onto the left side (x in [700..750])
ref_collar_clean[905:962, 700:750] = ref_collar_clean[905:962, 750:800][:, ::-1]

# --- LAYER 1: Left Bare Forearm ---
poly_arm = np.array([
    [496, 1070], [584, 1108], [575, 1150], [568, 1200], [558, 1250],
    [536, 1300], [504, 1350], [468, 1400], [438, 1445], [350, 1410],
    [388, 1350], [424, 1300], [460, 1250], [490, 1200], [498, 1150],
    [496, 1100]
], dtype=np.int32)
arm_corridor = np.zeros((3078, 1499), dtype=np.uint8)
cv2.fillPoly(arm_corridor, [poly_arm], 255)
raw_arm = (arm_corridor > 0) & (~is_ext_white_bg) & (~(B > R + 10))
num_l, labels, stats, _ = cv2.connectedComponentsWithStats(raw_arm.astype(np.uint8))
best_l = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
arm_mask = (labels == best_l).astype(np.uint8) * 255
arm_mask = cv2.morphologyEx(arm_mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
arm_rgba = np.zeros((3078, 1499, 4), dtype=np.uint8)
arm_rgba[..., :3] = ref_sharp
arm_rgba[..., 3] = cv2.GaussianBlur(arm_mask, (3, 3), 0.7)

# --- LAYER 3: Torso / Sailor Collar / Navy Bodice / Bow / Belt ---
poly_bodice = np.array([
    [672, 776], [655, 782], [635, 795], [602, 804], [568, 812], [562, 900],
    [552, 965], [548, 1010], [555, 1055], [580, 1100], [608, 1150],
    [614, 1190], [607, 1192], [607, 1236], [750, 1240], [892, 1236],
    [892, 1192], [885, 1190], [891, 1150], [919, 1100], [944, 1055],
    [951, 1010], [947, 965], [937, 900], [931, 812], [897, 804],
    [864, 795], [844, 782], [827, 776], [823, 800], [811, 840],
    [797, 880], [779, 920], [750, 962], [720, 920], [702, 880],
    [688, 840], [676, 800]
], dtype=np.int32)
bodice_corridor = np.zeros((3078, 1499), dtype=np.uint8)
cv2.fillPoly(bodice_corridor, [poly_bodice], 255)
R_c, G_c, B_c = ref_collar_clean[..., 0].astype(np.int32), ref_collar_clean[..., 1].astype(np.int32), ref_collar_clean[..., 2].astype(np.int32)
waist_side_noise = (yy >= 1070) & (yy <= 1195) & ((xx < 645) | (xx > 854)) & ((R_c > 110) | (B_c > 125))
collar_side_hair = (yy < 835) & ((xx < 595) | (xx > 904)) & (B_c - R_c > 25) & (R_c > 40)
vneck_skin = (yy < 962) & (xx > 670) & (xx < 830) & is_skin
raw_bodice = (bodice_corridor > 0) & (~is_ext_white_bg) & (~waist_side_noise) & (~collar_side_hair) & (~vneck_skin)
num_l, labels, stats, _ = cv2.connectedComponentsWithStats(raw_bodice.astype(np.uint8))
best_l = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
bodice_mask = (labels == best_l).astype(np.uint8) * 255
bodice_mask = cv2.morphologyEx(bodice_mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
# Enforce exact bilateral symmetry of bodice_mask for y in [774..905] so shared-UV collar/sleeve meshes align with 0px step
bodice_mask[774:905, 550:750] = bodice_mask[774:905, 750:950][:, ::-1]
bodice_rgba = np.zeros((3078, 1499, 4), dtype=np.uint8)
bodice_rgba[..., :3] = ref_collar_clean
bodice_rgba[..., 3] = cv2.GaussianBlur(bodice_mask, (3, 3), 0.7)

# Strictly fill V-neck skin inside the inner V-neck polygon (extending 10px under collar edge so 0 alpha gap exists)
poly_vneck = np.array([
    [668, 765], [831, 765], [830, 820], [818, 880], [798, 940],
    [750, 975], [701, 940], [681, 880], [669, 820]
], dtype=np.int32)
vneck_corridor = np.zeros((3078, 1499), dtype=np.uint8)
cv2.fillPoly(vneck_corridor, [poly_vneck], 255)
am344_rgba = np.zeros_like(bodice_rgba)
# Put clean warm skin inside vneck_corridor first (never overwrite blue hair beside neck at y < 825!)
vneck_fill = (vneck_corridor > 0) & (is_skin | (yy >= 820))
vneck_patch = ref_collar_clean.copy()
vneck_hair = vneck_fill & (yy >= 820) & (B_c > R_c)
vneck_patch[vneck_hair] = [253, 236, 231]
am344_rgba[vneck_fill, :3] = vneck_patch[vneck_fill]
am344_rgba[vneck_fill, 3] = 255
# Alpha-composite bodice_rgba over am344_rgba so the inner V-neck edge has 100% solid alpha=255 and smooth anti-aliasing
a_bod = bodice_rgba[..., 3:4].astype(np.float32) / 255.0
a_bg = am344_rgba[..., 3:4].astype(np.float32) / 255.0
a_out = a_bod + a_bg * (1.0 - a_bod)
rgb_out = (bodice_rgba[..., :3].astype(np.float32) * a_bod + am344_rgba[..., :3].astype(np.float32) * a_bg * (1.0 - a_bod)) / np.maximum(a_out, 1e-6)
am344_rgba[..., :3] = np.clip(rgb_out, 0, 255).astype(np.uint8)
am344_rgba[..., 3] = np.clip(a_out[..., 0] * 255.0, 0, 255).astype(np.uint8)

# --- LAYER 2: Left Puff Sleeve + Striped Cuff ---
poly_sleeve = np.array([
    [605, 800], [560, 802], [538, 825], [520, 865], [498, 920],
    [478, 980], [480, 1018], [495, 1028], [482, 1072], [535, 1094],
    [587, 1114], [598, 1070], [595, 955]
], dtype=np.int32)
sleeve_corridor = np.zeros((3078, 1499), dtype=np.uint8)
cv2.fillPoly(sleeve_corridor, [poly_sleeve], 255)
cuff_bot_y = 1072.0 + (xx - 482.0) * (42.0 / 105.0)
raw_sleeve = (sleeve_corridor > 0) & (yy <= cuff_bot_y) & (~is_ext_white_bg) & (~((yy < 1022) & (xx < 550) & is_bright_blue_hair)) & (~((yy > 1060) & is_skin))
num_l, labels, stats, _ = cv2.connectedComponentsWithStats(raw_sleeve.astype(np.uint8))
best_l = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
sleeve_mask = (labels == best_l).astype(np.uint8) * 255
sleeve_mask = cv2.morphologyEx(sleeve_mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
sleeve_rgba = np.zeros((3078, 1499, 4), dtype=np.uint8)
sleeve_rgba[..., :3] = ref_collar_clean
sleeve_rgba[..., 3] = cv2.GaussianBlur(sleeve_mask, (3, 3), 0.7)

upper_arm_rgba = arm_rgba.copy().astype(np.float32)
sa = sleeve_rgba[..., 3:4] / 255.0
upper_arm_rgba[..., :3] = sleeve_rgba[..., :3] * sa + upper_arm_rgba[..., :3] * (1.0 - sa)
upper_arm_rgba[..., 3:4] = np.maximum(upper_arm_rgba[..., 3:4], sleeve_rgba[..., 3:4])
upper_arm_rgba = np.clip(upper_arm_rgba, 0, 255).astype(np.uint8)

# --- LAYER 4: Navy Pleated Short Skirt ---
poly_skirt = np.array([
    [607, 1190], [892, 1190], [892, 1232], [935, 1300], [982, 1400], [1030, 1500],
    [1078, 1656], [1035, 1698], [955, 1720], [825, 1726], [675, 1726],
    [545, 1720], [465, 1698], [421, 1656], [469, 1500], [517, 1400],
    [564, 1300], [607, 1232]
], dtype=np.int32)
skirt_corridor = np.zeros((3078, 1499), dtype=np.uint8)
cv2.fillPoly(skirt_corridor, [poly_skirt], 255)
between_thighs = (yy > 1700) & (xx > 720) & (xx < 775) & (B > 110)
side_hair = (yy < 1590) & is_bright_blue_hair & (~((yy <= 1236) & (xx >= 725) & (xx <= 775)))
raw_skirt = (skirt_corridor > 0) & (~is_ext_white_bg) & (~is_skin) & (~between_thighs) & (~side_hair)
num_l, labels, stats, _ = cv2.connectedComponentsWithStats(raw_skirt.astype(np.uint8))
best_l = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
skirt_mask = (labels == best_l).astype(np.uint8) * 255
skirt_mask = cv2.morphologyEx(skirt_mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
skirt_rgba = np.zeros((3078, 1499, 4), dtype=np.uint8)
skirt_rgba[..., :3] = ref_sharp
skirt_rgba[..., 3] = cv2.GaussianBlur(skirt_mask, (3, 3), 0.7)

def apply_to_tex(canvas_rgba, tex_img, am_idx):
    th, tw = tex_img.shape[:2]
    bbox, patch, dmask = warp_canvas_to_texture_island(
        canvas_rgba, st['positions'][am_idx], st['uvs'][am_idx], st['tris'][am_idx], tw, th, dilate_px=4
    )
    tx0, ty0, tx1, ty1 = bbox
    sel = dmask > 0
    tex_img[ty0:ty1, tx0:tx1][sel] = patch[sel]

apply_to_tex(am344_rgba, tex1, 344)
for idx in [290, 286, 268, 269, 251]:
    apply_to_tex(bodice_rgba, tex1, idx)

sleeve_plus_shoulder = sleeve_rgba.copy()
sh_sel = (yy <= 900) & (bodice_rgba[..., 3] > sleeve_plus_shoulder[..., 3])
sleeve_plus_shoulder[sh_sel] = bodice_rgba[sh_sel]
apply_to_tex(sleeve_plus_shoulder, tex1, 601)

apply_to_tex(upper_arm_rgba, tex1, 596)
apply_to_tex(arm_rgba, tex1, 594)

for idx in [314, 318, 319, 345, 346, 347, 351, 352]:
    apply_to_tex(skirt_rgba, tex1, idx)

# --- LAYER 5: Bare Legs Conversion (Remove white stockings on AM 540, 561) ---
tx0_l, ty0_l, tx1_l, ty1_l = 2390, 1700, 2720, 3905
ph_l, pw_l = ty1_l - ty0_l, tx1_l - tx0_l
uv_l = st['uvs'][540]
tris_l = st['tris'][540]
tw_l, th_l = tex1.shape[1], tex1.shape[0]
uv_mask_l = np.zeros((ph_l, pw_l), dtype=np.uint8)
uv_local_l = np.column_stack([uv_l[:, 0] * tw_l - tx0_l, uv_l[:, 1] * th_l - ty0_l])
for tri in tris_l:
    cv2.fillConvexPoly(uv_mask_l, np.round(uv_local_l[tri]).astype(np.int32), 255)
uv_mask_dil_l = cv2.dilate(uv_mask_l, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))) > 0

patch_l = tex1[ty0_l:ty1_l, tx0_l:tx1_l].copy().astype(np.float32)
alpha_bin_l = ((patch_l[..., 3] > 40) & uv_mask_dil_l).astype(np.uint8)
xl_arr = np.zeros(ph_l, dtype=np.float32)
xr_arr = np.zeros(ph_l, dtype=np.float32)
for y in range(ph_l):
    xs = np.where(alpha_bin_l[y] > 0)[0]
    if len(xs) > 0:
        xl_arr[y] = xs[0]
        xr_arr[y] = xs[-1]

anchor_y = np.concatenate([np.arange(480, 550), np.arange(830, 900)])
poly_l = np.poly1d(np.polyfit(anchor_y, xl_arr[anchor_y], 3))
poly_r = np.poly1d(np.polyfit(anchor_y, xr_arr[anchor_y], 3))

py_grid, px_grid = np.mgrid[0:ph_l, 0:pw_l].astype(np.float32)
map_x = px_grid.copy()
for y in range(500, 880):
    if xr_arr[y] > xl_arr[y] + 10:
        wy = np.sin(np.pi * (y - 500.0) / 380.0) ** 1.5
        tgt_l = (1.0 - wy) * xl_arr[y] + wy * poly_l(y)
        tgt_r = (1.0 - wy) * xr_arr[y] + wy * poly_r(y)
        t_x = (px_grid[y] - tgt_l) / max(tgt_r - tgt_l, 1.0)
        map_x[y] = xl_arr[y] + t_x * (xr_arr[y] - xl_arr[y])

a_norm_l = patch_l[..., 3:4] / 255.0
p_pre_l = patch_l.copy()
p_pre_l[..., :3] *= a_norm_l
warped_l = cv2.remap(p_pre_l, map_x, py_grid, interpolation=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0,0,0,0))
nz_l = warped_l[..., 3] > 1e-3
warped_l[nz_l, :3] /= (warped_l[nz_l, 3:4] / 255.0)
patch_l[500:880] = np.where(uv_mask_dil_l[500:880, :, None], warped_l[500:880], patch_l[500:880])

fg_mask_l = ((patch_l[..., 3] > 20) & uv_mask_dil_l).astype(np.uint8)
dist_in_l = cv2.distanceTransform(fg_mask_l, cv2.DIST_L2, 5)
w_int_l = np.clip((dist_in_l - 1.6) / 2.6, 0.0, 1.0)

cx_leg = np.zeros_like(px_grid)
for y in range(ph_l):
    xs = np.where(fg_mask_l[y] > 0)[0]
    if len(xs) > 5:
        mid = 0.5 * (xs[0] + xs[-1])
        half_w = max(0.5 * (xs[-1] - xs[0]), 1.0)
        cx_leg[y] = np.clip((px_grid[y] - mid) / half_w, -1.0, 1.0)

orig_lum = (0.299 * patch_l[..., 0] + 0.587 * patch_l[..., 1] + 0.114 * patch_l[..., 2]) / 255.0
w_knee_zone = np.clip((py_grid - 820.0) / 100.0, 0.0, 1.0)
orig_lum = 0.945 * (1.0 - w_knee_zone) + orig_lum * w_knee_zone
lum_blur = cv2.GaussianBlur(orig_lum, (15, 15), 4.0)
s_shade = np.clip((lum_blur - 0.80) / 0.18, 0.0, 1.0)

edge_roll = (cx_leg ** 2)
w_underskirt = np.clip((520.0 - py_grid) / 140.0, 0.0, 1.0)

skin_r = 250.0 + 5.0 * s_shade - 1.5 * edge_roll - 3.0 * w_underskirt
skin_g = 221.0 + 18.0 * s_shade - 7.0 * edge_roll - 9.0 * w_underskirt
skin_b = 216.0 + 20.0 * s_shade - 8.0 * edge_roll - 9.0 * w_underskirt

w_knee = np.exp(-((py_grid - 1050.0) / 75.0) ** 2) * np.exp(-(cx_leg / 0.65) ** 2) * 0.45
skin_g -= w_knee * 14.0
skin_b -= w_knee * 15.0

out_r = np.full_like(skin_r, 142.0)
out_g = np.full_like(skin_g, 74.0)
out_b = np.full_like(skin_b, 68.0)

tgt_r = w_int_l * skin_r + (1.0 - w_int_l) * out_r
tgt_g = w_int_l * skin_g + (1.0 - w_int_l) * out_g
tgt_b = w_int_l * skin_b + (1.0 - w_int_l) * out_b

blend_l = (fg_mask_l > 0).astype(np.float32)
patch_l[..., 0] = (1.0 - blend_l) * patch_l[..., 0] + blend_l * tgt_r
patch_l[..., 1] = (1.0 - blend_l) * patch_l[..., 1] + blend_l * tgt_g
patch_l[..., 2] = (1.0 - blend_l) * patch_l[..., 2] + blend_l * tgt_b

tex1[ty0_l:ty1_l, tx0_l:tx1_l] = np.clip(patch_l, 0, 255).astype(np.uint8)

# ==============================================================================
# 3.5 CLEAN UP WHALE TAIL SHADOWS & PRE-CLIP OVERLAYS AT 4096x4096
# ==============================================================================
tex3 = np.array(Image.open(os.path.join(BACKUP_DIR, 'texture_03.png')).convert('RGBA'))
tex4 = np.array(Image.open(os.path.join(BACKUP_DIR, 'texture_04.png')).convert('RGBA'))

# 1) Smooth and brighten the white underbelly in texture_04.png to remove harsh oval shadow boundary
mask4 = tex4[..., 3] > 0
rgb4 = tex4[..., :3].astype(np.float32)
rgb4_blur = cv2.GaussianBlur(rgb4, (45, 45), 12.0)
# Map old [201..255] grey-lavender belly to clean, soft pearly white [244..255]
rgb4_clean = np.clip(254.0 - 0.18 * (255.0 - rgb4_blur), 0, 255).astype(np.uint8)
tex4[mask4, :3] = rgb4_clean[mask4]

# 2) Build eroded 4096x4096 silhouette mask from texture_04.png alpha so overlays stay strictly inside black outline
kernel_erode = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
alpha4_eroded = cv2.erode(tex4[..., 3], kernel_erode, iterations=1)
alpha4_smooth = cv2.GaussianBlur(alpha4_eroded.astype(np.float32), (3, 3), 0.8) / 255.0

tail_overlay_groups = [
    ([688, 689, 690, 691, 692], 1710.5, -1659.5),
    ([698, 699, 700, 701, 702], -58.5, -1630.0),
    ([708], 2251.5, -1672.0),
    ([713], -27.5, -2208.5),
]

t3_h, t3_w = tex3.shape[:2]
kernel_dilate = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))

for ams, ox, oy in tail_overlay_groups:
    island_mask = np.zeros((t3_h, t3_w), dtype=np.uint8)
    for am_idx in ams:
        uv = np.column_stack([st0['uvs'][am_idx][:, 0] * t3_w, st0['uvs'][am_idx][:, 1] * t3_h])
        tris = st0['tris'][am_idx]
        for t in tris:
            pts = np.round(uv[t]).astype(np.int32)
            cv2.fillConvexPoly(island_mask, pts, 255)
    island_mask = cv2.dilate(island_mask, kernel_dilate, iterations=1)
    ys, xs = np.where(island_mask > 0)
    if len(xs) == 0:
        continue
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    u3_grid, v3_grid = np.meshgrid(
        np.arange(x0, x1, dtype=np.float32),
        np.arange(y0, y1, dtype=np.float32)
    )
    u4_grid = u3_grid - 2.0 * ox - 286.0
    v4_grid = v3_grid - 2.0 * oy - 3257.0
    sampled_alpha = cv2.remap(
        alpha4_smooth, u4_grid, v4_grid,
        interpolation=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT, borderValue=0.0
    )
    sub_mask = island_mask[y0:y1, x0:x1] > 0
    cur_a = tex3[y0:y1, x0:x1, 3].astype(np.float32)
    cur_a[sub_mask] = cur_a[sub_mask] * sampled_alpha[sub_mask]
    tex3[y0:y1, x0:x1, 3] = np.clip(np.round(cur_a), 0, 255).astype(np.uint8)

# ==============================================================================
# 4. SAVE UPDATED MODEL FILES TO DISK
# ==============================================================================
with open(MOC_PATH, 'wb') as f:
    f.write(moc_bytes)
print(f'Wrote updated {MOC_PATH}')

Image.fromarray(tex0).save(os.path.join(TEX_DIR, 'texture_00.png'))
print('Wrote updated texture_00.png')

Image.fromarray(tex1).save(os.path.join(TEX_DIR, 'texture_01.png'))
print('Wrote updated texture_01.png')

Image.fromarray(tex3).save(os.path.join(TEX_DIR, 'texture_03.png'))
print('Wrote updated texture_03.png')

Image.fromarray(tex4).save(os.path.join(TEX_DIR, 'texture_04.png'))
print('Wrote updated texture_04.png')

# Also update Exp3/裙子切换.exp3.json so Clothes1 stays 1.0
exp_skirt_p = os.path.join(MODEL_DIR, 'Exp3', '裙子切换.exp3.json')
if os.path.exists(exp_skirt_p):
    with open(exp_skirt_p, 'r', encoding='utf-8') as f:
        exp_data = json.load(f)
    for p_entry in exp_data.get('Parameters', []):
        if p_entry.get('Id') == 'Clothes1':
            p_entry['Value'] = 1.0
    with open(exp_skirt_p, 'w', encoding='utf-8') as f:
        json.dump(exp_data, f, indent=2, ensure_ascii=False)
    print(f'Updated {exp_skirt_p}')

# ==============================================================================
# 5. RENDER FINAL VERIFICATION PREVIEWS FROM DISK (NEUTRAL + DYNAMIC POSES)
# ==============================================================================
with open(MOC_PATH, 'rb') as f:
    disk_moc = f.read()

textures = [
    np.array(Image.open(os.path.join(TEX_DIR, f'texture_0{i}.png')).convert('RGBA'))
    for i in range(5)
]

st_neutral = evaluate_moc(disk_moc)
im_neutral = np.array(render_state(st_neutral, textures, scale=0.5))

# Save model preview 大肥鱼.png
Image.fromarray(im_neutral[350:2800, 150:1720]).save(os.path.join(MODEL_DIR, '大肥鱼.png'))
print('Updated preview image 大肥鱼.png')

# Save full body & head closeup on white background for visual verification
a_n = im_neutral[..., 3:4] / 255.0
rgb_n = (im_neutral[..., :3] * a_n + 255.0 * (1.0 - a_n)).astype(np.uint8)
Image.fromarray(rgb_n[350:2650, 250:1620]).save(os.path.join(SCRATCH_DIR, 'final_full_render.png'))
Image.fromarray(rgb_n[360:1160, 500:1375]).save(os.path.join(SCRATCH_DIR, 'final_head_closeup.png'))

# Test dynamic Live2D parameters (Head turn + Smile mouth open + Eye smile)
poses = [
    ('Neutral Default', {}),
    ('Turn Left + Mouth Open', {'ParamAngleX': -18.0, 'ParamAngleY': 8.0, 'ParamBodyAngleX': -6.0, 'ParamMouthOpenY': 0.8}),
    ('Turn Right + Tilt + Happy Eyes', {'ParamAngleX': 18.0, 'ParamAngleZ': 10.0, 'ParamBodyAngleX': 6.0, 'ParamEyeLSmile': 1.0, 'ParamEyeRSmile': 1.0}),
]
pose_panels = []
for title, pdict in poses:
    st_p = evaluate_moc(disk_moc, pdict)
    im_p = np.array(render_state(st_p, textures, scale=0.35))
    ap = im_p[..., 3:4] / 255.0
    rgb_p = (im_p[..., :3] * ap + 255.0 * (1.0 - ap)).astype(np.uint8)
    pose_panels.append(rgb_p[240:1850, 180:1130])

sheet = np.concatenate(pose_panels, axis=1)
Image.fromarray(sheet).save(os.path.join(SCRATCH_DIR, 'final_poses_sheet.png'))
print('Saved final_full_render.png, final_head_closeup.png, and final_poses_sheet.png!')
