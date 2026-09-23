// «Оракулы» — the pick taken apart, told by two carved stone oracles.
//
// No 3D here on purpose: the chamber is photographs of carved stone and jungle ruins stacked on top of each other and
// blended (lighten, soft-light, screen), moved apart by the scroll — cheap to run, and the stone looks like stone.
// Photos: Unsplash License (free for commercial use), see assets/img/oracle/credits.json.
//
// Scroll walks through the four layers of the prediction, drawn from the real TI 2026 data; the oracle on the
// speaking side opens its eyes, and at the end the verdict lands: VISION 2:1, and the series did end 2:1.

import { MATCH } from "./content.js";

const INK = "#F8F8F8", CYAN = "#3DD9FF", MUTE = "#9A98B8", SILVER = "#C9D1E6";

// The layers as drawings on canvases. Values come from tournament.json (see docs/research.md).
async function layerCanvases(tour) {
  await Promise.race([document.fonts?.load("800 60px Geologica"), new Promise((r) => setTimeout(r, 1500))]);
  const ser = Object.fromEntries(tour.rounds.flatMap((r) => r.series).map((s) => [s.id, s]));
  const before = ["ub-qf-2", "ub-sf-1", "ub-qf-3", "ub-sf-2"];
  const teamGames = (team) => before.map((id) => ser[id]).filter((s) => s.a === team || s.b === team).map((s) => {
    const side = s.a === team ? "a" : "b", opp = side === "a" ? s.b : s.a;
    return { opp, won: s.winner === side, score: side === "a" ? s.score : [...s.score].reverse(), games: s.games.map((g) => ({ win: g.winner === side, min: Math.round(g.duration / 60) })) };
  });
  const V = teamGames("TEAM VISION"), Y = teamGames("Team Yandex");
  const short = (n) => n.replace(/^Team /, "").replace("Nigma Galaxy", "Nigma");

  const make = (draw) => {
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 256;
    const g = c.getContext("2d");
    g.textBaseline = "alphabetic";
    draw(g);
    return c;
  };
  const font = (w, px) => `${w} ${px}px Geologica, "Segoe UI", sans-serif`;
  const rowLabel = (g, y, name) => { g.fillStyle = INK; g.font = font(800, 34); g.fillText(name, 150, y); };

  return [
    // 1 · Form: the playoff series before the final
    make((g) => {
      [[V, "VISION", 104], [Y, "Yandex", 186]].forEach(([list, name, y]) => {
        rowLabel(g, y, name);
        list.forEach((s, i) => {
          const x = 380 + i * 250;
          g.fillStyle = s.won ? CYAN : SILVER; g.font = font(800, 38);
          g.fillText(`${s.score[0]}:${s.score[1]}`, x, y);
          g.fillStyle = MUTE; g.font = font(500, 24);
          g.fillText(short(s.opp), x + 76, y);
        });
      });
    }),
    // 2 · Maps: every game, won or lost
    make((g) => {
      [[V, "VISION", 104], [Y, "Yandex", 186]].forEach(([list, name, y]) => {
        rowLabel(g, y, name);
        let x = 380;
        list.forEach((s) => {
          s.games.forEach((m) => {
            g.fillStyle = m.win ? CYAN : "#3A3960";
            g.beginPath(); g.moveTo(x + 10, y - 34); g.lineTo(x + 50, y - 34); g.lineTo(x + 40, y + 2); g.lineTo(x, y + 2); g.closePath(); g.fill();
            x += 60;
          });
          x += 34;
        });
      });
    }),
    // 3 · Tempo: game lengths in minutes, the average marked
    make((g) => {
      [[V, "VISION", 104], [Y, "Yandex", 186]].forEach(([list, name, y]) => {
        rowLabel(g, y, name);
        const mins = list.flatMap((s) => s.games.map((m) => m.min));
        const avg = Math.round(mins.reduce((a, b) => a + b, 0) / mins.length);
        const x0 = 380, scale = 5.2;
        g.fillStyle = "#26244A"; g.fillRect(x0, y - 30, 80 * scale, 30);
        g.fillStyle = name === "VISION" ? CYAN : SILVER; g.fillRect(x0, y - 30, avg * scale, 30);
        g.fillStyle = INK; g.font = font(800, 34); g.fillText(`${avg} мин`, x0 + 80 * scale + 20, y);
        g.fillStyle = MUTE; g.font = font(500, 22); g.fillText(mins.join(" · "), x0, y + 32);
      });
    }),
    // 4 · Odds: favourite, underdog, and the score we picked
    make((g) => {
      const rows = [["VISION", MATCH.a.odds, CYAN, 94], ["Yandex", MATCH.b.odds, SILVER, 160], ["VISION 2:1", MATCH.pick.odds, CYAN, 226]];
      rows.forEach(([k, v, col, y], i) => {
        g.fillStyle = i === 2 ? CYAN : INK; g.font = font(800, i === 2 ? 36 : 32); g.fillText(k, 150, y);
        g.fillStyle = "#26244A"; g.fillRect(420, y - 28, 420, 26);
        g.fillStyle = col; g.fillRect(420, y - 28, Math.min(420, (v / 4.2) * 420), 26);
        g.fillStyle = INK; g.font = font(800, 34); g.fillText(v.toFixed(2), 860, y);
      });
    }),
  ];
}

