export interface VisualMotion {
  frames: Keyframe[];
  timing: KeyframeAnimationOptions;
}

/** CSS easing applies between keyframes; WAAPI's effect easing applies to the whole timeline. */
export function cssMotion(frames: Keyframe[], duration: number, easing: string,
  direction: PlaybackDirection = "normal"): VisualMotion {
  return {
    frames: frames.map(frame => ({ ...frame, easing })),
    timing: { duration, easing: "linear", direction },
  };
}

// Source: 海风与布丁/index.html, sIn/sInL/sInR/sInU/sPop and aJump...aSettle.
const fade: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];
const left: Keyframe[] = [{ opacity: 0, translate: "-280px 0" }, { opacity: 1, translate: "0 0" }];
const right: Keyframe[] = [{ opacity: 0, translate: "280px 0" }, { opacity: 1, translate: "0 0" }];
const up: Keyframe[] = [{ opacity: 0, translate: "0 140px" }, { opacity: 1, translate: "0 0" }];

export const ACTOR_ENTRIES: Record<string, VisualMotion> = {
  fade: cssMotion(fade, 450, "ease-out"),
  left: cssMotion(left, 550, "cubic-bezier(.2,.8,.3,1)"),
  right: cssMotion(right, 550, "cubic-bezier(.2,.8,.3,1)"),
  up: cssMotion(up, 550, "cubic-bezier(.2,.8,.3,1)"),
  pop: cssMotion([{ opacity: 0, translate: "0 40px" }, { opacity: 1, translate: "0 0" }],
    400, "cubic-bezier(.3,1.6,.5,1)"),
};

export const ACTOR_EXITS: Record<string, VisualMotion> = {
  fade: cssMotion(fade, 400, "ease-in", "reverse"),
  left: cssMotion(left, 500, "ease-in", "reverse"),
  right: cssMotion(right, 500, "ease-in", "reverse"),
  down: cssMotion(up, 500, "ease-in", "reverse"),
};

export const ACTOR_ACTIONS: Record<string, VisualMotion> = {
  jump: cssMotion([
      { offset: 0, translate: "0 0" }, { offset: 0.3, translate: "0 -42px" },
      { offset: 0.55, translate: "0 0" }, { offset: 0.75, translate: "0 -12px" },
      { offset: 1, translate: "0 0" },
    ], 500, "ease-out"),
  shake: cssMotion([
      { offset: 0, translate: "0 0" }, { offset: 0.15, translate: "-12px 0" },
      { offset: 0.3, translate: "10px 0" }, { offset: 0.45, translate: "-8px 0" },
      { offset: 0.6, translate: "6px 0" }, { offset: 0.8, translate: "-3px 0" },
      { offset: 1, translate: "0 0" },
    ], 500, "linear"),
  nod: cssMotion([
      { offset: 0, translate: "0 0" }, { offset: 0.35, translate: "0 22px" },
      { offset: 0.6, translate: "0 0" }, { offset: 0.8, translate: "0 10px" },
      { offset: 1, translate: "0 0" },
    ], 600, "ease-in-out"),
  lean: cssMotion([
      { offset: 0, translate: "0 0", rotate: "0deg" },
      { offset: 0.45, translate: "-10px 0", rotate: "-1.2deg" },
      { offset: 1, translate: "0 0", rotate: "0deg" },
    ], 550, "ease-in-out"),
  flinch: cssMotion([
      { offset: 0, translate: "0 0" }, { offset: 0.25, translate: "14px 1px" },
      { offset: 0.55, translate: "8px 0" }, { offset: 1, translate: "0 0" },
    ], 380, "ease-out"),
  settle: cssMotion([
      { offset: 0, translate: "0 -16px" }, { offset: 0.65, translate: "0 3px" },
      { offset: 1, translate: "0 0" },
    ], 550, "ease-out"),
};

// Source: shake/quake/zoomHit/whipPan, veil and blinkEye in the same legacy stylesheet.
export const SCREEN_MOTIONS: Record<string, VisualMotion> = {
  shake: cssMotion([
    { offset: 0, transform: "translate(0,0)" }, { offset: 0.2, transform: "translate(-14px,6px)" },
    { offset: 0.4, transform: "translate(12px,-8px)" }, { offset: 0.6, transform: "translate(-8px,4px)" },
    { offset: 0.8, transform: "translate(6px,-2px)" }, { offset: 1, transform: "translate(0,0)" },
  ], 500, "ease"),
  quake: cssMotion([
    { offset: 0, transform: "translate(0,0) scale(1.06)" },
    { offset: 0.08, transform: "translate(-34px,18px) scale(1.06)" },
    { offset: 0.16, transform: "translate(30px,-22px) scale(1.05)" },
    { offset: 0.26, transform: "translate(-24px,14px) scale(1.04)" },
    { offset: 0.38, transform: "translate(18px,-10px) scale(1.03)" },
    { offset: 0.52, transform: "translate(-10px,6px) scale(1.02)" },
    { offset: 0.7, transform: "translate(5px,-3px) scale(1.01)" },
    { offset: 1, transform: "translate(0,0) scale(1)" },
  ], 900, "cubic-bezier(.3,.7,.4,1)"),
  zoom: cssMotion([
    { offset: 0, transform: "scale(1)" }, { offset: 0.25, transform: "scale(1.12)" },
    { offset: 1, transform: "scale(1)" },
  ], 500, "ease-out"),
  whip: cssMotion([
    { offset: 0, transform: "translateX(0) scale(1.08)", filter: "blur(0)" },
    { offset: 0.14, transform: "translateX(-11%) scale(1.08)", filter: "blur(18px)" },
    { offset: 0.34, transform: "translateX(6%) scale(1.07)", filter: "blur(9px)" },
    { offset: 0.58, transform: "translateX(-2%) scale(1.04)", filter: "blur(3px)" },
    { offset: 1, transform: "translateX(0) scale(1)", filter: "blur(0)" },
  ], 620, "cubic-bezier(.15,.85,.3,1)"),
};

export const SCREEN_FLASH = cssMotion([{ opacity: 1 }, { opacity: 0 }], 800, "ease-out");
export const SCREEN_BLINK = cssMotion([
  { offset: 0, opacity: 1 }, { offset: 0.25, opacity: 0.15 }, { offset: 0.4, opacity: 1 },
  { offset: 0.65, opacity: 0 }, { offset: 0.78, opacity: 0.6 }, { offset: 1, opacity: 0 },
], 1600, "ease-in-out");
