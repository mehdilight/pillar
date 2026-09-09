import type {
  AvailableSection,
  BlockType,
  ContentCollection,
  ContentItem,
  DraftStatus,
  HistoryEntry,
  PageSection,
  SettingsPanelSchema,
  TemplateSummary,
} from '../types';

/**
 * A demo site, so the editor runs with no backend.
 *
 * This is what `pillar dev` will serve for real out of the working tree — the
 * shapes here are the API contract from `plan.md` §4, written down once as
 * fixtures so the UI can be built and reviewed before the PHP side exists.
 */

export const templates: TemplateSummary[] = [
  { name: 'index', label: 'Home page', route: '/', group: 'Pages' },
  { name: 'about', label: 'About', route: '/about/', group: 'Pages' },
  { name: 'blog', label: 'Blog index', route: '/blog/', group: 'Collections' },
  { name: 'post', label: 'Blog post', route: '/blog/hello-world/', group: 'Collections' },
  { name: '404', label: 'Not found', route: '/404.html', group: 'System' },
];

export const availableSections: AvailableSection[] = [
  {
    type: 'hero',
    name: 'Hero',
    description: 'A full-width heading, subheading and call to action.',
    settings: [
      { id: 'layout_head', type: 'header', label: 'Content', content: 'Content' },
      { id: 'heading', type: 'text', label: 'Heading', default: 'Build sites that outlive their tools' },
      { id: 'subheading', type: 'textarea', label: 'Subheading', default: 'Markdown in, HTML out.' },
      { id: 'cta_label', type: 'text', label: 'Button label', default: 'Read the docs' },
      { id: 'cta_url', type: 'url', label: 'Button link', default: '/docs/' },
      { id: 'image', type: 'image', label: 'Background image' },
      { id: 'style_head', type: 'header', label: 'Appearance', content: 'Appearance' },
      { id: 'align', type: 'radio', label: 'Alignment', default: 'center',
        options: [
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
        ] },
      { id: 'bg', type: 'color', label: 'Background', default: '#0f172a', css_var: '--hero-bg' },
      { id: 'padding', type: 'range', label: 'Vertical padding', min: 0, max: 160, step: 8, unit: 'px', default: 96, css_var: '--hero-pad', css_unit: 'px' },
      { id: 'full_bleed', type: 'checkbox', label: 'Full bleed', default: true, info: 'Ignore the layout container width.' },
    ],
  },
  {
    type: 'feature-grid',
    name: 'Feature grid',
    description: 'A grid of repeatable feature cards.',
    max_blocks: 6,
    blocks: [
      {
        type: 'feature',
        name: 'Feature',
        settings: [
          { id: 'title', type: 'text', label: 'Title', default: 'Fast' },
          { id: 'body', type: 'textarea', label: 'Body', default: 'Compiled templates, incremental builds.' },
          { id: 'icon', type: 'select', label: 'Icon', default: 'zap',
            options: [
              { value: 'zap', label: 'Lightning' },
              { value: 'box', label: 'Box' },
              { value: 'git', label: 'Git' },
            ] },
        ],
      },
    ],
    settings: [
      { id: 'heading', type: 'text', label: 'Heading', default: 'Why Pillar' },
      { id: 'columns', type: 'range', label: 'Columns', min: 2, max: 4, step: 1, default: 3 },
    ],
  },
  {
    type: 'rich-text',
    name: 'Rich text',
    description: 'A block of prose, written in markdown.',
    settings: [
      { id: 'body', type: 'markdown', label: 'Body', default: '## A heading\n\nSome **markdown**.' },
      { id: 'width', type: 'select', label: 'Width', default: 'prose',
        options: [
          { value: 'prose', label: 'Prose' },
          { value: 'full', label: 'Full width' },
        ] },
    ],
  },
  {
    type: 'post-list',
    name: 'Post list',
    description: 'The latest entries from a content collection.',
    enabled_on: ['blog', 'index'],
    settings: [
      { id: 'source', type: 'collection', label: 'Collection', default: 'posts' },
      { id: 'limit', type: 'number', label: 'How many', default: 10, min: 1, max: 50 },
      { id: 'show_excerpt', type: 'checkbox', label: 'Show excerpts', default: true },
    ],
  },
  {
    type: 'newsletter',
    name: 'Newsletter',
    description: 'An email capture form.',
    settings: [
      { id: 'heading', type: 'text', label: 'Heading', default: 'Subscribe' },
      { id: 'note', type: 'paragraph', label: '', content: 'The form posts to whatever endpoint the theme configures.' },
      { id: 'action', type: 'url', label: 'Form action', default: 'https://example.com/subscribe' },
    ],
  },
];

