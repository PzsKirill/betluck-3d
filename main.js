// Boot. Every chapter is its own module and fails alone: a broken tournament must never take the hero down.

import { frame, compileAll, reduced } from "./world.js";

const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);
if (new URLSearchParams(location.search).has("instant")) window.__qaInstant = true;
if (location.protocol === "file:") document.documentElement.classList.add("is-file");

// ── Scroll ──
let lenis = null;
if (!reduced && window.Lenis) {
  try {
    lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
    const unfreeze = () => { if (lenis.isStopped && document.getElementById("boot")?.classList.contains("is-gone") && !document.querySelector("dialog[open]")) lenis.start(); };
    addEventListener("wheel", unfreeze, { passive: true, capture: true });
    addEventListener("keydown", unfreeze);
  } catch (err) { console.warn("[betluck] smooth scroll off:", err); lenis = null; }
}
window.__lenis = lenis;
gsap.ticker.add(frame);

const goto = (target) => {
  const el = typeof target === "string" ? document.querySelector(target) : target;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else el.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
};
document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.getAttribute("href").length < 2) return;
  e.preventDefault();
  goto(a.getAttribute("href"));
});

// ── Chapters ──
const ctx = { gsap, ScrollTrigger, lenis };
const MODULES = [
  ["header", () => import("./header.js"), "initHeader"],
  ["blocks", () => import("./blocks.js"), "initBlocks"],
  ["jungle", () => import("./jungle.js"), "initJungle"],
  ["razbor", () => import("./razbor.js"), "initRazbor"],
  ["check", () => import("./check.js"), "initCheck"],
  ["odds", () => import("./odds.js"), "initOdds"],
  ["tournament", () => import("./tournament.js"), "initTournament"],
];

const boot = document.getElementById("boot");
const minShow = new Promise((r) => setTimeout(r, reduced ? 0 : 1900)); // the CSS spark always completes
let revealed = false;
const reveal = (apis) => {
  if (revealed) return;
  revealed = true;
  boot.classList.add("is-gone");
  lenis?.start();
  for (const api of apis) { try { api?.start?.(); } catch (err) { console.error(err); } }
  ScrollTrigger.refresh();
  setTimeout(() => boot.remove(), 1200);
};
const net = setTimeout(() => reveal([]), 9000); // whatever happens below, the page opens

const loaded = await Promise.all(MODULES.map(([name, load]) => load().catch((err) => { console.error(`[betluck] ${name} failed to load`, err); return null; })));
const apis = [];
for (let i = 0; i < MODULES.length; i++) {
  const [name, , fn] = MODULES[i];
  if (!loaded[i]) continue;
  try { apis.push(await loaded[i][fn](ctx)); } catch (err) { console.error(`[betluck] ${name} failed`, err); }
}
document.documentElement.classList.add("has-3d");
await Promise.race([compileAll(), new Promise((r) => setTimeout(r, 6000))]);
await minShow;
clearTimeout(net);
reveal(apis);
window.__ready = true;

let refreshTimer;
addEventListener("resize", () => { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 250); });
addEventListener("load", () => ScrollTrigger.refresh());
