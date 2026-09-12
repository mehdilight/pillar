(() => {
  async function copyText(text, button) {
    const original = button.textContent;
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copied';
    } catch {
      button.textContent = 'Select to copy';
    }
    setTimeout(() => { button.textContent = original; }, 1800);
  }
  document.querySelectorAll('[data-copy-install]').forEach(button => {
    button.addEventListener('click', () => copyText(button.parentElement.querySelector('code').textContent, button));
  });
  const sidebar = document.querySelector('.docs-navigation');
  if (sidebar) {
    const narrow = window.matchMedia('(max-width: 640px)');
    const update = () => { sidebar.open = !narrow.matches; };
    update();
    narrow.addEventListener('change', update);
  }
  const article = document.querySelector('.doc-content');
  if (!article) return;
  article.querySelectorAll('pre').forEach(pre => {
    const code = pre.querySelector('code');
    if (!code) return;
    const wrap = document.createElement('div');
    wrap.className = 'code-block';
    pre.before(wrap);
    wrap.append(pre);
    const label = document.createElement('span');
    label.className = 'code-label';
    label.textContent = [...code.classList].find(name => name.startsWith('language-'))?.slice(9) || 'Code';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-code';
    button.textContent = 'Copy';
    button.setAttribute('aria-label', 'Copy code example');
    button.addEventListener('click', () => copyText(code.textContent, button));
    wrap.append(label, button);
  });
  article.querySelectorAll('table').forEach(table => {
    const wrap = document.createElement('div');
    wrap.className = 'table-scroll';
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', 'Scrollable reference table');
    table.before(wrap);
    wrap.append(table);
  });
  const outline = document.querySelector('[data-page-outline]');
  const used = new Set([...document.querySelectorAll('[id]')].map(node => node.id));
  const headings = [...article.querySelectorAll('h2,h3')];
  headings.forEach((heading, index) => {
    const text = heading.textContent;
    if (!heading.id) {
      const base = text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-') || `section-${index + 1}`;
      let id = base;
      let suffix = 2;
      while (used.has(id)) id = `${base}-${suffix++}`;
      used.add(id);
      heading.id = id;
    }
    const anchor = document.createElement('a');
    anchor.className = 'heading-anchor';
    anchor.href = `#${heading.id}`;
    anchor.textContent = '#';
    anchor.setAttribute('aria-label', `Link to ${text}`);
    heading.append(anchor);
    if (outline) {
      const link = document.createElement('a');
      link.href = `#${heading.id}`;
      link.textContent = text;
      if (heading.tagName === 'H3') link.className = 'toc-sub';
      outline.append(link);
    }
  });
  if (outline && headings.length) {
    const links = [...outline.querySelectorAll('a')];
    const update = () => {
      const current = [...headings].reverse().find(heading => heading.getBoundingClientRect().top < 160) || headings[0];
      links.forEach(link => {
        const active = link.hash === `#${current.id}`;
        link.classList.toggle('current', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    };
    let waiting = false;
    window.addEventListener('scroll', () => {
      if (waiting) return;
      waiting = true;
      requestAnimationFrame(() => { update(); waiting = false; });
    }, { passive: true });
    update();
  }
})();
