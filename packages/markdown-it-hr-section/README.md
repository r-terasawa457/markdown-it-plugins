Here is a comprehensive, production-ready `README.md` written in English, tailored to match the clean design and precise API of your custom plugin.

---

# markdown-it-hr-section

A lightweight, robust `markdown-it` plugin designed to split your document into structured `<section>` elements based on horizontal rule dividers (like `---` or custom markers). It automatically wraps initial and final blocks, auto-increments page numbers, and provides a powerful post-processing hook layer—perfect for slide deck tools like Marp.

## Features

- **Auto-Wrapping:** Automatically wraps the opening of your document and the closing of your document in `<section>` blocks.
- **Deterministic Layouts:** Safely splits segments without conflicting with standard paragraph text or nested formatting.
- **Dynamic Attribute Injection:** Seamlessly adds dynamic `id` prefixes, global `class` arrays, and `data-section-number` counters utilizing `md.renderAttrs`.
- **Zero-Shift Post-Processing:** Provides a safe `sectionCoreRuleAdditionalHook` callback that completely isolates each section's tokens, allowing you to insert headers/footers or remove configuration sections without breaking line indices.
- **Highly Customizable:** Configure custom separator markers (e.g., `***`, `___`) and modify minimal threshold lengths.

---

## Basic Usage

```typescript
import MarkdownIt from 'markdown-it';
import SectionBlockPlugin from 'markdown-it-hr-section';

const md = new MarkdownIt().use(SectionBlockPlugin, {
  add_section_id: 'slide',
  add_classes: ['markdown-slide'],
  add_data_section_number: true,
});

const markdown = `
# Slide 1 Content
This is the first section.

---

# Slide 2 Content
This is the second section.
`;

console.log(md.render(markdown));
```

### Output HTML:

```html
<section id="slide-1" class="markdown-slide" data-section-number="1">
  <h1>Slide 1 Content</h1>
  <p>This is the first section.</p>
</section>
<section id="slide-2" class="markdown-slide" data-section-number="2">
  <h1>Slide 2 Content</h1>
  <p>This is the second section.</p>
</section>
```

---

## Configuration Options

| Option                          | Type                                | Default     | Description                                                                                                                                                                 |
| ------------------------------- | ----------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `add_data_section_number`       | `boolean`                           | `false`     | When true, appends a `data-section-number="X"` attribute to each section element.                                                                                           |
| `add_section_id`                | `string &#124; boolean &#124; null` | `true`      | The prefix for sequential item indexing. Set to `true` to get `section-X`, pass a string for a custom prefix (e.g. `slide-X`), or pass `false`/`null` to omit IDs entirely. |
| `add_classes`                   | `string[] &#124; false`             | `false`     | An array of static layout class names applied uniformly to all section structures.                                                                                          |
| `number_start`                  | `number`                            | `1`         | The starting integer for your sequential slide page indexes.                                                                                                                |
| `separator_marker_chars`        | `number[]`                          | `[0x2d]`    | Character codes explicitly registered to act as divider blocks. Defaults exclusively to `-` (`0x2d`).                                                                       |
| `separator_min_len`             | `number`                            | `3`         | The minimum required threshold length of the target marker chain to trigger an isolation split.                                                                             |
| `sectionCoreRuleAdditionalHook` | `(ctx) => void`                     | `undefined` | Advanced lifecycle callback execution layer to directly process isolated block segments.                                                                                    |

---

## Advanced Usage: Lifecycle Hooks

The `sectionCoreRuleAdditionalHook` grants access to an isolated layout grid array where structural alterations can be performed safely before tokens are compiled.

### Dynamic Layout Styling & Global Footers

```typescript
const md = new MarkdownIt().use(SectionBlockPlugin, {
  add_section_id: false,
  sectionCoreRuleAdditionalHook: (ctx) => {
    const { sections, meta, state } = ctx;

    sections.forEach((sec) => {
      // 1. Assign custom layout classes based on slide content
      const hasH1 = sec.tokens.some((t) => t.type === 'heading_open' && t.tag === 'h1');
      sec.openToken.attrJoin('class', hasH1 ? 'title-slide' : 'normal-slide');

      // 2. Append a safe pagination element onto the end of each slide
      const fOpen = new state.Token('footer_open', 'footer', 1);
      fOpen.attrs = [['class', 'pagination']];

      const fInline = new state.Token('inline', '', 0);
      fInline.content = `${sec.pageNumber}/${meta.total_pages}`;

      const fText = new state.Token('text', '', 0);
      fText.content = fInline.content;
      fInline.children = [fText];

      const fClose = new state.Token('footer_close', 'footer', -1);

      // Mutating tokens array here is 100% safe from line-index-shifting side-effects!
      sec.tokens.push(fOpen, fInline, fClose);
    });
  },
});
```

---

## Marker Customization

If you want your slide boundaries to trigger on asterisks (`***`) instead of hyphens, or if you want to preserve `---` for native markdown `<hr>` dividers inside a slide:

```typescript
const md = new MarkdownIt().use(SectionBlockPlugin, {
  separator_marker_chars: [0x2a], // Recognizes '*' only
  separator_min_len: 3,
});
```

## License

MIT
