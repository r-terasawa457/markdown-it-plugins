import type MarkdownIt from 'markdown-it';
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs';
import type StateCore from 'markdown-it/lib/rules_core/state_core.mjs';

const MARKER_CHAR = 0x2d; // '-'
const MIN_MARKER_LEN = 3;

/**
 * Markdown-it plugin that wraps content blocks separated by `---` (thematic breaks) into `<section>` elements.
 * It automatically opens a section at the beginning of the document and closes the final section at the end.
 * * @param md - The MarkdownIt parser instance.
 */
export default function SectionBlockPlugin(md: MarkdownIt): void {
  // Inject the section block ruler before the standard 'hr' (thematic break) rule
  md.block.ruler.before('hr', 'section_block', sectionBlockRule);

  // Core rules to handle wrapping at the very beginning and very end of the token stream
  md.core.ruler.push('section_wrap_open', sectionWrapOpenCoreRule);
  md.core.ruler.push('section_wrap_close', sectionWrapCloseCoreRule);

  // Renderer definitions for section tokens
  md.renderer.rules.section_open = () => '<section>\n';
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
