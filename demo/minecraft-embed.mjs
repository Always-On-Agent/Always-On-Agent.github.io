const root = document.querySelector('#village-demo');
if (root) {
  const params = new URLSearchParams(location.search);
  let lang = params.get('lang') === 'zh' ? 'zh' : 'en';
  let scene = ['singapore', 'ntu', 'village'].includes(params.get('scene')) ? 'singapore' : 'eccv';
  const zh = lang === 'zh';
  const names = zh ? {singapore:'新加坡 · NTU',eccv:'ECCV · EgoPoster'} : {singapore:'Singapore · NTU',eccv:'ECCV · EgoPoster'};
  const title = document.querySelector('#live-demo-title');
  const deck = document.querySelector('#village-deck');
  if (zh) {
    title.textContent = '两个场景，同一个持续循环。';
    deck.textContent = '从 ECCV 展台的五张海报，到真实地理尺度的 NTU 校园样板。戴上眼镜，让观察、记忆和行动在探索中连接起来。';
  }
  root.innerHTML = `<div class="village-window">
    <div class="village-placeholder" role="status"><img src="assets/icon.png" alt=""><span>${zh ? '正在准备你的场景…' : 'Preparing your scene…'}</span><small>${zh ? '首次进入需要加载场景资源' : 'The first visit loads the world resources'}</small></div>
    <iframe id="always-on-game" title="${names[scene]}" allow="fullscreen; gamepad" allowfullscreen></iframe>
  </div>
  <div class="village-scene-switch" role="group" aria-label="${zh?'切换体验场景':'Choose an experience'}">
    <button type="button" data-scene="eccv" aria-controls="always-on-game" aria-pressed="${scene==='eccv'}"><span class="scene-index">01</span><span><strong>${names.eccv}</strong><small>${zh?'展台体验 · 看论文、追问与回顾':'Booth experience · Observe, question, revisit'}</small></span><span class="scene-switch-arrow" aria-hidden="true">↗</span></button>
    <button type="button" data-scene="singapore" aria-controls="always-on-game" aria-pressed="${scene==='singapore'}"><span class="scene-index">02</span><span><strong>${names.singapore}</strong><small>${zh?'开放探索 · NTU 核心区原型 · 简化建筑':'Open exploration · NTU core prototype · Simplified buildings'}</small></span><span class="scene-switch-arrow" aria-hidden="true">↗</span></button>
  </div>
  <div class="village-scene-note" role="status">${zh?'切换场景会开始一次新访问，各自的记忆保留在此浏览器。':'Switching starts a new visit. Each scene retains its own memory in this browser.'}</div>
  <div class="village-footer"><span class="village-credit">${zh ? '脚本化交互演示 · 记忆仅保存在本机' : 'Scripted interactive demo · Memory stays in this browser'}<br><a href="game/credits.html" target="_blank" rel="noopener">${zh ? '源码与场景依据' : 'Source & scene references'}</a></span><div class="village-footer-controls"><button type="button" data-fullscreen>${zh ? '全屏' : 'Full screen'} ⤢</button></div></div>`;
  const frame = root.querySelector('iframe');
  const placeholder = root.querySelector('.village-placeholder');
  let started = false;
  function loadScene() {
    placeholder.hidden = false;
    frame.title = names[scene];
    frame.src = `game/?lang=${lang}&scene=${scene}&v=ntu-campus-1`;
  }
  function start() {
    if (started) return;
    started = true;
    loadScene();
  }
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { start(); observer.disconnect(); }
  }, { rootMargin: '300px' });
  observer.observe(root);
  root.querySelectorAll('[data-scene]').forEach(button => button.addEventListener('click', () => {
    if (scene === button.dataset.scene) return;
    try { lang = new URL(frame.contentWindow.location.href).searchParams.get('lang') === 'zh' ? 'zh' : 'en'; } catch {}
    scene = button.dataset.scene;
    const url = new URL(location.href);
    url.searchParams.set('scene', scene);url.searchParams.set('lang',lang);
    history.replaceState(null,'',url);
    root.querySelectorAll('[data-scene]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.scene === scene)));
    started = true;loadScene();
  }));
  frame.addEventListener('load', () => { if (frame.getAttribute('src')) placeholder.hidden = true; });
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
    if (event.data?.type === 'always-on-game-ready') placeholder.hidden = true;
  });
  root.querySelector('[data-fullscreen]').addEventListener('click', async () => {
    start();
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.querySelector('.village-window').requestFullscreen();
    } catch { frame.contentWindow?.focus(); }
  });
}