export async function initRazbor({ ScrollTrigger }) {
  const section = document.getElementById("razbor");
  const stage = section.querySelector(".razbor__stage");
  const layerEls = [...section.querySelectorAll(".layer")];
  const verdictEl = document.getElementById("razborVerdict");
  const plate = document.getElementById("razborPlate");
  const cap = document.getElementById("razborPlateCap");
  const parEls = [...section.querySelectorAll("[data-par]")];
  const eyes = { left: section.querySelector(".oracle__l--left"), right: section.querySelector(".oracle__l--right") };
  const tour = await fetch("assets/data/tournament.json").then((r) => r.json());
  const canvases = await layerCanvases(tour);
  const CAPS = ["Форма · плей-офф до финала", "Карты · каждая игра серии", "Темп · длительность карт", "Коэффициенты · линия BetBoom"];
  for (const c of canvases) { c.style.display = "none"; plate.prepend(c); }

  let prog = 0, active = -1, verdictOn = false, px = 0, py = 0;
  ScrollTrigger.create({ trigger: section, start: "top top", end: "bottom bottom", onUpdate: (s) => { prog = s.progress; frame(); } });
  stage.addEventListener("pointermove", (e) => {
    const r = stage.getBoundingClientRect();
    px = ((e.clientX - r.left) / r.width - 0.5) * 2;
    py = ((e.clientY - r.top) / r.height - 0.5) * 2;
    frame();
  });

  function frame() {
    // the layers drift apart with the scroll and lean with the pointer: the depth of the chamber
    for (const el of parEls) {
      const k = Number(el.dataset.par);
      el.style.setProperty("--y", `${(prog - 0.5) * -k * 3 + py * k * 0.6}px`);
      el.style.setProperty("--x", `${px * k * 0.5}px`);
      if (!el.classList.contains("oracle__shaft")) el.style.transform = `translate3d(${px * k * 0.5}px, ${(prog - 0.5) * -k * 3 + py * k * 0.6}px, 0)`;
    }
    const idx = Math.min(3, Math.max(0, Math.floor((prog - 0.06) / 0.2)));
    const on = prog > 0.06 && prog < 0.92;
    if (idx !== active || !on) {
      if (on) {
        active = idx;
        layerEls.forEach((el, i) => el.classList.toggle("is-on", i === idx));
        canvases.forEach((c, i) => { c.style.display = i === idx ? "block" : "none"; });
        cap.textContent = CAPS[idx] || "";
        plate.classList.add("is-on");
        eyes.left.style.setProperty("--speak", idx % 2 === 0 ? 0.55 : 0.18);
        eyes.right.style.setProperty("--speak", 0.45);
        eyes.right.classList.remove("is-speak");           // the big oracle wakes on every layer
        void eyes.right.offsetWidth;
        eyes.right.classList.add("is-speak");
      } else {
        active = -1;
        plate.classList.remove("is-on");
        layerEls.forEach((el) => el.classList.remove("is-on"));
        eyes.left.style.setProperty("--speak", 0.1);
        eyes.right.style.setProperty("--speak", 0.1);
      }
    }
    const v = prog > 0.9;
    if (v !== verdictOn) { verdictOn = v; verdictEl.classList.toggle("is-on", v); }
  }

  frame();
  return { start() { frame(); } };
}
