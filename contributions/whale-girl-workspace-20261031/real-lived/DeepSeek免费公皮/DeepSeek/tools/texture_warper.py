import numpy as np
import cv2

def warp_canvas_to_texture_island(canvas_rgba, c_xy, uv_norm, tris, tex_w, tex_h, dilate_px=4):
    """
    Given a full-resolution (or scaled) canvas_rgba image (H, W, 4),
    warps the triangles (c_xy -> t_xy) of an ArtMesh into its bounding box
    on the texture sheet (tex_w x tex_h).
    Returns:
      (tx0, ty0, tx1, ty1), tex_patch_rgba, tex_mask
    """
    ch, cw = canvas_rgba.shape[:2]
    scale_x = cw / 3749.0
    scale_y = ch / 7697.0
    src_pts_all = np.column_stack([c_xy[:, 0] * scale_x, c_xy[:, 1] * scale_y])
    dst_pts_all = np.column_stack([uv_norm[:, 0] * tex_w, uv_norm[:, 1] * tex_h])

    tx0 = max(0, int(np.floor(dst_pts_all[:, 0].min())) - dilate_px - 2)
    ty0 = max(0, int(np.floor(dst_pts_all[:, 1].min())) - dilate_px - 2)
    tx1 = min(tex_w, int(np.ceil(dst_pts_all[:, 0].max())) + dilate_px + 2)
    ty1 = min(tex_h, int(np.ceil(dst_pts_all[:, 1].max())) + dilate_px + 2)
    bw = tx1 - tx0
    bh = ty1 - ty0
    if bw <= 0 or bh <= 0:
        return None, None, None

    dst_local = dst_pts_all - np.array([tx0, ty0])
    # Check if the mapping is globally affine (err <= 1.0 px)
    X = np.column_stack([dst_local, np.ones(len(dst_local))])
    M, _, _, _ = np.linalg.lstsq(X, src_pts_all, rcond=None)
    err = np.abs(X @ M - src_pts_all).max()

    poly_mask = np.zeros((bh, bw), dtype=np.uint8)
    for tri in tris:
        pts_i = np.round(dst_local[tri]).astype(np.int32)
        cv2.fillConvexPoly(poly_mask, pts_i, 255)
        cv2.polylines(poly_mask, [pts_i], True, 255, 1)

    if err <= 1.2:
        # Forward affine from src (canvas crop) to dst_local using premultiplied alpha
        cx0 = max(0, int(np.floor(src_pts_all[:, 0].min())) - 8)
        cy0 = max(0, int(np.floor(src_pts_all[:, 1].min())) - 8)
        cx1 = min(cw, int(np.ceil(src_pts_all[:, 0].max())) + 8)
        cy1 = min(ch, int(np.ceil(src_pts_all[:, 1].max())) + 8)
        sub_c = canvas_rgba[cy0:cy1, cx0:cx1].astype(np.float32)
        sub_c[..., :3] *= (sub_c[..., 3:4] / 255.0)
        src_local = src_pts_all - np.array([cx0, cy0])
        X_s = np.column_stack([src_local, np.ones(len(src_local))])
        M_fwd, _, _, _ = np.linalg.lstsq(X_s, dst_local, rcond=None)
        M_cv = M_fwd.T.astype(np.float32)
        warped_f = cv2.warpAffine(
            sub_c, M_cv, (bw, bh),
            flags=cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=(0, 0, 0, 0)
        )
        nz = warped_f[..., 3] > 1e-3
        warped_f[nz, :3] /= (warped_f[nz, 3:4] / 255.0)
        warped = np.clip(warped_f, 0, 255).astype(np.uint8)
    else:
        warped = np.zeros((bh, bw, 4), dtype=np.uint8)
        for tri in tris:
            s_tri = src_pts_all[tri].astype(np.float32)
            d_tri = dst_local[tri].astype(np.float32)
            x0 = max(0, int(np.floor(d_tri[:, 0].min())) - 1)
            y0 = max(0, int(np.floor(d_tri[:, 1].min())) - 1)
            x1 = min(bw, int(np.ceil(d_tri[:, 0].max())) + 2)
            y1 = min(bh, int(np.ceil(d_tri[:, 1].max())) + 2)
            if x1 <= x0 or y1 <= y0:
                continue
            sx0 = max(0, int(np.floor(s_tri[:, 0].min())) - 4)
            sy0 = max(0, int(np.floor(s_tri[:, 1].min())) - 4)
            sx1 = min(cw, int(np.ceil(s_tri[:, 0].max())) + 4)
            sy1 = min(ch, int(np.ceil(s_tri[:, 1].max())) + 4)
            if sx1 <= sx0 or sy1 <= sy0:
                continue
            M_tri = cv2.getAffineTransform(
                (s_tri - [sx0, sy0]).astype(np.float32),
                (d_tri - [x0, y0]).astype(np.float32)
            )
            sub_c = canvas_rgba[sy0:sy1, sx0:sx1].astype(np.float32)
            sub_c[..., :3] *= (sub_c[..., 3:4] / 255.0)
            w_f = cv2.warpAffine(
                sub_c, M_tri, (x1 - x0, y1 - y0),
                flags=cv2.INTER_LINEAR,
                borderMode=cv2.BORDER_CONSTANT,
                borderValue=(0, 0, 0, 0)
            )
            nz = w_f[..., 3] > 1e-3
            w_f[nz, :3] /= (w_f[nz, 3:4] / 255.0)
            w_patch = np.clip(w_f, 0, 255).astype(np.uint8)
            t_mask = np.zeros((y1 - y0, x1 - x0), dtype=np.uint8)
            cv2.fillConvexPoly(t_mask, np.round(d_tri - [x0, y0]).astype(np.int32), 255)
            sel = t_mask > 0
            warped[y0:y1, x0:x1][sel] = w_patch[sel]

    # Dilate poly_mask slightly so UV triangle boundaries have clean edge padding
    if dilate_px > 0:
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (dilate_px * 2 + 1, dilate_px * 2 + 1))
        dilated_mask = cv2.dilate(poly_mask, kernel)
    else:
        dilated_mask = poly_mask

    warped[dilated_mask == 0] = 0
    return (tx0, ty0, tx1, ty1), warped, dilated_mask
