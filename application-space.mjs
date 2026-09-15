import { DOMAINS } from "./research-core.mjs";
import { PARTICIPANTS, MEASURED_HORIZONS, PLANES, INITIAL_CAMERA, clamp, clusterPlacements, projectPlane, worldPoint, fitProjection, dragCamera } from "./application-space-core.mjs";

const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const short = value => ({ "Within-session": "Within-session", "Cross-session": "Cross-session", "Longitudinal": "Longitudinal", "Unmeasured": "Unmeasured" })[value] || value;

export function createApplicationSpace(root, { onSelect, renderDetail }) {
  let cases = [], selected = "", view = "3d", camera = { ...INITIAL_CAMERA }, selection = null, drag = null, pendingFrame = 0;
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
    <aside class="space-inspector glass-panel" aria-label="Works at the selected location"><div class="space-inspector-content"></div></aside>
  </div>`;
  const svg = root.querySelector(".space-svg");
  const orbitPanel = root.querySelector(".space-orbit-panel");
  const planePanels = root.querySelector(".space-plane-panels");
  const inspector = root.querySelector(".space-inspector-content");

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
    planePanels.innerHTML = `<div class="space-unfold-heading"><span class="space-eyebrow">THREE VIEWS OF THE SAME WORKS</span><p>Each glass panel opens two dimensions. Select a cell to read every work in it.</p></div><div class="space-projection-cards">${PLANES.map((plane, index) => {
      const cells = projectPlane(cases, plane);
      return `<section class="space-projection-card glass-panel"><div class="space-projection-heading"><span>0${index+1}</span><div><h4>${plane.title}</h4><p>${({"domain-people":"Across all outcome horizons", "domain-time":"Across all participant scopes", "people-time":"Across all interaction domains"})[plane.id]}</p></div></div><table><caption class="sr-only">${esc(plane.title)} projection</caption><thead><tr><td></td>${plane.columns.map(label => `<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${plane.rows.map(y => `<tr${y === 'Unmeasured' ? ' class="space-unmeasured-row"' : ''}><th scope="row">${short(y)}</th>${plane.columns.map(x => {
        const cell = cells.find(cell => cell.x === x && cell.y === y);
        const active = selected ? cell.ids.includes(selected) : selection?.type === 'plane' && selection.plane === plane.id && selection.x === x && selection.y === y;
        const key = JSON.stringify([plane.id,x,y]);
        return `<td>${cell.ids.length ? `<button type="button" data-space-cell="${esc(key)}" aria-pressed="${active}" aria-label="${esc(x)}, ${esc(y)}: ${cell.ids.length} works"><span>${cell.ids.length}</span><small>${cell.ids.length === 1 ? 'work' : 'works'}</small></button>` : '<span class="space-empty" aria-label="No cases">—</span>'}</td>`;
      }).join('')}</tr>`).join('')}</tbody></table></section>`;
    }).join('')}</div><p class="space-unfold-note">A work can appear in more than one cell when its recorded scope spans categories. Unmeasured is kept separate wherever a panel includes outcome horizon.</p>`;
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
      return;
    }
    const ids = selectedIDs();
    const visible = cases.filter(item => ids.includes(item.id));
    const scope = selection?.type === "cluster" ? JSON.parse(selection.key).join(" · ") : selection ? `${selection.x} · ${selection.y}` : "All filtered application cases";
    inspector.innerHTML = `<div class="space-list-heading" tabindex="-1"><span class="space-eyebrow">${selection ? 'SELECTED LOCATION' : 'WORKS IN VIEW'}</span><h4>${visible.length} ${visible.length === 1 ? 'work' : 'works'}</h4><p>${esc(scope)}</p>${selection ? '<button type="button" data-space-clear>Show all locations</button>' : ''}</div><div class="space-work-list">${visible.map(item => `<button type="button" data-application-case="${esc(item.id)}"><strong>${esc(item.name)}</strong><span>${esc(item.domains.join(' + '))} · ${esc(item.horizon)}</span></button>`).join('') || '<p class="space-empty">No works at this location under the current filters.</p>'}</div>`;
  }

  function render() {
    root.dataset.spaceMode = view;
    orbitPanel.hidden = view !== "3d";
    planePanels.hidden = view !== "planes";
    if (view === "3d") renderScene();
    else if (view === "planes") renderPlanes();
    renderInspector();
  }

  function chooseLocation(next) {
    selection = next;
    onSelect("");
    const heading = inspector.querySelector('.space-list-heading');
    heading?.focus({ preventScroll: true });
    if (window.matchMedia('(max-width: 760px)').matches) root.querySelector('.space-inspector').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
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
    const controls = event.target.closest('[data-camera]');
    if (controls) changeCamera(controls.dataset.camera);
    const cluster = event.target.closest('[data-space-cluster]');
    if (cluster) {
      const found = clusterPlacements(cases).find(item => item.key === cluster.dataset.spaceCluster);
      if (found?.ids.length === 1) onSelect(found.ids[0]);
      else chooseLocation({ type:'cluster', key:cluster.dataset.spaceCluster });
    }
    const cell = event.target.closest('[data-space-cell]');
    if (cell) { const [plane,x,y] = JSON.parse(cell.dataset.spaceCell); chooseLocation({ type:'plane',plane,x,y }); }
    if (event.target.closest('[data-space-clear]')) { selection = null; onSelect(''); inspector.querySelector('.space-list-heading')?.focus({ preventScroll: true }); }
    if (event.target.closest('[data-space-back]')) { const previous = selected; onSelect(''); const target = [...inspector.querySelectorAll('[data-application-case]')].find(button => button.dataset.applicationCase === previous) || inspector.querySelector('.space-list-heading'); target?.focus({ preventScroll: true }); }
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
      root.dataset.spaceEntering = String(viewChanged);
      if (viewChanged) {
        if (pendingFrame) { cancelAnimationFrame(pendingFrame); pendingFrame = 0; }
        if (drag && svg.hasPointerCapture(drag.id)) svg.releasePointerCapture(drag.id);
        drag = null; svg.classList.remove('is-dragging');
      }
      cases=next; selected=selectedCase; view=nextView;
      if (changed || viewChanged) selection=null;
      render();
    },
    clearLocation() { selection = null; },
    get detailElement() { return inspector.querySelector('.space-case-detail'); }
  };
}
