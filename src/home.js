import { initNetwork } from './network.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function initHero(hero) {
  const controls = hero.querySelector('.hero-controls');
  const pauseButton = hero.querySelector('.hero-pause');
  const slides = [...hero.querySelectorAll('.hero-project')];
  const selectors = [...hero.querySelectorAll('[data-slide]')];
  const updateNetwork = initNetwork(hero.querySelector('[data-network]'));
  let selected = 0;
  let timer;
  let paused = false;
  let hovered = false;
  let focused = false;
  let visible = true;
  controls.hidden = slides.length < 2;

  function select(index) {
    selected = index;
    slides.forEach((slide, i) => {
      slide.hidden = i !== index;
      selectors[i].setAttribute('aria-pressed', String(i === index));
    });
  }

  function schedule() {
    clearTimeout(timer);
    const motion = !reduceMotion.matches && !paused && visible && !document.hidden;
    pauseButton.hidden = reduceMotion.matches;
    updateNetwork(selected, motion);
    if (motion && !hovered && !focused && slides.length > 1) {
      timer = setTimeout(() => {
        select((selected + 1) % slides.length);
        schedule();
      }, 5700);
    }
  }

  selectors.forEach((button, i) => button.addEventListener('click', () => {
    select(i);
    schedule();
  }));
  pauseButton.addEventListener('click', () => {
    paused = !paused;
    pauseButton.classList.toggle('is-paused', paused);
    pauseButton.setAttribute('aria-label', paused ? 'Resume featured project rotation' : 'Pause featured project rotation');
    schedule();
  });
  hero.addEventListener('pointerenter', event => {
    if (event.pointerType === 'touch') return;
    hovered = true;
    schedule();
  });
  hero.addEventListener('pointerleave', () => {
    hovered = false;
    schedule();
  });
  hero.addEventListener('focusin', event => {
    focused = event.target.matches(':focus-visible');
    schedule();
  });
  hero.addEventListener('focusout', event => {
    if (hero.contains(event.relatedTarget)) return;
    focused = false;
    schedule();
  });
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    schedule();
  }).observe(hero);
  reduceMotion.addEventListener('change', schedule);
  document.addEventListener('visibilitychange', schedule);
  schedule();
}

function initProjectBrowser(browser) {
  const form = browser.querySelector('form');
  const input = form.querySelector('input');
  const result = browser.querySelector('.browser-result');
  const extra = browser.querySelector('.extra-shelves');
  const resize = new ResizeObserver(entries => {
    for (const { target } of entries) updates.get(target)();
  });
  const updates = new Map();
  const shelves = [...browser.querySelectorAll('[data-shelf]')].map(section => {
    const track = section.querySelector('.shelf-track');
    const total = section.querySelector('.shelf-count');
    const controls = section.querySelector('.shelf-controls');
    const [previous, next] = controls.querySelectorAll('button');
    const updateControls = () => {
      const limit = track.scrollWidth - track.clientWidth;
      controls.hidden = limit < 2;
      previous.disabled = track.scrollLeft < 2;
      next.disabled = track.scrollLeft >= limit - 2;
    };
    const cards = [...track.children];
    for (const button of [previous, next]) {
      button.addEventListener('click', () => {
        const card = cards.find(entry => !entry.hidden);
        if (!card) return;
        const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
        track.scrollBy({ left: Number(button.dataset.scroll) * (card.offsetWidth + gap),
          behavior: reduceMotion.matches ? 'instant' : 'smooth' });
      });
    }
    track.addEventListener('scroll', updateControls, { passive: true });
    updates.set(track, updateControls);
    resize.observe(track);
    return { section, track, cards, total, updateControls };
  });

  let searching = false;
  let wasExpanded = false;
  function search() {
    const query = input.value.trim();
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const hasQuery = terms.length > 0;
    if (extra && hasQuery !== searching) {
      if (hasQuery) {
        wasExpanded = extra.open;
      } else {
        extra.open = wasExpanded;
      }
    }
    searching = hasQuery;
    let matches = 0;
    for (const { section, track, cards, total, updateControls } of shelves) {
      let count = 0;
      for (const card of cards) {
        card.hidden = !terms.every(term => card.dataset.project.includes(term));
        if (!card.hidden) count++;
      }
      section.hidden = count === 0;
      total.textContent = count;
      total.setAttribute('aria-label', count + (count === 1 ? ' problem' : ' problems'));
      matches += count;
      track.scrollLeft = 0;
      updateControls();
    }
    if (extra) {
      const extraMatches = shelves.some(({ section }) => extra.contains(section) && !section.hidden);
      extra.hidden = hasQuery && !extraMatches;
      extra.classList.toggle('is-searching', hasQuery);
      if (hasQuery && extraMatches) extra.open = true;
    }
    result.textContent = hasQuery
      ? (matches ? matches + (matches === 1 ? ' result' : ' results') + ' for “' + query + '”' : 'No problems match “' + query + '”. Try a shorter search.')
      : '';
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    search();
  });
  input.addEventListener('input', search);
  if (input.value) search();
}

function initProblemEntry(form) {
  const textarea = form.querySelector('textarea');
  const suggest = form.querySelector('[data-suggest]');
  const copy = form.querySelector('[data-copy]');
  const examples = [
    'Can we make a free tool that turns a scanned bus timetable into a searchable table?',
    'Which public weather datasets agree on the hottest hour in the same city?',
    'Can a free app compare two audio recordings and mark where they differ?'
  ];
  let current = -1;
  function refresh() {
    const text = textarea.value.trim();
    textarea.setCustomValidity(text || !textarea.value ? '' : 'Describe the problem before continuing.');
    suggest.disabled = Boolean(text) && text !== examples[current];
    copy.disabled = !text;
  }
  suggest.hidden = false;
  copy.hidden = false;
  suggest.addEventListener('click', () => {
    current = (current + 1) % examples.length;
    textarea.value = examples[current];
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    refresh();
  });
  textarea.addEventListener('input', refresh);
  refresh();
}

initHero(document.querySelector('[data-hero]'));
initProjectBrowser(document.querySelector('.project-browser'));
initProblemEntry(document.querySelector('[data-proposal]'));
