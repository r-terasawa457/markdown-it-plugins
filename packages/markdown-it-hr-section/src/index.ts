import type MarkdownIt from 'markdown-it';
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs';
import type StateCore from 'markdown-it/lib/rules_core/state_core.mjs';

const MARKER_CHAR = 0x2d; // '-'
const MIN_MARKER_LEN = 3;

export interface SectionBlockPluginOptions {
  /** セクションの通し番号 (data-section-number) を付与するかどうか */
  add_data_section_number?: boolean;
  /** 連番IDのプレフィックス (string: 任意の文字列, true: 'section-', false/null: 付与しない) */
  add_section_id?: string | boolean | null;
  /** セクションに一括付与するクラス名の配列 */
  add_classes?: string[] | false;
  /** 通し番号の開始インデックス */
  number_start?: number;
}

/**
 * Markdown-it plugin that wraps content blocks separated by `---` (thematic breaks) into `<section>` elements.
 * It automatically opens a section at the beginning of the document and closes the final section at the end.
 */
export default function SectionBlockPlugin(md: MarkdownIt, options?: SectionBlockPluginOptions): void {
  // デフォルト値のマージ (null や false を維持するため undefined のみチェック)
  const opts: Required<SectionBlockPluginOptions> = {
    add_data_section_number: options?.add_data_section_number ?? false,
    add_section_id: options?.add_section_id !== undefined ? options.add_section_id : true,
    add_classes: options?.add_classes ?? false,
    number_start: options?.number_start ?? 1,
  };

  // Inject the section block ruler before the standard 'hr' (thematic break) rule
  md.block.ruler.before('hr', 'section_block', sectionBlockRule);

  // Core rules to handle wrapping at the very beginning and very end of the token stream
  md.core.ruler.push('section_wrap_open', sectionWrapOpenCoreRule);
  md.core.ruler.push('section_wrap_close', sectionWrapCloseCoreRule);

  // Core rule to dynamically apply attributes to all section_open tokens
  md.core.ruler.push('section_apply_attrs', createSectionApplyAttrsCoreRule(opts));

  // Renderer definitions for section tokens using renderAttrs
  md.renderer.rules.section_open = (tokens, idx, _options, _env, self) => {
    return `<section${self.renderAttrs(tokens[idx])}>\n`;
  };
  md.renderer.rules.section_close = () => '</section>\n';
}

/**
 * Core rule to prepend a `section_open` token at the beginning of the block token stream.
 */
function sectionWrapOpenCoreRule(state: StateCore): void {
  if (state.tokens.length === 0) return;

  const token_o = new state.Token('section_open', 'section', 1);
  token_o.block = true;

  // Insert at the very beginning of the document
  state.tokens.unshift(token_o);
}

/**
 * Core rule to append a `section_close` token at the very end of the block token stream.
 */
function sectionWrapCloseCoreRule(state: StateCore): void {
  if (state.tokens.length === 0) return;

  const token_c = new state.Token('section_close', 'section', -1);
  token_c.block = true;

  // Append to the very end of the document
  state.tokens.push(token_c);
}

/**
 * Factory to create a core rule that applies configuration-based attributes to all section_open tokens.
 */
function createSectionApplyAttrsCoreRule(opts: Required<SectionBlockPluginOptions>) {
  return function sectionApplyAttrsCoreRule(state: StateCore): void {
    if (state.tokens.length === 0) return;

    let currentNumber = opts.number_start;

    for (let i = 0; i < state.tokens.length; i++) {
      const token = state.tokens[i];
      if (token.type !== 'section_open') continue;

      token.attrs = token.attrs || [];

      // 1. IDの付与 (出力HTMLの綺麗さのため、最初に追加して先頭に並ぶようにする)
      if (opts.add_section_id !== false && opts.add_section_id !== null) {
        const prefix = typeof opts.add_section_id === 'string' ? opts.add_section_id : 'section';
        token.attrSet('id', `${prefix}-${currentNumber}`);
      }

      // 2. クラスの付与
      if (opts.add_classes && opts.add_classes.length > 0) {
        opts.add_classes.forEach((cls) => {
          token.attrJoin('class', cls);
        });
      }

      // 3. 通し番号 (data-section-number) の付与
      if (opts.add_data_section_number) {
        token.attrSet('data-section-number', String(currentNumber));
      }

      currentNumber++;
    }
  };
}

function sectionBlockRule(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];

  // If it's indented more than 3 spaces, it should be treated as a code block
  if (state.sCount[startLine] - state.blkIndent >= 4) {
    return false;
  }

  // Check if the current character is a hyphen
  if (state.src.charCodeAt(pos) !== MARKER_CHAR) {
    return false;
  }

  // Scan marker length
  const mem = pos;
  pos = state.skipChars(pos, MARKER_CHAR);
  const len = pos - mem;

  // Visual dividers like '---' must have at least 3 markers
  if (len < MIN_MARKER_LEN) {
    return false;
  }

  // Ensure trailing spaces only
  pos = state.skipSpaces(pos);
  if (pos < max) {
    return false;
  }

  if (silent) {
    return true;
  }

  // Close the previous section and open a new one
  const token_c = state.push('section_close', 'section', -1);
  token_c.block = true;

  const token_o = state.push('section_open', 'section', 1);
  token_o.block = true;
  token_o.map = [startLine + 1, startLine + 1];

  // Consume this line and advance the parser state
  state.line = startLine + 1;
  return true;
}
