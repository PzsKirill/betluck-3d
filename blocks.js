// The DOM side of every block: lists, controls, readouts. 3D chapters draw behind these and read the same state,
// so the page is whole without WebGL, with reduced motion, and before a chapter has loaded.

import { MATCH, DAY, LINE, BOOKS, NEWS, WARNING, AD } from "./content.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const odds = (v) => (v == null ? "—" : v.toFixed(2));
const rub = (v) => Math.round(v).toLocaleString("ru-RU").replace(/ /g, " ");

// Shared state the 3D chapters subscribe to
export const state = {
  outcome: DAY.pick, stake: 1000, mine: null,
  listeners: new Set(),
  set(patch) { Object.assign(this, patch); for (const f of this.listeners) f(this); },
  on(f) { this.listeners.add(f); f(this); return () => this.listeners.delete(f); },
};

export function initBlocks({ ScrollTrigger }) {
  const refresh = (() => { let t; return () => { clearTimeout(t); t = setTimeout(() => ScrollTrigger.refresh(), 250); }; })();

  // Advertising marks and the addiction warning, everywhere they are needed
  document.querySelectorAll("[data-ad]").forEach((el) => {
    el.querySelector(".ad__label").textContent = AD.label;
    el.querySelector(".ad__who").textContent = AD.advertiser;
    el.querySelector(".ad__erid").textContent = AD.erid;
  });
  document.querySelectorAll("[data-warn]").forEach((el) => (el.textContent = WARNING));

  initLine(refresh);
  initRazbor();
  initCheck();
  initOdds();
  initBooks();
  initNews();
  return { start() {} };
}

// ── 2 · Line ──
function initLine(refresh) {
  $("#lineDate").textContent = LINE.date;
  const tabs = $("#lineGames"), list = $("#lineList");
  const show = (id) => {
    const g = LINE.games.find((x) => x.id === id);
    tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.id === id)));
    list.innerHTML = g.matches.length ? g.matches.map((m) => `
      <li class="match${m.day ? " is-day" : ""}">
        <span class="match__time">${esc(m.time)}</span>
        <span class="match__teams">${m.day ? '<span class="match__day">Матч дня</span>' : ""}${esc(m.a)}<span>—</span>${esc(m.b)}</span>
        <span class="match__odds"><span>П1 <b>${odds(m.oa)}</b></span><span>П2 <b>${odds(m.ob)}</b></span></span>
        <span class="match__pick"><span>${esc(m.pick)}</span></span>
      </li>`).join("") : `<li class="matches__empty">Сегодня матчей нет. Ближайшие прогнозы появятся в линии накануне.</li>`;
    refresh();
  };
  tabs.innerHTML = LINE.games.map((g) => `<button type="button" role="tab" data-id="${g.id}">${esc(g.name)}<span class="count">${g.matches.length}</span></button>`).join("");
  tabs.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) show(b.dataset.id); });
  show(LINE.games[0].id);
}

// ── 3 · Razbor: the four layers of the real pick (the 3D chapter lights them as it scrolls) ──
export const LAYERS = [
  { k: "Форма", v: "2–0 и 2–0", t: "Обе команды прошли верхнюю сетку без поражений: VISION обыграла BoomBoys и Team Spirit, Yandex — Team Liquid и Nigma Galaxy." },
  { k: "Карты", v: "4–2 и 4–1", t: "Обе серии VISION в плей-офф дошли до третьей карты: фаворит отдаёт игры." },
  { k: "Темп", v: "46 и 55 мин", t: "Yandex играет дольше и кровавее — 41 убийство за карту против 25 у VISION. Такую команду трудно обыграть всухую." },
  { k: "Коэффициенты", v: `${odds(MATCH.a.odds)} и ${odds(MATCH.b.odds)}`, t: `Букмекер видел в VISION явного фаворита. Счёт 2:1 стоил ${odds(MATCH.pick.odds)} — в 2,6 раза больше простой победы.` },
];

function initRazbor() {
  $("#razborMeta").textContent = `${MATCH.event} · ${MATCH.stage} · ${MATCH.date}`;
  $("#razborTitle").textContent = `${MATCH.a.short} — ${MATCH.b.short}`;
  $("#razborLayers").innerHTML = LAYERS.map((l, i) => `
    <li class="layer" data-i="${i}">
      <span class="layer__k">${esc(l.k)}</span><span class="layer__v">${esc(l.v)}</span>
      <p class="layer__t">${esc(l.t)}</p>
    </li>`).join("");
  setVerdict();
}

export function setVerdict(result = MATCH.result) {
  const el = $("#razborVerdict");
  const stamp = result == null ? "" : `<span class="stamp ${result.hit ? "stamp--hit" : "stamp--miss"}">${result.hit ? "Зашёл" : "Не зашёл"}</span>`;
  const score = result == null ? "" : ` Итог серии — ${esc(result.score)}.`;
  el.innerHTML = `Прогноз BetLuck: <b>${esc(MATCH.pick.text)}</b> · кэф ${odds(MATCH.pick.odds)}.${score}${stamp}<br><span class="note">Пик и коэффициенты — <a href="${MATCH.source}" target="_blank" rel="noopener">прогноз betluck.ru</a> (линия BetBoom); статистика плей-офф — Liquipedia, OpenDota.</span>`;
}

