"use strict";

// Accessible channel tabs: pointer, arrow keys, Home and End.
const channelTabs = [...document.querySelectorAll("[data-channel]")];
function selectChannel(tab, focus = false) {
  channelTabs.forEach((item) => {
    const selected = item === tab;
    item.setAttribute("aria-selected", String(selected));
    item.tabIndex = selected ? 0 : -1;
    document.getElementById(item.getAttribute("aria-controls")).hidden = !selected;
  });
  if (focus) tab.focus();
}
channelTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectChannel(tab));
  tab.addEventListener("keydown", (event) => {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % channelTabs.length;
    if (event.key === "ArrowLeft") next = (index - 1 + channelTabs.length) % channelTabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = channelTabs.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      selectChannel(channelTabs[next], true);
    }
  });
});

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
