  /* ================================================================ VN Studio 插件部分 */
  const KEY_EVENTS = ['turn_start', 'round_start', 'say_delta', 'round_end', 'step_start', 'think_delta', 'step_end', 'tool_start', 'approval_required', 'approval_resolved', 'tool_end'];
  const plain = s => String(s || '').replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/`([^`\n]+)`/g, '$1');

  VNPlugin.define({
    id: 'gallings.galagent',
    name: 'GalAgent',
    version: '0.3.0',
    api: 1,
    author: 'galLingS',
    icon: 'bot',
    homepage: 'https://github.com/Liyang1145/galLingS',
    description: '结局后和角色继续聊天；剧情里的 @agent 也能让角色调用工具帮你做事。思考和工具步骤收在名字牌旁的胶囊里，点开铺满画面。',
    permissions: ['network', 'agent', 'script', 'vars', 'tools'],
    settings: [
      { key: 'url', label: '后端地址', type: 'text', placeholder: '留空 = 离线模拟；ws://127.0.0.1:8765/ws/post_ending', help: '在 galLingS 作品页里玩时留空即可，自动连同一个 galLingS。' },
      { key: 'token', label: '令牌', type: 'password', local: true, placeholder: '双击打开（file://）时必填', help: '见 galLingS 启动日志或 ~/.gallings/post_ending_token.txt。只存在这台电脑上。' },
      { key: 'char', label: '结局后聊天', type: 'char', allowEmpty: '（自动：@postchat 或手账角色）', default: '' },
      { key: 'tools', label: '后端工具', type: 'bool', default: true, help: '允许角色用 powershell、读写文件等（危险操作仍会先问你）。' },
      { key: 'autoAsk', label: '确认时展开', type: 'bool', default: true, help: '角色要做需要你确认的事时，自动展开工作流程面板。' },
    ],
    actions: [{ id: 'dev', label: '调试台', icon: 'stethoscope', when: 'editor', run: vn => openDev(vn) }],

    setup(vn) {
      const GA = loadLib();
      const S = k => vn.settings.get(k);
      const defUrl = () => vn.engine.hosted ? (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/ws/post_ending' : '';
      const url = () => {
        let u = String(S('url') || '').trim() || defUrl(); if (!u) return '';
        const card = vn.project.soul()?.card; if (card && !/[?&]card=/.test(u)) u += (u.includes('?') ? '&' : '?') + 'card=' + encodeURIComponent(card);
        return u;
      };
      const charInfo = name => { const c = vn.chars.get(name) || { name, persona: '' }; return { name: c.name, persona: c.persona, expressions: vn.chars.expressions(name), avatar: vn.chars.avatar(name) }; };

      /* —— 前端工具：在玩家浏览器里执行。别的插件可以 vn.require('gallings.galagent').addClientTool({...}) 再加 —— */
      const clientTools = [
        { name: 'get_vars', effect: 'read', description: '读取当前所有游戏变量的值', parameters: { type: 'object', properties: {} }, handler: () => vn.vars.all() },
        { name: 'set_var', effect: 'perform', description: '修改一个游戏变量（只能改项目里定义过的变量），例如好感度',
          parameters: { type: 'object', required: ['name', 'value'], properties: { name: { type: 'string' }, value: { description: '新值，数字或文字' } } },
          handler: ({ name, value }) => ({ [name]: vn.vars.set(name, value) }) },
        { name: 'play_se', effect: 'perform', description: '播放一个音效素材（给玩家一点小惊喜）',
          parameters: { type: 'object', required: ['name'], properties: { name: { type: 'string', description: '音效名字' } } },
          handler: ({ name }) => { try { vn.audio.se(name); } catch (e) { throw new Error('没有这个音效，可用：' + vn.audio.list().join('、')); } return { played: name }; } },
      ];
      let dock = null;
      const newClient = o => {
        const opts = Object.assign({ url: url(), token: S('token'), clientTools }, o);
        return !opts.url || opts.mock ? new GA.MockClient(opts) : new GA.Client(opts);
      };
      Object.assign(vn.exports, {
        GalAgent: GA, clientTools, newClient, charInfo,
        addClientTool(t) { clientTools.push(t); return () => { const i = clientTools.indexOf(t); if (i >= 0) clientTools.splice(i, 1); }; },
        get dock() { return dock; },
      });

      /* —— 胶囊 + 工作流程面板：挂在 VN Studio 自己的对话框上 —— */
      const ensureDock = who => {
        if (!dock) dock = new GA.WorkDock(vn.ui.stage, {
          pillParent: vn.ui.el('dialog'), who, autoOpenOnAsk: S('autoAsk') !== false,
          onApprove: (id, a, r) => vn.chat.current?._ga?.client.approve(id, a, r),
          onSay: t => { const c = vn.chat.current; if (c && c.busy) vn.ui.el('text').textContent = plain(t); },   // 中途台词先显示在对话框
          placePill: p => { const n = vn.ui.el('name'); p.style.left = (n.textContent ? n.offsetLeft + n.offsetWidth + 14 : 28) + 'px'; },
        });
        dock.o.who = who; return dock;
      };
      const closeChat = chat => {
        if (chat && chat._ga) { chat._ga.client.close(); chat._ga = null; }
        if (dock) { dock.destroy(); dock = null; }
      };
      vn.on('chat:end', closeChat);
      vn.on('stop', () => closeChat(vn.chat.current));

      /* —— 大脑 galagent：剧情 @agent（设置里选 GalAgent）和结局后聊天都走它 —— */
      vn.agent.register('galagent', 'GalAgent', async (req, settings, C) => {
        const who = req.character.name;
        if (!C) throw new Error('没有对话');
        if (!C._ga) {
          const ctx = C.post ? C.ctx : { goal: req.scene.goal, story: req.scene.setup, vars: req.vars };
          const client = newClient({ character: charInfo(who), context: ctx, server_tools: C.serverTools ?? (S('tools') !== false) });
          C._ga = { client }; ensureDock(who);
          KEY_EVENTS.forEach(t => client.on(t, m => { if (vn.chat.current === C && dock) dock.feed(m); }));
          await client.connect();
        }
        const client = C._ga.client;
        return new Promise(resolve => {
          let emo = '', said = '';
          const finish = m => {
            offs.forEach(f => f()); if (dock) dock.feed(m);
            resolve({ text: plain(m.reply || m.error || said || (m.stopped ? '（被打断了）' : '……')), emotion: emo, set: '', end: false });
          };
          const offs = [
            client.on('say_delta', m => { said += m.text; }),
            client.on('round_start', () => { said = ''; }),
            client.on('emotion', m => { emo = m.name; vn.chars.setEmotion(who, m.name); }),
            client.on('error', m => { if (m.fatal) finish({ type: 'turn_end', error: m.message }); else said = said || '（' + m.message + '）'; }),
            client.on('close', () => finish({ type: 'turn_end', error: '连接已断开，请退出聊天后重试。' })),
            client.on('turn_end', finish),
          ];
          if (client.ready) client.send(req.input);
          else finish({ type: 'turn_end', error: '连接已断开，请退出聊天后重试。' });
        });
      });

      /* —— 剧本命令 @postchat 角色 [auto=on] [tools=off] goal=聊天方向；@postchat off —— */
      vn.script.command('postchat', {
        parse(arg, { kv, err }) {
          const gi = arg.indexOf('goal='), head = gi >= 0 ? arg.slice(0, gi) : arg, o = kv(head), ch = head.trim().split(/\s+/)[0];
          if (!ch) err('写法：@postchat 角色 [auto=on] [tools=off] goal=聊天方向；@postchat off 关闭');
          const d = vn.data.get();
          d.postChat = ch === 'off' || ch === 'none' ? { off: true } : { char: ch, auto: o.auto === 'on', tools: o.tools !== 'off', goal: gi >= 0 ? arg.slice(gi + 5).trim() : '' };
          vn.data.set(d);
        },
        export() {
          const pc = vn.data.get().postChat; if (!pc) return null;
          if (pc.off) return '@postchat off';
          return `@postchat ${pc.char}` + (pc.auto ? ' auto=on' : '') + (pc.tools === false ? ' tools=off' : '') + (pc.goal ? ' goal=' + pc.goal : '');
        },
      });
      vn.api.op('postchat', c => {
        const d = vn.data.get();
        d.postChat = !c.char || c.char === 'off' ? { off: true } : { char: String(c.char), auto: !!c.auto && c.auto !== 'off', tools: c.tools !== false && c.tools !== 'off', goal: String(c.goal || ''), greeting: String(c.greeting || '') };
        vn.data.set(d); return d.postChat;
      });
      vn.check(() => {
        const pc = postCfg(); const out = [];
        if (pc.char && !vn.chars.get(pc.char)) out.push([0, 'GalAgent：结局后聊天的角色不存在：' + pc.char]);
        return out;
      });

      /* —— 结局后聊天：结局卡“和 X 聊聊”→ 回到画面，用对话框继续聊（不限回合；⏹ 回结局卡） —— */
      function postCfg() {
        const pc = vn.data.get().postChat || {};
        if (pc.off) return {};
        const char = S('char') || pc.char || vn.project.soul()?.char || '';
        return Object.assign({ tools: true }, pc, { char });
      }
      function openPostChat(ending) {
        const pc = postCfg(); if (!pc.char) return;
        vn.ui.endingCard.hide();
        vn.chat.start({
          char: pc.char, goal: pc.goal || '', provider: 'galagent', turns: 9999,
          greeting: pc.greeting || '……', placeholder: `说点什么，或者请${pc.char}帮你做点事…`,
          onExit: () => { vn.ui.el('input').placeholder = ''; vn.ui.endingCard.show(); },
          extra: { post: true, endingName: ending, serverTools: pc.tools !== false && S('tools') !== false,
            ctx: { ending, goal: pc.goal || '', vars: vn.vars.all(), story: vn.story.backlog(12).map(b => (b.speaker ? b.speaker + '：' : '') + b.text).join('\n') } },
        });
      }
      vn.ui.addEndingButton({ primary: true, icon: 'message-square-text', label: () => `和${postCfg().char}聊聊`, show: () => !!postCfg().char, onClick: openPostChat });
      vn.on('ending', ({ name }) => {
        const pc = postCfg();
        if (pc.char && pc.auto) setTimeout(() => { if (vn.ui.el('endcard').classList.contains('show')) openPostChat(name); }, 1200);
      });
      vn.exports.openPostChat = openPostChat;

      return () => {   // 停用 / 卸载：收干净
        closeChat(vn.chat.current);
        document.getElementById('galagent-css')?.remove();
        document.getElementById('gaDev')?.remove();
        if (window.GalAgent === GA) delete window.GalAgent;
      };
    },
  });

  /* —— 调试台（编辑器）：不跑剧情直接和角色聊，看后端给了哪些工具 —— */
  function openDev(vn) {
    const X = vn.exports, GA = X.GalAgent;
    let ov = document.getElementById('gaDev'); if (ov) ov.remove();
    ov = document.createElement('div'); ov.id = 'gaDev';
    const chars = vn.project.chars().map(c => c.name), esc = vn.ui.esc;
    const pcChar = vn.settings.get('char') || vn.data.get().postChat?.char || vn.project.soul()?.char || '';
    if (!document.getElementById('gaDevCss')) { const st = document.createElement('style'); st.id = 'gaDevCss'; st.textContent = DEV_CSS; document.head.appendChild(st); }
    ov.innerHTML = `<div class="gd-side"><h3>${vn.ui.icon('bot')} GalAgent 调试台</h3>
      <label>角色<select data-g="char">${(chars.length ? chars : ['（先在“角色”里加角色）']).map(n => `<option ${n === pcChar ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label>结局名（上下文）<input data-g="ending" placeholder="例如：真结局"></label>
      <label>聊天方向<input data-g="goal" value="${esc(vn.data.get().postChat?.goal || '')}"></label>
      <label>后端地址（留空 = 离线模拟）<input data-g="url" value="${esc(vn.settings.get('url') || '')}" placeholder="ws://127.0.0.1:8765/ws/post_ending"></label>
      <label>令牌<input data-g="token" type="password" value="${esc(vn.settings.get('token') || '')}"></label>
      <label class="gd-ck"><input type="checkbox" data-g="tools" ${vn.settings.get('tools') === false ? '' : 'checked'}> 允许后端工具（powershell 等）</label>
      <div class="gd-btns"><button data-g="go" class="pri">开始聊天</button><button data-g="close">关闭</button></div>
      <div class="gd-tools"></div></div><div class="gd-main"></div>`;
    document.body.appendChild(ov);
    const q = k => ov.querySelector(`[data-g=${k}]`);
    let view = null;
    q('close').onclick = () => { if (view) view.destroy(); ov.remove(); };
    q('go').onclick = () => {
      vn.settings.set('url', q('url').value.trim()); vn.settings.set('token', q('token').value.trim());
      if (view) view.destroy();
      const name = q('char').value, main = ov.querySelector('.gd-main'); main.innerHTML = '';
      const client = X.newClient({ character: X.charInfo(name), server_tools: q('tools').checked, context: { ending: q('ending').value.trim(), goal: q('goal').value.trim(), vars: vn.vars.all() } });
      client.on('ready', m => { ov.querySelector('.gd-tools').innerHTML = '<b>可用工具</b>' + (m.tools || []).map(t => `<div><code>${esc(t.name)}</code> <small>${esc(t.source)} · ${esc(t.policy)}</small></div>`).join('') + (client instanceof GA.MockClient ? '<p>（离线模拟中）</p>' : ''); });
      view = GA.mount(main, { client, character: X.charInfo(name), greeting: '', onEmotion: e => { ov.querySelector('.gd-tools').insertAdjacentHTML('beforeend', `<div>表情 → ${esc(e)}</div>`); } });
    };
  }
  const DEV_CSS = `#gaDev{position:fixed;inset:0;z-index:1000;background:#05070d;display:flex;gap:16px;padding:20px;box-sizing:border-box;color:#eef3ff;font-size:14px}
#gaDev .gd-side{width:290px;display:flex;flex-direction:column;gap:10px;overflow-y:auto}
#gaDev h3{margin:0 0 4px;display:flex;align-items:center;gap:8px}
#gaDev label{display:flex;flex-direction:column;gap:4px;color:#9aa6c2;font-size:12px}
#gaDev label.gd-ck{flex-direction:row;align-items:center;gap:6px;color:#eef3ff}
#gaDev input:not([type=checkbox]),#gaDev select{background:#0d1220;border:1px solid #ffffff30;border-radius:8px;color:#fff;padding:7px 9px;font:inherit}
#gaDev .gd-btns{display:flex;gap:8px}
#gaDev button{border:1px solid #ffffff30;background:#ffffff10;color:#fff;border-radius:8px;padding:7px 14px;cursor:pointer;font:inherit}
#gaDev button.pri{background:var(--acc,#8fd3ff);color:#0b1020;border-color:transparent;font-weight:600}
#gaDev .gd-tools{font-size:12px;color:#9aa6c2;line-height:1.8}#gaDev .gd-tools code{color:#eef3ff}
#gaDev .gd-main{flex:1;min-width:0}`;
