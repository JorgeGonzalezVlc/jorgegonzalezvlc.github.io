/*
 * Home page: filter the project grid by area without leaving the page.
 * - The area buttons are links to the category pages (works without JS);
 *   with JS they filter the cards below instead.
 * - The active filter is kept in the URL hash (e.g. /#sistemas) so it can be shared.
 */
(function () {
  'use strict';

  var filters = document.getElementById('area-filters');
  var grid = document.getElementById('post-list');
  if (!filters || !grid) return;

  var buttons = Array.prototype.slice.call(filters.querySelectorAll('a[data-filter]'));
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.post-card'));
  var label = document.getElementById('filter-label');
  var count = document.getElementById('filter-count');
  var empty = document.getElementById('filter-empty');
  var heading = document.getElementById('proyectos');
  var defaultLabel = label ? label.textContent : '';

  /* rank of a card among the featured posts of an area (data-featured="blue-team:1 sistemas:3") */
  function featuredRank(card, area) {
    var pairs = (card.dataset.featured || '').split(' ');
    for (var i = 0; i < pairs.length; i++) {
      var kv = pairs[i].split(':');
      if (kv[0] === area && kv[1]) return parseInt(kv[1], 10);
    }
    return Infinity;
  }

  /* inside an area, its featured posts go first; "Todos" keeps the original order (pinned, then by date) */
  function reorder(area) {
    var order = cards.map(function (card, i) {
      return { card: card, i: i, rank: area === 'todos' ? Infinity : featuredRank(card, area) };
    });
    order.sort(function (a, b) { return (a.rank - b.rank) || (a.i - b.i); });
    order.forEach(function (o) {
      o.card.classList.toggle('is-featured', o.rank !== Infinity);
      grid.appendChild(o.card);
    });
  }

  function apply(name, scroll) {
    var button = buttons.filter(function (b) { return b.dataset.filter === name; })[0] || buttons[0];
    var wanted = button.dataset.cats ? button.dataset.cats.split(' ') : [];
    var shown = 0;

    reorder(button.dataset.filter);

    cards.forEach(function (card) {
      var cats = (card.dataset.cats || '').split(' ');
      var match = wanted.length === 0 || wanted.some(function (c) { return cats.indexOf(c) !== -1; });
      card.hidden = !match;
      if (match) {
        shown += 1;
        card.classList.remove('is-entering');
        void card.offsetWidth; /* restart the entrance animation */
        card.classList.add('is-entering');
      }
    });

    buttons.forEach(function (b) {
      var active = b === button;
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
      b.classList.toggle('is-active', active);
    });

    var isAll = button.dataset.filter === 'todos';
    if (label) label.textContent = isAll ? defaultLabel : 'Proyectos · ' + button.textContent.trim();
    if (count) count.textContent = isAll ? '' : String(shown);
    if (empty) empty.hidden = shown !== 0;
    if (heading) heading.className = 'section-heading' + (isAll ? '' : ' area-' + button.dataset.filter);

    if (scroll && heading) {
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.preventDefault();
      var name = b.dataset.filter;
      if (history.replaceState) {
        history.replaceState(null, '', name === 'todos' ? location.pathname : '#' + name);
      }
      apply(name, true);
    });
  });

  /* old links keep working after merging "Desarrollo" and "IA & Automatización" */
  var ALIASES = { 'desarrollo-ia': 'desarrollo-e-ia' };

  function fromHash(scroll) {
    var name = (location.hash || '').replace('#', '');
    name = ALIASES[name] || name;
    var known = buttons.some(function (b) { return b.dataset.filter === name; });
    if (known || name === '') apply(known ? name : 'todos', scroll && known);
  }

  /* a shared link like /#sistemas opens with that filter applied and the grid in view */
  fromHash(true);
  window.addEventListener('hashchange', function () { fromHash(true); });
})();
