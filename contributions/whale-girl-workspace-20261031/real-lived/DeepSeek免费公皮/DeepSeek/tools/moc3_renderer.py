import ctypes, struct, sys, os, json
import numpy as np
import cv2
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')

DLL_PATH = r'<USERPROFILE>\Desktop\galagentV1.0\.tools\CubismEditor\app\dll64\Live2DCubismCoreJNI.dll'
MOC_PATH = r'../../..\real-lived\DeepSeek免费公皮\DeepSeek\大肥鱼.moc3'
CDI_PATH = r'../../..\real-lived\DeepSeek免费公皮\DeepSeek\大肥鱼.cdi3.json'
TEX_DIR  = r'../../..\real-lived\DeepSeek免费公皮\DeepSeek\大肥鱼.4096'

class CubismCore:
    def __init__(self, dll_path=DLL_PATH):
        self.dll = ctypes.CDLL(dll_path)
        b = self.dll._handle
        self.ReviveMocInPlace = ctypes.CFUNCTYPE(ctypes.c_void_p, ctypes.c_void_p, ctypes.c_uint32)(b + 0x4f10)
        self.GetSizeofModel = ctypes.CFUNCTYPE(ctypes.c_uint32, ctypes.c_void_p)(b + 0x4cf0)
        self.InitializeModelInPlace = ctypes.CFUNCTYPE(ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_uint32)(b + 0x4db0)
        self.UpdateModel = ctypes.CFUNCTYPE(None, ctypes.c_void_p)(b + 0x4f90)
        self.HasMocConsistency = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.c_void_p, ctypes.c_uint32)(b + 0x4d40)

        self.GetParameterCount = ctypes.CFUNCTYPE(ctypes.c_int32, ctypes.c_void_p)(b + 0x48a0)
        self.GetParameterValues = ctypes.CFUNCTYPE(ctypes.c_uint64, ctypes.c_void_p)(b + 0x4b30)
        self.GetPartCount = ctypes.CFUNCTYPE(ctypes.c_int32, ctypes.c_void_p)(b + 0x4b70)
        self.GetPartOpacities = ctypes.CFUNCTYPE(ctypes.c_uint64, ctypes.c_void_p)(b + 0x4c30)
        self.GetPartParentPartIndices = ctypes.CFUNCTYPE(ctypes.c_uint64, ctypes.c_void_p)(b + 0x4c70)

        self.GetDrawableCount = ctypes.CFUNCTYPE(ctypes.c_int32, ctypes.c_void_p)(b + 0x3e50)
        self.GetDrawableConstantFlags = ctypes.CFUNCTYPE(ctypes.c_uint64, ctypes.c_void_p)(b + 0x3e00)
        self.GetDrawableDynamicFlags = ctypes.CFUNCTYPE(ctypes.c_uint64, ctypes.c_void_p)(b + 0x3ed0)
        self.GetDrawableTextureIndices = ctypes.CFUNCTYPE(ctypes.c_uint64, ctypes.c_void_p)(b + 0x4280)
        self.GetDrawableDrawOrders = ctypes.CFUNCTYPE(ctypes.c_uint64, ctypes.c_void_p)(b + 0x3e90)
        self.GetDrawableRenderOrders = ctypes.CFUNCTYPE(ctypes.c_uint64, ctypes.c_void_p)(b + 0x4cb0)
        self.GetDrawableOpacities = ctypes.CFUNCTYPE(ctypes.c_uint64, ctypes.c_void_p)(b + 0x40e0)
        self.GetDrawableMaskCounts = ctypes.CFUNCTYPE(ctypes.c_uint64, ctypes.c_void_p)(b + 0x4000)
        self.GetDrawableMasks = ctypes.CFUNCTYPE(ctypes.c_uint64, ctypes.c_void_p)(b + 0x4050)
        self.GetDrawableVertexCounts = ctypes.CFUNCTYPE(ctypes.c_uint64, ctypes.c_void_p)(b + 0x42d0)
        self.GetDrawableVertexPositions = ctypes.CFUNCTYPE(ctypes.c_uint64, ctypes.c_void_p)(b + 0x4320)
        self.GetDrawableVertexUvs = ctypes.CFUNCTYPE(ctypes.c_uint64, ctypes.c_void_p)(b + 0x4360)
        self.GetDrawableIndexCounts = ctypes.CFUNCTYPE(ctypes.c_uint64, ctypes.c_void_p)(b + 0x3f60)
        self.GetDrawableIndices = ctypes.CFUNCTYPE(ctypes.c_uint64, ctypes.c_void_p)(b + 0x3fb0)
        self.GetDrawableParentPartIndices = ctypes.CFUNCTYPE(ctypes.c_uint64, ctypes.c_void_p)(b + 0x41f0)
        self.GetDrawableMultiplyColors = ctypes.CFUNCTYPE(ctypes.c_uint64, ctypes.c_void_p)(b + 0x40a0)
        self.GetDrawableScreenColors = ctypes.CFUNCTYPE(ctypes.c_uint64, ctypes.c_void_p)(b + 0x4240)

