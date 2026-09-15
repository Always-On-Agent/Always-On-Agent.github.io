"use strict";

// Figures expand inside the page; native dialog keeps focus and Esc handling.
const imageLightbox = document.getElementById("image-lightbox");
const lightboxImage = document.getElementById("image-lightbox-image");
let imageZoomTrigger;
document.querySelectorAll("[data-zoom-image]").forEach(trigger => {
  trigger.addEventListener("click", () => {
    const thumbnail = trigger.closest("figure").querySelector("img");
    imageZoomTrigger = trigger;
    lightboxImage.src = thumbnail.currentSrc || thumbnail.src;
    lightboxImage.alt = thumbnail.alt;
    document.documentElement.classList.add("image-zoom-open");
    imageLightbox.showModal();
    // Keep the loaded preview visible while its original-resolution image loads.
    const original = new Image();
    original.addEventListener("load", () => {
      if (imageLightbox.open && imageZoomTrigger === trigger) lightboxImage.src = original.src;
    });
    original.src = trigger.dataset.zoomImage;
  });
});
imageLightbox.addEventListener("click", () => imageLightbox.close());
imageLightbox.addEventListener("close", () => {
  document.documentElement.classList.remove("image-zoom-open");
  imageZoomTrigger?.focus({ preventScroll: true });
  imageZoomTrigger = undefined;
});

// Loop typing/deleting only while the heading is visible; reserve its full width.
const terminalHeading = document.querySelector("[data-terminal-heading]");
if (terminalHeading && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  terminalHeading.classList.add("terminal-ready");
  if ("IntersectionObserver" in window) {
    const terminalObserver = new IntersectionObserver((entries) => {
      terminalHeading.classList.toggle("terminal-playing", entries.some(entry => entry.isIntersecting));
    }, { threshold: 0.5 });
    terminalObserver.observe(terminalHeading);
  } else {
    terminalHeading.classList.add("terminal-playing");
  }
}

// Nodes and directed channels share one accessible set of in-page panels.
const frameworkExplorer = document.getElementById("framework-explorer");
if (frameworkExplorer) {
  const tabs = [...frameworkExplorer.querySelectorAll("[data-framework-select]")];
  const edges = [...frameworkExplorer.querySelectorAll("[data-loop-edge]")];
  const details = frameworkExplorer.querySelector(".framework-details");
  const navigation = frameworkExplorer.querySelector(".framework-navigation");
  const moduleIds = { s: "sensing", m: "memory", a: "action" };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const narrowLayout = window.matchMedia("(max-width: 960px)");
  let flowAnimation;
  reducedMotion.addEventListener?.("change", () => {
    if (reducedMotion.matches) flowAnimation?.cancel();
  });

  function revealDetails() {
    details.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "start" });
  }

  function selectFramework(tab, { focusTab = false, focusPanel = false, reveal = false, animate = true } = {}) {
    const key = tab.dataset.frameworkSelect;
    tabs.forEach(item => {
      const selected = item === tab;
      item.setAttribute("aria-selected", String(selected));
      item.tabIndex = selected ? 0 : -1;
      document.getElementById(item.getAttribute("aria-controls")).hidden = !selected;
      const connected = key.length === 2 && [...key].some(letter => moduleIds[letter] === item.dataset.frameworkSelect);
      item.classList.toggle("is-connected", connected);
    });
    edges.forEach(edge => edge.classList.toggle("is-active", edge.dataset.loopEdge === key));
    flowAnimation?.cancel();
    flowAnimation = undefined;
    const trace = edges.find(edge => edge.dataset.loopEdge === key)?.querySelector(".loop-trace");
    if (animate && !reducedMotion.matches && trace?.animate) {
      // A single directional pass on selection; the static difficulty styling stays visible.
      flowAnimation = trace.animate([
        { strokeDashoffset: "13", opacity: 0, offset: 0 },
        { strokeDashoffset: "0", opacity: 1, offset: 0.15 },
        { strokeDashoffset: "-85", opacity: 1, offset: 0.85 },
        { strokeDashoffset: "-100", opacity: 0, offset: 1 }
      ], { duration: 800, easing: "ease-in-out", iterations: 1 });
    }
    if (focusTab) tab.focus({ preventScroll: true });
    if (focusPanel) document.getElementById(tab.getAttribute("aria-controls")).focus({ preventScroll: true });
    if (reveal) revealDetails();
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectFramework(tab, { reveal: narrowLayout.matches }));
    tab.addEventListener("keydown", event => {
      let next;
      if (["ArrowRight", "ArrowDown"].includes(event.key)) next = (index + 1) % tabs.length;
      if (["ArrowLeft", "ArrowUp"].includes(event.key)) next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      if (next !== undefined) {
        event.preventDefault();
        selectFramework(tabs[next], { focusTab: true });
      }
    });
  });
  // SVG routes are pointer shortcuts; the matching native tabs provide keyboard access.
  edges.forEach(edge => edge.addEventListener("click", () => {
    selectFramework(tabs.find(tab => tab.dataset.frameworkSelect === edge.dataset.loopEdge), {
      focusTab: true, reveal: narrowLayout.matches
    });
  }));
  frameworkExplorer.querySelectorAll("[data-explore-target]").forEach(button => {
    button.addEventListener("click", () => selectFramework(
      tabs.find(tab => tab.dataset.frameworkSelect === button.dataset.exploreTarget),
      { focusPanel: true, reveal: true }
    ));
  });
  frameworkExplorer.querySelector("[data-framework-back]").addEventListener("click", () => {
    tabs.find(tab => tab.getAttribute("aria-selected") === "true").focus({ preventScroll: true });
    navigation.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "start" });
  });
  selectFramework(tabs.find(tab => tab.getAttribute("aria-selected") === "true") || tabs[0], { animate: false });
}

const copyButton = document.getElementById("copy-citation");
const copyStatus = document.getElementById("copy-status");
let copyStatusTimer;
copyButton.addEventListener("click", async () => {
  clearTimeout(copyStatusTimer);
  try {
    await navigator.clipboard.writeText(document.getElementById("bibtex").textContent.trim());
    copyStatus.textContent = "Copied!";
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(document.getElementById("bibtex"));
    selection.removeAllRanges();
    selection.addRange(range);
    copyStatus.textContent = "Selected — press Ctrl/Cmd+C";
  }
  copyStatusTimer = setTimeout(() => { copyStatus.textContent = ""; }, 5000);
});

const navLinks = [...document.querySelectorAll("nav a[href^='#']")];
if ("IntersectionObserver" in window) {
  const visibleSections = new Map();
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => visibleSections.set(entry.target.id, entry.isIntersecting));
    const active = navLinks.find((link) => visibleSections.get(link.hash.slice(1)));
    navLinks.forEach((link) => {
      if (link === active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }, { rootMargin: "-130px 0px -55% 0px", threshold: 0 });
  navLinks.forEach((link) => observer.observe(document.querySelector(link.hash)));
}
