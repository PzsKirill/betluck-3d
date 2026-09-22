// Everything the page says lives here, so a repositioning is a text pass, not a rebuild.
// real: true   → taken from a source in docs/research.md (and the source is linked)
// real: false  → illustrative for the concept; the footer says so

// A real betluck.ru pick from The International 2026 — and one that came in (research/tournament-sources.md).
// The hero assembles it, «Разбор» takes it apart. Odds are BetBoom's, as quoted on the prediction page.
export const MATCH = {
  game: "Dota 2",
  event: "The International 2026",
  stage: "Финал верхней сетки",
  date: "22 августа 2026",
  format: "BO3",
  a: { name: "TEAM VISION", short: "VISION", odds: 1.26 },
  b: { name: "Team Yandex", short: "Yandex", odds: 4.0 },
  pick: { text: "VISION 2:1", side: "a", odds: 3.3 },
  result: { score: "2:1", hit: true },
  source: "https://betluck.ru/prognoz/team-vision-team-yandex-prognoz-na-22-avgusta-2026",
  real: true,
};

// Hero: the facts behind that pick. Odds from the prediction page; the rest computed from the TI 2026 playoff games
// played before the final (Liquipedia bracket, OpenDota games) — all real.
export const HERO_CHIPS = [
  { k: "П1 VISION", v: "1.26", real: true },
  { k: "П2 Yandex", v: "4.00", real: true },
  { k: "Счёт 2:1", v: "3.30", real: true },
  { k: "Формат", v: "BO3", real: true },
  { k: "VISION в плей-офф", v: "2–0", real: true },
  { k: "Yandex в плей-офф", v: "2–0", real: true },
  { k: "Карты VISION", v: "4–2", real: true },
  { k: "Карты Yandex", v: "4–1", real: true },
  { k: "Серии VISION в три карты", v: "2 из 2", real: true },
  { k: "Средняя игра VISION", v: "46 мин", real: true },
  { k: "Средняя игра Yandex", v: "55 мин", real: true },
  { k: "Убийств за карту", v: "25 / 41", real: true },
  { k: "TI 2026", v: "Шанхай", real: true },
];

// Today's match — illustrative (real teams, invented fixture and odds). «Проверь себя» and «Где ставить» use it.
export const DAY = {
  game: "Dota 2",
  time: "19:00",
  format: "BO3",
  a: { name: "Team Spirit", short: "Spirit" },
  b: { name: "Tundra Esports", short: "Tundra" },
  outcomes: [
    { id: "a", label: "Победа Spirit" },
    { id: "b", label: "Победа Tundra" },
    { id: "pick", label: "Spirit 2:1" },
  ],
  pick: "pick",     // BetLuck's pick among the outcomes
  readers: { a: 0.57, b: 0.43 }, // readers' vote, illustrative
  real: false,
};

// «Сегодня в линии»: real teams, illustrative fixtures and odds (no real event names on invented fixtures)
export const LINE = {
  date: "21 сентября",
  games: [
    { id: "dota2", name: "Dota 2", matches: [
      { time: "15:00", a: "BetBoom Team", b: "Team Falcons", oa: 2.25, ob: 1.62, pick: "П2" },
      { time: "19:00", a: "Team Spirit", b: "Tundra Esports", oa: 1.8, ob: 1.98, pick: "Spirit 2:1", day: true },
      { time: "22:00", a: "Team Liquid", b: "Gaimin Gladiators", oa: 1.66, ob: 2.2, pick: "П1" },
    ] },
    { id: "cs2", name: "CS2", matches: [
      { time: "16:00", a: "Team Vitality", b: "Aurora", oa: 1.44, ob: 2.7, pick: "П1" },
      { time: "18:30", a: "Natus Vincere", b: "FURIA", oa: 1.95, ob: 1.83, pick: "Тотал карт больше 2.5" },
      { time: "21:00", a: "Team Spirit", b: "MOUZ", oa: 1.72, ob: 2.1, pick: "П1" },
    ] },
    { id: "deadlock", name: "Deadlock", matches: [] },
  ],
  real: false,
};

// «Где ставить» / «Букмекеры»: partners seen in betluck.ru's affiliate links (+ FONBET, PARI from its rating).
// Scores are betluck.ru's where known; odds on today's match and bonuses are illustrative.
export const BOOKS = [
  { id: "betboom", name: "BetBoom", score: 4.6, bonus: "Фрибет новым игрокам", odds: { a: 1.8, b: 1.98, pick: 3.4 } },
  { id: "winline", name: "Winline", score: null, bonus: "Фрибет новым игрокам", odds: { a: 1.78, b: 2.02, pick: 3.25 } },
  { id: "liga", name: "Лига Ставок", score: null, bonus: "Бонус на первый депозит", odds: { a: 1.76, b: 2.0, pick: 3.3 } },
  { id: "fonbet", name: "FONBET", score: null, bonus: "Фрибет новым игрокам", odds: { a: 1.82, b: 1.95, pick: 3.2 } },
  { id: "pari", name: "PARI", score: null, bonus: "Фрибет новым игрокам", odds: { a: 1.79, b: 2.0, pick: 3.35 } },
];

// Real headlines from betluck.ru, 18–21.09.2026 (dek only where the source says more than the headline)
export const NEWS = [
  { id: "vitality-starseries", game: "CS2", date: "20 сентября", title: "Team Vitality выиграла StarSeries Fall 2026",
    dek: "В финале Vitality обыграла Aurora со счётом 3:1.",
    url: "https://betluck.ru/novost/team-vitality-vyigrala-star-series-fall-2026" },
  { id: "aunkere-eleague", game: "CS2", date: "21 сентября", title: "Aunkere Team стала чемпионом Fonbet Media Eleague Season 9",
    dek: "В финале — 2:1 над shoke Team. Призовой фонд — 1 500 000 ₽.", url: "https://betluck.ru/game/cs2" },
  { id: "navi-vrs", game: "CS2", date: "21 сентября", title: "Natus Vincere обновила антирекорд в симуляции рейтинга VRS",
    dek: "17-е место.", url: "https://betluck.ru/novosti" },
  { id: "yekindar-furia", game: "CS2", date: "18 сентября", title: "YEKINDAR отказался от роли капитана FURIA",
    dek: "", url: "https://betluck.ru/novosti" },
  { id: "wildcard-fr3nd", game: "CS2", date: "18 сентября", title: "Wildcard подписала fr3nd на замену mhL",
    dek: "", url: "https://betluck.ru/novosti" },
];

export const WARNING = "Участие в азартных играх может привести к возникновению зависимости от азартных игр";
export const AD = { label: "Реклама", advertiser: "Рекламодатель: букмекер-партнёр", erid: "erid: —" };
