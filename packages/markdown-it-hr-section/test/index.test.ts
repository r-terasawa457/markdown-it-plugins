import MarkdownIt from 'markdown-it';
import SectionBlockPlugin from '../src/index.ts';
import { describe, test, expect } from 'bun:test';

interface TestCase {
  name: string;
  markdown: string;
  expectedHtml: string;
}

const defaultTestCases: TestCase[] = [
  {
    name: '1. Single section without dividers wraps the entire document',
    markdown: '最初のセクションのテキストです。',
    expectedHtml: '<section id="section-1">\n<p>最初のセクションのテキストです。</p>\n</section>\n',
  },
  {
    name: '2. Basic section split avoiding lheading with empty lines',
    markdown: 'セクション1\n\n---\n\nセクション2',
    expectedHtml:
      '<section id="section-1">\n<p>セクション1</p>\n</section>\n<section id="section-2">\n<p>セクション2</p>\n</section>\n',
  },
  {
    name: '3. Multiple dividers without empty lines fall back to lheading hierarchy',
    markdown: 'A\n---\nB\n---\nC',
    expectedHtml: '<section id="section-1">\n<h2>A</h2>\n<h2>B</h2>\n<p>C</p>\n</section>\n',
  },
  {
    name: '4. Successive dividers where the first acts as lheading and the second splits sections',
    markdown: 'セクション1\n---\n---\nセクション3',
    expectedHtml:
      '<section id="section-1">\n<h2>セクション1</h2>\n</section>\n<section id="section-2">\n<p>セクション3</p>\n</section>\n',
  },
  {
    name: '5. Long sequence of hyphens treats prior line as lheading',
    markdown: 'セクション1\n---------\nセクション2',
    expectedHtml: '<section id="section-1">\n<h2>セクション1</h2>\n<p>セクション2</p>\n</section>\n',
  },
  {
    name: '6. Boundary check: less than 3 markers yield standard Setext headers (h2)',
    markdown: '見出し1\n--',
    expectedHtml: '<section id="section-1">\n<h2>見出し1</h2>\n</section>\n',
  },
  {
    name: '7. Out of spec: indented dividers with 4+ spaces continue paragraph text block',
    markdown: 'セクション1\n    ---\nセクション1の続き',
    expectedHtml: '<section id="section-1">\n<p>セクション1\n---\nセクション1の続き</p>\n</section>\n',
  },
  {
    name: '8. Indented dividers within 3 spaces act as lheading if text precedes them',
    markdown: 'セクション1\n   ---\nセクション2',
    expectedHtml: '<section id="section-1">\n<h2>セクション1</h2>\n<p>セクション2</p>\n</section>\n',
  },
  {
    name: '9. Trailing spaces after the divider maintain lheading when text precedes them',
    markdown: 'セクション1\n---    \nセクション2',
    expectedHtml: '<section id="section-1">\n<h2>セクション1</h2>\n<p>セクション2</p>\n</section>\n',
  },
  {
    name: '10. Trailing characters invalidates the divider block entirely',
    markdown: 'セクション1\n--- text\nセクション1の続き',
    expectedHtml: '<section id="section-1">\n<p>セクション1\n--- text\nセクション1の続き</p>\n</section>\n',
  },
];

describe('SectionBlockPlugin - Default Options', () => {
  const md = new MarkdownIt().use(SectionBlockPlugin);

  for (const testCase of defaultTestCases) {
    test(testCase.name, () => {
      expect(md.render(testCase.markdown)).toBe(testCase.expectedHtml);
    });
  }
});

describe('SectionBlockPlugin - Custom Attribute Options', () => {
  test('Enabling custom IDs, multiple classes, numbers and non-default start indexes', () => {
    const md = new MarkdownIt().use(SectionBlockPlugin, {
      add_data_section_number: true,
      add_section_id: 'slide',
      add_classes: ['markdown-slide', 'theme-dark'],
      number_start: 5,
    });

    const src = 'スライド1\n\n---\n\nスライド2';
    const expected =
      '<section id="slide-5" class="markdown-slide theme-dark" data-section-number="5">\n<p>スライド1</p>\n</section>\n' +
      '<section id="slide-6" class="markdown-slide theme-dark" data-section-number="6">\n<p>スライド2</p>\n</section>\n';

    expect(md.render(src)).toBe(expected);
  });

  test('Disabling ID generation with false value', () => {
    const md = new MarkdownIt().use(SectionBlockPlugin, {
      add_section_id: false,
    });

    const src = 'テストテキスト';
    const expected = '<section>\n<p>テストテキスト</p>\n</section>\n';

    expect(md.render(src)).toBe(expected);
  });

  test('Disabling ID generation with null value', () => {
    const md = new MarkdownIt().use(SectionBlockPlugin, {
      add_section_id: null,
    });

    const src = 'テストテキスト';
    const expected = '<section>\n<p>テストテキスト</p>\n</section>\n';

    expect(md.render(src)).toBe(expected);
  });

  test('Enabling section numbers explicitly alongside static class lists', () => {
    const md = new MarkdownIt().use(SectionBlockPlugin, {
      add_section_id: false,
      add_data_section_number: true,
      add_classes: ['page'],
    });

    const src = 'ページ1\n\n---\n\nページ2';
    const expected =
      '<section class="page" data-section-number="1">\n<p>ページ1</p>\n</section>\n' +
      '<section class="page" data-section-number="2">\n<p>ページ2</p>\n</section>\n';

    expect(md.render(src)).toBe(expected);
  });
});