export const availableBlocks: BlockType[] = [
  {
    type: 'feature',
    name: 'Feature',
    file: true,
    settings: [
      { id: 'title', type: 'text', label: 'Title', default: 'Fast' },
      { id: 'body', type: 'textarea', label: 'Body' },
    ],
  },
];

const schemaFor = (type: string) => {
  const found = availableSections.find((s) => s.type === type);

  return found
    ? { name: found.name, settings: found.settings, blocks: found.blocks, max_blocks: found.max_blocks }
    : undefined;
};

const section = (
  id: string,
  type: string,
  settings: Record<string, any>,
  extra: Partial<PageSection> = {}
): PageSection => ({
  section_id: id,
  section_type: type,
  settings,
  order: 0,
  enabled: true,
  schema: schemaFor(type),
  ...extra,
});

export const layout: PageSection[] = [
  section('static-header', 'header', { sticky: true }, {
    is_layout: true,
    schema: {
      name: 'Header',
      settings: [
        { id: 'sticky', type: 'checkbox', label: 'Stick to top', default: true },
        { id: 'menu', type: 'menu', label: 'Menu', default: 'main' },
      ],
    },
  }),
  section('static-footer', 'footer', { note: '© Pillar' }, {
    is_layout: true,
    schema: {
      name: 'Footer',
      settings: [{ id: 'note', type: 'text', label: 'Footer note', default: '© Pillar' }],
    },
  }),
];

export const pages: Record<string, PageSection[]> = {
  index: [
    section('hero_a1', 'hero', {
      heading: 'Build sites that outlive their tools',
      subheading: 'Markdown in, HTML out. Edit here, deploy anywhere.',
      cta_label: 'Read the docs',
      cta_url: '/docs/',
      align: 'center',
      bg: '#0f172a',
      padding: 96,
      full_bleed: true,
    }, { order: 0 }),
    section('feature_b2', 'feature-grid', { heading: 'Why Pillar', columns: 3 }, {
      order: 1,
      blocks: [
        { id: 'feature_k91x', type: 'feature', settings: { title: 'Local first', body: 'No database, no service. A directory.', icon: 'box' } },
        { id: 'feature_p02m', type: 'feature', settings: { title: 'Schema driven', body: 'The <schema> block is the whole editor.', icon: 'zap' } },
        { id: 'feature_q73f', type: 'feature', settings: { title: 'Git is the store', body: 'Drafts, history and rollback for free.', icon: 'git' } },
      ],
    }),
    section('posts_c3', 'post-list', { source: 'posts', limit: 3, show_excerpt: true }, { order: 2 }),
    section('news_d4', 'newsletter', { heading: 'Subscribe', action: 'https://example.com/subscribe' }, { order: 3, enabled: false }),
  ],
  about: [
    section('text_e5', 'rich-text', { body: '## About\n\nPillar is a static site generator.', width: 'prose' }, { order: 0 }),
  ],
  blog: [section('posts_f6', 'post-list', { source: 'posts', limit: 20, show_excerpt: true }, { order: 0 })],
  post: [section('text_g7', 'rich-text', { body: '{{ page.content }}', width: 'prose' }, { order: 0 })],
  '404': [section('text_h8', 'rich-text', { body: '## Not found', width: 'prose' }, { order: 0 })],
};

