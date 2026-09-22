# betluck-3d

Концепт сайта BETLUCK «Экспедиция за удачей» от duck.design: вид от первого лица, ночные джунгли и Храм Удачной ставки на three.js.
Это демонстрационный концепт, а не официальный сайт BetLuck. Страница закрыта от индексации. Контент рассчитан на аудиторию 18+.

**Демо:** https://pzskirill.github.io/betluck-3d/

## Как открыть локально
Сайт статический, собирать его не нужно, но открывать нужно через локальный сервер: с `file://` модули и 3D-модели не загрузятся.
```
python -m http.server 5173
```
Затем откройте http://localhost:5173/

## Технологии
three.js r170 (один WebGL-контекст на всю страницу, постобработка bloom), GSAP ScrollTrigger, Lenis, шрифт Geologica (Google Fonts, OFL).

## Данные
- Прогнозы и коэффициенты по The International 2026: страницы прогнозов betluck.ru (22.08.2026).
- Сетка и счёт турнира: Liquipedia; поминутное золото: OpenDota (league 19719).
- Заголовки новостей: betluck.ru, 18–21.09.2026.
- Линия на сегодня, коэффициенты «матча дня», бонусы и голоса читателей — иллюстрация для концепта.

## 3D-модели (CC0)
- Quaternius: Stylized Nature MegaKit, Ultimate Monsters (грибной народец), Modular Ruins, пальмы и лианы — https://quaternius.com
- Isa Lousberg: Large Monstera, Pothos Vine — https://poly.pizza
- reyshapes: Big Leaf Plant — https://poly.pizza

Шаблон логотипа BETLUCK обведён с макета из портфолио duck.design (черновик до исходника клиента).
