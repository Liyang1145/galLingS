(() => {
  const { CubismFramework, CubismUserModel, CubismMatrix44 } = window.CubismSDK;

  const stage = document.getElementById('stage');
  const canvas = document.getElementById('model');
  const statusEl = document.getElementById('status');
  const poseTagEl = document.getElementById('pose-tag');
  const dialogueBoxEl = document.getElementById('dialogue-box');
  const dialogueTextEl = document.getElementById('dialogue-text');
  const slidersContainer = document.getElementById('sliders-container');

  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: true,
    preserveDrawingBuffer: true
  });

  class WhaleGirlModel extends CubismUserModel {
    advance(dt) {
      this._physics?.evaluate(this._model, dt);
      this._pose?.updateParameters(this._model, dt);
    }
  }

  const PRESETS = {
    auto: {
      tag: '自然待机',
      line: '“……看什么看？本小姐只是刚好路过这片浅滩而已。”',
      params: {
        ParamAngleX: 0, ParamAngleY: 0, ParamAngleZ: 0,
        ParamEyeLOpen: 1.0, ParamEyeROpen: 1.0,
        ParamEyeLSmile: 0.0, ParamEyeRSmile: 0.0,
        ParamEyeBallX: 0.0, ParamEyeBallY: 0.0,
        ParamBrowLY: 0.0, ParamBrowRY: 0.0,
        ParamBrowLAngle: 0.0, ParamBrowRAngle: 0.0,
        ParamBrowLForm: 0.0, ParamBrowRForm: 0.0,
        ParamMouthForm: 0.0, ParamMouthOpenY: 0.0,
        ParamCheek: 0.0,
        ParamBodyAngleX: 0.0, ParamBodyAngleZ: 0.0
      }
    },
    tsundere_pout: {
      tag: '傲娇撇嘴·侧目',
      line: '“哼！刚才摸尾巴尖的事，本小姐可还没原谅你呢！”',
      params: {
        ParamAngleX: 18.0, ParamAngleY: -8.0, ParamAngleZ: -10.0,
        ParamEyeLOpen: 1.0, ParamEyeROpen: 1.0,
        ParamEyeLSmile: 0.0, ParamEyeRSmile: 0.0,
        ParamEyeBallX: -0.68, ParamEyeBallY: 0.15,
        ParamBrowLY: -0.55, ParamBrowRY: -0.55,
        ParamBrowLAngle: -0.85, ParamBrowRAngle: -0.85,
        ParamBrowLForm: -0.7, ParamBrowRForm: -0.7,
        ParamMouthForm: -1.0, ParamMouthOpenY: 0.0,
        ParamCheek: 0.6,
        ParamBodyAngleX: -6.0, ParamBodyAngleZ: -4.0
      }
    },
    tsundere_blush: {
      tag: '害羞抗议·脸红',
      line: '“笨、笨蛋！谁准你凑这么近盯着本小姐看的——！！”',
      params: {
        ParamAngleX: -12.0, ParamAngleY: -12.0, ParamAngleZ: 9.0,
        ParamEyeLOpen: 1.0, ParamEyeROpen: 1.0,
        ParamEyeLSmile: 0.0, ParamEyeRSmile: 0.0,
        ParamEyeBallX: 0.35, ParamEyeBallY: 0.18,
        ParamBrowLY: 0.35, ParamBrowRY: 0.35,
        ParamBrowLAngle: 0.85, ParamBrowRAngle: 0.85,
        ParamBrowLForm: -0.4, ParamBrowRForm: -0.4,
        ParamMouthForm: -1.0, ParamMouthOpenY: 0.78,
        ParamCheek: 1.0,
        ParamBodyAngleX: 5.0, ParamBodyAngleZ: 4.0
      }
    },
    tsundere_glare: {
      tag: '嫌弃半眯眼',
      line: '“……你就这点本事？连个布丁都保护不好。”',
      params: {
        ParamAngleX: 8.0, ParamAngleY: 5.0, ParamAngleZ: -6.0,
        ParamEyeLOpen: 0.66, ParamEyeROpen: 0.66,
        ParamEyeLSmile: 0.0, ParamEyeRSmile: 0.0,
        ParamEyeBallX: -0.25, ParamEyeBallY: -0.10,
        ParamBrowLY: -0.35, ParamBrowRY: -0.35,
        ParamBrowLAngle: -0.60, ParamBrowRAngle: -0.60,
        ParamBrowLForm: -0.5, ParamBrowRForm: -0.5,
        ParamMouthForm: -0.85, ParamMouthOpenY: 0.0,
        ParamCheek: 0.2,
        ParamBodyAngleX: 3.0, ParamBodyAngleZ: -2.0
      }
    },
    happy_smile: {
      tag: '破防开心笑',
      line: '“……勉强算你及格吧！明天还要带酸梅汤，加桂花的！”',
      params: {
        ParamAngleX: -6.0, ParamAngleY: 8.0, ParamAngleZ: 7.0,
        ParamEyeLOpen: 0.0, ParamEyeROpen: 0.0,
        ParamEyeLSmile: 1.0, ParamEyeRSmile: 1.0,
        ParamEyeBallX: 0.0, ParamEyeBallY: 0.0,
        ParamBrowLY: 0.45, ParamBrowRY: 0.45,
        ParamBrowLAngle: 0.45, ParamBrowRAngle: 0.45,
        ParamBrowLForm: 0.7, ParamBrowRForm: 0.7,
        ParamMouthForm: 1.0, ParamMouthOpenY: 0.0,
        ParamCheek: 0.8,
        ParamBodyAngleX: -4.0, ParamBodyAngleZ: 4.0
      }
    }
  };

  const SLIDER_DEFS = [
    { id: 'ParamMouthForm', label: '嘴部形状 (傲娇撇嘴 ↔ 微笑)', min: -1, max: 1, step: 0.02 },
    { id: 'ParamMouthOpenY', label: '嘴巴开闭 (闭口 ↔ 张口)', min: 0, max: 1, step: 0.02 },
    { id: 'ParamBrowLAngle', label: '左眉角度 (蹙眉 ↔ 八字眉)', min: -1, max: 1, step: 0.02 },
    { id: 'ParamBrowRAngle', label: '右眉角度 (蹙眉 ↔ 八字眉)', min: -1, max: 1, step: 0.02 },
    { id: 'ParamBrowLY', label: '双眉高低 (压眉 ↔ 挑眉)', min: -1, max: 1, step: 0.02, sync: 'ParamBrowRY' },
    { id: 'ParamEyeLOpen', label: '双眼开合 (闭眼 ↔ 睁眼)', min: 0, max: 1, step: 0.02, sync: 'ParamEyeROpen' },
    { id: 'ParamEyeBallX', label: '视线水平 (左看 ↔ 右看)', min: -1, max: 1, step: 0.02 },
    { id: 'ParamEyeBallY', label: '视线垂直 (下看 ↔ 上看)', min: -1, max: 1, step: 0.02 },
    { id: 'ParamAngleX', label: '头部转角 X (左右转头)', min: -30, max: 30, step: 0.5 },
    { id: 'ParamAngleY', label: '头部俯仰 Y (低头 ↔ 抬头)', min: -30, max: 30, step: 0.5 },
    { id: 'ParamAngleZ', label: '头部歪头 Z (左右歪头)', min: -30, max: 30, step: 0.5 },
    { id: 'ParamBodyAngleX', label: '身体转身 X', min: -10, max: 10, step: 0.2 },
    { id: 'ParamTailSway', label: '鲸尾摆动 (物理叠加)', min: -1, max: 1, step: 0.02 }
  ];

  let userModel = null;
  const textures = [];
  const paramIds = new Map();
  const currentParams = {};
  const targetParams = { ...PRESETS.auto.params };
  const manualOverrides = {};
  const sliderElements = {};

  // Model bounding box in moc3 local space
  let bounds = { minX: -0.5, maxX: 0.5, minY: -1.0, maxY: 1.0, cx: 0, totalH: 2.0 };
  let CAMERA_VIEWS = {
    face: { cy: 0.6, viewH: 0.5 },
    half: { cy: 0.3, viewH: 1.1 },
    full: { cy: 0.0, viewH: 2.1 }
  };

  let currentPose = 'auto';
  let currentView = 'half';
  let camCy = 0.3;
  let camViewH = 1.1;
  let targetCamCy = 0.3;
  let targetCamViewH = 1.1;
  let zoomFactor = 1.0;
  let targetZoomFactor = 1.0;
  let panX = 0.0;
  let panY = 0.0;

  let mouseTrackEnabled = true;
  let autoIdleEnabled = true;
  let mouseX = 0;
  let mouseY = 0;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let lastTime = 0;
  let elapsed = 0;

  SLIDER_DEFS.forEach((def) => {
    const row = document.createElement('div');
    row.className = 'slider-row';
    const header = document.createElement('div');
    header.className = 'slider-header';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = def.label;
    const valSpan = document.createElement('span');
    valSpan.textContent = '0.00';
    header.appendChild(nameSpan);
    header.appendChild(valSpan);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(def.min);
    input.max = String(def.max);
    input.step = String(def.step);
    input.value = String(targetParams[def.id] ?? 0);

    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      manualOverrides[def.id] = v;
      if (def.sync) manualOverrides[def.sync] = v;
      valSpan.textContent = v.toFixed(2);
    });

    row.appendChild(header);
    row.appendChild(input);
    slidersContainer.appendChild(row);
    sliderElements[def.id] = { input, valSpan, def };
  });

  function syncSlidersToPreset() {
    Object.keys(manualOverrides).forEach((k) => delete manualOverrides[k]);
    Object.entries(sliderElements).forEach(([id, obj]) => {
      const v = targetParams[id] ?? 0;
      obj.input.value = String(v);
      obj.valSpan.textContent = Number(v).toFixed(2);
    });
  }

  document.getElementById('reset-sliders').addEventListener('click', () => {
    syncSlidersToPreset();
  });

  function setPreset(poseName, viewName) {
    if (poseName && PRESETS[poseName]) {
      currentPose = poseName;
      const preset = PRESETS[poseName];
      Object.assign(targetParams, preset.params);
      poseTagEl.textContent = preset.tag;
      dialogueTextEl.textContent = preset.line;
      document.querySelectorAll('[data-pose]').forEach((b) => {
        b.classList.toggle('active', b.dataset.pose === poseName);
      });
      syncSlidersToPreset();
    }
    if (viewName && CAMERA_VIEWS[viewName]) {
      currentView = viewName;
      targetCamCy = CAMERA_VIEWS[viewName].cy;
      targetCamViewH = CAMERA_VIEWS[viewName].viewH;
      targetZoomFactor = 1.0;
      panX = 0.0;
      panY = 0.0;
      document.querySelectorAll('[data-view]').forEach((b) => {
        b.classList.toggle('active', b.dataset.view === viewName);
      });
    }
  }

  window.viewerAPI = { setPreset, getBounds: () => bounds };

  document.querySelectorAll('[data-pose]').forEach((btn) => {
    btn.addEventListener('click', () => setPreset(btn.dataset.pose, null));
  });

  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => setPreset(null, btn.dataset.view));
  });

  document.querySelectorAll('[data-bg]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-bg]').forEach((b) => b.classList.toggle('active', b === btn));
      const bg = btn.dataset.bg;
      if (bg === 'noon') stage.style.backgroundImage = "url('/bg/cove_noon.png')";
      else if (bg === 'golden') stage.style.backgroundImage = "url('/bg/cove_golden.png')";
      else stage.style.backgroundImage = 'none';
    });
  });

  document.getElementById('toggle-dialogue').addEventListener('change', (e) => {
    dialogueBoxEl.style.opacity = e.target.checked ? '1' : '0';
  });
  document.getElementById('toggle-mouse').addEventListener('change', (e) => {
    mouseTrackEnabled = e.target.checked;
    if (!mouseTrackEnabled) { mouseX = 0; mouseY = 0; }
  });
  document.getElementById('toggle-auto').addEventListener('change', (e) => {
    autoIdleEnabled = e.target.checked;
  });

  stage.addEventListener('mousemove', (e) => {
    const rect = stage.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    if (isDragging) {
      const dx = (e.clientX - dragStartX) / rect.width * 2;
      const dy = -(e.clientY - dragStartY) / rect.height * 2;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      panX += dx;
      panY += dy;
    } else if (mouseTrackEnabled) {
      mouseX = Math.max(-1, Math.min(1, nx));
      mouseY = Math.max(-1, Math.min(1, ny));
    }
  });

  stage.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
    }
  });
  window.addEventListener('mouseup', () => { isDragging = false; });
  stage.addEventListener('mouseleave', () => { mouseX = 0; mouseY = 0; });

  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    targetZoomFactor = Math.max(0.4, Math.min(4.5, targetZoomFactor * factor));
  }, { passive: false });

  function resize() {
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    userModel?.setRenderTargetSize(canvas.width, canvas.height);
  }
  window.addEventListener('resize', resize);

  function setModelParam(name, val) {
    const id = paramIds.get(name);
    if (id !== undefined && userModel) {
      userModel.getModel().setParameterValueById(id, val);
    }
  }

  function computeModelBounds(model) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const count = model.getDrawableCount();
    for (let i = 0; i < count; i++) {
      const vCount = model.getDrawableVertexCount(i);
      const verts = model.getDrawableVertices(i);
      for (let j = 0; j < vCount; j++) {
        const x = verts[j * 2];
        const y = verts[j * 2 + 1];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    const cx = (minX + maxX) * 0.5;
    const totalH = (maxY - minY) || 2.0;
    bounds = { minX, maxX, minY, maxY, cx, totalH };

    CAMERA_VIEWS = {
      face: {
        cy: maxY - totalH * 0.165,
        viewH: totalH * 0.275
      },
      half: {
        cy: maxY - totalH * 0.285,
        viewH: totalH * 0.64
      },
      full: {
        cy: minY + totalH * 0.45,
        viewH: totalH * 1.10
      }
    };
    targetCamCy = CAMERA_VIEWS[currentView].cy;
    targetCamViewH = CAMERA_VIEWS[currentView].viewH;
    camCy = targetCamCy;
    camViewH = targetCamViewH;
  }

  function draw() {
    if (!gl || !userModel) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = canvas.height / canvas.width;
    const sy = (2.0 / camViewH) * zoomFactor;
    const sx = sy * aspect;
    const tx = panX - sx * bounds.cx;
    const ty = panY - sy * camCy;

    const matrix = new CubismMatrix44();
    const tr = matrix.getArray();
    tr[0] = sx;
    tr[5] = sy;
    tr[12] = tx;
    tr[13] = ty;

    const renderer = userModel.getRenderer();
    renderer.setMvpMatrix(matrix);
    renderer.setRenderState(null, [0, 0, canvas.width, canvas.height]);
    renderer.drawModel('/sdk/Framework/Shaders/WebGL/');
  }

  function frame(now) {
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016;
    lastTime = now;
    elapsed += dt;

    const camLerp = Math.min(1, dt * 8.5);
    camCy += (targetCamCy - camCy) * camLerp;
    camViewH += (targetCamViewH - camViewH) * camLerp;
    zoomFactor += (targetZoomFactor - zoomFactor) * camLerp;

    if (userModel) {
      const model = userModel.getModel();
      model.loadParameters();

      const pLerp = Math.min(1, dt * 7.5);
      for (const key of Object.keys(targetParams)) {
        const tgt = manualOverrides[key] !== undefined ? manualOverrides[key] : targetParams[key];
        if (currentParams[key] === undefined) currentParams[key] = tgt;
        currentParams[key] += (tgt - currentParams[key]) * pLerp;
      }

      const idleWaveX = autoIdleEnabled ? Math.sin(elapsed * 1.1) * 3.5 : 0;
      const idleWaveY = autoIdleEnabled ? Math.cos(elapsed * 0.85) * 2.5 : 0;
      const idleWaveZ = autoIdleEnabled ? Math.sin(elapsed * 0.7) * 1.8 : 0;
      const breathVal = autoIdleEnabled ? (Math.sin(elapsed * 2.1) + 1) * 0.5 : 0.5;
      const tailWave = autoIdleEnabled ? Math.sin(elapsed * 1.8) * 0.45 : 0;

      let blinkFactor = 1.0;
      if (autoIdleEnabled) {
        const cycle = elapsed % 3.8;
        if (cycle > 3.55 && cycle < 3.73) {
          const t = (cycle - 3.55) / 0.18;
          blinkFactor = Math.abs(Math.cos(t * Math.PI));
        }
      }

      const mAngleX = mouseTrackEnabled ? mouseX * 14 : 0;
      const mAngleY = mouseTrackEnabled ? mouseY * 10 : 0;
      const mEyeX = mouseTrackEnabled ? mouseX * 0.55 : 0;
      const mEyeY = mouseTrackEnabled ? mouseY * 0.45 : 0;
      const mBodyX = mouseTrackEnabled ? mouseX * 4.5 : 0;

      setModelParam('ParamAngleX', currentParams.ParamAngleX + idleWaveX + mAngleX);
      setModelParam('ParamAngleY', currentParams.ParamAngleY + idleWaveY + mAngleY);
      setModelParam('ParamAngleZ', currentParams.ParamAngleZ + idleWaveZ);

      const baseEyeL = currentParams.ParamEyeLOpen;
      const baseEyeR = currentParams.ParamEyeROpen;
      setModelParam('ParamEyeLOpen', baseEyeL > 0.1 ? baseEyeL * blinkFactor : baseEyeL);
      setModelParam('ParamEyeROpen', baseEyeR > 0.1 ? baseEyeR * blinkFactor : baseEyeR);
      setModelParam('ParamEyeLSmile', currentParams.ParamEyeLSmile);
      setModelParam('ParamEyeRSmile', currentParams.ParamEyeRSmile);

      setModelParam('ParamEyeBallX', Math.max(-1, Math.min(1, currentParams.ParamEyeBallX + mEyeX)));
      setModelParam('ParamEyeBallY', Math.max(-1, Math.min(1, currentParams.ParamEyeBallY + mEyeY)));

      setModelParam('ParamBrowLY', currentParams.ParamBrowLY);
      setModelParam('ParamBrowRY', currentParams.ParamBrowRY);
      setModelParam('ParamBrowLAngle', currentParams.ParamBrowLAngle);
      setModelParam('ParamBrowRAngle', currentParams.ParamBrowRAngle);
      setModelParam('ParamBrowLForm', currentParams.ParamBrowLForm);
      setModelParam('ParamBrowRForm', currentParams.ParamBrowRForm);

      setModelParam('ParamMouthForm', currentParams.ParamMouthForm);
      setModelParam('ParamMouthOpenY', currentParams.ParamMouthOpenY);
      setModelParam('ParamCheek', currentParams.ParamCheek);

      setModelParam('ParamBodyAngleX', currentParams.ParamBodyAngleX + mBodyX);
      setModelParam('ParamBodyAngleZ', currentParams.ParamBodyAngleZ);
      setModelParam('ParamBreath', breathVal);
      setModelParam('ParamTailSway', manualOverrides.ParamTailSway !== undefined ? manualOverrides.ParamTailSway : tailWave);

      userModel.advance(dt);
      model.update();
      draw();
    }

    requestAnimationFrame(frame);
  }

  async function init() {
    try {
      resize();
      if (!CubismFramework.startUp()) throw new Error('CubismFramework 启动失败');
      CubismFramework.initialize();

      const modelRoot = '/model/';
      const settings = await fetch(modelRoot + 'whale-girl-v6-body-x-wip.model3.json').then((r) => r.json());
      const mocBytes = await fetch(modelRoot + settings.FileReferences.Moc).then((r) => r.arrayBuffer());

      userModel = new WhaleGirlModel();
      userModel.loadModel(mocBytes, true);
      const model = userModel.getModel();

      if (settings.FileReferences.Physics) {
        const physBytes = await fetch(modelRoot + settings.FileReferences.Physics).then((r) => r.arrayBuffer());
        userModel.loadPhysics(physBytes, physBytes.byteLength);
      }

      const paramCount = model.getParameterCount();
      const drawableCount = model.getDrawableCount();
      model.saveParameters();
      model.update();
      computeModelBounds(model);

      const allParamNames = [
        'ParamAngleX', 'ParamAngleY', 'ParamAngleZ',
        'ParamEyeLOpen', 'ParamEyeROpen', 'ParamEyeLSmile', 'ParamEyeRSmile',
        'ParamEyeBallX', 'ParamEyeBallY',
        'ParamBrowLY', 'ParamBrowRY', 'ParamBrowLX', 'ParamBrowRX',
        'ParamBrowLAngle', 'ParamBrowRAngle', 'ParamBrowLForm', 'ParamBrowRForm',
        'ParamMouthForm', 'ParamMouthOpenY', 'ParamCheek',
        'ParamBodyAngleX', 'ParamBodyAngleY', 'ParamBodyAngleZ',
        'ParamBreath', 'ParamHairFront', 'ParamHairSide', 'ParamHairBack', 'ParamTailSway'
      ];
      for (const name of allParamNames) {
        const id = CubismFramework.getIdManager().getId(name);
        paramIds.set(name, id);
      }

      userModel.createRenderer(canvas.width, canvas.height);
      const renderer = userModel.getRenderer();
      renderer.startUp(gl);
      renderer.setIsPremultipliedAlpha(true);
      renderer.loadShaders('/sdk/Framework/Shaders/WebGL/');

      for (const [index, file] of settings.FileReferences.Textures.entries()) {
        const img = new Image();
        img.src = modelRoot + file + '?t=' + Date.now();
        await img.decode();
        const tex = gl.createTexture();
        textures.push(tex);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        renderer.bindTexture(index, tex);
      }

      syncSlidersToPreset();
      statusEl.textContent = `Runtime 已运行 · ${paramCount} 个绑定参数 · ${drawableCount} 个图层部件 · 物理引擎已开启 (60 FPS)`;
      requestAnimationFrame(frame);
    } catch (err) {
      statusEl.textContent = '加载异常: ' + String(err);
      console.error(err);
    }
  }

  init();
})();