export const settingsSchema: SettingsPanelSchema[] = [
  {
    name: 'Brand',
    settings: [
      { id: 'site_title', type: 'text', label: 'Site title', default: 'Pillar' },
      { id: 'tagline', type: 'text', label: 'Tagline', default: 'A local-first static site generator' },
      { id: 'logo', type: 'image', label: 'Logo' },
      { id: 'favicon', type: 'image', label: 'Favicon' },
    ],
  },
  {
    name: 'Colors',
    settings: [
      { id: 'color_ink', type: 'color', label: 'Text', default: '#111827', css_var: '--ink' },
      { id: 'color_bg', type: 'color', label: 'Background', default: '#ffffff', css_var: '--bg' },
      { id: 'color_accent', type: 'color', label: 'Accent', default: '#005bd3', css_var: '--accent' },
    ],
  },
  {
    name: 'Typography',
    settings: [
      { id: 'font_head', type: 'select', label: 'Headings', default: 'system',
        options: [
          { value: 'system', label: 'System sans' },
          { value: 'serif', label: 'Serif' },
          { value: 'mono', label: 'Monospace' },
        ] },
      { id: 'base_size', type: 'range', label: 'Base size', min: 14, max: 20, step: 1, unit: 'px', default: 16 },
    ],
  },
  {
    name: 'Advanced',
    settings: [
      { id: 'analytics_note', type: 'paragraph', label: '', content: 'Injected verbatim before </head>.' },
      { id: 'head_code', type: 'code', label: 'Head code' },
    ],
  },
];

export const settingsData: Record<string, any> = {
  site_title: 'Pillar',
  tagline: 'A local-first static site generator',
  color_ink: '#111827',
  color_bg: '#ffffff',
  color_accent: '#005bd3',
  font_head: 'system',
  base_size: 16,
};

export const collections: ContentCollection[] = [
  {
    name: 'posts',
    label: 'Posts',
    count: 3,
    fields: [
      { id: 'title', type: 'text', label: 'Title' },
      { id: 'date', type: 'date', label: 'Date' },
      { id: 'tags', type: 'tags', label: 'Tags' },
      { id: 'cover', type: 'image', label: 'Cover image' },
      { id: 'draft', type: 'checkbox', label: 'Draft', default: false },
    ],
  },
  {
    name: 'pages',
    label: 'Pages',
    count: 2,
    fields: [
      { id: 'title', type: 'text', label: 'Title' },
      { id: 'layout', type: 'select', label: 'Template', default: 'page',
        options: [{ value: 'page', label: 'Page' }, { value: 'wide', label: 'Wide' }] },
    ],
  },
];

export const content: ContentItem[] = [
  {
    collection: 'posts', slug: 'hello-world', title: 'Hello world',
    frontmatter: { title: 'Hello world', date: '2026-08-01', tags: ['meta'], draft: false },
    body: '# Hello world\n\nThe first post.\n', updated_at: '2026-08-01T10:00:00Z',
  },
  {
    collection: 'posts', slug: 'why-static', title: 'Why static',
    frontmatter: { title: 'Why static', date: '2026-08-14', tags: ['ssg', 'liqx'], draft: false },
    body: '# Why static\n\nBecause a file is the simplest thing that can be served.\n',
    updated_at: '2026-08-14T09:20:00Z',
  },
  {
    collection: 'posts', slug: 'schema-first', title: 'Schema-first editing',
    frontmatter: { title: 'Schema-first editing', date: '2026-09-02', tags: ['editor'], draft: true },
    body: '# Schema-first editing\n\nOne block, two readers.\n', updated_at: '2026-09-02T18:05:00Z',
  },
  {
    collection: 'pages', slug: 'about', title: 'About',
    frontmatter: { title: 'About', layout: 'page' },
    body: 'Pillar is a static site generator.\n',
  },
  {
    collection: 'pages', slug: 'contact', title: 'Contact',
    frontmatter: { title: 'Contact', layout: 'page' },
    body: 'Say hello.\n',
  },
];

export const draftStatus: DraftStatus = {
  count: 0,
  files: [],
  has_remote: true,
  branch: 'main',
};

export const history: HistoryEntry[] = [
  { hash: 'a1b2c3d4', short: 'a1b2c3d', message: 'Add feature grid to the home page', author: 'you', date: '2026-09-08T14:22:00Z' },
  { hash: 'e5f6a7b8', short: 'e5f6a7b', message: 'Publish: two posts, new hero copy', author: 'you', date: '2026-09-05T11:03:00Z' },
  { hash: 'c9d0e1f2', short: 'c9d0e1f', message: 'Initial site', author: 'you', date: '2026-09-01T08:00:00Z' },
];
