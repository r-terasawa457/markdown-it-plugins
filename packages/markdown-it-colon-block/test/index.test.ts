import MarkdownIt from 'markdown-it';
import ColonBlockPlugin from '../src/index.ts';
import { describe, test, expect } from 'bun:test';

interface TestCase {
  name: string;
  markdown: string;
  expectedHtml: string;
}

const testCases: TestCase[] = [
  {
    name: '0. fence コピー実装の挙動を簡易的に確認',
    markdown: `~~~js\nconsole.log('hello');\n~~~`,
    expectedHtml: `<pre><code class="language-js">console.log('hello');\n</code></pre>\n`,
  },
  {
    name: '1. 基本的な1行ブロック（単一クラス）',
    markdown: '::div text-danger:: こんにちは',
    // レンダラーが attrs = ` class="${token.info}"` と出力している想定です
    expectedHtml: '<div class="text-danger">こんにちは</div>\n',
  },
  {
    name: '2. 複数クラスの指定（スペース区切り）',
    markdown: '::div d-flex align-items-center:: 読込中...',
    expectedHtml: '<div class="d-flex align-items-center">読込中...</div>\n',
  },
  {
    name: '3. div以外の有効なタグ名（span）',
    markdown: '::span badge:: 新着',
    expectedHtml: '<span class="badge">新着</span>\n',
  },
  {
    name: '4. パラメータ（クラスなど）が空のパターン',
    markdown: '::div:: クラスなしテキスト',
    // ※レンダラーの実装によっては <div class=""> になる場合があります。
    // もし <div class=""> になる場合は期待値を適宜修正してください。
    expectedHtml: '<div>クラスなしテキスト</div>\n',
  },
  {
    name: '5. コンテンツ前後の空白が trimStart() されるかの検証',
    markdown: '::div alert::      前方にスペースがあるテキスト   ',
    expectedHtml: '<div class="alert">前方にスペースがあるテキスト   </div>\n',
  },
  {
    name: '6. 【異常系】タグ名が無効な場合は弾かれて通常の段落（pタグ）になる',
    markdown: '::.invalid-tag class:: 弾かれるはず',
    // パーサーが false を返すため、markdown-itの標準パーサーによって通常の文字列として処理されます
    expectedHtml: '<p>::.invalid-tag class:: 弾かれるはず</p>\n',
  },
  {
    name: '7. 【異常系】閉じの「::」が存在しない場合は通常の段落になる',
    markdown: '::div missing-close-marker text',
    expectedHtml: '<p>::div missing-close-marker text</p>\n',
  },
  {
    name: '8. 【仕様外】4スペース以上のインデントがある場合はコードブロックになる',
    markdown: '    ::div d-flex:: インデントされたテキスト',
    expectedHtml: '<pre><code>::div d-flex:: インデントされたテキスト\n</code></pre>\n',
  },
  {
    name: '9. 基本的な複数行ブロック（クラス指定、内部がMarkdownパースされること）',
    markdown: ':::div card\nこんにちは\n:::',
    // 1行ブロックと違い、中身の「こんにちは」が通常の段落（pタグ）としてパースされます
    expectedHtml: '<div class="card"><p>こんにちは</p>\n</div>\n',
  },
  {
    name: '10. div以外の有効なタグ名（section）',
    markdown: ':::section intro\nイントロダクションの文章\n:::',
    expectedHtml: '<section class="intro"><p>イントロダクションの文章</p>\n</section>\n',
  },
  {
    name: '11. 複数行ブロックのネスト（入れ子構造）',
    markdown: ':::div outer\n  :::div inner\n  ネストされたテキスト\n:::',
    expectedHtml: '<div class="outer"><div class="inner"><p>ネストされたテキスト</p>\n</div>\n</div>\n',
  },
  {
    name: '12. 閉じマーカーの長さ（開始マーカーの長さ以上が必要であること）',
    markdown: '::::div\n4本のコロンで開始\n:::\n::::',
    // 途中の「:::」では閉じられず、最後の「::::」で正しく閉じられるかのテスト
    expectedHtml: '<div><p>4本のコロンで開始\n:::</p>\n</div>\n',
  },
  {
    name: '13. 閉じ忘れ時のオートクローズ（ファイル末尾で自動的に閉じられる）',
    markdown: ':::div warning\n閉じ忘れたコンテンツ',
    expectedHtml: '<div class="warning"><p>閉じ忘れたコンテンツ</p>\n</div>\n',
  },
  {
    name: '14. 【異常系】タグ名が無効な場合は複数行ブロックにならず、ただのテキストになる',
    markdown: ':::.invalid-tag\nコンテンツ\n:::',
    expectedHtml: '<p>:::.invalid-tag\nコンテンツ\n:::</p>\n',
  },
  {
    name: '15. 任意属性パースの検証（1行ブロック）',
    markdown: '::span btn btn-primary id="submit-btn" data-toggle="modal":: 送信',
    expectedHtml: '<span class="btn btn-primary" id="submit-btn" data-toggle="modal">送信</span>\n',
  },
  {
    name: '16. 任意属性パースの検証（複数行ブロック・クォート内のスペース維持）',
    markdown: ':::div container id="main-content" style="display: flex; gap: 10px;"\nコンテンツ\n:::',
    expectedHtml:
      '<div class="container" id="main-content" style="display: flex; gap: 10px;"><p>コンテンツ</p>\n</div>\n',
  },
  {
    name: '17. 属性値（Value）内部のエスケープクォーテーションの検証',
    markdown: '::button data-msg="Hello \\"World\\"":: ボタン',
    // 最終的に markdown-it の標準レンダラーが \" を &quot; に安全に変換してくれます
    expectedHtml: '<button data-msg="Hello &quot;World&quot;">ボタン</button>\n',
  },
  {
    name: '18. 1行ブロックの属性値（Value）内部に「::」が含まれる場合のパース検証',
    markdown: '::div important class="badge" data-pattern="a::b":: 該当テキスト',
    expectedHtml: '<div class="important badge" data-pattern="a::b">該当テキスト</div>\n',
  },
];

describe('ColonBlockPlugin', () => {
  const md = new MarkdownIt().use(ColonBlockPlugin);

  for (const testCase of testCases) {
    test(testCase.name, () => {
      expect(md.render(testCase.markdown)).toBe(testCase.expectedHtml);
    });
  }
});
