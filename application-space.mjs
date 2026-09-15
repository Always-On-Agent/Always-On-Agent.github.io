import { DOMAINS } from "./research-core.mjs";
import { PARTICIPANTS, MEASURED_HORIZONS, PLANES, INITIAL_CAMERA, clamp, clusterPlacements, projectPlane, worldPoint, fitProjection, dragCamera } from "./application-space-core.mjs";

const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const short = value => ({ "Within-session": "Within-session", "Cross-session": "Cross-session", "Longitudinal": "Longitudinal", "Unmeasured": "Unmeasured" })[value] || value;

export function createApplicationSpace(root, { onSelect, renderDetail }) {
  let cases = [], selected = "", view = "3d", camera = { ...INITIAL_CAMERA }, selection = null, drag = null, pendingFrame = 0;
  let planeOrder = PLANES.map(plane => plane.id);
  let panelShowingWorks = false;
  let workListScroll = 0;
  const panelAnimations = new WeakMap();
  root.innerHTML = `<div class="space-workspace">
    <div class="space-visuals">
      <div class="space-orbit-panel glass-panel">
        <div class="space-stage-toolbar"><div><span class="space-eyebrow">THE APPLICATION SPACE</span><p>Drag to rotate. Select a cluster to browse its works.</p></div><div class="space-camera-controls"><button type="button" data-camera="left" aria-label="Rotate left">↶</button><button type="button" data-camera="right" aria-label="Rotate right">↷</button><button type="button" data-camera="out" aria-label="Zoom out">−</button><button type="button" data-camera="in" aria-label="Zoom in">+</button><button type="button" data-camera="reset">Reset view</button></div></div>
        <div class="space-stage"><svg class="space-svg" viewBox="0 0 780 530" tabindex="0" role="group" aria-label="Three-dimensional application map. Drag to rotate; use arrow keys to rotate, plus or minus to zoom, and Home to reset."></svg></div>
        <div class="space-axis-key"><span><b>X</b> Interaction domain</span><span><b>Y</b> Participant scope</span><span><b>Z</b> Outcome horizon</span></div>
        <div class="space-unmeasured"></div>
      </div>
      <div class="space-plane-panels" hidden></div>
      <p class="space-projection-note">Each location groups cases with the same categories. Counts refer to distinct works at that location; distances do not indicate performance.</p>
    </div>
    <div class="space-inspector-dock"><aside class="space-inspector glass-panel" aria-label="Works at the selected location"><div class="space-inspector-content"></div></aside></div>
  </div>`;
  const svg = root.querySelector(".space-svg");
  const orbitPanel = root.querySelector(".space-orbit-panel");
  const planePanels = root.querySelector(".space-plane-panels");
  const inspector = root.querySelector(".space-inspector-content");
  const inspectorSurface = root.querySelector('.space-inspector');
  const inspectorDock = root.querySelector('.space-inspector-dock');
  function animatePanel(card, opening = true) {
    const face = card?.querySelector('.space-projection-card');
    if (!face?.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    panelAnimations.get(face)?.cancel();
    const lift = opening ? -14 : 5;
    const animation = face.animate([
      { transform:'translateY(0) scale(1)' },
      { transform:`translateY(${lift}px) scale(${opening ? 1.012 : .992})`, offset:.36 },
      { transform:'translateY(0) scale(1)' }
    ], { duration:opening ? 620 : 400, easing:'cubic-bezier(.22,.75,.25,1)' });
    panelAnimations.set(face, animation);
  }

  function renderScene() {
    const project = fitProjection(camera);
    const xy = point => { const p = project(point); return `${p.x.toFixed(2)},${p.y.toFixed(2)}`; };
    const line = (a, b, className = "space-grid-line") => `<line class="${className}" x1="${project(a).x}" y1="${project(a).y}" x2="${project(b).x}" y2="${project(b).y}"/>`;
    const text = (point, label, className = "space-axis-label", anchor = "middle") => { const p = project(point); return `<text class="${className}" x="${p.x}" y="${p.y}" text-anchor="${anchor}">${esc(label)}</text>`; };
    let content = `<defs><linearGradient id="space-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".92"/><stop offset=".48" stop-color="#f8fcfa" stop-opacity=".57"/><stop offset="1" stop-color="#dcebe3" stop-opacity=".48"/></linearGradient><filter id="space-plane-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="9" stdDeviation="7" flood-color="#425e50" flood-opacity=".13"/></filter><radialGradient id="space-point-fill" cx=".3" cy=".2" r=".9"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#d7e9dd"/></radialGradient></defs>`;
    for (let i = 0; i < MEASURED_HORIZONS.length; i++) {
      const z = (i - 1) * 115;
      const corners = [[-205,-165], [205,-165], [205,165], [-205,165]].map(([x,y]) => xy({ x,y,z })).join(" ");
      content += `<g class="space-horizon-layer"><polygon points="${corners}" class="space-glass-plane"/>`;
      for (const x of [-155,0,155]) content += line({ x,y:-165,z }, { x,y:165,z });
      for (const y of [-125,0,125]) content += line({ x:-205,y,z }, { x:205,y,z });
      content += text({ x:235,y:160,z }, MEASURED_HORIZONS[i], "space-layer-label", "start") + '</g>';
    }
    DOMAINS.forEach((label,i) => content += text({ x:(i-1)*155,y:200,z:-115 }, label));
    PARTICIPANTS.forEach((label,i) => content += text({ x:-245,y:(i-1)*125,z:-115 }, label, "space-axis-label", "end"));
    const clusters = clusterPlacements(cases).sort((a,b) => project(worldPoint(a)).depth - project(worldPoint(b)).depth);
    clusters.forEach((cluster,index) => {
      const p = project(worldPoint(cluster));
      const radius = cluster.ids.length === 1 ? 11 : 18 + Math.min(5, Math.log2(cluster.ids.length));
      const active = selected ? cluster.ids.includes(selected) : selection?.type === "cluster" && selection.key === cluster.key;
      const label = `${cluster.domain}, ${cluster.participant}, ${cluster.horizon}: ${cluster.ids.length} ${cluster.ids.length === 1 ? 'work' : 'works'}`;
      const name = cluster.ids.length === 1 ? cases.find(item => item.id === cluster.ids[0]).name : "";
      content += `<g class="space-cluster${active ? ' is-selected' : ''}" role="button" tabindex="0" data-space-cluster="${esc(cluster.key)}" aria-label="${esc(label)}" aria-pressed="${active}" transform="translate(${p.x},${p.y})"><title>${esc(label)}</title><circle class="space-cluster-halo" r="${radius+6}"/><circle class="space-cluster-body" r="${radius}"/>${cluster.ids.length > 1 ? `<text class="space-cluster-count" text-anchor="middle" dominant-baseline="central">${cluster.ids.length}</text>` : '<circle class="space-single-core" r="3.5"/>'}${name ? `<text class="space-work-label" x="${radius+8}" y="4">${esc(name)}</text>` : ''}</g>`;
    });
    svg.innerHTML = content;
    const unmeasured = cases.filter(item => item.horizon === "Unmeasured");
    root.querySelector(".space-unmeasured").innerHTML = `<div><strong>Unmeasured</strong><span>Separate from the time axis · ${unmeasured.length} works</span></div><div class="space-unmeasured-works">${unmeasured.map(item => `<button type="button" data-application-case="${esc(item.id)}" aria-pressed="${selected === item.id}">${esc(item.name)}</button>`).join('') || '<span class="space-empty">None in this selection</span>'}</div>`;
    root.querySelector('[data-camera="out"]').disabled = camera.zoom <= .75;
    root.querySelector('[data-camera="in"]').disabled = camera.zoom >= 1.25;
  }

  function renderPlanes() {
    if (!planePanels.querySelector('.space-depth-deck')) {
      planePanels.innerHTML = `<div class="space-unfold-heading"><span class="space-eyebrow">THREE PERSPECTIVES, ONE COLLECTION</span><p>Tap an exposed edge to switch panels. Select a cell or the front title to browse works in this panel.</p></div><div class="space-deck-scene"><div class="space-deck-glow" aria-hidden="true"></div><div class="space-depth-deck">${PLANES.map((plane,index) => `<section class="space-depth-card" data-plane-card="${plane.id}" aria-labelledby="plane-title-${plane.id}"><div class="space-projection-card"><div class="space-card-glass" aria-hidden="true"></div><button type="button" class="space-plane-handle" data-plane-switch="${plane.id}" aria-controls="plane-content-${plane.id}"><span class="space-plane-number">0${index+1}</span><span class="space-plane-heading"><strong id="plane-title-${plane.id}">${plane.title}</strong><span>${({"domain-people":"Across all outcome horizons", "domain-time":"Across all participant scopes", "people-time":"Across all interaction domains"})[plane.id]}</span></span><span class="space-plane-state" aria-hidden="true"></span></button><div class="space-plane-content" id="plane-content-${plane.id}"><div class="space-plane-table"></div><div class="space-panel-works" id="plane-works-${plane.id}"><div class="space-panel-toolbar"><button type="button" data-space-matrix>← Back to matrix</button><span>WORKS &amp; EVIDENCE</span></div><div class="space-panel-slot"></div></div></div></div></section>`).join('')}</div></div><p class="space-deck-status sr-only" role="status" aria-live="polite"></p><p class="space-unfold-note">These are three projections of the same cases. A selected work stays with you when you switch panels. Depth separates views; it does not rank the work.</p>`;
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
      handle.setAttribute('aria-label', `${front ? panelShowingWorks ? 'Show matrix for' : 'Explore works in' : 'Bring forward'} ${plane.title}`);
      card.querySelector('.space-plane-state').textContent = front ? panelShowingWorks ? 'View matrix ↩' : 'Explore works +' : 'Bring forward ↗';
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

  function switchPlane(id) {
    if (!PLANES.some(plane => plane.id === id)) return;
    if (id === planeOrder[0]) {
      panelShowingWorks = !panelShowingWorks;
      renderPlanes(); renderInspector();
      animatePanel(planePanels.querySelector('[data-front="true"]'), panelShowingWorks);
      if (panelShowingWorks) inspector.querySelector('.space-list-heading,.space-case-detail')?.focus({ preventScroll:true });
      else focusMatrix();
      return;
    }
    const previous = planePanels.querySelector('[data-front="true"]');
    planeOrder = [id, ...planeOrder.filter(plane => plane !== id)];
    selection = null;
    workListScroll = 0;
    renderPlanes();
    renderInspector();
    animatePanel(previous, false);
    animatePanel(planePanels.querySelector('[data-front="true"]'));
    planePanels.querySelector(`[data-plane-switch="${id}"]`).focus({ preventScroll:true });
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
    animatePanel(planePanels.querySelector('[data-front="true"]'), false);
  }

  function stepPlane(step) {
    const current = PLANES.findIndex(plane => plane.id === planeOrder[0]);
    switchPlane(PLANES[(current + step + PLANES.length) % PLANES.length].id);
  }

  function selectedIDs() {
    if (!selection) return cases.map(item => item.id);
    if (selection.type === "cluster") return clusterPlacements(cases).find(cluster => cluster.key === selection.key)?.ids || [];
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
    const scope = selection?.type === "cluster" ? JSON.parse(selection.key).join(" · ") : selection ? `${selection.x} · ${selection.y}` : "All filtered application cases";
    inspector.innerHTML = `<div class="space-list-heading" tabindex="-1"><span class="space-eyebrow">${selection ? 'SELECTED LOCATION' : 'WORKS IN VIEW'}</span><h4>${visible.length} ${visible.length === 1 ? 'work' : 'works'}</h4><p>${esc(scope)}</p>${selection ? '<button type="button" data-space-clear>Show all locations</button>' : ''}</div><div class="space-work-list">${visible.map(item => `<button type="button" data-application-case="${esc(item.id)}"><strong>${esc(item.name)}</strong><span>${esc(item.domains.join(' + '))} · ${esc(item.horizon)}</span></button>`).join('') || '<p class="space-empty">No works at this location under the current filters.</p>'}</div>`;
    finishInspector();
  }

  function finishInspector() {
    if (view !== 'planes') return;
    inspectorSurface.scrollTop = selected ? 0 : workListScroll;
    if (panelShowingWorks && inspector.animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      panelAnimations.get(inspector)?.cancel();
      panelAnimations.set(inspector, inspector.animate([{ opacity:.25, transform:'translateY(5px)' }, { opacity:1, transform:'none' }], { duration:280, easing:'ease-out' }));
    }
  }

  function render() {
    root.dataset.spaceMode = view;
    orbitPanel.hidden = view !== "3d";
    planePanels.hidden = view !== "planes";
    inspectorDock.hidden = view === 'planes';
    if (view !== 'planes') inspectorDock.append(inspectorSurface);
    if (view === "3d") renderScene();
    else if (view === "planes") renderPlanes();
    renderInspector();
  }

  function chooseLocation(next) {
    selection = next;
    workListScroll = 0;
    if (view === 'planes') panelShowingWorks = true;
    onSelect("");
    const heading = inspector.querySelector('.space-list-heading');
    heading?.focus({ preventScroll: true });
    if (view === 'planes') animatePanel(planePanels.querySelector('[data-front="true"]'));
    if (view !== 'planes' && window.matchMedia('(max-width: 760px)').matches) heading?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  }

  function changeCamera(action) {
    if (action === "reset") camera = { ...INITIAL_CAMERA };
    if (action === "left") camera.yaw -= .18;
    if (action === "right") camera.yaw += .18;
    if (action === "up") camera.tilt = clamp(camera.tilt + .10, .26, 1.16);
    if (action === "down") camera.tilt = clamp(camera.tilt - .10, .26, 1.16);
    if (action === "in") camera.zoom = Math.min(1.25, camera.zoom + .1);
    if (action === "out") camera.zoom = Math.max(.75, camera.zoom - .1);
    renderScene();
  }

  root.addEventListener('click', event => {
    if (event.target.closest('[data-space-matrix]')) { showMatrix(); return; }
    const planeSwitch = event.target.closest('[data-plane-switch]');
    if (planeSwitch) { switchPlane(planeSwitch.dataset.planeSwitch); return; }
    const controls = event.target.closest('[data-camera]');
    if (controls) changeCamera(controls.dataset.camera);
    const cluster = event.target.closest('[data-space-cluster]');
    if (cluster) {
      const found = clusterPlacements(cases).find(item => item.key === cluster.dataset.spaceCluster);
      if (found?.ids.length === 1) onSelect(found.ids[0]);
      else chooseLocation({ type:'cluster', key:cluster.dataset.spaceCluster });
    }
    const cell = event.target.closest('[data-space-cell]');
    if (cell && !cell.disabled) { const [plane,x,y] = JSON.parse(cell.dataset.spaceCell); chooseLocation({ type:'plane',plane,x,y }); }
    if (event.target.closest('[data-space-clear]')) { selection = null; workListScroll = 0; onSelect(''); inspector.querySelector('.space-list-heading')?.focus({ preventScroll: true }); }
    if (event.target.closest('[data-space-back]')) { const previous = selected; onSelect(''); const target = [...inspector.querySelectorAll('[data-application-case]')].find(button => button.dataset.applicationCase === previous) || inspector.querySelector('.space-list-heading'); target?.focus({ preventScroll: true }); }
    const card = event.target.closest('[data-plane-card]');
    if (card && !event.target.closest('button,a,input,select,textarea,.space-panel-works')) switchPlane(card.dataset.planeCard);
  });
  planePanels.addEventListener('keydown', event => {
    if (event.key === 'Escape' && panelShowingWorks) { event.preventDefault(); showMatrix(); return; }
    if (!event.target.closest('[data-plane-switch]')) return;
    const step = ({ ArrowRight:1, ArrowDown:1, ArrowLeft:-1, ArrowUp:-1 })[event.key];
    if (step) { event.preventDefault(); stepPlane(step); }
    if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); const id = PLANES[event.key === 'Home' ? 0 : PLANES.length-1].id; if (id !== planeOrder[0]) switchPlane(id); }
  });
  svg.addEventListener('keydown', event => {
    const cluster = event.target.closest('[data-space-cluster]');
    if (cluster && ['Enter',' '].includes(event.key)) { event.preventDefault(); cluster.dispatchEvent(new MouseEvent('click', { bubbles:true })); return; }
    if (event.target !== svg) return;
    const action = ({ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',Home:'reset','+':'in','=':'in','-':'out'})[event.key];
    if (action) { event.preventDefault(); changeCamera(action); }
  });
  svg.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('[data-space-cluster]')) return;
    drag = { id:event.pointerId, x:event.clientX, y:event.clientY, camera:{...camera} };
    svg.setPointerCapture(event.pointerId); svg.classList.add('is-dragging');
  });
  svg.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    camera = dragCamera(drag.camera, event.clientX-drag.x, event.clientY-drag.y);
    if (!pendingFrame) pendingFrame = requestAnimationFrame(() => { pendingFrame=0; renderScene(); });
  });
  const finishDrag = event => {
    if (!drag || drag.id !== event.pointerId) return;
    drag = null; svg.classList.remove('is-dragging');
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
  };
  svg.addEventListener('pointerup', finishDrag);
  svg.addEventListener('pointercancel', finishDrag);
  svg.addEventListener('lostpointercapture', () => { drag=null; svg.classList.remove('is-dragging'); });

  return {
    update({ cases:next, selectedCase, view:nextView }) {
      const changed = cases.map(item=>item.id).join('|') !== next.map(item=>item.id).join('|');
      const viewChanged = view !== nextView;
      const picked = selectedCase && selectedCase !== selected;
      if (picked && !selected && view === 'planes') workListScroll = inspectorSurface.scrollTop;
      if (changed || viewChanged) workListScroll = 0;
      if (nextView === 'planes' && (picked || viewChanged && selectedCase)) panelShowingWorks = true;
      root.dataset.spaceEntering = String(viewChanged);
      if (viewChanged) {
        if (pendingFrame) { cancelAnimationFrame(pendingFrame); pendingFrame = 0; }
        if (drag && svg.hasPointerCapture(drag.id)) svg.releasePointerCapture(drag.id);
        drag = null; svg.classList.remove('is-dragging');
      }
      cases=next; selected=selectedCase; view=nextView;
      if (changed || viewChanged) selection=null;
      render();
      if (picked && view === 'planes') animatePanel(planePanels.querySelector('[data-front="true"]'));
    },
    clearLocation() { selection = null; workListScroll = 0; },
    get detailElement() { return view !== 'planes' || panelShowingWorks ? inspector.querySelector('.space-case-detail') : null; }
  };
}
