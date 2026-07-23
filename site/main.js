// @ts-check
import { View, Region, Router } from 'lumenjs';
import { renderMarkdown } from './markdown.js';
import { createTodoApp, TODO_SOURCE } from './demo.js';

/**
 * The site navigation, grouped into sections. Each item has an `id` (route + doc file),
 * and an optional `example` (the examples/<example>/ folder embedded as a live iframe).
 */
const NAV = [
  {
    label: { en: 'Start', es: 'Inicio' },
    items: [{ id: 'install', doc: 'install' }],
  },
  {
    label: { en: 'Modules', es: 'Módulos' },
    items: [
      'event-emitter', 'dom', 'math', 'animate', 'view', 'model', 'collection', 'collection-view',
      'region', 'router', 'http', 'i18n', 'validate', 'element', 'svg', 'canvas',
    ].map((id) => {
      // canvas and svg each show two live examples on one page.
      if (id === 'canvas') return { id, doc: id, examples: ['canvas', 'particles'] };
      if (id === 'svg') return { id, doc: id, examples: ['svg', 'svg-circuit'] };
      return { id, doc: id, example: id };
    }),
  },
  {
    label: { en: 'Guides', es: 'Guías' },
    items: [
      { id: 'tradeoffs', doc: 'tradeoffs' },
      { id: 'structure', doc: 'structure' },
      { id: 'messaging', doc: 'messaging', example: 'messaging' },
      { id: 'styling', doc: 'styling', example: 'tailwind' },
      { id: 'deployment', doc: 'deployment' },
      { id: 'llms', doc: 'llms' },
      { id: 'credits', doc: 'credits' },
    ],
  },
];

/** @type {Record<string, { id: string, doc: string, example?: string }>} */
const ITEMS = {};
for (const section of NAV) for (const item of section.items) ITEMS[item.id] = item;

const I18N = {
  en: {
    tagline: 'transparent · no-magic · no-build',
    home: '· home',
    example: 'Live example',
    open: 'open in new tab ↗',
    demoLabel: 'A complete app — running',
    chips: ['no build', 'no magic', 'OOP-first', 'native ES modules', '~0 deps'],
    introTagline: 'A transparent, no-magic, no-build vanilla-JS OOP UI framework. What you write is what runs.',
    introBody:
      '## Start here\n' +
      'Pick a topic on the left. Each page shows the docs and a **live example running** below — the same example you can open standalone.\n\n' +
      'This site is itself built with Lumen: a `View` shell with `static regions`, a `Router` for the pages, the docs rendered from bilingual markdown, and styled with [scc](https://github.com/dragones-tech/scc). No build step.\n\n' +
      '- **No build.** Native ES modules.\n' +
      '- **No magic.** No globals, no hidden proxies, explicit lifecycle.\n' +
      '- **OOP-first.** A view is a class you extend.\n',
  },
  es: {
    tagline: 'transparente · sin magia · sin build',
    home: '· inicio',
    example: 'Ejemplo en vivo',
    open: 'abrir en pestaña nueva ↗',
    demoLabel: 'Una app completa — corriendo',
    chips: ['sin build', 'sin magia', 'OOP primero', 'módulos ES nativos', '~0 deps'],
    introTagline: 'Un framework de UI en JS vanilla, OOP, transparente, sin magia y sin build. Lo que escribes es lo que corre.',
    introBody:
      '## Empieza aquí\n' +
      'Elige un tema a la izquierda. Cada página muestra la documentación y un **ejemplo en vivo corriendo** abajo — el mismo que puedes abrir por separado.\n\n' +
      'Este sitio está hecho con Lumen: un shell `View` con `static regions`, un `Router` para las páginas, los docs renderizados desde markdown bilingüe, y estilado con [scc](https://github.com/dragones-tech/scc). Sin build.\n\n' +
      '- **Sin build.** Módulos ES nativos.\n' +
      '- **Sin magia.** Sin globals, sin proxies ocultos, ciclo de vida explícito.\n' +
      '- **OOP primero.** Una vista es una clase que extiendes.\n',
  },
};

