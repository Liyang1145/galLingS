/* Steam / 桌面版宿主桥（web/offline/steam-host.js）
 *
 * 同时运行在外框（vn.html）与作品内页（index.html）里：
 * 1. 纯净游戏模式（?steam=1 / window.GALLINGS_STEAM）：默认隐藏外框调试顶栏，画面铺满窗口；
 *    按 F10 或 Ctrl+Shift+D 可随时呼出调试顶栏与引擎时间轴；按 F11 或 Alt+Enter 切换原生全屏。
 * 2. Steam Auto-Cloud 本地文件存档同步（/__host/saves）：
 *    把 IndexedDB 里的 saves:<id> 与 localStorage 里的 vnglobal / vnprefs / vnread / vnplug
 *    实时镜像到 %APPDATA%/com.gallings.haifeng/saves/*.json（便携模式下为 userdata/saves/*.json）。
 * 3. 多模型插件 + 灵枢记忆库 + GalAgent 桥接（window.GallingsLLM + /api/settings + /__host/llm）：
 *    支持 OpenAI/DeepSeek 兼容、Anthropic Claude、Google Gemini、Ollama 本地四类模型插件，
 *    以及灵枢认知图 MCP 记忆底座（gallings.memory.lingshu）与本地轻量记忆切换。
 *    密钥独立存在本机数据目录（不进 saves/，避免被 Steam 云同步到公共设备）。
 */
