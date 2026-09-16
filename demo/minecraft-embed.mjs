const root = document.querySelector('#village-demo');
if (root) {
  const params = new URLSearchParams(location.search);
  let lang = params.get('lang') === 'zh' ? 'zh' : 'en';
  let scene = params.get('scene') === 'eccv' ? 'eccv' : 'village';
  const zh = lang === 'zh';
  const names = zh ? {village:'开放村庄',eccv:'ECCV · EgoPoster'} : {village:'Open village',eccv:'ECCV · EgoPoster'};
  const title = document.querySelector('#live-demo-title');
  const deck = document.querySelector('#village-deck');
  if (zh) {
    title.textContent = '两个场景，同一个持续循环。';
    deck.textContent = '戴上眼镜，在开放村庄自由探索，或走进 ECCV Poster 会场。让观察、记忆和行动在亲自体验中连接起来。';
  }
  root.innerHTML = `<div class="village-window">
    <div class="village-placeholder" role="status"><img src="assets/icon.png" alt=""><span>${zh ? '正在准备你的场景…' : 'Preparing your scene…'}</span><small>${zh ? '首次进入需要加载场景资源' : 'The first visit loads the world resources'}</small></div>
    <iframe id="always-on-game" title="${names[scene]}" allow="fullscreen; gamepad" allowfullscreen></iframe>
  </div>
  <div class="village-scene-switch" role="group" aria-label="${zh?'切换体验场景':'Choose an experience'}">
    <button type="button" data-scene="village" aria-controls="always-on-game" aria-pressed="${scene==='village'}"><span class="scene-index">01</span><span><strong>${names.village}</strong><small>${zh?'自由探索 · 承诺与记忆跨次延续':'Free exploration · Commitments across visits'}</small></span><span class="scene-switch-arrow" aria-hidden="true">↗</span></button>
    <button type="button" data-scene="eccv" aria-controls="always-on-game" aria-pressed="${scene==='eccv'}"><span class="scene-index">02</span><span><strong>${names.eccv}</strong><small>${zh?'Booth 44 · 看论文、追问、关联与回顾':'Booth 44 · Observe, question, connect, revisit'}</small></span><span class="scene-switch-arrow" aria-hidden="true">↗</span></button>
  </div>
  <div class="village-scene-note" role="status">${zh?'切换场景会开始一次新访问，各自的记忆保留在此浏览器。':'Switching starts a new visit. Each scene retains its own memory in this browser.'}</div>
  <div class="village-footer"><span class="village-credit">${zh ? '脚本化交互演示 · 记忆仅保存在本机' : 'Scripted interactive demo · Memory stays in this browser'}<br><a href="game/credits.html" target="_blank" rel="noopener">${zh ? '源码与场景依据' : 'Source & scene references'}</a></span><div class="village-footer-controls"><button type="button" data-fullscreen>${zh ? '全屏' : 'Full screen'} ⤢</button></div></div>`;
  const frame = root.querySelector('iframe');
  const placeholder = root.querySelector('.village-placeholder');
  let started = false;
  function loadScene() {
    placeholder.hidden = false;
    frame.title = names[scene];
    frame.src = `game/?lang=${lang}&scene=${scene}&v=two-scenes-1`;
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
