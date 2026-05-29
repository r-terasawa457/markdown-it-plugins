import type MarkdownIt from 'markdown-it';
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs';
import type StateCore from 'markdown-it/lib/rules_core/state_core.mjs';

/**
 * Options for configuring the SectionBlockPlugin.
 */
export interface SectionBlockPluginOptions {
  /** Determines whether to append the `data-section-number` attribute to sections. */
  add_data_section_number?: boolean;
  /**
   * Configures the prefix for the sequential ID attribute.
   * - `string`: Uses the specified custom prefix (e.g., 'slide-1').
   * - `true`: Uses the default prefix 'section-' (e.g., 'section-1').
   * - `false` or `null`: Disables appending the ID attribute entirely.
   */
  add_section_id?: string | boolean | null;
  /** An array of class names to be added to every section element. */
  add_classes?: string[] | false;
  /** The starting index for the sequential page numbering. */
  number_start?: number;
  /** A post-processing core-rule hook that triggers right after all sections are parsed and extracted. */
  sectionCoreRuleAdditionalHook?: (ctx: SectionHookContext) => void;
  /** An array of character codes recognized as section dividers. Defaults to `[0x2d]` ('-'). */
  separator_marker_chars?: number[];
  /** The minimum length of the marker characters required to form a section divider. Defaults to `3`. */
  separator_min_len?: number;
}

/**
 * Context object passed to the `sectionCoreRuleAdditionalHook` callback.
 */
export interface SectionHookContext {
  /** The markdown-it Core rule state object. */
  state: StateCore;
  /** An array of structured section data objects that can be mutated inside the hook. */
  sections: SectionData[];
  /** The fully resolved plugin options. */
  options: Required<Omit<SectionBlockPluginOptions, 'sectionCoreRuleAdditionalHook'>>;
  /** Document-wide metadata collection. */
  meta: {
    /** Total number of extracted sections/pages. */
    total_pages: number;
  };
}

/**
 * Represents the structure of a single markdown section.
 */
export interface SectionData {
  /** The open token instance representing the `<section>` tag. */
  openToken: any;
  /** The close token instance representing the `</section>` tag. */
  closeToken: any;
  /** The internal array of block tokens contained inside this specific section. */
  tokens: any[];
  /** The 1-based sequential page index assigned to this section. */
  pageNumber: number;
}

/**
 * A markdown-it block plugin that segments content blocks separated by specific dividers into `<section>` elements.
 * It prepends an initial opening section and appends a closing section token globally.
 */
export default function SectionBlockPlugin(md: MarkdownIt, options?: SectionBlockPluginOptions): void {
  const opts: Required<SectionBlockPluginOptions> = {
    add_data_section_number: options?.add_data_section_number ?? false,
    add_section_id: options?.add_section_id !== undefined ? options.add_section_id : true,
    add_classes: options?.add_classes ?? false,
    number_start: options?.number_start ?? 1,
    sectionCoreRuleAdditionalHook: options?.sectionCoreRuleAdditionalHook ?? (() => {}),
    separator_marker_chars: options?.separator_marker_chars ?? [0x2d],
    separator_min_len: options?.separator_min_len ?? 3,
  };

  md.block.ruler.before('hr', 'section_block', createSectionBlockRule(opts));
  md.core.ruler.push('section_wrap_open', sectionWrapOpenCoreRule);
  md.core.ruler.push('section_wrap_close', sectionWrapCloseCoreRule);
  md.core.ruler.push('section_apply_attrs', createSectionApplyAttrsCoreRule(opts));

  md.renderer.rules.section_open = (tokens, idx, _options, _env, self) => {
    return `<section${self.renderAttrs(tokens[idx])}>\n`;
  };
  md.renderer.rules.section_close = () => '</section>\n';
}

function sectionWrapOpenCoreRule(state: StateCore): void {
  if (state.tokens.length === 0) return;
  const token_o = new state.Token('section_open', 'section', 1);
  token_o.block = true;
  state.tokens.unshift(token_o);
}

function sectionWrapCloseCoreRule(state: StateCore): void {
  if (state.tokens.length === 0) return;
  const token_c = new state.Token('section_close', 'section', -1);
  token_c.block = true;
  state.tokens.push(token_c);
}

/**
 * Factory that returns a markdown-it block rule function designed to match customized divider syntax.
 */
function createSectionBlockRule(opts: Required<SectionBlockPluginOptions>) {
  return function sectionBlockRule(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
    let pos = state.bMarks[startLine] + state.tShift[startLine];
    let max = state.eMarks[startLine];

    if (state.sCount[startLine] - state.blkIndent >= 4) return false;

    const marker = state.src.charCodeAt(pos);
    if (!opts.separator_marker_chars.includes(marker)) return false;

    const mem = pos;
    pos = state.skipChars(pos, marker);
    const len = pos - mem;

    if (len < opts.separator_min_len) return false;

    pos = state.skipSpaces(pos);
    if (pos < max) return false;

    if (silent) return true;

    const token_c = state.push('section_close', 'section', -1);
    token_c.block = true;

    const token_o = state.push('section_open', 'section', 1);
    token_o.block = true;
    token_o.map = [startLine + 1, startLine + 1];

    state.line = startLine + 1;
    return true;
  };
}

/**
 * Factory that creates a core rule function responsible for structuring flat tokens into manageable sections,
 * attaching explicit rendering attributes, executing the custom hook, and flattening tokens back together.
 */
function createSectionApplyAttrsCoreRule(opts: Required<SectionBlockPluginOptions>) {
  return function sectionApplyAttrsCoreRule(state: StateCore): void {
    if (state.tokens.length === 0) return;

    const sections: SectionData[] = [];
    let currentSection: SectionData | null = null;
    let pageCounter = opts.number_start;

    for (let i = 0; i < state.tokens.length; i++) {
      const token = state.tokens[i];

      if (token.type === 'section_open') {
        currentSection = {
          openToken: token,
          closeToken: null,
          tokens: [],
          pageNumber: pageCounter++,
        };

        token.attrs = token.attrs || [];
        if (opts.add_section_id !== false && opts.add_section_id !== null) {
          const prefix = typeof opts.add_section_id === 'string' ? opts.add_section_id : 'section';
          token.attrSet('id', `${prefix}-${currentSection.pageNumber}`);
        }
        if (opts.add_classes && opts.add_classes.length > 0) {
          opts.add_classes.forEach((cls) => token.attrJoin('class', cls));
        }
        if (opts.add_data_section_number) {
          token.attrSet('data-section-number', String(currentSection.pageNumber));
        }
      } else if (token.type === 'section_close') {
        if (currentSection) {
          currentSection.closeToken = token;
          sections.push(currentSection);
          currentSection = null;
        }
      } else {
        if (currentSection) {
          currentSection.tokens.push(token);
        }
      }
    }

    const meta = { total_pages: sections.length };
    if (opts.sectionCoreRuleAdditionalHook) {
      opts.sectionCoreRuleAdditionalHook({
        state,
        sections,
        options: opts,
        meta,
      });
    }

    const newTokens: any[] = [];
    for (const sec of sections) {
      newTokens.push(sec.openToken);
      newTokens.push(...sec.tokens);
      newTokens.push(sec.closeToken);
    }
    state.tokens = newTokens;
  };
}
