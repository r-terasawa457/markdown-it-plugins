import MarkdownIt from 'markdown-it';
import SectionBlockPlugin from '../src/index.ts';
import { describe, test, expect } from 'bun:test';

interface TestCase {
  name: string;
  markdown: string;
  expectedHtml: string;
}

const testCases: TestCase[] = [
  {
    name: '1. 単一のセクション（区切り線なしでも全体が囲まれること）',
    markdown: '最初のセクションのテキストです。',
    expectedHtml: '<section>\n<p>最初のセクションのテキストです。</p>\n</section>\n',
  },
  {
    name: '2. 基本的なセクション区切り（空行を挟むことでlheadingを回避しセクションが分割される）',
    markdown: 'セクション1\n\n---\n\nセクション2',
    expectedHtml: '<section>\n<p>セクション1</p>\n</section>\n<section>\n<p>セクション2</p>\n</section>\n',
  },
  {
    name: '3. 複数のセクション区切り（空行がない場合はlheading見出しが優先される）',
    markdown: 'A\n---\nB\n---\nC',
    expectedHtml: '<section>\n<h2>A</h2>\n<h2>B</h2>\n<p>C</p>\n</section>\n',
  },
  {
    name: '4. 連続する区切り線（1つ目はlheadingとして消費され、2つ目でセクションが分割される）',
    markdown: 'セクション1\n---\n---\nセクション3',
    expectedHtml: '<section>\n<h2>セクション1</h2>\n</section>\n<section>\n<p>セクション3</p>\n</section>\n',
  },
  {
    name: '5. 長いハイフン列の区切り線（前の行がある場合はlheading見出しが優先される）',
    markdown: 'セクション1\n---------\nセクション2',
    expectedHtml: '<section>\n<h2>セクション1</h2>\n<p>セクション2</p>\n</section>\n',
  },
  {
    name: '6. 【境界値】2本以下のハイフンは区切り線にならず、Setext見出し（h2）になる',
    markdown: '見出し1\n--',
    expectedHtml: '<section>\n<h2>見出し1</h2>\n</section>\n',
  },
  {
    name: '7. 【仕様外】段落の直後に4スペース以上のインデントがあるハイフンは、段落の継続テキストとなる',
    markdown: 'セクション1\n    ---\nセクション1の続き',
    expectedHtml: '<section>\n<p>セクション1\n---\nセクション1の続き</p>\n</section>\n',
  },
  {
    name: '8. 3スペース以内のインデントがあり、前の行が存在する場合はlheadingとなる',
    markdown: 'セクション1\n   ---\nセクション2',
    expectedHtml: '<section>\n<h2>セクション1</h2>\n<p>セクション2</p>\n</section>\n',
  },
  {
    name: '9. ハイフンの後ろにスペースのみが存在し、前の行が存在する場合はlheadingとなる',
    markdown: 'セクション1\n---    \nセクション2',
    expectedHtml: '<section>\n<h2>セクション1</h2>\n<p>セクション2</p>\n</section>\n',
  },
  {
    name: '10. ハイフンの後ろに文字が存在する場合は無効化され通常のテキストとなる',
    markdown: 'セクション1\n--- text\nセクション1の続き',
    expectedHtml: '<section>\n<p>セクション1\n--- text\nセクション1の続き</p>\n</section>\n',
  },
];

describe('SectionBlockPlugin', () => {
  const md = new MarkdownIt().use(SectionBlockPlugin);

  for (const testCase of testCases) {
    test(testCase.name, () => {
      expect(md.render(testCase.markdown)).toBe(testCase.expectedHtml);
    });
  }
});