def evaluate_moc(moc_bytes, param_overrides=None, part_opacity_overrides=None):
    core = CubismCore()
    buf = ctypes.create_string_buffer(len(moc_bytes) + 64)
    aligned_addr = (ctypes.addressof(buf) + 63) & ~63
    ctypes.memmove(aligned_addr, moc_bytes, len(moc_bytes))
    moc_ptr = core.ReviveMocInPlace(aligned_addr, len(moc_bytes))
    model_size = core.GetSizeofModel(moc_ptr)
    mbuf = ctypes.create_string_buffer(model_size + 64)
    maddr = (ctypes.addressof(mbuf) + 63) & ~63
    model_ptr = core.InitializeModelInPlace(moc_ptr, maddr, model_size)

    offsets = struct.unpack_from('<160I', moc_bytes, 64)
    num_parts = core.GetPartCount(model_ptr)
    num_artmeshes = core.GetDrawableCount(model_ptr)
    num_params = core.GetParameterCount(model_ptr)

    def read_ids(sec_idx, count):
        base = offsets[sec_idx]
        return [moc_bytes[base + i*64 : base + (i+1)*64].split(b'\x00', 1)[0].decode('utf-8', errors='ignore') for i in range(count)]

    part_ids = read_ids(3, num_parts)
    artmesh_ids = read_ids(33, num_artmeshes)
    param_ids = read_ids(50, num_params)

    param_vals = np.frombuffer((ctypes.c_float * num_params).from_address(core.GetParameterValues(model_ptr)), dtype=np.float32)
    part_opacs = np.frombuffer((ctypes.c_float * num_parts).from_address(core.GetPartOpacities(model_ptr)), dtype=np.float32)

    if param_overrides:
        for k, v in param_overrides.items():
            if k in param_ids:
                param_vals[param_ids.index(k)] = v
    if part_opacity_overrides:
        for k, v in part_opacity_overrides.items():
            if isinstance(k, int):
                part_opacs[k] = v
            elif k in part_ids:
                part_opacs[part_ids.index(k)] = v

    core.UpdateModel(model_ptr)

    opacities = np.frombuffer((ctypes.c_float * num_artmeshes).from_address(core.GetDrawableOpacities(model_ptr)), dtype=np.float32).copy()
    render_orders = np.frombuffer((ctypes.c_int32 * num_artmeshes).from_address(core.GetDrawableRenderOrders(model_ptr)), dtype=np.int32).copy()
    vcnts = np.frombuffer((ctypes.c_int32 * num_artmeshes).from_address(core.GetDrawableVertexCounts(model_ptr)), dtype=np.int32).copy()
    icnts = np.frombuffer((ctypes.c_int32 * num_artmeshes).from_address(core.GetDrawableIndexCounts(model_ptr)), dtype=np.int32).copy()
    mcnts = np.frombuffer((ctypes.c_int32 * num_artmeshes).from_address(core.GetDrawableMaskCounts(model_ptr)), dtype=np.int32).copy()
    am_tex = np.frombuffer((ctypes.c_int32 * num_artmeshes).from_address(core.GetDrawableTextureIndices(model_ptr)), dtype=np.int32).copy()
    am_part = np.frombuffer((ctypes.c_int32 * num_artmeshes).from_address(core.GetDrawableParentPartIndices(model_ptr)), dtype=np.int32).copy()
    am_cflags = np.frombuffer((ctypes.c_uint8 * num_artmeshes).from_address(core.GetDrawableConstantFlags(model_ptr)), dtype=np.uint8).copy()
    am_dflags = np.frombuffer((ctypes.c_uint8 * num_artmeshes).from_address(core.GetDrawableDynamicFlags(model_ptr)), dtype=np.uint8).copy()
    mul_colors = np.frombuffer((ctypes.c_float * (num_artmeshes * 4)).from_address(core.GetDrawableMultiplyColors(model_ptr)), dtype=np.float32).reshape(num_artmeshes, 4).copy()
    scr_colors = np.frombuffer((ctypes.c_float * (num_artmeshes * 4)).from_address(core.GetDrawableScreenColors(model_ptr)), dtype=np.float32).reshape(num_artmeshes, 4).copy()

    pos_ptrs = np.frombuffer((ctypes.c_uint64 * num_artmeshes).from_address(core.GetDrawableVertexPositions(model_ptr)), dtype=np.uint64)
    uv_ptrs = np.frombuffer((ctypes.c_uint64 * num_artmeshes).from_address(core.GetDrawableVertexUvs(model_ptr)), dtype=np.uint64)
    idx_ptrs = np.frombuffer((ctypes.c_uint64 * num_artmeshes).from_address(core.GetDrawableIndices(model_ptr)), dtype=np.uint64)
    mask_ptrs = np.frombuffer((ctypes.c_uint64 * num_artmeshes).from_address(core.GetDrawableMasks(model_ptr)), dtype=np.uint64)

    positions = []
    uvs = []
    tris = []
    masks = []
    for i in range(num_artmeshes):
        vc = int(vcnts[i])
        ic = int(icnts[i])
        mc = int(mcnts[i])
        pts = np.frombuffer((ctypes.c_float * (vc * 2)).from_address(int(pos_ptrs[i])), dtype=np.float32).reshape(-1, 2)
        c_xy = np.column_stack([pts[:, 0] * 3749.0 + 1874.5, 3848.5 - pts[:, 1] * 3749.0])
        positions.append(c_xy)

        am_uv = np.frombuffer((ctypes.c_float * (vc * 2)).from_address(int(uv_ptrs[i])), dtype=np.float32).reshape(-1, 2)
        t_xy = np.column_stack([am_uv[:, 0], 1.0 - am_uv[:, 1]])
        uvs.append(t_xy)

        if ic > 0 and idx_ptrs[i]:
            tr = np.frombuffer((ctypes.c_uint16 * ic).from_address(int(idx_ptrs[i])), dtype=np.uint16).reshape(-1, 3).copy()
        else:
            tr = np.zeros((0, 3), dtype=np.uint16)
        tris.append(tr)

        if mc > 0 and mask_ptrs[i]:
            ms = np.frombuffer((ctypes.c_int32 * mc).from_address(int(mask_ptrs[i])), dtype=np.int32).tolist()
        else:
            ms = []
        masks.append(ms)

    return {
        'part_ids': part_ids, 'artmesh_ids': artmesh_ids, 'param_ids': param_ids,
        'opacities': opacities, 'render_orders': render_orders, 'positions': positions,
        'uvs': uvs, 'tris': tris, 'masks': masks, 'am_part': am_part, 'am_tex': am_tex,
        'am_cflags': am_cflags, 'am_dflags': am_dflags,
        'mul_colors': mul_colors, 'scr_colors': scr_colors
    }

