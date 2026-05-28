# markdown-it-colon-block

コロン（`:`）表記を用いて、任意のHTMLタグや属性（クラス名・汎用属性）を柔軟に記述できる `markdown-it` プラグイン。私用ツール。
マークダウン内に、マークダウンらしい簡潔な記法を崩さず、任意のHtmlタグを使ってドキュメントを自由に構成できます。
[markdown-it-container](https://github.com/markdown-it/markdown-it-container)にインスパイアされています。

## 🚀 特徴 (Features)

- **1行・複数行の双方に対応**: `::` によるインライン風の1行要素と、`:::` によるブロック要素の双方をサポート。
- **閉じマーカーの省略（オートクローズ）**: 複数行コンテナは、**中間の閉じマーカー（`:::`）を省略できます**。
- **柔軟なネスト（入れ子）表現**: 以下の2パターンのいずれでも直感的にネストを表現できます。

1. **インデントレベル** によるネスト（内側をインデントする）
2. **コロンの数** によるネスト（外側のコロン `::::` を増やす）

- **高度な属性パース**: `class` 名の自動マージに加え、`id="main"` や `data-custom="value"` などの汎用属性の付与に対応。

## 📦 利用方法 (Usage with Bun)

### 依存関係のインストール

```bash
bun add markdown-it
# TypeScript型定義などが必要な場合
bun add -d @types/markdown-it

```

### 導入例

```typescript
import MarkdownIt from 'markdown-it';
import ColonBlockPlugin from './src/index.ts';

const md = new MarkdownIt().use(ColonBlockPlugin);

const src = '::span badge btn-primary:: 新着';
const rendered = md.render(src);
// <span class="badge btn-primary">新着</span>
```

---

## 📝 記法見本 (Syntax Examples)

### 1. 1行ブロック

```markdown
::[タグ名: divの場合省略可] [クラス名1] [クラス名2] [...] [属性名1]="[属性値1]" [属性名2]="[属性値2]" [...]:: 内容
::span btn btn-primary id="submit-btn":: 送信
```

### 2. 複数行コンテナ ＆ 閉じマーカーの省略

```markdown
:::div alert alert-warning
閉じマーカー（:::）を書き忘れても、
ドキュメントの最後で安全に自動クローズされます。
```

### 3. ネスト表現（インデントレベル）

```markdown
::: outer-box
::: inner-box
インデントを下げることでネストされます。
::: inner-box
ネスト時の内側は閉じコロンが省略できます
:::
```

### 4. ネスト表現（コロンの数）

```markdown
::::section main-container
:::div content-card
コロンの数を「開始 > 内部」にすることでインデントなしでもネスト可能です。
:::
::::
```

### 4. ネスト表現（コロンの数|インデントレベル）

```markdown
::::section main-container
::: card
::: card-header
コロンの数を「開始 > 内部」にすることでインデントなしでもネスト可能です。
::: card-body
コロンの数とインデントレベルを併用して柔軟にネストできます。
:::
:::
::::
```