(() => {
  'use strict';
  if (window.__GALLINGS_STEAM_HOST_LOADED) return;
  window.__GALLINGS_STEAM_HOST_LOADED = true;

  const isTop = (() => { try { return window.top === window; } catch (e) { return true; } })();
  const topWin = (() => { try { return window.top || window; } catch (e) { return window; } })();
  const isAppHost = location.hostname === 'app.localhost' || location.protocol === 'tauri:';
  const isSteamMode = Boolean(
    window.GALLINGS_STEAM ||
    topWin.GALLINGS_STEAM ||
    isAppHost ||
    new URLSearchParams(location.search).get('steam') === '1' ||
    (() => { try { return new URLSearchParams(topWin.location.search).get('steam') === '1'; } catch (e) { return false; } })()
  );
  if (isSteamMode) {
    window.GALLINGS_STEAM = true;
    try { topWin.GALLINGS_STEAM = true; } catch (e) {}
  }

  const PROVIDER_DEFAULTS = {
    'openai-compat': { base_url: 'https://api.deepseek.com', model: 'deepseek-chat', label: 'OpenAI / DeepSeek' },
    'anthropic': { base_url: 'https://api.anthropic.com', model: 'claude-sonnet-4-20250514', label: 'Claude' },
    'gemini': { base_url: 'https://generativelanguage.googleapis.com', model: 'gemini-2.5-flash', label: 'Gemini' },
    'ollama': { base_url: 'http://127.0.0.1:11434', model: 'qwen2.5:7b', label: 'Ollama 本地' },
  };

  // ------------------------------------------------------------------ 1. 宿主探测与同步预热
  let hostAvailable = isAppHost;
  let hostSavesCache = null;
  let hostInfoCache = null;
  let llmConfigCache = {
    provider: 'openai-compat',
    base_url: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    api_key: '',
    has_key: false,
    key_tail: '',
    mode: 'choice',
    memory_use: 'lingshu',
    memory_active: 'gallings.memory.lingshu',
  };

  function syncGetJson(url) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      if (xhr.status >= 200 && xhr.status < 300 && xhr.responseText) {
        return JSON.parse(xhr.responseText);
      }
    } catch (e) {}
    return null;
  }

  function loadLocalLlmConfig() {
    try {
      const raw = localStorage.getItem('gallings.llm.config');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const k = String(parsed.api_key || '');
          llmConfigCache = Object.assign({}, llmConfigCache, parsed, {
            has_key: Boolean(k || parsed.has_key),
            key_tail: k.length >= 4 ? k.slice(-4) : (parsed.key_tail || (k ? '****' : '')),
          });
        }
      }
    } catch (e) {}
  }

  loadLocalLlmConfig();

  // 顶层窗口探测一次并缓存到 topWin.__GALLINGS_HOST_BOOT，内层 iframe 直接复用，避免重复同步请求
  if (isAppHost || isSteamMode) {
    let boot = null;
    try { boot = topWin.__GALLINGS_HOST_BOOT; } catch (e) {}
    if (!boot) {
      const info = syncGetJson('/__host/info');
      const sv = info && info.ok ? syncGetJson('/__host/saves') : null;
      const lc = info && info.ok ? syncGetJson('/__host/llm') : null;
      boot = { info, sv, lc };
      try { topWin.__GALLINGS_HOST_BOOT = boot; } catch (e) {}
    }
    if (boot.info && boot.info.ok) {
      hostAvailable = true;
      hostInfoCache = boot.info;
    }
    if (boot.sv && boot.sv.ok && boot.sv.data) {
      hostSavesCache = boot.sv.data;
      hydrateLocalStorageFromHost(boot.sv.data);
    }
    if (boot.lc && boot.lc.ok) {
      llmConfigCache = Object.assign({}, llmConfigCache, boot.lc);
      try { localStorage.setItem('gallings.llm.config', JSON.stringify(llmConfigCache)); } catch (e) {}
    }
  }

  // 若运行在完整 Python 后端下，异步拉取一次 /api/settings 同步多模型、灵枢记忆状态与工具链信息
  if (!window.GALLINGS_OFFLINE && !isAppHost && isTop) {
    fetch('/api/settings').then(r => r.ok ? r.json() : null).then(s => {
      if (!s || !s.llm) return;
      llmConfigCache = Object.assign({}, llmConfigCache, {
        provider: s.llm.provider || llmConfigCache.provider || 'openai-compat',
        base_url: s.llm.base_url || llmConfigCache.base_url,
        model: s.llm.model || llmConfigCache.model,
        has_key: Boolean(s.llm.key_set || llmConfigCache.api_key),
        key_tail: s.llm.key_tail || llmConfigCache.key_tail,
        memory_use: (s.memory && s.memory.use) || 'lingshu',
        memory_active: s.memory_active || '',
        tools_active: s.tools || [],
        backend_full: true,
      });
      try { localStorage.setItem('gallings.llm.config', JSON.stringify(llmConfigCache)); } catch (e) {}
    }).catch(() => {});
  }

  function hydrateLocalStorageFromHost(data) {
    if (!data || typeof data !== 'object') return;
    try {
      const pid = (window.VN_GAME && window.VN_GAME.id) || 'haifeng-pudding';
      const origSet = Storage.prototype.setItem;
      if (data.global && typeof data.global === 'object' && Object.keys(data.global).length) {
        const map = data.global._byKey || { ['vnglobal:' + pid]: data.global };
        for (const [k, v] of Object.entries(map)) {
          if (v && typeof v === 'object') origSet.call(localStorage, k, JSON.stringify(v));
        }
      }
      if (data.prefs && typeof data.prefs === 'object' && Object.keys(data.prefs).length) {
        const map = data.prefs._byKey || { ['vnprefs:' + pid]: data.prefs };
        for (const [k, v] of Object.entries(map)) {
          if (v && typeof v === 'object') origSet.call(localStorage, k, JSON.stringify(v));
        }
      }
      if (data.read && typeof data.read === 'object') {
        const map = data.read._byKey || (Array.isArray(data.read) ? { ['vnread:' + pid]: data.read } : {});
        for (const [k, v] of Object.entries(map)) {
          if (Array.isArray(v)) origSet.call(localStorage, k, JSON.stringify(v));
        }
      }
      if (data.plugins && typeof data.plugins === 'object') {
        const map = data.plugins._byKey || {};
        for (const [k, v] of Object.entries(map)) {
          origSet.call(localStorage, k, typeof v === 'string' ? v : JSON.stringify(v));
        }
      }
    } catch (e) {
      console.warn('[steam-host] 预热本地存档失败：', e);
    }
  }

  // ------------------------------------------------------------------ 2. 存档写穿同步（localStorage + IndexedDB -> /__host/saves）
  let saveFlushTimer = null;
  const pendingSavePatch = {};

  function queueHostSave(bucket, payload) {
    if (!hostAvailable) return;
    pendingSavePatch[bucket] = payload;
    clearTimeout(saveFlushTimer);
    saveFlushTimer = setTimeout(flushHostSave, 120);
  }

  function flushHostSave() {
    if (!hostAvailable || !Object.keys(pendingSavePatch).length) return;
    const body = Object.assign({}, pendingSavePatch);
    for (const k of Object.keys(pendingSavePatch)) delete pendingSavePatch[k];
    fetch('/__host/saves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
  }

  function collectPrefix(prefix) {
    const out = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          try { out[k] = JSON.parse(localStorage.getItem(k)); }
          catch (e) { out[k] = localStorage.getItem(k); }
        }
      }
    } catch (e) {}
    return { _byKey: out };
  }

  const origSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    origSetItem.call(this, k, v);
    if (this !== localStorage || !hostAvailable) return;
    const key = String(k || '');
    if (key.startsWith('vnglobal:')) queueHostSave('global', collectPrefix('vnglobal:'));
    else if (key.startsWith('vnprefs:')) queueHostSave('prefs', collectPrefix('vnprefs:'));
    else if (key.startsWith('vnread:')) queueHostSave('read', collectPrefix('vnread:'));
    else if (key.startsWith('vnplug:') || key.startsWith('vnplugkv:')) {
      const p1 = collectPrefix('vnplug:')._byKey;
      const p2 = collectPrefix('vnplugkv:')._byKey;
      queueHostSave('plugins', { _byKey: Object.assign({}, p1, p2) });
    }
  };

  // ------------------------------------------------------------------ 3. 原生窗口控制（全屏 / 退出 / 打开存档目录）
  async function hostWindowAction(action, extra = {}) {
    const payload = JSON.stringify(Object.assign({ action }, extra));
    // 若在 Tauri 壳里但加载的是 127.0.0.1 Python 完整后端，优先调用 app.localhost 的原生窗口控制
    if ((action === 'toggle_fullscreen' || action === 'quit') && isSteamMode && !isAppHost) {
      try {
        const r = await fetch('http://app.localhost/__host/window', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        });
        if (r.ok) return await r.json();
      } catch (e) {}
    }
    if (hostAvailable) {
      try {
        const r = await fetch('/__host/window', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        });
        if (r.ok) {
          const data = await r.json();
          if (data && data.ok) return data;
        }
      } catch (e) {}
    }
    if (action === 'toggle_fullscreen') {
      try {
        const doc = topWin.document || document;
        if (!doc.fullscreenElement) await doc.documentElement.requestFullscreen();
        else await doc.exitFullscreen();
        return { ok: true, fullscreen: Boolean(doc.fullscreenElement) };
      } catch (e) {}
    }
    if (action === 'quit') {
      try { topWin.close(); } catch (e) {}
    }
    return { ok: false };
  }

  // ------------------------------------------------------------------ 4. 游戏内多模型客户端（window.GallingsLLM）
  function normalizeEndpoint(baseUrl) {
    let u = String(baseUrl || '').trim().replace(/\/+$/, '');
    if (!u) return '';
    if (/\/chat\/completions$/i.test(u)) return u;
    if (/\/v\d+$/i.test(u)) return u + '/chat/completions';
    return u + '/v1/chat/completions';
  }

  const GallingsLLM = {
    isHostAvailable: () => hostAvailable,
    getHostInfo: () => hostInfoCache,
    getProviderDefaults: () => PROVIDER_DEFAULTS,
    getConfig() {
      if (topWin !== window && topWin.GallingsLLM && topWin.GallingsLLM !== this) {
        return topWin.GallingsLLM.getConfig();
      }
      return Object.assign({}, llmConfigCache);
    },
    isReady() {
      const c = this.getConfig();
      if (c.provider === 'ollama') return Boolean(c.base_url && c.model);
      return Boolean(c.base_url && c.model && (c.api_key || c.has_key));
    },
    async saveConfig(patch) {
      if (topWin !== window && topWin.GallingsLLM && topWin.GallingsLLM !== this) {
        const r = await topWin.GallingsLLM.saveConfig(patch);
        llmConfigCache = Object.assign({}, r);
        return r;
      }
      const next = Object.assign({}, llmConfigCache, patch || {});
      if (patch && typeof patch.api_key === 'string') {
        const trimmed = patch.api_key.trim();
        if (trimmed) {
          next.api_key = trimmed;
          next.has_key = true;
          next.key_tail = trimmed.length >= 4 ? trimmed.slice(-4) : '****';
        } else if (patch.clear_key) {
          next.api_key = '';
          next.has_key = false;
          next.key_tail = '';
        } else {
          next.api_key = llmConfigCache.api_key;
        }
      }
      llmConfigCache = next;
      try { localStorage.setItem('gallings.llm.config', JSON.stringify(llmConfigCache)); } catch (e) {}
      if (hostAvailable) {
        try {
          await fetch('/__host/llm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: llmConfigCache.provider || 'openai-compat',
              base_url: llmConfigCache.base_url,
              model: llmConfigCache.model,
              api_key: llmConfigCache.api_key,
              mode: llmConfigCache.mode,
              memory_use: llmConfigCache.memory_use || 'lingshu',
            }),
          });
        } catch (e) {}
      }
      // 若 Python 完整服务在线，同步更新 /api/settings 以热重启多模型插件与灵枢 MCP 记忆库
      if (!window.GALLINGS_OFFLINE && !isAppHost) {
        try {
          const settingsBody = {
            llm: {
              provider: llmConfigCache.provider || 'openai-compat',
              base_url: llmConfigCache.base_url,
              model: llmConfigCache.model,
            },
            memory: {
              use: llmConfigCache.memory_use || 'lingshu',
            },
          };
          if (patch && typeof patch.api_key === 'string') {
            if (patch.clear_key) settingsBody.llm.api_key = '';
            else if (patch.api_key.trim()) settingsBody.llm.api_key = patch.api_key.trim();
          }
          const sr = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settingsBody),
          });
          if (sr.ok) {
            const s = await sr.json();
            llmConfigCache.memory_active = s.memory_active || '';
            llmConfigCache.tools_active = s.tools || [];
            llmConfigCache.backend_full = true;
            if (s.llm) {
              llmConfigCache.has_key = Boolean(s.llm.key_set || llmConfigCache.api_key);
              llmConfigCache.key_tail = s.llm.key_tail || llmConfigCache.key_tail;
            }
          }
        } catch (e) {}
      }
      return Object.assign({}, llmConfigCache);
    },
    async complete({ messages, tools, json_mode, temperature, max_tokens, timeout = 25000 }) {
      const cfg = this.getConfig();
      const provider = cfg.provider || 'openai-compat';
      if (!cfg.base_url || !cfg.model || (provider !== 'ollama' && !cfg.api_key)) {
        return { ok: false, text: '', tool_calls: [], error: '尚未配置模型 API 密钥' };
      }

      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeout);
      try {
        if (provider === 'anthropic') {
          let base = String(cfg.base_url || 'https://api.anthropic.com').trim().replace(/\/+$/, '');
          const url = base.endsWith('/v1/messages') ? base : (base.endsWith('/v1') ? base + '/messages' : base + '/v1/messages');
          const sysParts = messages.filter(m => m.role === 'system').map(m => m.content);
          const chatMsgs = messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: String(m.content || ''),
          }));
          const body = { model: cfg.model, max_tokens: max_tokens || 1024, messages: chatMsgs };
          if (sysParts.length) body.system = sysParts.join('\n\n');
          if (temperature != null) body.temperature = temperature;
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': cfg.api_key,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(body),
            signal: ctl.signal,
          });
          if (!res.ok) {
            const errTxt = (await res.text().catch(() => '')).slice(0, 240);
            return { ok: false, text: '', tool_calls: [], error: `HTTP ${res.status}: ${errTxt || res.statusText}` };
          }
          const data = await res.json();
          const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text || '').join('');
          return { ok: true, text, tool_calls: [], error: '' };
        }

        if (provider === 'gemini') {
          let base = String(cfg.base_url || 'https://generativelanguage.googleapis.com').trim().replace(/\/+$/, '');
          if (!base.endsWith('/v1beta')) base += '/v1beta';
          const modelName = cfg.model.startsWith('models/') ? cfg.model : `models/${cfg.model}`;
          const url = `${base}/${modelName}:generateContent?key=${encodeURIComponent(cfg.api_key)}`;
          const sysParts = messages.filter(m => m.role === 'system').map(m => ({ text: String(m.content || '') }));
          const contents = messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: String(m.content || '') }],
          }));
          const body = { contents: contents.length ? contents : [{ role: 'user', parts: [{ text: '...' }] }] };
          if (sysParts.length) body.systemInstruction = { parts: sysParts };
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: ctl.signal,
          });
          if (!res.ok) {
            const errTxt = (await res.text().catch(() => '')).slice(0, 240);
            return { ok: false, text: '', tool_calls: [], error: `HTTP ${res.status}: ${errTxt || res.statusText}` };
          }
          const data = await res.json();
          const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
          const text = parts.map(p => p.text || '').join('');
          return { ok: true, text, tool_calls: [], error: '' };
        }

        const url = normalizeEndpoint(cfg.base_url);
        const body = {
          model: cfg.model,
          messages,
          stream: false,
        };
        if (temperature != null) body.temperature = temperature;
        if (max_tokens != null) body.max_tokens = max_tokens;
        if (json_mode) body.response_format = { type: 'json_object' };
        if (tools && tools.length) body.tools = tools;
        const headers = { 'Content-Type': 'application/json' };
        if (cfg.api_key) headers['Authorization'] = 'Bearer ' + cfg.api_key;

        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: ctl.signal,
        });
        if (!res.ok) {
          const errTxt = (await res.text().catch(() => '')).slice(0, 240);
          return { ok: false, text: '', tool_calls: [], error: `HTTP ${res.status}: ${errTxt || res.statusText}` };
        }
        const data = await res.json();
        const msg = (data.choices && data.choices[0] && data.choices[0].message) || {};
        const text = String(msg.content || '');
        const toolCalls = (msg.tool_calls || []).map((tc, i) => {
          let args = {};
          try { args = JSON.parse(tc.function?.arguments || '{}'); } catch (e) {}
          return {
            id: tc.id || ('call_' + i),
            name: tc.function?.name || '',
            arguments: args,
          };
        });
        return { ok: true, text, tool_calls: toolCalls, error: '' };
      } catch (e) {
        return { ok: false, text: '', tool_calls: [], error: String(e && e.message || e) };
      } finally {
        clearTimeout(timer);
      }
    },
    async stream({ messages, tools, temperature, signal, onText, onToolCall, timeout = 45000 }) {
      const cfg = this.getConfig();
      const provider = cfg.provider || 'openai-compat';
      if (provider === 'anthropic' || provider === 'gemini') {
        const r = await this.complete({ messages, tools, temperature, timeout });
        if (!r.ok) throw new Error(r.error || '模型请求失败');
        if (r.text && onText) onText(r.text);
        if (Array.isArray(r.tool_calls)) {
          for (const tc of r.tool_calls) {
            if (onToolCall) onToolCall(tc);
          }
        }
        return { ok: true, tool_calls: r.tool_calls || [] };
      }
      if (!cfg.base_url || !cfg.model || (provider !== 'ollama' && !cfg.api_key)) {
        throw new Error('尚未配置模型 API 密钥');
      }
      const url = normalizeEndpoint(cfg.base_url);
      const body = {
        model: cfg.model,
        messages,
        stream: true,
      };
      if (temperature != null) body.temperature = temperature;
      if (tools && tools.length) body.tools = tools;

      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeout);
      if (signal) signal.addEventListener('abort', () => ctl.abort(), { once: true });

      try {
        const headers = { 'Content-Type': 'application/json' };
        if (cfg.api_key) headers['Authorization'] = 'Bearer ' + cfg.api_key;
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: ctl.signal,
        });
        if (!res.ok || !res.body) {
          const errTxt = (await res.text().catch(() => '')).slice(0, 240);
          throw new Error(`HTTP ${res.status}: ${errTxt || res.statusText}`);
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        const tcMap = new Map();

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split(/\r?\n/);
          buf = lines.pop() || '';
          for (const raw of lines) {
            const line = raw.trim();
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            let chunk;
            try { chunk = JSON.parse(payload); } catch (e) { continue; }
            const delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
            if (!delta) continue;
            if (delta.reasoning_content && onText) {
              onText('<think>' + delta.reasoning_content + '</think>');
            }
            if (delta.content && onText) {
              onText(delta.content);
            }
            if (Array.isArray(delta.tool_calls)) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                const cur = tcMap.get(idx) || { id: tc.id || ('call_' + idx), name: '', argsRaw: '' };
                if (tc.id) cur.id = tc.id;
                if (tc.function?.name) cur.name += tc.function.name;
                if (tc.function?.arguments) cur.argsRaw += tc.function.arguments;
                tcMap.set(idx, cur);
              }
            }
          }
        }
        const toolCalls = [];
        for (const [, tc] of [...tcMap.entries()].sort((a, b) => a[0] - b[0])) {
          let args = {};
          try { args = JSON.parse(tc.argsRaw || '{}'); } catch (e) {}
          const call = { id: tc.id, name: tc.name, arguments: args };
          toolCalls.push(call);
          if (onToolCall) onToolCall(call);
        }
        return { ok: true, tool_calls: toolCalls };
      } finally {
        clearTimeout(timer);
      }
    },
    async test() {
      if (!window.GALLINGS_OFFLINE && !isAppHost) {
        try {
          const sr = await fetch('/api/settings/test', { method: 'POST' });
          if (sr.ok) {
            const r = await sr.json();
            if (r && typeof r.ok === 'boolean') return r;
          }
        } catch (e) {}
      }
      const r = await this.complete({
        messages: [{ role: 'user', content: '只回复两个字：在呢' }],
        max_tokens: 32,
        timeout: 15000,
      });
      if (!r.ok) return { ok: false, message: r.error || '连接失败' };
      return { ok: true, message: (r.text || '').trim().slice(0, 40) || '模型已响应' };
    },
    windowAction: hostWindowAction,
  };

  window.GallingsLLM = GallingsLLM;
  try { if (!topWin.GallingsLLM) topWin.GallingsLLM = GallingsLLM; } catch (e) {}

  // ------------------------------------------------------------------ 5. 外框（vn.html）纯净模式与快捷键
  function setupOuterShell() {
    if (!document.body || !document.body.classList.contains('vnpage')) return false;
    const style = document.createElement('style');
    style.id = 'steam-pure-css';
    style.textContent = `
      body.vnpage.steam-pure:not(.steam-debug) .topbar { display: none !important; }
      body.vnpage.steam-pure:not(.steam-debug) .stage { background: #000 !important; }
      body.vnpage.steam-pure:not(.steam-debug) #screen {
        position: fixed !important; inset: 0 !important;
        width: 100vw !important; height: 100vh !important;
        left: 0 !important; top: 0 !important;
        aspect-ratio: auto !important; box-shadow: none !important; border-radius: 0 !important;
      }
      .steam-debug-toast {
        position: fixed; right: 16px; bottom: 16px; z-index: 9999;
        background: rgba(16, 27, 32, 0.92); color: #edf0e4; border: 1px solid #aec6bb55;
        padding: 8px 14px; border-radius: 10px; font-size: 13px; pointer-events: none;
        transition: opacity .25s ease;
      }
    `;
    document.head.appendChild(style);
    if (isSteamMode) document.body.classList.add('steam-pure');

    // 把 steam-host.js 自动注入到游戏 iframe 里，无需改作品源文件也能生效
    const gameFrame = document.getElementById('game');
    if (gameFrame) {
      gameFrame.addEventListener('load', () => {
        try {
          const cw = gameFrame.contentWindow, cd = gameFrame.contentDocument;
          if (!cw || !cd || cw.__GALLINGS_STEAM_HOST_LOADED) return;
          cw.GALLINGS_STEAM = window.GALLINGS_STEAM;
          cw.GALLINGS_OFFLINE = window.GALLINGS_OFFLINE;
          cw.GallingsLLM = window.GallingsLLM;
          const s = cd.createElement('script');
          s.src = '/static/offline/steam-host.js';
          cd.head.appendChild(s);
        } catch (e) {}
      });
    }
    return true;
  }

  function bindGlobalHotkeys() {
    if (isSteamMode || hostAvailable) {
      window.addEventListener('contextmenu', e => {
        if (e.target && e.target.closest && e.target.closest('input, textarea')) return;
        e.preventDefault();
        try {
          const cg = document.getElementById('cgview');
          if (cg && cg.classList.contains('show')) { cg.classList.remove('show'); return; }
          const ovl = document.querySelector('.ovl.show:not(#title)');
          if (ovl) {
            const closeBtn = ovl.querySelector('.ovx');
            if (closeBtn) closeBtn.click();
            else ovl.classList.remove('show');
            return;
          }
          const title = document.getElementById('title');
          const stage = document.getElementById('stage');
          if (stage && (!title || !title.classList.contains('show')) && typeof window.setHideUI === 'function') {
            window.setHideUI(!stage.classList.contains('hideui'));
          }
        } catch (err) {}
      });
    }
    window.addEventListener('keydown', e => {
      if ((isSteamMode || hostAvailable) && (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && ['r', 'R', 's', 'S', 'p', 'P', 'u', 'U'].includes(e.key)))) {
        e.preventDefault();
        return;
      }
      if (e.key === 'F11' || (e.altKey && e.key === 'Enter')) {
        e.preventDefault();
        hostWindowAction('toggle_fullscreen');
      } else if (e.key === 'F10' || (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd'))) {
        try {
          const b = topWin.document.body;
          if (b && b.classList.contains('steam-pure')) {
            e.preventDefault();
            const debugOn = b.classList.toggle('steam-debug');
            topWin.dispatchEvent(new Event('resize'));
            let toast = topWin.document.querySelector('.steam-debug-toast');
            if (!toast) {
              toast = topWin.document.createElement('div');
              toast.className = 'steam-debug-toast';
              topWin.document.body.appendChild(toast);
            }
            toast.textContent = debugOn ? '已展开调试顶栏与引擎时间轴（按 F10 隐藏）' : '已回到纯净游戏画面（按 F10 呼出调试栏）';
            toast.style.opacity = '1';
            clearTimeout(toast._t);
            toast._t = setTimeout(() => { toast.style.opacity = '0'; }, 2200);
          }
        } catch (err) {}
      }
    });
  }

  bindGlobalHotkeys();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupOuterShell, { once: true });
  } else {
    setupOuterShell();
  }

  // ------------------------------------------------------------------ 6. 作品内页（index.html）增强：存档同步、设置面板、手账大脑、退出按钮
  function hookGameInnerPage() {
    if (typeof window.showTitle !== 'function' || typeof window.showPrefs !== 'function' || (!window.VN_GAME && !window.VNPlugins)) return false;
    if (window.__GALLINGS_GAME_HOOKED) return true;
    window.__GALLINGS_GAME_HOOKED = true;

    // 6.1 若有宿主存档，确保 G / PREF / READ 立即可用，并拦截 idbGet / idbSet
    if (hostSavesCache) {
      hydrateLocalStorageFromHost(hostSavesCache);
      try { if (typeof window.loadG === 'function') { window.G = null; window.loadG(); } } catch (e) {}
      try { if (typeof window.loadPrefs === 'function') window.loadPrefs(); } catch (e) {}
      try { if (typeof window.loadRead === 'function') window.loadRead(); } catch (e) {}
    }

    const origIdbGet = window.idbGet;
    const origIdbSet = window.idbSet;
    if (typeof origIdbGet === 'function' && typeof origIdbSet === 'function') {
      window.idbGet = async function (k) {
        const res = await origIdbGet.call(this, k);
        if (hostAvailable && String(k || '').startsWith('saves:')) {
          const hostSlots = hostSavesCache && hostSavesCache.slots;
          const hasLocal = res && typeof res === 'object' && Object.keys(res).length > 0;
          const hasHost = hostSlots && typeof hostSlots === 'object' && Object.keys(hostSlots).length > 0;
          if (!hasLocal && hasHost) {
            await origIdbSet.call(this, k, hostSlots);
            return JSON.parse(JSON.stringify(hostSlots));
          }
          if (hasLocal && !hasHost) {
            queueHostSave('slots', res);
          }
        }
        return res;
      };
      window.idbSet = async function (k, v) {
        const ok = await origIdbSet.call(this, k, v);
        if (hostAvailable && String(k || '').startsWith('saves:') && v && typeof v === 'object') {
          if (!hostSavesCache) hostSavesCache = {};
          hostSavesCache.slots = JSON.parse(JSON.stringify(v));
          queueHostSave('slots', hostSavesCache.slots);
        }
        return ok;
      };
    }

    // 6.2 同步 galcore 插件的 mode 设置（纯选项 / AI 模式）
    function syncGalcoreMode(mode) {
      try {
        if (window.VNPlugins && typeof window.VNPlugins.setSetting === 'function') {
          window.VNPlugins.setSetting('gallings.galcore', 'mode', mode);
        }
        if (window.GalcoreLocal && window.GalcoreLocal.last) {
          window.GalcoreLocal.last.handle({ type: 'mode', mode });
        }
      } catch (e) {}
    }
    if (llmConfigCache.mode) syncGalcoreMode(llmConfigCache.mode);

    // 6.3 注入设置面板样式与“桌面与 AI 设置”分组
    const css = document.createElement('style');
    css.id = 'steam-game-settings-css';
    css.textContent = `
      #psettings .steam-sec-inp {
        flex: 1; max-width: 360px; height: 34px; padding: 0 12px; border-radius: 8px;
        border: 1px solid #ffffff33; background: #0c1420cc; color: #f3f6fb; font: inherit; font-size: 15px;
      }
      #psettings .steam-sec-inp:focus { outline: none; border-color: var(--acc, #7aa2ff); }
      #psettings .steam-sec-status { font-size: 13px; color: #a9c4d8; margin-left: 8px; }
      #psettings .steam-sec-status.ok { color: #7ee0a1; }
      #psettings .steam-sec-status.bad { color: #ff9a9a; }
    `;
    document.head.appendChild(css);

    const origShowPrefs = window.showPrefs;
    window.showPrefs = function (...args) {
      const r = origShowPrefs.apply(this, args);
      try {
        const box = document.getElementById('psettings');
        if (isSteamMode || hostAvailable) {
          const soulDot = box && box.querySelector('#soulDot');
          if (soulDot && soulDot.closest('.row')) soulDot.closest('.row').style.display = 'none';
        }
        const rows = box && box.querySelector('.rows');
        if (!rows || rows.querySelector('[data-steam-sec]')) return r;
        const cfg = GallingsLLM.getConfig();
        let curProvider = cfg.provider || 'openai-compat';
        let curMem = cfg.memory_use || 'lingshu';
        const curMode = (window.VNPlugins?.getSetting?.('gallings.galcore', 'mode')) || cfg.mode || 'choice';
        const saveDir = hostInfoCache?.save_dir || '';
        const isFullBackend = !window.GALLINGS_OFFLINE && !isAppHost;
        const sec = document.createElement('div');
        sec.id = 'steamAiSec';
        sec.dataset.steamSec = '1';
        sec.innerHTML = `
          <div class="row sep"><span>画面与存档</span><small class="dim">${hostAvailable ? 'Steam 云存档目录已连接' : '浏览器存储'}${isFullBackend ? ' · 灵枢完整后端已启用' : ''}</small></div>
          <div class="row">
            <span>显示模式</span>
            <div class="seg">
              <button type="button" class="tg" data-st-win="toggle">切换全屏 / 窗口 (F11)</button>
              ${isSteamMode ? '<button type="button" class="tg" data-st-win="debug">调试时间轴 (F10)</button>' : ''}
            </div>
          </div>
          ${hostAvailable ? `<div class="row">
            <span>本地存档</span>
            <button type="button" class="tg" data-st-win="savedir">打开存档文件夹</button>
            <small class="dim" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:280px" title="${saveDir.replace(/"/g, '&quot;')}">${saveDir}</small>
          </div>` : ''}
          <div class="row sep"><span>灵枢记忆与多模型 AI 导演</span><small class="dim">不填密钥也可完整游玩全部剧情；填密钥后解锁自由输入、灵枢 MCP 记忆与 GalAgent 工具链</small></div>
          <div class="row">
            <span>剧情选项模式</span>
            <div class="seg">
              <button type="button" class="tg ${curMode !== 'ai' ? 'on' : ''}" data-st-mode="choice">纯选项（原著体验）</button>
              <button type="button" class="tg ${curMode === 'ai' ? 'on' : ''}" data-st-mode="ai">AI 模式（选项点可“自己说”）</button>
            </div>
          </div>
          <div class="row">
            <span>记忆底座</span>
            <div class="seg">
              <button type="button" class="tg ${curMem === 'lingshu' ? 'on' : ''}" data-st-mem="lingshu">灵枢认知图 (MCP)</button>
              <button type="button" class="tg ${curMem !== 'lingshu' ? 'on' : ''}" data-st-mem="local">本地轻量记忆</button>
            </div>
          </div>
          <div class="row">
            <span>模型厂商协议</span>
            <div class="seg">
              <button type="button" class="tg ${curProvider === 'openai-compat' ? 'on' : ''}" data-st-prov="openai-compat">OpenAI / DeepSeek</button>
              <button type="button" class="tg ${curProvider === 'anthropic' ? 'on' : ''}" data-st-prov="anthropic">Claude</button>
              <button type="button" class="tg ${curProvider === 'gemini' ? 'on' : ''}" data-st-prov="gemini">Gemini</button>
              <button type="button" class="tg ${curProvider === 'ollama' ? 'on' : ''}" data-st-prov="ollama">Ollama 本地</button>
            </div>
          </div>
          <div class="row">
            <span>模型服务地址</span>
            <input class="steam-sec-inp" id="stLlmBase" spellcheck="false" value="${(cfg.base_url || 'https://api.deepseek.com').replace(/"/g, '&quot;')}" placeholder="https://api.deepseek.com">
          </div>
          <div class="row">
            <span>模型名称</span>
            <input class="steam-sec-inp" id="stLlmModel" spellcheck="false" value="${(cfg.model || 'deepseek-chat').replace(/"/g, '&quot;')}" placeholder="deepseek-chat">
          </div>
          <div class="row">
            <span>API 密钥</span>
            <input class="steam-sec-inp" id="stLlmKey" type="password" autocomplete="off" spellcheck="false" placeholder="${curProvider === 'ollama' ? 'Ollama 本地无需密钥（可选）' : cfg.has_key ? '已保存（末 4 位 ' + (cfg.key_tail || '****') + '），留空不改' : '填入对应厂商的 API Key'}">
          </div>
          <div class="row">
            <span>连接操作</span>
            <div class="seg">
              <button type="button" class="tg on" id="stLlmSave">保存模型设置</button>
              <button type="button" class="tg" id="stLlmTest">测试模型</button>
              ${cfg.has_key ? '<button type="button" class="tg" id="stLlmClear">清除密钥</button>' : ''}
            </div>
            <span class="steam-sec-status ${ GallingsLLM.isReady() ? 'ok' : '' }" id="stLlmOut">${GallingsLLM.isReady() ? '● 模型已就绪' : '○ 当前使用内置离线回复'}</span>
          </div>
        `;
        rows.appendChild(sec);

        sec.querySelectorAll('input').forEach(inp => {
          inp.addEventListener('keydown', ev => ev.stopPropagation());
          inp.addEventListener('click', ev => ev.stopPropagation());
        });

        sec.querySelectorAll('[data-st-win]').forEach(btn => {
          btn.onclick = ev => {
            ev.stopPropagation();
            const act = btn.dataset.stWin;
            if (act === 'toggle') hostWindowAction('toggle_fullscreen');
            else if (act === 'savedir') hostWindowAction('open_save_dir');
            else if (act === 'debug') {
              try {
                const b = topWin.document.body;
                if (b) { b.classList.toggle('steam-debug'); topWin.dispatchEvent(new Event('resize')); }
              } catch (e) {}
            }
          };
        });

        sec.querySelectorAll('[data-st-mode]').forEach(btn => {
          btn.onclick = async ev => {
            ev.stopPropagation();
            const mode = btn.dataset.stMode;
            sec.querySelectorAll('[data-st-mode]').forEach(x => x.classList.toggle('on', x === btn));
            await GallingsLLM.saveConfig({ mode });
            syncGalcoreMode(mode);
          };
        });

        sec.querySelectorAll('[data-st-mem]').forEach(btn => {
          btn.onclick = async ev => {
            ev.stopPropagation();
            curMem = btn.dataset.stMem;
            sec.querySelectorAll('[data-st-mem]').forEach(x => x.classList.toggle('on', x === btn));
            await GallingsLLM.saveConfig({ memory_use: curMem });
          };
        });

        sec.querySelectorAll('[data-st-prov]').forEach(btn => {
          btn.onclick = ev => {
            ev.stopPropagation();
            curProvider = btn.dataset.stProv;
            sec.querySelectorAll('[data-st-prov]').forEach(x => x.classList.toggle('on', x === btn));
            const d = PROVIDER_DEFAULTS[curProvider] || PROVIDER_DEFAULTS['openai-compat'];
            const baseInp = sec.querySelector('#stLlmBase');
            const modelInp = sec.querySelector('#stLlmModel');
            const keyInp = sec.querySelector('#stLlmKey');
            const knownBases = new Set(Object.values(PROVIDER_DEFAULTS).map(x => x.base_url));
            const knownModels = new Set(Object.values(PROVIDER_DEFAULTS).map(x => x.model));
            baseInp.placeholder = d.base_url;
            modelInp.placeholder = d.model;
            if (!baseInp.value.trim() || knownBases.has(baseInp.value.trim())) baseInp.value = d.base_url;
            if (!modelInp.value.trim() || knownModels.has(modelInp.value.trim())) modelInp.value = d.model;
            keyInp.placeholder = curProvider === 'ollama'
              ? 'Ollama 本地无需密钥（可选）'
              : (GallingsLLM.getConfig().has_key ? `已保存（末 4 位 ${GallingsLLM.getConfig().key_tail || '****'}），留空不改` : '填入对应厂商的 API Key');
          };
        });

        const outEl = sec.querySelector('#stLlmOut');
        const saveInputs = async (clearKey = false) => {
          const d = PROVIDER_DEFAULTS[curProvider] || PROVIDER_DEFAULTS['openai-compat'];
          const base_url = sec.querySelector('#stLlmBase').value.trim() || d.base_url;
          const model = sec.querySelector('#stLlmModel').value.trim() || d.model;
          const api_key = clearKey ? '' : sec.querySelector('#stLlmKey').value.trim();
          const saved = await GallingsLLM.saveConfig({
            provider: curProvider,
            memory_use: curMem,
            base_url,
            model,
            api_key,
            clear_key: clearKey,
          });
          sec.querySelector('#stLlmKey').value = '';
          sec.querySelector('#stLlmKey').placeholder = curProvider === 'ollama'
            ? 'Ollama 本地无需密钥（可选）'
            : saved.has_key
              ? `已保存（末 4 位 ${saved.key_tail || '****'}），留空不改`
              : '填入对应厂商的 API Key';
          outEl.className = 'steam-sec-status ' + (GallingsLLM.isReady() ? 'ok' : '');
          outEl.textContent = GallingsLLM.isReady() ? '● 已保存（模型与记忆已就绪）' : '○ 已保存（当前使用内置离线回复）';
        };

        sec.querySelector('#stLlmSave').onclick = async ev => {
          ev.stopPropagation();
          await saveInputs(false);
        };
        sec.querySelector('#stLlmTest').onclick = async ev => {
          ev.stopPropagation();
          await saveInputs(false);
          outEl.className = 'steam-sec-status';
          outEl.textContent = '正在连接模型……';
          const res = await GallingsLLM.test();
          outEl.className = 'steam-sec-status ' + (res.ok ? 'ok' : 'bad');
          outEl.textContent = (res.ok ? '✓ 连通：' : '✕ 失败：') + res.message;
        };
        const clrBtn = sec.querySelector('#stLlmClear');
        if (clrBtn) {
          clrBtn.onclick = async ev => {
            ev.stopPropagation();
            await saveInputs(true);
          };
        }
      } catch (e) {
        console.warn('[steam-host] 渲染设置项失败：', e);
      }
      return r;
    };

    // 6.4 标题画面正式版增强：隐藏开发者“插件”按钮、增加“继续游戏”与“退出游戏”按钮
    function enhanceTitleMenu() {
      if (!(isSteamMode || hostAvailable)) return;
      try {
        const menu = document.querySelector('#title .menu');
        if (!menu) return;
        const plgBtn = menu.querySelector('[data-t="plg"]');
        if (plgBtn) plgBtn.style.display = 'none';
        if (!menu.querySelector('[data-t="quit"]')) {
          const qb = document.createElement('button');
          qb.dataset.t = 'quit';
          qb.textContent = '退出游戏';
          qb.onclick = ev => {
            ev.stopPropagation();
            hostWindowAction('quit');
          };
          menu.appendChild(qb);
        }
        const startBtn = menu.querySelector('[data-t="start"]');
        if (startBtn && !menu.querySelector('[data-t="continue"]') && typeof window.idbGet === 'function') {
          const pid = window.VN_GAME?.id || '';
          window.idbGet('saves:' + pid).then(saves => {
            if (!saves || typeof saves !== 'object') return;
            const latest = Object.values(saves).filter(s => s && s.time).sort((a, b) => b.time - a.time)[0];
            if (!latest || menu.querySelector('[data-t="continue"]')) return;
            const cb = document.createElement('button');
            cb.dataset.t = 'continue';
            cb.textContent = '继续游戏';
            cb.onclick = ev => {
              ev.stopPropagation();
              const lines = window.VN_GAME?.lines || [];
              const byId = lines.findIndex(x => x.id === latest.lineId);
              if (typeof window.startPlay === 'function') window.startPlay(byId >= 0 ? byId : latest.idx, latest);
            };
            startBtn.insertAdjacentElement('afterend', cb);
          }).catch(() => {});
        }
      } catch (e) {}
    }

    const origShowTitle = window.showTitle;
    window.showTitle = function (...args) {
      const r = origShowTitle.apply(this, args);
      enhanceTitleMenu();
      return r;
    };
    if (document.querySelector('#title.show')) {
      enhanceTitleMenu();
    }

    // 6.5 灵枢手账（SOUL_BRAINS.galLingS）离线兜底大模型增强
    // 当运行在纯离线模式（没有 Python /ws/soul 服务）时：若配了 GallingsLLM 则直接调大模型回复悄悄话，否则立即走本地回复
    const isOfflineMode = Boolean(window.GALLINGS_OFFLINE || topWin.GALLINGS_OFFLINE);
    if (isOfflineMode && window.SOUL_BRAINS && window.SOUL_BRAINS.galLingS) {
      const localBrain = window.SOUL_BRAINS.local;
      window.SOUL_BRAINS.galLingS.remember = function (ev) {
        return localBrain && typeof localBrain.remember === 'function' ? localBrain.remember(ev) : undefined;
      };
      window.SOUL_BRAINS.galLingS.whisper = async function (req) {
        if (GallingsLLM.isReady()) {
          try {
            const charName = req.char || '鲸鱼小姐';
            const proj = window.VN_GAME || {};
            const chObj = (Array.isArray(proj.chars) && proj.chars.find(c => c.name === charName)) || {};
            const memLines = (req.memory || []).slice(-10).map(m => `- ${m.t || m.src || ''}`).join('\n');
            const talkHint = req.talk === 'short' ? '只回简短一句话（20字以内）。' : req.talk === 'long' ? '可以多写两句，带一点小动作描写（60字以内）。' : '回复一两句话（40字以内）。';
            const sys = [
              `你是《海风与布丁》里的「${charName}」，正在手账的「悄悄话」纸页上用钢笔回复玩家写给你的话。`,
              chObj.persona || '口吻傲娇、嘴硬心软，自称“本小姐”，称呼对方“人类”，喜欢双倍焦糖布丁，尾巴会暴露真实心情。',
              memLines ? `你们在这条时间线上的共同记忆：\n${memLines}` : '',
              `要求：保持手账便签上的口吻，${talkHint} 可以在开头用【害羞】【得意】【柔和】【生气】【坏笑】之一标出表情，然后直接写回复正文。`,
            ].filter(Boolean).join('\n\n');
            const msgs = [{ role: 'system', content: sys }];
            for (const h of (req.history || []).slice(-6)) {
              msgs.push({ role: h.me ? 'user' : 'assistant', content: String(h.t || '') });
            }
            msgs.push({ role: 'user', content: String(req.input || '') });
            const r = await GallingsLLM.complete({ messages: msgs, temperature: 0.7, max_tokens: 160, timeout: 20000 });
            if (r.ok && r.text) {
              let txt = r.text.trim();
              let emo = '';
              const m = txt.match(/^[【\[]([^\]】]{1,6})[】\]]\s*/);
              if (m) { emo = m[1]; txt = txt.slice(m[0].length).trim(); }
              if (txt) return { text: txt, emotion: emo, src: 'llm' };
            }
          } catch (e) {}
        }
        return Object.assign(await localBrain.whisper(req), { src: 'local' });
      };
    }

    return true;
  }

  if (!hookGameInnerPage()) {
    const t = setInterval(() => {
      if (hookGameInnerPage()) clearInterval(t);
    }, 50);
    setTimeout(() => clearInterval(t), 15000);
  }
})();
