import { PLANES, clamp, projectPlane } from "./application-space-core.mjs";

const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const short = value => ({ "Within-session": "Within-session", "Cross-session": "Cross-session", "Longitudinal": "Longitudinal", "Unmeasured": "Unmeasured" })[value] || value;

export function createApplicationSpace(root, { onSelect, renderDetail }) {
  let cases = [], selected = "", selection = null;
  let planeOrder = PLANES.map(plane => plane.id);
  let panelShowingWorks = false;
  let workListScroll = 0;
  let deckDrag = null, suppressDeckClickUntil = 0;
  const panelAnimations = new WeakMap();
  root.innerHTML = `<div class="space-workspace"><div class="space-plane-panels"></div></div>`;
  const planePanels = root.querySelector(".space-plane-panels");
  const inspectorSurface = document.createElement('section');
  inspectorSurface.className = 'space-inspector';
  inspectorSurface.setAttribute('aria-label', 'Works at the selected location');
  inspectorSurface.innerHTML = '<div class="space-inspector-content"></div>';
  const inspector = inspectorSurface.querySelector('.space-inspector-content');
  function playAnimation(element, frames, options) {
    if (!element) return;
    panelAnimations.get(element)?.cancel();
    if (!element.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    panelAnimations.set(element, element.animate(frames, options));
  }

  function animatePanel(card, arriving = true) {
    const face = card?.querySelector('.space-projection-card');
    if (!face) return;
    const start = face.style.transform || ('translateY(6px)');
    face.style.removeProperty('transform');
    playAnimation(face, [
      { transform:start },
      { transform:'translateY(0)' }
    ], { duration:arriving ? 1100 : 800, easing:'cubic-bezier(.2,.7,.2,1)' });
  }

  function revealFrom(source, surface) {
    const bounds = surface.getBoundingClientRect();
    const origin = source?.getBoundingClientRect();
    if (!origin || !bounds.width || !bounds.height) return { x:50, y:25, clip:'inset(18% 36% 64% 36% round 14px)' };
    const x = clamp((origin.left + origin.width / 2 - bounds.left) / bounds.width * 100, 8, 92);
    const y = clamp((origin.top + origin.height / 2 - bounds.top) / bounds.height * 100, 8, 92);
    return { x, y, clip:`inset(${Math.max(0,y-8)}% ${Math.max(0,92-x)}% ${Math.max(0,92-y)}% ${Math.max(0,x-8)}% round 14px)` };
  }

  function unfoldSurface(surface, origin = { x:50, y:20, clip:'inset(8% 12% 35% 12% round 18px)' }) {
    surface.style.transformOrigin = `${origin.x}% ${origin.y}%`;
    playAnimation(surface, [
      { opacity:0, filter:'blur(12px)', transform:'translateY(8px)' },
      { opacity:1, filter:'blur(0px)', transform:'translateY(0)' }
    ], { duration:1100, easing:'cubic-bezier(.2,.65,.2,1)' });
  }

  function renderPlanes() {
    if (!planePanels.querySelector('.space-depth-deck')) {
      planePanels.innerHTML = `<div class="space-unfold-heading"><span class="space-eyebrow">THREE PERSPECTIVES, ONE COLLECTION</span><p>Tap a title or edge, or drag sideways, to switch panels. Select a cell to explore its works.</p><button type="button" class="space-browse-all" data-space-all>Browse all works →</button></div><div class="space-deck-scene"><div class="space-deck-glow" aria-hidden="true"></div><div class="space-depth-deck">${PLANES.map((plane,index) => `<section class="space-depth-card" data-plane-card="${plane.id}" aria-labelledby="plane-title-${plane.id}"><div class="space-projection-card"><div class="space-card-glass" aria-hidden="true"></div><button type="button" class="space-plane-handle" data-plane-switch="${plane.id}" aria-controls="plane-content-${plane.id}"><span class="space-plane-number">0${index+1}</span><span class="space-plane-heading"><strong id="plane-title-${plane.id}">${plane.title}</strong><span>${({"domain-people":"Across all outcome horizons", "domain-time":"Across all participant scopes", "people-time":"Across all interaction domains"})[plane.id]}</span></span><span class="space-plane-state" aria-hidden="true"></span></button><div class="space-plane-content" id="plane-content-${plane.id}"><div class="space-plane-table"></div><div class="space-panel-works" id="plane-works-${plane.id}"><div class="space-panel-toolbar"><button type="button" data-space-matrix>← Back to matrix</button><span>WORKS &amp; EVIDENCE</span></div><div class="space-panel-slot"></div></div></div></div></section>`).join('')}</div></div><p class="space-deck-status sr-only" role="status" aria-live="polite"></p><p class="space-unfold-note">These are three projections of the same cases. Each panel opens at its matrix. Depth separates views; it does not rank the work.</p>`;
    }
    PLANES.forEach(plane => {
      const card = planePanels.querySelector(`[data-plane-card="${plane.id}"]`);
      const depth = planeOrder.indexOf(plane.id);
      const front = depth === 0;
      card.style.setProperty('--depth', depth);
      card.dataset.depth = String(depth);
      card.dataset.front = String(front);
      card.dataset.panelView = front && panelShowingWorks ? 'works' : 'matrix';
      const handle = card.querySelector('[data-plane-switch]');
      handle.setAttribute('aria-pressed', String(front));
      handle.setAttribute('aria-label', `Open ${plane.title} matrix`);
      card.querySelector('.space-plane-state').textContent = front ? panelShowingWorks ? 'View matrix ↩' : 'Matrix view' : 'Open matrix ↗';
      const body = card.querySelector('.space-plane-content');
      body.toggleAttribute('inert', !front);
      body.setAttribute('aria-hidden', String(!front));
      const matrix = card.querySelector('.space-plane-table');
      matrix.toggleAttribute('inert', !front || panelShowingWorks);
      matrix.setAttribute('aria-hidden', String(!front || panelShowingWorks));
      const works = card.querySelector('.space-panel-works');
      works.toggleAttribute('inert', !front || !panelShowingWorks);
      works.setAttribute('aria-hidden', String(!front || !panelShowingWorks));
      if (front) card.querySelector('.space-panel-slot').append(inspectorSurface);
      const cells = projectPlane(cases, plane);
      matrix.innerHTML = `<table><caption class="sr-only">${esc(plane.title)} projection</caption><thead><tr><td></td>${plane.columns.map(label => `<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${plane.rows.map(y => `<tr${y === 'Unmeasured' ? ' class="space-unmeasured-row"' : ''}><th scope="row">${short(y)}</th>${plane.columns.map(x => {
        const cell = cells.find(cell => cell.x === x && cell.y === y);
        const active = selected ? cell.ids.includes(selected) : selection?.type === 'plane' && selection.plane === plane.id && selection.x === x && selection.y === y;
        const key = JSON.stringify([plane.id,x,y]);
        return `<td>${cell.ids.length ? `<button type="button" data-space-cell="${esc(key)}" aria-pressed="${active}" aria-label="${esc(x)}, ${esc(y)}: ${cell.ids.length} works"${front && !panelShowingWorks ? '' : ' disabled tabindex="-1"'}><span>${cell.ids.length}</span><small>${cell.ids.length === 1 ? 'work' : 'works'}</small></button>` : '<span class="space-empty" aria-label="No cases">—</span>'}</td>`;
      }).join('')}</tr>`).join('')}</tbody></table><p class="space-plane-footnote">${plane.y === 'horizon' ? 'Unmeasured has no measured outcome horizon.' : 'Includes measured and unmeasured outcome horizons.'} A work can occupy more than one cell.</p>`;
    });
    const current = PLANES.findIndex(plane => plane.id === planeOrder[0]);
    const status = planePanels.querySelector('.space-deck-status');
    const label = `0${current+1} / 03 · ${PLANES[current].title}`;
    if (status.textContent !== label) status.textContent = label;
  }

  function switchPlane(id, order = null) {
    if (!PLANES.some(plane => plane.id === id)) return;
    if (deckDrag) finishDeckDrag({ pointerId:deckDrag.id }, true);
    const previous = planePanels.querySelector('[data-front="true"]');
    planeOrder = order || [id, ...planeOrder.filter(plane => plane !== id)];
    panelShowingWorks = false;
    selection = null;
    workListScroll = 0;
    panelAnimations.get(inspector)?.cancel();
    // Clear the controller's selected case too, so later renders cannot reopen it.
    onSelect('');
    const current = planePanels.querySelector('[data-front="true"]');
    current.querySelector('.space-plane-table').scrollTop = 0;
    current.querySelector('.space-plane-table').scrollLeft = 0;
    if (previous !== current) animatePanel(previous, false);
    animatePanel(current);
    unfoldSurface(current.querySelector('.space-plane-table'));
    current.querySelector('[data-plane-switch]').focus({ preventScroll:true });
  }

  function focusMatrix() {
    const card = planePanels.querySelector('[data-front="true"]');
    const cell = [...card.querySelectorAll('[data-space-cell]')].find(button => {
      const [plane,x,y] = JSON.parse(button.dataset.spaceCell);
      return selection?.type === 'plane' && selection.plane === plane && selection.x === x && selection.y === y;
    });
    (cell || card.querySelector('[data-plane-switch]')).focus({ preventScroll:true });
  }

  function showMatrix() {
    if (!panelShowingWorks) return;
    panelShowingWorks = false;
    renderPlanes();
    focusMatrix();
    unfoldSurface(planePanels.querySelector('[data-front="true"] .space-plane-table'));
  }

  function stepPlane(step) {
    const current = PLANES.findIndex(plane => plane.id === planeOrder[0]);
    switchPlane(PLANES[(current + step + PLANES.length) % PLANES.length].id);
  }

  function selectedIDs() {
    if (!selection) return cases.map(item => item.id);
    const plane = PLANES.find(plane => plane.id === selection.plane);
    return projectPlane(cases, plane).find(cell => cell.x === selection.x && cell.y === selection.y)?.ids || [];
  }

  function renderInspector() {
    const current = cases.find(item => item.id === selected);
    if (current) {
      inspector.innerHTML = `<button class="space-back-list" type="button" data-space-back>← Back to the works</button><div class="space-case-detail" tabindex="-1">${renderDetail(current)}</div>`;
      finishInspector();
      return;
    }
    const ids = selectedIDs();
    const visible = cases.filter(item => ids.includes(item.id));
    const scope = selection ? `${selection.x} · ${selection.y}` : "All filtered application cases";
    inspector.innerHTML = `<div class="space-list-heading" tabindex="-1"><span class="space-eyebrow">${selection ? 'SELECTED LOCATION' : 'WORKS IN VIEW'}</span><h4>${visible.length} ${visible.length === 1 ? 'work' : 'works'}</h4><p>${esc(scope)}</p>${selection ? '<button type="button" data-space-clear>Show all locations</button>' : ''}</div><div class="space-work-list">${visible.map(item => `<button type="button" data-application-case="${esc(item.id)}"><strong>${esc(item.name)}</strong><span>${esc(item.domains.join(' + '))} · ${esc(item.horizon)}</span></button>`).join('') || '<p class="space-empty">No works at this location under the current filters.</p>'}</div>`;
    finishInspector();
  }

  function finishInspector() {
    inspectorSurface.scrollTop = selected ? 0 : workListScroll;
    if (panelShowingWorks) {
      playAnimation(inspector, [
        { opacity:0, transform:'translateY(6px)', offset:0 },
        { opacity:.08, transform:'translateY(4px)', offset:.16 },
        { opacity:1, transform:'translateY(0)', offset:1 }
      ], { duration:1000, easing:'cubic-bezier(.2,.6,.2,1)' });
    }
  }

  function render() {
    renderPlanes();
    renderInspector();
  }

  function chooseLocation(next, source) {
    const surface = planePanels.querySelector('[data-front="true"] .space-panel-works');
    const origin = revealFrom(source, surface);
    selection = next;
    workListScroll = 0;
    panelShowingWorks = true;
    onSelect("");
    inspector.querySelector('.space-list-heading')?.focus({ preventScroll:true });
    unfoldSurface(surface, origin);
  }

  root.addEventListener('click', event => {
    if (event.target.closest('[data-space-all]')) { chooseLocation(null, event.target); return; }
    if (event.target.closest('[data-space-matrix]')) { showMatrix(); return; }
    const planeSwitch = event.target.closest('[data-plane-switch]');
    if (planeSwitch) { switchPlane(planeSwitch.dataset.planeSwitch); return; }
    const cell = event.target.closest('[data-space-cell]');
    if (cell && !cell.disabled) { const [plane,x,y] = JSON.parse(cell.dataset.spaceCell); chooseLocation({ type:'plane',plane,x,y }, cell); }
    if (event.target.closest('[data-space-clear]')) { selection = null; workListScroll = 0; onSelect(''); inspector.querySelector('.space-list-heading')?.focus({ preventScroll: true }); }
    if (event.target.closest('[data-space-back]')) { const previous = selected; onSelect(''); const target = [...inspector.querySelectorAll('[data-application-case]')].find(button => button.dataset.applicationCase === previous) || inspector.querySelector('.space-list-heading'); target?.focus({ preventScroll: true }); }
    const card = event.target.closest('[data-plane-card]');
    if (card && !event.target.closest('button,a,input,select,textarea,.space-panel-works')) switchPlane(card.dataset.planeCard);
  });
  // Horizontal intent starts a deck gesture; vertical intent stays native scrolling.
  planePanels.addEventListener('pointerdown', event => {
    suppressDeckClickUntil = 0;
    if (event.button !== 0 || !event.isPrimary || deckDrag) return;
    const card = event.target.closest('[data-plane-card]');
    if (!card || event.target.closest('.space-panel-works')) return;
    if (event.target.closest('button,a,input,select,textarea') && !event.target.closest('[data-plane-switch]')) return;
    const front = planePanels.querySelector('[data-front="true"]');
    deckDrag = { id:event.pointerId, x:event.clientX, y:event.clientY, dx:0, active:false,
      card:front, width:front.getBoundingClientRect().width };
  });
  planePanels.addEventListener('pointermove', event => {
    if (!deckDrag || event.pointerId !== deckDrag.id) return;
    const dx = event.clientX - deckDrag.x, dy = event.clientY - deckDrag.y;
    if (!deckDrag.active) {
      if (Math.abs(dy) > 12 && Math.abs(dy) >= Math.abs(dx)) { deckDrag = null; return; }
      if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
      deckDrag.active = true;
      panelAnimations.get(deckDrag.card.querySelector('.space-projection-card'))?.cancel();
      planePanels.setPointerCapture(event.pointerId);
      planePanels.classList.add('is-dragging');
    }
    event.preventDefault();
    deckDrag.dx = dx;
    const offset = clamp(dx * .42, -100, 100);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    deckDrag.card.querySelector('.space-projection-card').style.transform = `translateX(${offset}px) rotate(${reduced ? 0 : offset / 45}deg)`;
  });
  function finishDeckDrag(event, canceled = false) {
    if (!deckDrag || event.pointerId !== deckDrag.id) return;
    const gesture = deckDrag;
    deckDrag = null;
    planePanels.classList.remove('is-dragging');
    if (planePanels.hasPointerCapture(event.pointerId)) planePanels.releasePointerCapture(event.pointerId);
    if (!gesture.active) return;
    suppressDeckClickUntil = canceled ? 0 : performance.now() + 350;
    const threshold = clamp(gesture.width * .16, 48, 90);
    if (!canceled && Math.abs(gesture.dx) >= threshold) {
      const order = gesture.dx < 0 ? [...planeOrder.slice(1), planeOrder[0]] : [planeOrder[planeOrder.length - 1], ...planeOrder.slice(0, -1)];
      switchPlane(order[0], order);
    } else {
      const face = gesture.card.querySelector('.space-projection-card');
      const start = face.style.transform;
      face.style.removeProperty('transform');
      playAnimation(face, [{ transform:start }, { transform:'none' }], { duration:600, easing:'cubic-bezier(.2,.7,.2,1)' });
    }
  }
  planePanels.addEventListener('pointerup', event => finishDeckDrag(event));
  planePanels.addEventListener('pointercancel', event => finishDeckDrag(event, true));
  planePanels.addEventListener('lostpointercapture', event => finishDeckDrag(event, true));
  planePanels.addEventListener('pointerleave', () => { if (deckDrag && !deckDrag.active) deckDrag = null; });
  planePanels.addEventListener('click', event => {
    if (event.detail !== 0 && performance.now() < suppressDeckClickUntil) {
      event.preventDefault(); event.stopImmediatePropagation();
      suppressDeckClickUntil = 0;
    }
  }, true);
  planePanels.addEventListener('keydown', event => {
    if (event.key === 'Escape' && panelShowingWorks) { event.preventDefault(); showMatrix(); return; }
    if (!event.target.closest('[data-plane-switch]')) return;
    const step = ({ ArrowRight:1, ArrowDown:1, ArrowLeft:-1, ArrowUp:-1 })[event.key];
    if (step) { event.preventDefault(); stepPlane(step); }
    if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); const id = PLANES[event.key === 'Home' ? 0 : PLANES.length-1].id; switchPlane(id); }
  });
  return {
    update({ cases:next, selectedCase }) {
      if (deckDrag) finishDeckDrag({ pointerId:deckDrag.id }, true);
      const changed = cases.map(item=>item.id).join('|') !== next.map(item=>item.id).join('|');
      const picked = selectedCase && selectedCase !== selected;
      if (picked && !selected) workListScroll = inspectorSurface.scrollTop;
      if (changed) { workListScroll = 0; selection = null; }
      if (picked) panelShowingWorks = true;
      cases = next;
      selected = selectedCase;
      render();
    },
    clearLocation() { selection = null; workListScroll = 0; },
    get detailElement() { return panelShowingWorks ? inspector.querySelector('.space-case-detail') : null; }
  };
}
