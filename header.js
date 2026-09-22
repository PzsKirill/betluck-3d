// Header: sound (off by default, one toggle — rule 19), the page's progress as a thin cyan plate, and the section
// the reader is in.

export function initHeader({ ScrollTrigger }) {
  const btn = document.getElementById("sound");
  window.__sound = false;
  btn.addEventListener("click", () => {
    if (!window.__ac) { try { window.__ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; } }
    window.__sound = !window.__sound;
    if (window.__sound) window.__ac.resume?.();
    btn.setAttribute("aria-pressed", String(window.__sound));
    btn.setAttribute("aria-label", window.__sound ? "Выключить звук" : "Включить звук");
  });

  // The game layer: the explorer's level fills with the page, and discoveries pop as achievements
  const bar = document.getElementById("headProgress"), lvl = document.getElementById("xpLvl");
  const RANKS = ["Новичок", "Следопыт", "Искатель", "Знаток", "Оракул"];
  let level = 0;
  ScrollTrigger.create({ start: 0, end: "max", onUpdate: (s) => {
    const x = s.progress * 5, l = Math.min(4, Math.floor(x));
    bar.style.transform = `scaleX(${(l === 4 ? 1 : x - l).toFixed(4)})`;
    if (l !== level) { level = l; lvl.textContent = `Ур. ${l + 1} · ${RANKS[l]}`; lvl.classList.remove("is-up"); void lvl.offsetWidth; lvl.classList.add("is-up"); }
  } });
  lvl.textContent = `Ур. 1 · ${RANKS[0]}`;
  const box = document.getElementById("toasts"), seen = new Set();
  window.__achieve = (title, sub = "") => {
    if (seen.has(title)) return;
    seen.add(title);
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `<svg class="toast__ico" viewBox="457 0 697 160" aria-hidden="true"><use href="#plate-g"/></svg><span class="toast__k">Достижение получено</span><b></b><span class="toast__s"></span>`;
    el.querySelector("b").textContent = title;
    el.querySelector(".toast__s").textContent = sub;
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add("is-in"));
    setTimeout(() => { el.classList.remove("is-in"); setTimeout(() => el.remove(), 600); }, 3600);
    if (window.__sound && window.__ac) {
      const ac = window.__ac, t = ac.currentTime;
      [660, 990].forEach((f, i) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = "triangle"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + i * 0.09); g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.09 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.35);
        o.connect(g).connect(ac.destination); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.4);
      });
    }
  };

  const links = [...document.querySelectorAll(".head__nav a")];
  const map = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      links.forEach((a) => a.classList.remove("is-here"));
      map.get(e.target.id)?.classList.add("is-here");
    }
  }, { rootMargin: "-45% 0px -50% 0px" });
  for (const id of map.keys()) { const s = document.getElementById(id); if (s) io.observe(s); }
  return { start() {} };
}
