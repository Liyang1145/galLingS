/* Authoring UI only. Register lightweight art URLs; decode originals on use. */
window.VNArtLibrary = (() => {
  const statusNames = {adopted:'已采用', reserve:'备用', source:'原始 PNG', rework:'待重制', replaced:'已替换原件', candidate:'试制候选', rejected:'退选留档'};
  const typeNames = {bg:'场景背景', cg:'人物 CG', ch:'角色立绘'};
  let catalog, overlay, selected, page = 0, query = '', category = '', status = '';
  const PAGE_SIZE = 36;
  const url = path => location.protocol === 'file:'
    ? new URL('../' + path, location.href).href
    : '/art-assets/' + path.split('/').map(encodeURIComponent).join('/');
  const media = (item, preview = false) => item.previewSrc || url(preview ? item.thumb : item.path);
  const matches = () => catalog.items.filter(a => (!category || a.category === category) && (!status || a.status === status)
    && (!query || [a.name, a.id, a.scene, ...a.files, ...a.runtimeIds].join(' ').toLowerCase().includes(query.toLowerCase())));
  function close() { overlay?.remove(); overlay = null; $('#bArt')?.focus(); }
  function assetFor(item) {
    if (!A(item.id)) P.assets[item.id] = Object.assign({}, item.asset || {}, {id:item.id, name:item.name,
      type:item.category === 'ch' ? 'ch' : 'bg', src:media(item), w:item.w, h:item.h,
      cg:item.category === 'cg', character:item.character, libraryStatus:item.status, libraryPath:item.path});
    return item.id;
  }
  function apply(item, scope) {
    const id = assetFor(item);
    if (scope === 'cover') { snapshot(); P.settings.cover = Object.assign({}, P.settings.cover, {img:id}); changed(); }
    else if (item.category === 'ch') {
      if (scope === 'replace' && selIndex() >= 0) replaceSprite(selIndex(), id);
      else if (scope === 'linked') addSprite(id);
      else { snapshot(); const a = A(id), sprite = {uid:uid(), asset:id, x:640, y:H, h:a.w > a.h ? 360 : 660, flip:false}; L().sprites.push(sprite); selUid = sprite.uid; touchRecent(id); changed(); }
    } else if (scope === 'linked') setBg(id);
    else { snapshot(); L().bg = id; touchRecent(id); changed(); }
    close();
  }
  function detail() {
    const box = overlay.querySelector('.art-detail');
    if (!selected) { box.innerHTML = '<p class="art-empty">选择素材查看大图和调用方式。</p>'; return; }
    const a = selected, notes = A(a.id)?.artNotes || {}, origin = a.provenance || {};
    box.innerHTML = `<img class="art-large" src="${esc(media(a))}" alt="${esc(a.name)}"><h2>${esc(a.name)}</h2>
      <p>${typeNames[a.category]} · ${statusNames[a.status]} · ${a.w} × ${a.h}</p>
      <p class="art-note">${a.status === 'rework' || a.status === 'rejected' ? '这张曾因画面问题退出播放，保留供人工重制和比较。调用只改变编辑草稿。' : '点击调用后，可在舞台拖动角色、调整大小和翻转；属性面板可精确微调。'}</p>
      <div class="art-actions"><button data-use="single">${a.category === 'ch' ? '添加到当前句' : '设为当前句背景 / CG'}</button>
      <button data-use="linked">${a.category === 'ch' ? '添加到关联画面' : '替换关联画面'}</button>
      ${a.category === 'ch' ? '<button data-use="replace"' + (selIndex() < 0 ? ' disabled' : '') + '>替换选中角色</button>' : '<button data-use="cover">设为标题封面</button>'}</div>
      <small>关联操作遵循顶部“关联画面”开关；默认单句调用只修改当前句。撤销 / 重做均可用。</small>
      <dl><dt>素材 ID</dt><dd>${esc(a.id)}</dd><dt>剧情引用</dt><dd>${a.usage} 句${a.firstLine != null ? ' · <button data-jump>跳到首次使用 #' + (a.firstLine+1) + '</button>' : ''}</dd></dl>
      <details open><summary>来源与制作路线</summary><p>${esc(origin.label || '未登记')}</p><p>来源：${esc(notes.creator || origin.creator || '未登记')}<br>工具：${esc(notes.tool || origin.tool || '未登记')}<br>请求模型：${esc(notes.requestedModel || origin.requestedModel || '未登记')}<br>后端模型：${esc(notes.reportedModel || origin.reportedModel || '未回传')}<br>${esc(notes.note || '')}</p><button data-register>编辑来源 / 微调备注</button></details>
      <details open><summary>原始文件 / 同内容副本（${a.files.length}）</summary>${a.files.map(p => `<a href="${esc(a.previewSrc || url(p))}" target="_blank" rel="noopener">${esc(p)}</a>`).join('')}${a.sourceMasterPath ? '<a href="'+esc(url(a.sourceMasterPath))+'" target="_blank" rel="noopener">查看 PNG 母版</a>' : ''}</details>`;
    box.querySelectorAll('[data-use]').forEach(b => b.onclick = () => apply(a, b.dataset.use));
    const jump = box.querySelector('[data-jump]'); if (jump) jump.onclick = () => { goto(a.firstLine); close(); };
    box.querySelector('[data-register]').onclick = () => {
      const fields = [['creator','制作方'],['tool','生成工具'],['requestedModel','请求模型'],['reportedModel','后端实际模型'],['evidence','依据 / 原件路径'],['note','微调备注']];
      const dialog = modal('<h3>登记素材来源</h3><p>写入你的项目草稿，保留原件。请求模型不等于已核实的实际模型。</p><div class="art-form">' + fields.map(([key,label])=>'<label>'+label+'<input data-note="'+key+'" value="'+esc(notes[key] || origin[key] || '')+'"></label>').join('') + '</div>', () => {
        const value={};dialog.querySelectorAll('[data-note]').forEach(input=>value[input.dataset.note]=input.value.trim());
        A(assetFor(a)).artNotes=value;autosave();detail();
      });
    };
  }
  function list() {
    const filtered = matches(), pages = Math.max(1, Math.ceil(filtered.length/PAGE_SIZE)); page = Math.min(page, pages-1);
    overlay.querySelector('.art-count').textContent = `${filtered.length} 项 / ${catalog.items.length} 项 · ${catalog.physicalFiles} 个文件已索引`;
    overlay.querySelector('.art-page').textContent = `${page+1} / ${pages}`;
    overlay.querySelector('[data-page=prev]').disabled = page === 0;
    overlay.querySelector('[data-page=next]').disabled = page >= pages-1;
    const grid = overlay.querySelector('.art-grid');
    grid.innerHTML = filtered.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE).map(a => `<button class="art-card${selected?.id===a.id?' selected':''}" data-art="${a.id}"><img loading="lazy" decoding="async" src="${esc(media(a,true))}" alt=""><b>${esc(a.name)}</b><span>${a.scene ? esc(a.scene)+' · ' : ''}${statusNames[a.status]}</span><small>${typeNames[a.category]} · ${a.w} × ${a.h}</small></button>`).join('') || '<p class="art-empty">没有匹配素材，试试清空筛选。</p>';
    grid.scrollTop = 0;
    grid.querySelectorAll('[data-art]').forEach(b => {
      b.onclick = () => { selected = catalog.items.find(a => a.id === b.dataset.art); grid.querySelectorAll('.selected').forEach(c => c.classList.remove('selected')); b.classList.add('selected'); detail(); };
    });
  }
  function open() {
    if (overlay || playing) return;
    overlay = document.createElement('section'); overlay.className = 'art-library'; overlay.setAttribute('role','dialog'); overlay.setAttribute('aria-modal','true'); overlay.setAttribute('aria-label','全量美术素材库');
    overlay.innerHTML = `<header><div><small>海风与布丁 · 引擎开发</small><h1>美术素材库</h1></div><span class="art-count"></span><button class="art-close" aria-label="关闭素材库">返回编辑 ×</button></header>
      <div class="art-filters"><input type="search" placeholder="搜索名称、场景编号、素材 ID 或文件名" aria-label="搜索美术素材" value="${esc(query)}"><select aria-label="素材类型"><option value="">全部类型</option>${Object.entries(typeNames).map(([v,n])=>`<option value="${v}"${category===v?' selected':''}>${n}</option>`).join('')}</select><select aria-label="采用状态"><option value="">全部状态</option>${Object.entries(statusNames).map(([v,n])=>`<option value="${v}"${status===v?' selected':''}>${n}</option>`).join('')}</select></div>
      <div class="art-body"><div class="art-results"><div class="art-grid"></div><footer><button data-page="prev">上一页</button><span class="art-page"></span><button data-page="next">下一页</button></footer></div><aside class="art-detail"></aside></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.art-close').onclick = close;
    const filters = overlay.querySelector('.art-filters');
    filters.querySelector('input').oninput = e => { query = e.target.value; page = 0; list(); };
    const selects = filters.querySelectorAll('select'); selects[0].onchange = e => { category=e.target.value;page=0;list(); }; selects[1].onchange = e => {status=e.target.value;page=0;list();};
    overlay.querySelectorAll('[data-page]').forEach(b => b.onclick = () => { page += b.dataset.page === 'prev' ? -1 : 1; list(); });
    list(); detail(); overlay.querySelector('input').focus();
  }
  async function start(data) {
    catalog = data;
    if (!catalog || !Array.isArray(catalog.items)) throw new Error('美术素材索引没有加载');
    if (!window.VN_PREVIEW_ONLY) {
      const css = document.createElement('link'); css.rel='stylesheet'; css.href='art-editor.css';document.head.appendChild(css);
    }
    document.body.classList.add('art-authoring');
    // Register every production image with the native selectors and scripting API.
    // URL metadata is cheap; full-size images are decoded only when used or inspected.
    catalog.items.forEach(assetFor);
    autosave();
    $('#bArt').hidden = false; $('#bArt').onclick = open;
    const micro = document.createElement('button');micro.className='btn art-text-btn';micro.id='bArtAdjust';micro.textContent='画面微调';micro.onclick=adjust;
    $('#bArt').after(micro);
    $('#bSave').classList.add('art-text-btn');$('#bSave').textContent='保存项目';$('#bSave').title='下载微调项目，交给队友继续编辑';
    $('#bOpen').classList.add('art-text-btn');$('#bOpen').textContent='打开项目';
    const notice = document.createElement('div'); notice.className='art-editor-notice';
    const stale = P.artEditorBase && P.artEditorBase !== catalog.projectFingerprint;
    if (!P.artEditorBase) P.artEditorBase=catalog.projectFingerprint;
    notice.innerHTML = window.VN_PREVIEW_ONLY ? '<b>美术开发页演示</b> · 图片已缩小内嵌，可单独转发；完整素材与音频请在正式开发页编辑。' : '<span><b>编辑草稿</b> · '+(stale?'草稿来自较早作品，另存后可载入最新版。':'自动保存在此浏览器；保存项目后可交给队友继续编辑。')+'</span>';
    $('#app').prepend(notice);
    if (!window.VN_PREVIEW_ONLY) {
      const fresh=document.createElement('button');fresh.type='button';fresh.textContent='载入仓库最新版';fresh.onclick=async()=>{
        if (!confirm('将先下载当前项目备份，然后载入仓库最新剧情和素材。继续？')) return;
        await saveFile();savedAssets.clear();DIR=null;loadProject(clone(window.VN_GAME));
        P.cur=Math.max(0,P.lines.findIndex(l=>l.chapter));P.settings.link=false;P.artEditorBase=catalog.projectFingerprint;
        notice.querySelector('span').innerHTML='<b>编辑草稿</b> · 已载入仓库最新版；新的修改自动保存在此浏览器。';changed();fit();
      };notice.appendChild(fresh);
    }
    document.title = P.title + ' · 引擎开发';
    $('#bGame').onclick=exportStandalone;
    $('#bGame').title='导出包含微调结果和音频的单文件游戏（需从本地服务打开）';
    if (window.VN_PREVIEW_ONLY) {
      ['bNew','bOpen','bSave','bGame','bPlay','bExport','bFolder','bImport','bPlug'].forEach(id => {$('#'+id).disabled=true;});
    }
    document.addEventListener('keydown', e => {
      if (window.VN_PREVIEW_ONLY && (e.key==='F5' || ((e.ctrlKey||e.metaKey) && ['s','o'].includes(e.key.toLowerCase())))) {e.preventDefault();e.stopImmediatePropagation();return;}
      if (!overlay) return;
      if ($('#modal').style.display === 'flex') return;
      if (e.key==='Escape') {e.preventDefault(); close();}
      if (e.key==='Tab') {
        const nodes=[...overlay.querySelectorAll('button:not(:disabled),input,select,a[href]')], first=nodes[0],last=nodes[nodes.length-1];
        if (e.shiftKey && document.activeElement===first){e.preventDefault();last?.focus();}
        if (!e.shiftKey && document.activeElement===last){e.preventDefault();first?.focus();}
      }
      e.stopImmediatePropagation();
    },true);
    window.VN_ART_READY=true;
  }
  function adjust() {
    if (playing) return;
    const sprites=L().sprites;
    const box=modal('<h3>当前画面微调</h3><p>第 '+(P.cur+1)+' 句 · '+(P.settings.link?'影响关联的 '+affected().length+' 句':'只修改当前句')+'</p><div class="art-form"><label>背景 / CG<button type="button" id="artPickBg">'+esc(A(L().bg)?.name || '未设置')+' · 去素材库选择</button></label><label>当前角色<select id="artSpr">'+sprites.map((s,i)=>'<option value="'+i+'"'+(s.uid===selUid?' selected':'')+'>'+esc(A(s.asset)?.name || s.asset)+'</option>').join('')+'</select></label><div id="artNumbers"></div></div>',null);
    box.querySelector('[data-a=c]').textContent='关闭';
    box.querySelector('#artPickBg').onclick=()=>{closeModal();category='bg';query='';status='';page=0;open();};
    const select=box.querySelector('#artSpr');
    const fields=()=>{
      const index=Number(select.value), sprite=L().sprites[index], area=box.querySelector('#artNumbers');
      if (!sprite){area.innerHTML='<p>当前没有角色，先从美术素材库添加。</p>';return;}
      selUid=sprite.uid;renderStage(L(),true);
      const fit=sceneFitFor(sprite,L()),fitLabels={brightness:'人物明度',saturation:'人物饱和度',warmth:'色温（负值偏冷，正值偏暖）'};
      area.innerHTML=[['x','横向位置'],['y','纵向位置'],['h','人物高度']].map(([key,label])=>'<label>'+label+'<input type="number" data-position="'+key+'" step="1" value="'+sprite[key]+'"></label>').join('')+'<label><input type="checkbox" id="artFlip"'+(sprite.flip?' checked':'')+'>水平翻转</label>'
        +'<label>场景光色<select id="artSceneFit"><option value="inherit"'+(fit.mode==='inherit'?' selected':'')+'>跟随背景</option><option value="off"'+(fit.mode==='off'?' selected':'')+'>保留立绘原色</option><option value="custom"'+(fit.mode==='custom'?' selected':'')+'>手动微调</option></select></label>'
        +Object.entries(SCENE_FIT_LIMITS).map(([key,[min,max]])=>'<label>'+fitLabels[key]+'<input type="number" data-scene-fit="'+key+'" min="'+min+'" max="'+max+'" step="0.02" value="'+fit[key]+'"'+(fit.mode==='custom'?'':' disabled')+'></label>').join('')
        +'<small>只调整人物的光色，不改原图、人物位置和演出动作。跟随背景时，换景自动采用对应光色。</small>';
      area.querySelectorAll('[data-position]').forEach(input=>input.onchange=()=>{
        const value=Number(input.value);if (!Number.isFinite(value))return;
        const key=input.dataset.position,v=key==='h'?Math.max(1,Math.min(3000,value)):Math.max(-3000,Math.min(5000,value));
        edit(l=>{if(l.sprites[index])l.sprites[index][key]=v;});input.value=v;
      });
      area.querySelector('#artFlip').onchange=e=>edit(l=>{if(l.sprites[index])l.sprites[index].flip=e.target.checked;});
      const target=l=>l.sprites.find(s=>s.uid===sprite.uid)||l.sprites[index];
      area.querySelector('#artSceneFit').onchange=e=>{
        const mode=e.target.value;
        edit(l=>{const s=target(l);if(!s)return;if(mode==='inherit')delete s.sceneFit;else s.sceneFit=mode==='off'?{mode:'off'}:{mode:'custom',...sceneFitValues(sceneFitFor(s,l))};});
        fields();
      };
      area.querySelectorAll('[data-scene-fit]').forEach(input=>input.onchange=()=>{
        const key=input.dataset.sceneFit,value=Number(input.value);
        if(!input.value.trim()||!Number.isFinite(value)){input.value=fit[key];return;}
        const normalized=sceneFitValues({...sceneFitFor(sprite,L()),[key]:value})[key];
        edit(l=>{const s=target(l);if(s)s.sceneFit={mode:'custom',...sceneFitValues(sceneFitFor(s,l)),[key]:normalized};});
        input.value=normalized;
      });
    };select.onchange=fields;fields();
  }
  function playableProject() {
    const proj=clone(P), used=new Set();
    const scan=value=>{if(typeof value==='string')used.add(value);else if(Array.isArray(value))value.forEach(scan);else if(value && typeof value==='object')Object.values(value).forEach(scan);};
    Object.entries(proj).filter(([key])=>!['assets','recent'].includes(key)).forEach(([,value])=>scan(value));
    // Unused visual reserves stay in the editor; the player gallery keeps active CGs.
    proj.assets=Object.fromEntries(Object.entries(proj.assets).filter(([id,a])=>
      used.has(id) || (!a.libraryPath && !['bg','ch'].includes(a.type))));
    proj.cur=0;delete proj.recent;
    return proj;
  }
  async function sourceForExport() {
    const response=await fetch('game-polish.css');if(!response.ok)throw new Error('画面样式加载失败');
    let css=await response.text();
    for(const match of [...css.matchAll(/url\("([^\"]+)"\)/g)])css=css.replace(match[0],'url("'+await blobToData(await srcBlob(match[1]))+'")');
    return (window.VN_SOURCE_HTML || ORIGINAL_HTML)
      .replace('<link rel="stylesheet" href="game-polish.css">','<style>'+css+'</style>')
      .replace('<script src="game.js"></script>','');
  }
  async function exportStandalone() {
    if (window.VN_PREVIEW_ONLY) return;
    if (location.protocol==='file:') {
      const box=modal('<h3>导出单文件游戏</h3><p>请先保存项目，再运行仓库的 start.bat，从本地服务打开开发页并导入项目。这样才能把原始图片和音乐完整打包。</p><p><a href="http://127.0.0.1:8765/vn/%E6%B5%B7%E9%A3%8E%E4%B8%8E%E5%B8%83%E4%B8%81/index.html?editor=1" target="_blank" rel="noopener">打开本地服务中的开发页</a></p>',saveFile);
      box.querySelector('[data-a=o]').textContent='保存项目';return;
    }
    const button=$('#bGame'), old=button.innerHTML;button.disabled=true;button.textContent='正在打包…';
    try {
      const proj=playableProject(), cache=new Map();
      const embed=async src=>{
        if (!src || src.startsWith('data:'))return src;
        if (!cache.has(src)) cache.set(src,blobToData(await srcBlob(src)));
        return cache.get(src);
      };
      for (const asset of Object.values(proj.assets)) {asset.src=await embed(asset.src);delete asset.file;}
      let source=await sourceForExport();
      const marker="<script>\n'use strict';";
      if(!source.includes(marker))throw new Error('播放器代码没有找到');
      source=source.replace(marker,'<script>window.VN_GAME='+JSON.stringify(proj).replace(/</g,'\\u003c')+';<\/script>\n'+marker);
      download((P.title || 'game').replace(/[\\/:*?"<>|]/g,'_')+'_单文件游玩.html',source,'text/html');
    } catch(error) {alert('打包未完成：'+error.message+'。请保存项目备份，保留原始素材。');}
    finally {button.disabled=false;button.innerHTML=old;}
  }
  return {start,open,close,register:() => {catalog?.items.forEach(assetFor);},resolve:url,playableProject,sourceForExport};
})();
