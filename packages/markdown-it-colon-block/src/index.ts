import type MarkdownIt from 'markdown-it';
import StateBlock from 'markdown-it/lib/rules_block/state_block.mjs';

const marker_char = ':'.charCodeAt(0);
const marker_one_line = 2;
const marker_min_block = 3;
const defaultAttrName = 'class';
const validTagRegex = /^[a-zA-Z][a-zA-Z0-9-]*$/;

/**
 * Parses a parameter string into an array of attribute key-value pairs.
 * Words without an explicit key are automatically grouped into the default 'class' attribute.
 * * @param attrsStr - The raw parameter string extracted from the block header.
 * @returns An array of [attributeName, attributeValue] tuples.
 */
function parseAttrs(attrsStr: string): [string, string][] {
  const attrs: [string, string][] = [];
  const defaultAttrValues: string[] = [];

  const regex = /([a-zA-Z0-9_-]+)="((?:[^"\\]|\\.)*)"|([^\s"=]+)/g;
  const matches = attrsStr.matchAll(regex);

  for (const match of matches) {
    if (match[1] !== undefined && match[2] !== undefined) {
      const key = match[1];
      const value = match[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');

      if (key === defaultAttrName) {
        defaultAttrValues.push(...value.split(/\s+/));
      } else {
        attrs.push([key, value]);
      }
    } else if (match[3] !== undefined) {
      defaultAttrValues.push(match[3]);
    }
  }

  if (defaultAttrValues.length > 0) {
    attrs.unshift([defaultAttrName, defaultAttrValues.join(' ')]);
  }

  return attrs;
}

/**
 * Markdown-it plugin that introduces custom colon-delimited blocks.
 * Supports both single-line (`::`) and multi-line (`:::`) containers with dynamic tag names and attributes.
 * * @param md - The MarkdownIt parser instance.
 */
export default function ColonBlockPlugin(md: MarkdownIt): void {
  md.block.ruler.before('fence', 'colon_block', ColonBlock);

  md.renderer.rules.colon_block_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const tagName = token.tag || 'div';
    console.log('token.attrs', token.attrs);

    const attrsStr = self.renderAttrs(token);
    return `<${tagName}${attrsStr}>`;
  };

  md.renderer.rules.colon_block_close = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const tagName = token.tag || 'div';

    return `</${tagName}>\n`;
  };
}

function ColonBlock(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];

  if (state.sCount[startLine] - state.blkIndent >= 4) {
    return false;
  }

  if (pos + marker_one_line > max) {
    return false;
  }

  if (state.src.charCodeAt(pos) !== marker_char) {
    return false;
  }

  let mem = pos;
  pos = state.skipChars(pos, marker_char);

  let marker_len = pos - mem;

  if (marker_len === marker_one_line) {
    // Notation Sample:
    // ::[tagName?] [attrs?]:: content

    const lineText = state.src.slice(pos, max);

    let closeIdx = -1;
    let inQuotes = false;

    for (let i = 0; i < lineText.length; i++) {
      if (lineText[i] === '\\' && inQuotes) {
        i++;
        continue;
      }

      if (lineText[i] === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (!inQuotes && lineText.slice(i, i + 2) === '::') {
        closeIdx = i;
        break;
      }
    }
    if (closeIdx === -1) {
      return false;
    }

    let tagName = 'div';
    let attrs = '';

    let idx = 0;
    mem = idx;

    idx = lineText.slice(0, closeIdx).indexOf(' ', idx);
    idx = idx === -1 ? closeIdx : idx;
    if (idx - mem > 0) {
      const TagName0 = lineText.slice(mem, idx);
      if (validTagRegex.test(TagName0)) {
        tagName = TagName0;
      } else {
        return false;
      }
    }
    if (closeIdx - idx > 0) {
      attrs = lineText.slice(idx, closeIdx).trim();
    }

    if (silent) {
      return true;
    }

    state.line = startLine + 1;

    const token_o = state.push('colon_block_open', tagName, 1);
    token_o.markup = '::';
    token_o.info = attrs;
    token_o.map = [startLine, state.line];
    token_o.attrs = parseAttrs(attrs);

    const token_i = state.push('inline', '', 0);
    token_i.content = lineText.slice(closeIdx + 2).trimStart();
    token_i.map = [startLine, state.line];
    token_i.children = [];

    const token_c = state.push('colon_block_close', tagName, -1);
    token_c.markup = '::';

    return true;
  } else if (marker_len < marker_min_block) {
    return false;
  }

  // Notation Sample:
  /*
  :::[tagName?] [attrs?]
  inner blocks
  :::
  */

  const lineText = state.src.slice(pos, max);

  let tagName = 'div';
  let attrs = '';
  let idx = 0;
  mem = idx;
  let lmax = max - pos;

  idx = lineText.indexOf(' ', idx);
  idx = idx === -1 ? lmax : idx;
  if (idx - mem > 0) {
    const TagName0 = lineText.slice(mem, idx);
    if (validTagRegex.test(TagName0)) {
      tagName = TagName0;
    } else {
      return false;
    }
  }
  if (lmax - idx > 0) {
    attrs = lineText.slice(idx, lmax).trim();
  }

  if (silent) {
    return true;
  }

  let nextLine = startLine;
  const sCount = state.sCount[startLine];
  let haveEndMarker = false;
  let alsoOpenMarker = false;
  let cmarker_len = 0;

  for (;;) {
    nextLine++;
    if (nextLine >= endLine) {
      break;
    }

    pos = mem = state.bMarks[nextLine] + state.tShift[nextLine];
    max = state.eMarks[nextLine];

    if (pos < max && state.sCount[nextLine] < state.blkIndent) {
      break;
    }

    // Skip nested content lines that are deeper than the block indent
    if (pos < max && state.sCount[nextLine] > sCount) {
      continue;
    }

    if (state.src.charCodeAt(pos) !== marker_char) {
      continue;
    }

    if (state.sCount[nextLine] - state.blkIndent >= 4) {
      continue;
    }

    // Terminate the block if the indent is shallower than the base indent
    if (pos < max && state.sCount[nextLine] < sCount) {
      break;
    }

    pos = state.skipChars(pos, marker_char);
    cmarker_len = pos - mem;

    if (cmarker_len < marker_len) {
      continue;
    }

    pos = state.skipSpaces(pos);

    if (pos < max) {
      alsoOpenMarker = true;
    }

    haveEndMarker = true;
    break;
  }

  const old_parent = state.parentType;
  const old_line_max = state.lineMax;

  state.parentType = 'container';
  // Restrict the inner tokenizer from parsing past the closing line of this container
  state.lineMax = nextLine;

  const token_o = state.push('colon_block_open', tagName, 1);
  token_o.markup = ':'.repeat(marker_len);
  token_o.block = true;
  token_o.info = attrs;
  token_o.map = [startLine, nextLine];
  token_o.attrs = parseAttrs(attrs);

  // Recursively tokenize the nested block content
  state.md.block.tokenize(state, startLine + 1, nextLine);

  const token_c = state.push('colon_block_close', tagName, -1);
  token_c.markup = ':'.repeat(cmarker_len);
  token_c.block = true;

  state.parentType = old_parent;
  state.lineMax = old_line_max;
  state.line = nextLine + (haveEndMarker && !alsoOpenMarker ? 1 : 0);

  return true;
}