// ── 4 · Check: your pick against the readers' and ours ──
function initCheck() {
  $("#checkMeta").textContent = `${DAY.game} · ${DAY.time} · ${DAY.format}`;
  const teams = $("#checkTeams");
  teams.innerHTML = ["a", "b"].map((s) => `
    <button type="button" class="team-drop team-drop--${s}" data-side="${s}" style="${s === "a" ? "left" : "right"}: 6vw">
      <span class="team-drop__name">${esc(DAY[s].short)}</span><span class="team-drop__k">${esc(DAY[s].name)}</span>
    </button>`).join("");
  const res = $("#checkResult");
  let mine = null;
  try { mine = localStorage.getItem("bl-mine"); } catch {}
  const render = () => {
    teams.querySelectorAll(".team-drop").forEach((b) => b.classList.toggle("is-mine", b.dataset.side === mine));
    if (!mine) { res.innerHTML = `<p class="check__hint">Перетащите плашку на команду — или нажмите на её название.</p>`; return; }
    const r = DAY.readers, ours = DAY.outcomes.find((o) => o.id === DAY.pick);
    const agree = (mine === "a" && (DAY.pick === "a" || DAY.pick === "pick")) || mine === DAY.pick;
    res.innerHTML = `
      <div class="split">
        <div class="split__legend"><span>${esc(DAY.a.short)} · ${Math.round(r.a * 100)} % читателей</span><span>${esc(DAY.b.short)} · ${Math.round(r.b * 100)} %</span></div>
        <div class="split__bar"><i style="width:${r.a * 100}%"></i><i style="width:${r.b * 100}%"></i></div>
        <p>Ваш выбор — <b>${esc(DAY[mine].short)}</b>. Редакция ставит на <b>${esc(ours.label)}</b>${agree ? " — вы совпали." : " — у вас другое мнение."} Итог узнаем после матча.</p>
        <p class="note">Голоса читателей — иллюстрация.</p>
      </div>`;
  };
  teams.addEventListener("click", (e) => {
    const b = e.target.closest(".team-drop");
    if (!b) return;
    choose(b.dataset.side);
  });
  const choose = (side) => {
    mine = side;
    try { localStorage.setItem("bl-mine", side); } catch {}
    state.set({ mine });
    render();
  };
  state.choose = choose;
  state.mine = mine;
  render();
}

// ── 5 · Odds: the same outcome at each partner ──
function initOdds() {
  const out = $("#oddsOutcomes"), stakeIn = $("#oddsStake"), readout = $("#oddsReadout"), bars = $("#oddsBars");
  out.innerHTML = DAY.outcomes.map((o) => `<button type="button" role="radio" data-id="${o.id}" aria-checked="false">${esc(o.label)}</button>`).join("");
  out.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) state.set({ outcome: b.dataset.id }); });
  const parse = () => { const v = parseInt(stakeIn.value.replace(/\D/g, ""), 10); return Number.isFinite(v) ? Math.min(v, 1e7) : 0; };
  stakeIn.addEventListener("input", () => state.set({ stake: parse() }));
  stakeIn.addEventListener("blur", () => (stakeIn.value = rub(state.stake)));

  state.on((s) => {
    out.querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.id === s.outcome)));
    const list = BOOKS.map((b) => ({ ...b, k: b.odds[s.outcome] })).sort((a, b) => b.k - a.k);
    const best = list[0], worst = list[list.length - 1];
    const max = best.k, min = Math.min(...list.map((b) => b.k)) * 0.9;
    bars.innerHTML = list.map((b) => `
      <li class="bar${b === best ? " is-best" : ""}"><span class="bar__name">${esc(b.name)}</span>
        <span class="bar__track"><i class="bar__fill" style="width:${(((b.k - min) / (max - min)) * 88 + 12).toFixed(1)}%"></i></span>
        <span class="bar__odds">${odds(b.k)}</span></li>`).join("");
    const label = DAY.outcomes.find((o) => o.id === s.outcome).label;
    readout.innerHTML = s.stake > 0
      ? `«${esc(label)}»: при ставке ${rub(s.stake)} ₽ выплата в случае выигрыша — <b>${rub(s.stake * best.k)} ₽</b> в ${esc(best.name)}, на ${rub(s.stake * (best.k - worst.k))} ₽ больше, чем в ${esc(worst.name)}.`
      : "Введите сумму ставки.";
    state.books = list;
  });
}

// ── 7 · Books ──
function initBooks() {
  $("#booksList").innerHTML = BOOKS.map((b, i) => `
    <li class="book${i === 0 ? " is-choice" : ""}">
      <span class="book__name">${i === 0 ? '<span class="book__choice">Выбор BetLuck</span>' : ""}${esc(b.name)}</span>
      <span class="book__bonus">${esc(b.bonus)}</span>
      <span class="book__score">${b.score ? `<b>${b.score.toFixed(1)}</b> / 5` : ""}</span>
      <a class="btn btn--ghost" href="#books"><span>Обзор</span></a>
    </li>`).join("");
}

// ── 8 · News ──
function initNews() {
  $("#newsList").innerHTML = NEWS.map((n, i) => `
    <li class="newsitem${i === 0 ? " newsitem--lead" : ""}"><a href="${esc(n.url)}" target="_blank" rel="noopener">
      <span class="newsitem__meta">${esc(n.game)} · ${esc(n.date)}</span>
      <span class="newsitem__title">${esc(n.title)}</span>
      ${n.dek ? `<span class="newsitem__dek">${esc(n.dek)}</span>` : ""}
    </a></li>`).join("");
}