/** Apply highlight.js to every code block inside a rendered container (if loaded). */
function highlightCode(root) {
  const hljs = /** @type {any} */ (window).hljs;
  if (hljs) root.querySelectorAll('pre code').forEach((el) => hljs.highlightElement(el));
}

/** Left navigation: sections of links, with a Tailwind active highlight. */
class Sidebar extends View {
  static template = '#sidebar';
  onCreate() {
    this.lang = this.props.lang;
    this.active = 'home';
  }
  onMount() { this.renderNav(); }
  setLang(lang) { this.lang = lang; this.renderNav(); }
  setActive(id) { this.active = id; this.renderNav(); }

  renderNav() {
    const children = [this._link('home', I18N[this.lang].home, '#/')];
    for (const section of NAV) {
      const label = document.createElement('div');
      label.textContent = section.label[this.lang];
      label.className = 'nav-section';
      children.push(label);
      for (const item of section.items) children.push(this._link(item.id, item.id, `#/${item.id}`));
    }
    this.ui.nav.replaceChildren(...children);
  }

  _link(id, text, href) {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = text;
    a.dataset.id = id;
    a.className = 'nav-link';
    if (id === this.active) a.setAttribute('aria-current', 'page');
    return a;
  }
}

/** A documentation page: rendered markdown + (optionally) the live example in an iframe. */
class DocPage extends View {
  static template = '#doc';
  onMount() { this.load(); }
  async load() {
    const { item, lang } = this.props;
    const examples = item.examples ?? (item.example ? [item.example] : []);
    if (examples.length) {
      // two columns: example(s) on the left, docs on the right
      this.ui.layout.className = 'doc-layout cols';
      this.ui.exWrap.hidden = false;
      // a single tall example stays sticky; stacked examples scroll with the page
      this.ui.exWrap.className = examples.length > 1 ? 'ex-wrap' : 'ex-wrap sticky';
      this.ui.exLabel.textContent = I18N[lang].example + (examples.length > 1 ? 's' : '');
      this.ui.exFrames.replaceChildren(...examples.map((ex) => this.exBlock(ex, lang, examples.length)));
    } else {
      // single readable column
      this.ui.layout.className = 'doc-layout single';
      this.ui.exWrap.hidden = true;
    }
    try {
      // `no-cache` → always revalidate with the server (cheap 304 when unchanged), so an
      // edited doc never shows up stale from the browser/CDN cache.
      const res = await fetch(`../docs/${lang}/${item.doc}.md`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(String(res.status));
      this.ui.body.innerHTML = renderMarkdown(await res.text());
      highlightCode(this.ui.body);
    } catch {
      this.ui.body.textContent = `Could not load docs/${lang}/${item.doc}.md`;
    }
  }

  /** Build one example block: a labelled live iframe + an open-in-new-tab link. */
  exBlock(ex, lang, count) {
    const wrap = document.createElement('div');
    if (count > 1) {
      const cap = document.createElement('div');
      cap.className = 'ex-cap';
      cap.textContent = ex;
      wrap.append(cap);
    }
    const frame = document.createElement('iframe');
    frame.src = `../examples/${ex}/?v=scc2`;
    frame.title = ex;
    frame.className = 'ex-frame';
    frame.addEventListener('load', () => {
      // same-origin: make the embedded example follow the site's light/dark mode
      try { frame.contentDocument.documentElement.dataset.mode = document.documentElement.dataset.mode; } catch {}
    });
    if (count > 1) {
      // stacked examples (same-origin): size each iframe to its content, refit if it reflows.
      frame.style.height = '36rem'; // fallback until measured
      frame.addEventListener('load', () => {
        const fit = () => {
          try {
            const d = frame.contentDocument;
            if (d) frame.style.height = d.documentElement.scrollHeight + 2 + 'px'; // +2 = border
          } catch {}
        };
        fit();
        try {
          const d = frame.contentDocument;
          if (d) new ResizeObserver(fit).observe(d.documentElement);
        } catch {}
      });
    } else {
      frame.classList.add('ex-frame--tall'); // single: tall + sticky
    }
    const open = document.createElement('a');
    open.href = `../examples/${ex}/?v=scc2`;
    open.target = '_blank';
    open.className = 'ex-open';
    open.textContent = count > 1 ? `${ex} — ${I18N[lang].open}` : I18N[lang].open;
    wrap.append(frame, open);
    return wrap;
  }
}

/** The landing page: hero + a complete running app + its source + intro prose. */
class Intro extends View {
  static template = '#intro';
  onMount() {
    const t = I18N[this.props.lang];
    this.ui.tagline.textContent = t.introTagline;
    this.ui.demoLabel.textContent = t.demoLabel;
    this.ui.chips.replaceChildren(...t.chips.map((c) => {
      const s = document.createElement('span');
      s.textContent = c;
      s.className = 'chip';
      return s;
    }));
    this.addChild(createTodoApp(this.props.lang), this.ui.demo);
    this.ui.code.textContent = TODO_SOURCE;
    this.ui.body.innerHTML = renderMarkdown(t.introBody);
    highlightCode(this.el);
  }
}

/** The docs app: a shell View with sidebar + content regions, driven by the router. */
class DocsApp extends View {
  static template = '#shell';
  static regions = { sidebar: 'sidebar', content: 'content' };