def rasterize_artmesh(tex_img, uv_norm, c_xy, tris, canvas_w=3749, canvas_h=7697, scale=0.4):
    if len(tris) == 0:
        return None, None
    tex_h, tex_w = tex_img.shape[:2]
    t_xy = np.column_stack([uv_norm[:, 0] * tex_w, uv_norm[:, 1] * tex_h])
    c_s = c_xy * scale
    xmin = max(0, int(np.floor(c_s[:, 0].min())) - 2)
    ymin = max(0, int(np.floor(c_s[:, 1].min())) - 2)
    xmax = min(int(canvas_w * scale), int(np.ceil(c_s[:, 0].max())) + 2)
    ymax = min(int(canvas_h * scale), int(np.ceil(c_s[:, 1].max())) + 2)
    bw = xmax - xmin
    bh = ymax - ymin
    if bw <= 0 or bh <= 0:
        return None, None

    X = np.column_stack([t_xy, np.ones(len(t_xy))])
    dst_pts = c_s - np.array([xmin, ymin])
    M, _, _, _ = np.linalg.lstsq(X, dst_pts, rcond=None)
    err = np.abs(X @ M - dst_pts).max()

    tx0 = max(0, min(tex_w - 1, int(np.floor(t_xy[:, 0].min())) - 4))
    ty0 = max(0, min(tex_h - 1, int(np.floor(t_xy[:, 1].min())) - 4))
    tx1 = max(tx0 + 1, min(tex_w, int(np.ceil(t_xy[:, 0].max())) + 4))
    ty1 = max(ty0 + 1, min(tex_h, int(np.ceil(t_xy[:, 1].max())) + 4))
    sub_tex_raw = tex_img[ty0:ty1, tx0:tx1]
    if sub_tex_raw.shape[0] <= 0 or sub_tex_raw.shape[1] <= 0:
        return None, None
    # Premultiply RGB by Alpha before bilinear interpolation to prevent transparent RGB bleed
    sub_f = sub_tex_raw.astype(np.float32)
    sub_f[..., :3] *= (sub_f[..., 3:4] / 255.0)
    t_local = t_xy - np.array([tx0, ty0])

    mask = np.zeros((bh, bw), dtype=np.uint8)
    for tri in tris:
        pts_i = np.round(dst_pts[tri]).astype(np.int32)
        cv2.fillConvexPoly(mask, pts_i, 255)
        cv2.polylines(mask, [pts_i], True, 255, 1)

    if err <= 1.5:
        X_loc = np.column_stack([t_local, np.ones(len(t_local))])
        M_loc, _, _, _ = np.linalg.lstsq(X_loc, dst_pts, rcond=None)
        M_cv = M_loc.T.astype(np.float32)
        warped_f = cv2.warpAffine(sub_f, M_cv, (bw, bh), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0,0,0,0))
        nz = warped_f[..., 3] > 1e-3
        warped_f[nz, :3] /= (warped_f[nz, 3:4] / 255.0)
        warped = np.clip(warped_f, 0, 255).astype(np.uint8)
        warped[..., 3] = (warped[..., 3].astype(np.uint16) * mask // 255).astype(np.uint8)
        return (xmin, ymin, xmax, ymax), warped
    else:
        out = np.zeros((bh, bw, 4), dtype=np.uint8)
        for tri in tris:
            src_tri = t_local[tri].astype(np.float32)
            dst_tri = dst_pts[tri].astype(np.float32)
            x0 = max(0, int(np.floor(dst_tri[:, 0].min())))
            y0 = max(0, int(np.floor(dst_tri[:, 1].min())))
            x1 = min(bw, int(np.ceil(dst_tri[:, 0].max())) + 1)
            y1 = min(bh, int(np.ceil(dst_tri[:, 1].max())) + 1)
            if x1 <= x0 or y1 <= y0: continue
            sx0 = max(0, int(np.floor(src_tri[:, 0].min())) - 2)
            sy0 = max(0, int(np.floor(src_tri[:, 1].min())) - 2)
            sx1 = min(sub_f.shape[1], int(np.ceil(src_tri[:, 0].max())) + 2)
            sy1 = min(sub_f.shape[0], int(np.ceil(src_tri[:, 1].max())) + 2)
            if sx1 <= sx0 or sy1 <= sy0: continue
            M_tri = cv2.getAffineTransform((src_tri - [sx0, sy0]).astype(np.float32), (dst_tri - [x0, y0]).astype(np.float32))
            w_f = cv2.warpAffine(sub_f[sy0:sy1, sx0:sx1], M_tri, (x1-x0, y1-y0), flags=cv2.INTER_LINEAR)
            nz = w_f[..., 3] > 1e-3
            w_f[nz, :3] /= (w_f[nz, 3:4] / 255.0)
            w_patch = np.clip(w_f, 0, 255).astype(np.uint8)
            t_mask = np.zeros((y1-y0, x1-x0), dtype=np.uint8)
            pts_i = np.round(dst_tri - [x0, y0]).astype(np.int32)
            cv2.fillConvexPoly(t_mask, pts_i, 255)
            cv2.polylines(t_mask, [pts_i], True, 255, 1)
            sel = t_mask > 0
            out[y0:y1, x0:x1][sel] = w_patch[sel]
        out[..., 3] = (out[..., 3].astype(np.uint16) * mask // 255).astype(np.uint8)
        return (xmin, ymin, xmax, ymax), out

def render_state(state, textures, scale=0.4):
    W, H = int(3749 * scale), int(7697 * scale)
    canvas = np.zeros((H, W, 4), dtype=np.float32)
    cache = {}
    def get_rast(idx):
        if idx not in cache:
            cache[idx] = rasterize_artmesh(textures[state['am_tex'][idx]], state['uvs'][idx], state['positions'][idx], state['tris'][idx], scale=scale)
        return cache[idx]

    order = np.argsort(state['render_orders'])
    for i in order:
        if not (state['am_dflags'][i] & 0x01): # csmIsVisible
            continue
        op = state['opacities'][i]
        if op <= 0.005:
            continue
        bbox, patch = get_rast(i)
        if bbox is None:
            continue
        x0, y0, x1, y1 = bbox
        masks = [m for m in state['masks'][i] if m >= 0]
        if masks:
            inv = bool(state['am_cflags'][i] & 0x08)
            m_alpha = np.zeros((y1-y0, x1-x0), dtype=np.float32)
            for m_idx in masks:
                mbbox, mpatch = get_rast(m_idx)
                if mbbox is None: continue
                mx0, my0, mx1, my1 = mbbox
                ix0, iy0 = max(x0, mx0), max(y0, my0)
                ix1, iy1 = min(x1, mx1), min(y1, my1)
                if ix1 > ix0 and iy1 > iy0:
                    m_alpha[iy0-y0:iy1-y0, ix0-x0:ix1-x0] = np.clip(
                        m_alpha[iy0-y0:iy1-y0, ix0-x0:ix1-x0] + mpatch[iy0-my0:iy1-my0, ix0-mx0:ix1-mx0, 3] / 255.0,
                        0.0, 1.0
                    )
            if inv:
                m_alpha = 1.0 - m_alpha
            patch = patch.copy()
            patch[..., 3] = (patch[..., 3].astype(np.float32) * m_alpha).astype(np.uint8)

        sub = patch.astype(np.float32)
        mc = state['mul_colors'][i][:3]
        sc = state['scr_colors'][i][:3]
        if not (np.allclose(mc, 1.0) and np.allclose(sc, 0.0)):
            c_norm = (sub[..., :3] / 255.0) * mc
            c_norm = 1.0 - (1.0 - c_norm) * (1.0 - sc)
            sub[..., :3] = np.clip(c_norm * 255.0, 0.0, 255.0)
        src_a = (sub[..., 3:4] / 255.0) * op
        dst = canvas[y0:y1, x0:x1]
        dst_a = dst[..., 3:4] / 255.0
        fl = state['am_cflags'][i]
        if fl & 0x01: # Additive
            dst[..., :3] = np.minimum(255.0, dst[..., :3] + sub[..., :3] * src_a)
        elif fl & 0x02: # Multiply
            blended = (dst[..., :3] * sub[..., :3]) / 255.0
            dst[..., :3] = dst[..., :3] * (1.0 - src_a) + blended * src_a
        else:
            out_a = src_a + dst_a * (1.0 - src_a)
            mask_nz = out_a[..., 0] > 1e-5
            out_rgb = sub[..., :3] * src_a + dst[..., :3] * dst_a * (1.0 - src_a)
            out_rgb[mask_nz] /= out_a[mask_nz]
            dst[..., :3] = out_rgb
            dst[..., 3:4] = out_a * 255.0

    return Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8), 'RGBA')

if __name__ == '__main__':
    with open(MOC_PATH, 'rb') as f:
        moc_bytes = f.read()
    textures = [np.array(Image.open(os.path.join(TEX_DIR, f'texture_0{i}.png')).convert('RGBA')) for i in range(5)]
    # Hide maid headband (Part161), hairpin (Part), back bow (Part135), shoulder frills (Part117, Part93), pen (Part90)
    part_hide = {
        'Part161': 0.0, # 女仆发饰
        'Part': 0.0,    # 发饰 (DS发夹)
        'Part135': 0.0, # 身后蝴蝶结
        'Part117': 0.0, # 肩膀花边-变q
        'Part93': 0.0,  # 肩膀花边
        'Part90': 0.0,  # 钢笔
    }
    state = evaluate_moc(moc_bytes, param_overrides={'Clothes1': 1.0, 'Clothes3': 1.0}, part_opacity_overrides=part_hide)
    out_im = render_state(state, textures, scale=0.4)
    out_im.save(r'.\moc3_short_skirt.png')
    print('Rendered moc3_short_skirt.png!')
