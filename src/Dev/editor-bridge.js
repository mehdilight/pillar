/**
 * The preview half of the editor.
 *
 * Injected into a page only when it is rendered for the dashboard's canvas
 * (`?editor=1`), never into a built page. It gives every section a hover
 * outline and a click target, and answers the dashboard when it selects one
 * from the sidebar — the two halves of "click the thing you want to edit".
 *
 * Deliberately plain: no build step, no dependency, and it must not disturb
 * the page it decorates. Everything it adds is a fixed-position overlay
 * outside the document flow.
 */
(function () {
  var ATTRIBUTE = 'data-pillar-section-id';
  var selected = null;
  var hovered = null;

  var style = document.createElement('style');

  style.textContent =
    '.pillar-hover-outline,.pillar-selected-outline{position:absolute;pointer-events:none;z-index:2147483000;' +
    'border-radius:3px;transition:opacity .12s}' +
    '.pillar-hover-outline{outline:2px solid rgba(0,91,211,.45);outline-offset:-2px}' +
    '.pillar-selected-outline{outline:2px solid #005bd3;outline-offset:-2px}' +
    '.pillar-section-label{position:absolute;transform:translateY(-100%);background:#005bd3;color:#fff;' +
    'font:600 11px/1.6 -apple-system,system-ui,sans-serif;padding:1px 7px;border-radius:5px 5px 0 0;white-space:nowrap}';

  document.head.appendChild(style);

  function overlay(className) {
    var element = document.createElement('div');

    element.className = className;
    element.hidden = true;
    document.body.appendChild(element);

    return element;
  }

  var hoverBox = overlay('pillar-hover-outline');
  var selectedBox = overlay('pillar-selected-outline');
  var label = document.createElement('span');

  label.className = 'pillar-section-label';
  selectedBox.appendChild(label);

  function sectionOf(node) {
    return node && node.closest ? node.closest('[' + ATTRIBUTE + ']') : null;
  }

  function place(box, section) {
    if (!section) {
      box.hidden = true;

      return;
    }

    var rect = section.getBoundingClientRect();

    box.hidden = false;
    box.style.top = rect.top + window.scrollY + 'px';
    box.style.left = rect.left + window.scrollX + 'px';
    box.style.width = rect.width + 'px';
    box.style.height = rect.height + 'px';
  }

  function reposition() {
    place(hoverBox, hovered);
    place(selectedBox, selected);
  }

  document.addEventListener('mouseover', function (event) {
    var section = sectionOf(event.target);

    if (section === hovered) return;

    hovered = section === selected ? null : section;
    place(hoverBox, hovered);
  });

  document.addEventListener('mouseleave', function () {
    hovered = null;
    hoverBox.hidden = true;
  });

  document.addEventListener(
    'click',
    function (event) {
      var section = sectionOf(event.target);

      if (!section) return;

      // A link inside a section would navigate the canvas away from the page
      // being edited, which is never what a click in the editor meant.
      event.preventDefault();
      event.stopPropagation();

      select(section.getAttribute(ATTRIBUTE), true);
    },
    true
  );

  function select(id, tell) {
    selected = id ? document.querySelector('[' + ATTRIBUTE + '="' + id + '"]') : null;
    hovered = null;

    hoverBox.hidden = true;
    place(selectedBox, selected);

    if (selected) {
      label.textContent = selected.getAttribute('data-section-type') || id;
    }

    if (tell && window.parent !== window) {
      window.parent.postMessage({ type: 'PILLAR_SECTION_SELECTED', sectionId: id }, '*');
    }
  }

  window.addEventListener('message', function (event) {
    var data = event.data || {};

    // A theme setting's live value — a custom property on :root, which wins
    // over the stylesheet's until the saved page replaces this one. Only a
    // `--name` and a plain value: this channel sets variables, nothing else.
    if (data.type === 'PILLAR_CSS_VAR' && /^--[a-zA-Z0-9-]+$/.test(String(data.name)) && /^[^;{}<>]*$/.test(String(data.value))) {
      document.documentElement.style.setProperty(data.name, String(data.value));
    }

    if (data.type === 'PILLAR_SELECT_SECTION') {
      select(data.sectionId, false);

      if (selected) {
        selected.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });

  window.addEventListener('resize', reposition);
  window.addEventListener('scroll', reposition, { passive: true });

  // Sections can change height after load — a webfont, an image, a lazy embed —
  // and an outline left at the old size is worse than none.
  if (window.ResizeObserver) {
    var observer = new ResizeObserver(reposition);

    observer.observe(document.body);
  }

  window.addEventListener('load', reposition);

  if (window.parent !== window) {
    window.parent.postMessage({ type: 'PILLAR_PREVIEW_READY' }, '*');
  }
})();