  onCreate() {
    this.lang = 'en';
    /** @type {string} */
    this.currentRoute = 'home';
  }

  onMount() {
    this.ui.tagline.textContent = I18N[this.lang].tagline;
    this.sidebar = new Sidebar({ lang: this.lang });
    this.regions.sidebar.show(this.sidebar);
    this.listen(this.ui.lang, 'click', this.toggleLang);
    this.listen(this.ui.mode, 'click', this.toggleMode);       // light/dark switch
    this.refreshModeIcon();
    this.listen(this.ui.menu, 'click', this.toggleMenu);       // mobile: open/close the sidebar drawer
    this.listen(this.ui.backdrop, 'click', this.closeMenu);

    this.router = new Router()
      .add('/', () => this.go('home'))
      .add('/:id', ({ id }) => this.go(ITEMS[id] ? id : 'home'))
      .start();
  }

  onUnmount() { this.router.stop(); }

  go = (route) => {
    this.currentRoute = route;
    this.sidebar.setActive(route);
    this.closeMenu(); // collapse the mobile drawer after picking a page
    this.regions.content.show(
      route === 'home'
        ? new Intro({ lang: this.lang })
        : new DocPage({ item: ITEMS[route], lang: this.lang }),
    );
  };

  // Mobile sidebar drawer. On desktop the layout keeps it visible regardless (see site.css).
  toggleMenu = () => {
    const open = this.ui.sidebar.classList.toggle('open');
    this.ui.backdrop.classList.toggle('open', open);
  };
  closeMenu = () => {
    this.ui.sidebar.classList.remove('open');
    this.ui.backdrop.classList.remove('open');
  };

  // Light/dark switch. scc reads `data-mode` on <html> via light-dark(); we persist the choice
  // and propagate it into the same-origin example iframes so they follow the site.
  toggleMode = () => {
    const next = document.documentElement.dataset.mode === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.mode = next;
    try { localStorage.setItem('lumen-mode', next); } catch {}
    this.refreshModeIcon();
    for (const f of document.querySelectorAll('iframe')) {
      try { f.contentDocument.documentElement.dataset.mode = next; } catch {}
    }
  };
  refreshModeIcon = () => {
    const dark = document.documentElement.dataset.mode !== 'light';
    this.ui.mode.textContent = dark ? '🌙' : '☀️';
    this.ui.mode.setAttribute('aria-label', dark ? 'Switch to light' : 'Switch to dark');
  };

  toggleLang = () => {
    this.lang = this.lang === 'en' ? 'es' : 'en';
    this.ui.lang.textContent = this.lang === 'en' ? 'ES' : 'EN';
    this.ui.tagline.textContent = I18N[this.lang].tagline;
    this.sidebar.setLang(this.lang);
    this.go(this.currentRoute);
  };
}

new DocsApp().mount(document.querySelector('#app'));
