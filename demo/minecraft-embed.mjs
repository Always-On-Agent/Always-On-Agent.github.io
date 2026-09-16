const root = document.querySelector('#village-demo');
if (root) {
  const lang = new URLSearchParams(location.search).get('lang') === 'zh' ? 'zh' : 'en';
  const zh = lang === 'zh';
  const title = document.querySelector('#live-demo-title');
  const deck = document.querySelector('#village-deck');
  if (zh) {
    title.textContent = '一个记得你的世界。';
    deck.textContent = '戴上眼镜，自由探索村庄。观察新的变化，找回此前的记忆，决定助手何时应该介入。';
  }
  root.innerHTML = `<div class="village-window">
    <div class="village-placeholder" role="status"><img src="assets/icon.png" alt=""><span>${zh ? '正在准备你的村庄…' : 'Preparing your village…'}</span><small>${zh ? '首次进入需要加载场景资源' : 'The first visit loads the world resources'}</small></div>
    <iframe title="${zh ? 'Always-On 第一视角村庄' : 'Always-On first-person village'}" allow="fullscreen; gamepad" allowfullscreen></iframe>
  </div><div class="village-footer"><span class="village-credit">${zh ? '脚本化交互演示 · 记忆仅保存在本机' : 'Scripted interactive demo · Memory stays in this browser'}<br><a href="game/credits.html" target="_blank" rel="noopener">${zh ? '源码与资源说明' : 'Source & credits'}</a></span><div class="village-footer-controls"><button type="button" data-fullscreen>${zh ? '全屏' : 'Full screen'} ⤢</button></div></div>`;
  const frame = root.querySelector('iframe');
  const placeholder = root.querySelector('.village-placeholder');
  let started = false;
  function start() {
    if (started) return;
    started = true;
    frame.src = `game/?lang=${lang}&v=village-1`;
  }
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { start(); observer.disconnect(); }
  }, { rootMargin: '300px' });
  observer.observe(root);
  // Show the client's own progress immediately after its document loads.
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
