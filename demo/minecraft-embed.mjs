const root = document.querySelector('#village-demo');
if (root) {
  const params = new URLSearchParams(location.search);
  let lang = params.get('lang') === 'zh' ? 'zh' : 'en';
  let scene = ['singapore', 'ntu', 'village'].includes(params.get('scene')) ? 'singapore' : 'eccv';
  const zh = lang === 'zh';
  let campusPlace = params.get('campusPlace') || '';
  const names = zh ? {singapore:'新加坡 · NTU',eccv:'ECCV · EgoPoster'} : {singapore:'Singapore · NTU',eccv:'ECCV · EgoPoster'};
  const title = document.querySelector('#live-demo-title');
  const deck = document.querySelector('#village-deck');
  if (zh) {
    title.textContent = '两个场景，同一个持续循环。';
    deck.textContent = '从 ECCV 展台的五张海报，到覆盖教学区、宿舍、NIE 和运动区的 NTU 校园。戴上眼镜，让观察、记忆和行动在探索中连接起来。';
  }
  root.innerHTML = `<div class="village-game-mode-bar">
    <div><strong data-game-mode-title>${names[scene]}</strong><span>${zh ? 'Esc · 游戏菜单' : 'Esc · Game menu'}</span></div>
    <button type="button" data-exit-game aria-label="${zh ? '退出游戏，返回项目页面' : 'Exit game and return to the project page'}">${zh ? '退出游戏' : 'Exit game'} <span aria-hidden="true">↙</span></button>
  </div>
  <div class="village-window">
    <div class="village-placeholder" role="status"><img src="assets/icon.png" alt=""><span>${zh ? '正在准备你的场景…' : 'Preparing your scene…'}</span><small>${zh ? '首次进入需要加载场景资源' : 'The first visit loads the world resources'}</small></div>
    <iframe id="always-on-game" title="${names[scene]}" allow="gamepad; fullscreen 'none'"></iframe>
  </div>
  <div class="village-scene-switch" role="group" aria-label="${zh?'切换体验场景':'Choose an experience'}">
    <button type="button" data-scene="eccv" aria-controls="always-on-game" aria-pressed="${scene==='eccv'}"><span class="scene-index">01</span><span><strong>${names.eccv}</strong><small>${zh?'展台体验 · 看论文、追问与回顾':'Booth experience · Observe, question, revisit'}</small></span><span class="scene-switch-arrow" aria-hidden="true">↗</span></button>
    <button type="button" data-scene="singapore" aria-controls="always-on-game" aria-pressed="${scene==='singapore'}"><span class="scene-index">02</span><span><strong>${names.singapore}</strong><small>${zh?'开放探索 · 全校园地图 · 行人与交通':'Open exploration · Campus map · People & traffic'}</small></span><span class="scene-switch-arrow" aria-hidden="true">↗</span></button>
  </div>
  <div class="village-scene-note" role="status">${zh?'切换场景会开始一次新访问，各自的记忆保留在此浏览器。':'Switching starts a new visit. Each scene retains its own memory in this browser.'}</div>
  <div class="village-footer"><span class="village-credit">${zh ? '脚本化交互演示 · 记忆仅保存在本机' : 'Scripted interactive demo · Memory stays in this browser'}<br><a href="game/credits.html" target="_blank" rel="noopener">${zh ? '源码与场景依据' : 'Source & scene references'}</a></span><div class="village-footer-controls"><button type="button" data-enter-game aria-controls="always-on-game" aria-expanded="false">${zh ? '进入游戏模式' : 'Enter game mode'} ⤢</button></div></div>`;
  const frame = root.querySelector('iframe');
  const placeholder = root.querySelector('.village-placeholder');
  const enterButton = root.querySelector('[data-enter-game]');
  let gameMode = false;
  let pageState;
  let started = false;
  function sendGameMode() {
    frame.contentWindow?.postMessage({type:'always-on-game-mode', active:gameMode}, location.origin);
  }
  function setGameMode(active) {
    if (gameMode === active) return;
    gameMode = active;
    if (active) {
      start();
      const bodyStyles = Object.fromEntries(['position','top','left','width','overflow'].map(key => [key, document.body.style[key]]));
      const outside = [];
      for (let branch = root; branch.parentElement; branch = branch.parentElement) {
        for (const sibling of branch.parentElement.children) {
          if (sibling !== branch && !['SCRIPT','STYLE','LINK'].includes(sibling.tagName)) {
            outside.push({element:sibling, inert:sibling.inert});
            sibling.inert = true;
          }
        }
        if (branch.parentElement === document.body) break;
      }
      pageState = {x:scrollX, y:scrollY, focus:document.activeElement, bodyStyles, outside,
        role:root.getAttribute('role'), modal:root.getAttribute('aria-modal')};
      Object.assign(document.body.style, {position:'fixed', top:`${-pageState.y}px`, left:`${-pageState.x}px`, width:'100%', overflow:'hidden'});
      root.setAttribute('role','dialog');
      root.setAttribute('aria-modal','true');
    }
    root.classList.toggle('is-game-mode', active);
    enterButton.setAttribute('aria-expanded', String(active));
    sendGameMode();
    if (active) {
      frame.focus();
    } else if (pageState) {
      Object.assign(document.body.style, pageState.bodyStyles);
      for (const {element, inert} of pageState.outside) element.inert = inert;
      for (const [attribute, value] of [['role',pageState.role],['aria-modal',pageState.modal]]) {
        if (value === null) root.removeAttribute(attribute);
        else root.setAttribute(attribute,value);
      }
      const smoothScroll = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(pageState.x,pageState.y);
      document.documentElement.style.scrollBehavior = smoothScroll;
      const previousFocus = pageState.focus instanceof HTMLElement && pageState.focus !== document.body && pageState.focus.isConnected ? pageState.focus : enterButton;
      previousFocus.focus({preventScroll:true});
      pageState = undefined;
    }
  }
  function loadScene() {
    placeholder.hidden = false;
    frame.title = names[scene];
    root.querySelector('[data-game-mode-title]').textContent = names[scene];
    const frameParams = new URLSearchParams({lang, scene, v:'minecraft-campus-20260917-ready'});
    if (['localhost','127.0.0.1','[::1]'].includes(location.hostname) && scene === 'singapore' && ['hall3-16','ntumap'].includes(params.get('campusPrototype'))) {
      frameParams.set('campusPrototype',params.get('campusPrototype'));
      const previewDistance = Number(params.get('renderDistance'));
      if (Number.isInteger(previewDistance) && previewDistance >= 1 && previewDistance <= 16) frameParams.set('renderDistance', String(previewDistance));
      if (params.get('prototypeView') === 'baseline') frameParams.set('prototypeView','baseline');
    }
    if (scene === 'singapore' && campusPlace) frameParams.set('campusPlace',campusPlace);
    frame.src = `game/?${frameParams}`;
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
  frame.addEventListener('load', () => {
    if (frame.getAttribute('src')) placeholder.hidden = true;
    sendGameMode();
  });
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
    if (event.data?.type === 'always-on-campus-place' && typeof event.data.id==='string' && /^[a-zA-Z0-9_-]{1,100}$/.test(event.data.id)) { campusPlace=event.data.id; }
    if (event.data?.type === 'always-on-game-ready') { placeholder.hidden = true; sendGameMode(); }
    if (event.data?.type === 'always-on-exit-game') setGameMode(false);
  });
  enterButton.addEventListener('click', () => setGameMode(true));
  root.querySelector('[data-exit-game]').addEventListener('click', () => setGameMode(false));
}