describe('SectionBlockPlugin - Marker Customization', () => {
  test('Allows asterisks (***) to segment blocks in addition to hyphens', () => {
    const md = new MarkdownIt().use(SectionBlockPlugin, {
      add_section_id: false,
      separator_marker_chars: [0x2d, 0x2a],
    });

    const src = 'ページ1\n\n---\n\nページ2\n\n***\n\nページ3';
    const expected =
      '<section>\n<p>ページ1</p>\n</section>\n' +
      '<section>\n<p>ページ2</p>\n</section>\n' +
      '<section>\n<p>ページ3</p>\n</section>\n';

    expect(md.render(src)).toBe(expected);
  });

  test('Should only split by 4 or more markers when separator_min_len is set to 4', () => {
    const md = new MarkdownIt().use(SectionBlockPlugin, {
      add_section_id: false,
      separator_min_len: 4,
    });

    const src = 'スライド1の前半\n\n---\n\nスライド1の後半\n\n----\n\nスライド2';
    const expected =
      '<section>\n<p>スライド1の前前半</p>\n<hr>\n<p>スライド1の後半</p>\n</section>\n' +
      '<section>\n<p>スライド2</p>\n</section>\n';

    const rendered = md.render(src);
    expect(rendered).toContain('<hr>');
    expect(rendered.match(/<\/section>/g)?.length).toBe(2);
  });
});

describe('SectionBlockPlugin - sectionCoreRuleAdditionalHook', () => {
  test('Use Case 1: Dynamically assign layout classes depending on structural token types', () => {
    const md = new MarkdownIt().use(SectionBlockPlugin, {
      add_section_id: false,
      sectionCoreRuleAdditionalHook: (ctx) => {
        ctx.sections.forEach((sec) => {
          const hasH1 = sec.tokens.some((t: any) => t.type === 'heading_open' && t.tag === 'h1');
          sec.openToken.attrJoin('class', hasH1 ? 'title-slide' : 'normal-slide');
        });
      },
    });

    const src = '# タイトル\n\n---\n\n通常のテキストです。';
    const expected =
      '<section class="title-slide">\n<h1>タイトル</h1>\n</section>\n' +
      '<section class="normal-slide">\n<p>通常のテキストです。</p>\n</section>\n';

    expect(md.render(src)).toBe(expected);
  });

  test('Use Case 2: Append pagination elements seamlessly onto section ends via child text tokens', () => {
    const md = new MarkdownIt().use(SectionBlockPlugin, {
      add_section_id: false,
      sectionCoreRuleAdditionalHook: (ctx) => {
        const { sections, meta, state } = ctx;
        sections.forEach((sec) => {
          const fOpen = new state.Token('footer_open', 'footer', 1);
          fOpen.attrs = [['class', 'pagination']];

          const fInline = new state.Token('inline', '', 0);
          fInline.content = `${sec.pageNumber}/${meta.total_pages}`;

          const fText = new state.Token('text', '', 0);
          fText.content = fInline.content;
          fInline.children = [fText];

          const fClose = new state.Token('footer_close', 'footer', -1);

          sec.tokens.push(fOpen, fInline, fClose);
        });
      },
    });

    const src = 'ページ1\n\n---\n\nページ2';
    const expected =
      '<section>\n<p>ページ1</p>\n<footer class="pagination">1/2</footer></section>\n' +
      '<section>\n<p>ページ2</p>\n<footer class="pagination">2/2</footer></section>\n';

    expect(md.render(src)).toBe(expected);
  });

  test('Use Case 3: Completely remove slide configurations from the initial stream map', () => {
    const md = new MarkdownIt().use(SectionBlockPlugin, {
      add_section_id: 'p',
      sectionCoreRuleAdditionalHook: (ctx) => {
        const { sections } = ctx;
        if (sections.length > 0) {
          // ✨ Added optional chaining '?.' to sections[0] to satisfy TypeScript's strict compiler
          const firstToken = sections[0]?.tokens.find((t: any) => t.type === 'inline');

          if (firstToken && firstToken.content.startsWith('marp: true')) {
            sections.shift();
            sections.forEach((sec, idx) => {
              sec.pageNumber = idx + 1;
              sec.openToken.attrSet('id', `p-${sec.pageNumber}`);
            });
          }
        }
      },
    });

    const src = 'marp: true\ntheme: gaia\n\n---\n\nここから本編';
    const expected = '<section id="p-1">\n<p>ここから本編</p>\n</section>\n';

    expect(md.render(src)).toBe(expected);
  });
});
