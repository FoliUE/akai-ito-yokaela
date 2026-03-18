const AUTHOR_PRESETS = {
  mica: {
    label: "Mica",
    cardClass: "note-card--mica",
    emptyTitle: "Tu espacio",
    emptyBody: "Esta hoja queda abierta para cuando quieras escribir."
  },
  leo: {
    label: "Leo",
    cardClass: "note-card--leo",
    emptyTitle: "Tu respuesta",
    emptyBody: "Este espacio queda listo para cuando quieras sumar tu nota."
  }
};

const DEFAULT_MUSIC_TEXT = {
  buttonLabel: "Reproducir canción",
  loadingMessage: "Intentando reproducir la canción al abrir esta hoja.",
  playingMessage: "Reproduciendo la canción de fondo.",
  blockedMessage: "Tu navegador bloqueó el autoplay con sonido. Tocá el botón para iniciar la canción."
};

const VALID_FONT_SIZES = new Set(["default", "sm", "md", "lg", "xl", "hero"]);
const VALID_FONT_FAMILIES = new Set(["default", "body", "serif", "display", "script"]);
const VALID_ALIGNS = new Set(["default", "left", "center", "right"]);

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function pad(numero) {
  return String(numero).padStart(2, "0");
}

function coerceValue(rawValue = "") {
  const value = String(rawValue).trim();

  if (!value.length) {
    return "";
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  if (value === "null") {
    return null;
  }

  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function parseFrontmatter(rawContent = "") {
  const normalized = String(rawContent).replaceAll("\r\n", "\n");

  if (!normalized.startsWith("---\n")) {
    return {
      meta: {},
      body: normalized.trim()
    };
  }

  const endIndex = normalized.indexOf("\n---\n", 4);

  if (endIndex === -1) {
    return {
      meta: {},
      body: normalized.trim()
    };
  }

  const frontmatter = normalized.slice(4, endIndex);
  const body = normalized.slice(endIndex + 5).trim();
  const meta = {};

  frontmatter.split("\n").forEach((line) => {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmedLine.indexOf(":");

    if (separatorIndex === -1) {
      return;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1).trim();

    meta[key] = coerceValue(value);
  });

  return { meta, body };
}

function parseDirectiveOptions(lines = []) {
  const options = {};

  lines.forEach((line) => {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      return;
    }

    const separatorMatch = trimmedLine.match(/^([A-Za-z][\w-]*)\s*(=|:)\s*(.+)$/);

    if (!separatorMatch) {
      return;
    }

    const [, key, , value] = separatorMatch;
    options[key] = coerceValue(value);
  });

  return options;
}

function extractQuoteAuthor(lines = []) {
  const contentLines = [...lines];

  while (contentLines.length && !contentLines[contentLines.length - 1].trim()) {
    contentLines.pop();
  }

  const lastEntry = contentLines[contentLines.length - 1];
  const lastLine = lastEntry ? lastEntry.trim() : "";

  if (!/^[-—]\s+/.test(lastLine)) {
    return {
      author: "",
      lines: contentLines
    };
  }

  contentLines.pop();

  return {
    author: lastLine.replace(/^[-—]\s+/, "").trim(),
    lines: contentLines
  };
}

function linesToParagraphs(lines = []) {
  const paragraphs = [];
  let currentParagraph = [];

  lines.forEach((line) => {
    if (!line.trim()) {
      if (currentParagraph.length) {
        paragraphs.push(currentParagraph.join("\n").trim());
        currentParagraph = [];
      }

      return;
    }

    currentParagraph.push(line);
  });

  if (currentParagraph.length) {
    paragraphs.push(currentParagraph.join("\n").trim());
  }

  return paragraphs;
}

function normalizeStyle(style = {}) {
  const rawStyle = style && typeof style === "object" ? style : {};
  const fontSize = VALID_FONT_SIZES.has(rawStyle.fontSize) ? rawStyle.fontSize : "default";
  const fontFamily = VALID_FONT_FAMILIES.has(rawStyle.fontFamily) ? rawStyle.fontFamily : "default";
  const align = VALID_ALIGNS.has(rawStyle.align) ? rawStyle.align : "default";

  return { fontSize, fontFamily, align };
}

function normalizeFlags(rawFlags = [], blockType = "") {
  const inputFlags = Array.isArray(rawFlags)
    ? rawFlags
    : rawFlags instanceof Set
      ? [...rawFlags]
      : [rawFlags];
  const normalized = inputFlags
    .map((flag) => String(flag || "").trim().toLowerCase())
    .filter(Boolean);

  if (blockType === "hero-quote") {
    if (!normalized.includes("hero")) {
      normalized.push("hero");
    }
    if (!normalized.includes("center")) {
      normalized.push("center");
    }
  }

  return new Set(normalized);
}

function normalizeImageOptions(options = {}) {
  const rawOptions = options && typeof options === "object" ? options : {};

  return {
    src: String(rawOptions.src || "").trim(),
    alt: String(rawOptions.alt || "").trim(),
    caption: String(rawOptions.caption || "").trim(),
    height: String(rawOptions.height || "").trim(),
    fit: String(rawOptions.fit || "cover").trim() || "cover",
    padding: String(rawOptions.padding || rawOptions.imgPadding || "").trim(),
    background: String(rawOptions.background || rawOptions.imgBackground || "").trim(),
    position: String(rawOptions.position || "").trim(),
    margin: String(rawOptions.margin || "").trim()
  };
}

function normalizeVisualQuoteImageOptions(options = {}) {
  const rawOptions = options && typeof options === "object" ? options : {};
  const fit = String(rawOptions.fit || "cover").trim().toLowerCase();

  return {
    src: String(rawOptions.src || "").trim(),
    alt: String(rawOptions.alt || "").trim(),
    width: String(rawOptions.width || "").trim(),
    height: String(rawOptions.height || "").trim(),
    fit: fit === "contain" ? "contain" : "cover",
    padding: String(rawOptions.padding || "").trim(),
    background: String(rawOptions.background || "").trim(),
    position: String(rawOptions.position || "").trim(),
    radius: String(rawOptions.radius || "").trim(),
    border: String(rawOptions.border || "").trim()
  };
}

function buildVisualQuoteItem(rawItem = {}) {
  const item = rawItem && typeof rawItem === "object" ? rawItem : {};
  const kind = String(item.kind || item.type || "text").trim().toLowerCase();

  if (kind === "image") {
    return {
      id: item.id || `item-${Math.random().toString(36).slice(2, 8)}`,
      kind: "image",
      options: normalizeVisualQuoteImageOptions(item.options || item)
    };
  }

  return {
    id: item.id || `item-${Math.random().toString(36).slice(2, 8)}`,
    kind: "text",
    text: String(item.text || "").trim()
  };
}

function normalizeVisualQuoteRows(rows = []) {
  const sourceRows = Array.isArray(rows) ? rows : [];

  return sourceRows
    .map((row) => {
      const rawRow = row && typeof row === "object" ? row : {};
      const items = Array.isArray(rawRow.items)
        ? rawRow.items.map((item) => buildVisualQuoteItem(item)).filter((item) => item.kind === "image" || item.text)
        : [];

      if (!items.length) {
        return null;
      }

      return {
        id: rawRow.id || `row-${Math.random().toString(36).slice(2, 8)}`,
        items
      };
    })
    .filter(Boolean);
}

function normalizeVisualQuoteLayout(layout = {}) {
  const rawLayout = layout && typeof layout === "object" ? layout : {};
  const textTransform = String(rawLayout.textTransform || "").trim().toLowerCase();

  return {
    maxWidth: String(rawLayout.maxWidth || "").trim(),
    minHeight: String(rawLayout.minHeight || "").trim(),
    padding: String(rawLayout.padding || "").trim(),
    margin: String(rawLayout.margin || "").trim(),
    lineHeight: String(rawLayout.lineHeight || "").trim(),
    letterSpacing: String(rawLayout.letterSpacing || "").trim(),
    textTransform: textTransform === "uppercase" || textTransform === "none" ? textTransform : "",
    fontSize: String(rawLayout.fontSize || "").trim(),
    authorSize: String(rawLayout.authorSize || "").trim(),
    rowGap: String(rawLayout.rowGap || "").trim()
  };
}

function normalizeQuoteStripLayout(layout = {}) {
  const rawLayout = layout && typeof layout === "object" ? layout : {};

  return {
    margin: String(rawLayout.margin || "").trim(),
    gap: String(rawLayout.gap || "").trim(),
    sideWidth: String(rawLayout.sideWidth || "").trim(),
    minHeight: String(rawLayout.minHeight || "").trim(),
    quoteMaxWidth: String(rawLayout.quoteMaxWidth || "").trim(),
    quotePadding: String(rawLayout.quotePadding || "").trim()
  };
}

function buildBlock(rawBlock = {}) {
  const type = String(rawBlock.type || "paragraph").trim().toLowerCase();
  const style = normalizeStyle(rawBlock.style);

  if (type === "visual-quote") {
    return {
      id: rawBlock.id || `block-${Math.random().toString(36).slice(2, 8)}`,
      type: "visual-quote",
      style,
      rows: normalizeVisualQuoteRows(rawBlock.rows),
      author: String(rawBlock.author || "").trim(),
      layout: normalizeVisualQuoteLayout(rawBlock.layout)
    };
  }

  if (type === "quote-strip") {
    const paragraphSource = Array.isArray(rawBlock.paragraphs)
      ? rawBlock.paragraphs
      : typeof rawBlock.text === "string"
        ? rawBlock.text.split("\n\n")
        : [];

    return {
      id: rawBlock.id || `block-${Math.random().toString(36).slice(2, 8)}`,
      type: "quote-strip",
      style,
      author: String(rawBlock.author || "").trim(),
      paragraphs: paragraphSource
        .map((paragraph) => String(paragraph || "").replace(/\n\s*\n+/g, "\n").trim())
        .filter(Boolean),
      leftImage: normalizeVisualQuoteImageOptions(rawBlock.leftImage),
      rightImage: normalizeVisualQuoteImageOptions(rawBlock.rightImage),
      layout: normalizeQuoteStripLayout(rawBlock.layout)
    };
  }

  if (type === "html") {
    return {
      id: rawBlock.id || `block-${Math.random().toString(36).slice(2, 8)}`,
      type: "html",
      style,
      html: String(rawBlock.html || "")
    };
  }

  if (type === "image") {
    return {
      id: rawBlock.id || `block-${Math.random().toString(36).slice(2, 8)}`,
      type: "image",
      style,
      options: normalizeImageOptions(rawBlock.options)
    };
  }

  if (type === "divider") {
    return {
      id: rawBlock.id || `block-${Math.random().toString(36).slice(2, 8)}`,
      type: "divider",
      style
    };
  }

  if (type === "paragraph") {
    return {
      id: rawBlock.id || `block-${Math.random().toString(36).slice(2, 8)}`,
      type: "paragraph",
      style,
      text: String(rawBlock.text || "").trim(),
      preserveBreaks: rawBlock.preserveBreaks === true || rawBlock.preserveBreaks === "true"
    };
  }

  const normalizedType = type === "hero_quote" ? "hero-quote" : type;
  const paragraphSource = Array.isArray(rawBlock.paragraphs)
    ? rawBlock.paragraphs
    : typeof rawBlock.text === "string"
      ? rawBlock.text.split("\n\n")
      : [];

  return {
    id: rawBlock.id || `block-${Math.random().toString(36).slice(2, 8)}`,
    type: normalizedType,
    style,
    flags: normalizeFlags(rawBlock.flags || [], normalizedType),
    author: String(rawBlock.author || "").trim(),
    paragraphs: paragraphSource
      .map((paragraph) => String(paragraph || "").trim())
      .filter(Boolean)
  };
}

function parseBlocks(rawBody = "") {
  const normalized = String(rawBody).replaceAll("\r\n", "\n").trim();

  if (!normalized) {
    return [];
  }

  const lines = normalized.split("\n");
  const blocks = [];
  let paragraphLines = [];
  let directive = null;

  function flushParagraph() {
    const text = paragraphLines.join(" ").trim();

    if (text) {
      blocks.push(buildBlock({
        type: "paragraph",
        text
      }));
    }

    paragraphLines = [];
  }

  lines.forEach((line) => {
    const trimmedLine = line.trim();

    if (directive) {
      if (trimmedLine === ":::") {
        blocks.push(buildDirectiveBlock(directive));
        directive = null;
      } else {
        directive.lines.push(line);
      }

      return;
    }

    if (trimmedLine.startsWith(":::")) {
      flushParagraph();

      const tokens = trimmedLine.slice(3).trim().split(/\s+/).filter(Boolean);
      const [type = "quote", ...flags] = tokens;

      directive = {
        type: type.toLowerCase(),
        flags: flags.map((flag) => flag.toLowerCase()),
        lines: []
      };
      return;
    }

    if (trimmedLine === "---") {
      flushParagraph();
      blocks.push(buildBlock({ type: "divider" }));
      return;
    }

    if (!trimmedLine) {
      flushParagraph();
      return;
    }

    paragraphLines.push(line.trim());
  });

  if (directive) {
    blocks.push(buildDirectiveBlock(directive));
  }

  flushParagraph();

  return blocks;
}

function buildDirectiveBlock(directive) {
  if (directive.type === "image") {
    return buildBlock({
      type: "image",
      options: parseDirectiveOptions(directive.lines)
    });
  }

  if (directive.type === "divider") {
    return buildBlock({ type: "divider" });
  }

  const normalizedType = directive.type === "hero-quote" || directive.type === "hero_quote"
    ? "hero-quote"
    : directive.type;
  const { author, lines } = extractQuoteAuthor(directive.lines);
  const paragraphs = linesToParagraphs(lines);

  return buildBlock({
    type: normalizedType,
    author,
    flags: directive.flags,
    paragraphs
  });
}

function compactAuthorBlocks(blocks = []) {
  return blocks.reduce((accumulator, block) => {
    const previous = accumulator[accumulator.length - 1];

    if (
      previous &&
      previous.type === "paragraph" &&
      block.type === "paragraph" &&
      JSON.stringify(previous.style || {}) === JSON.stringify(block.style || {})
    ) {
      const leftText = String(previous.text || "").trim();
      const rightText = String(block.text || "").trim();
      previous.text = [leftText, rightText].filter(Boolean).join("\n\n");
      previous.preserveBreaks = previous.preserveBreaks === true || block.preserveBreaks === true;
      return accumulator;
    }

    accumulator.push(block);
    return accumulator;
  }, []);
}

function normalizeAuthorDocument(authorId, rawDocument = {}) {
  const preset = AUTHOR_PRESETS[authorId] || AUTHOR_PRESETS.leo;
  const document = rawDocument && typeof rawDocument === "object" ? rawDocument : {};
  const meta = document.meta && typeof document.meta === "object" ? document.meta : {};
  const blocks = Array.isArray(document.blocks)
    ? compactAuthorBlocks(document.blocks.map((block) => buildBlock(block)))
    : [];

  return {
    meta: {
      label: String(meta.label || preset.label).trim() || preset.label,
      title: String(meta.title || preset.emptyTitle).trim() || preset.emptyTitle,
      helper: String(meta.helper || "").trim(),
      spoiler: meta.spoiler === true || meta.spoiler === "true",
      variant: String(meta.variant || "").trim(),
      placeholder: meta.placeholder === true || meta.placeholder === "true",
      placeholderBody: String(meta.placeholderBody || preset.emptyBody).trim() || preset.emptyBody
    },
    blocks
  };
}

function buildLoadedAuthor(authorConfig = {}, document = {}) {
  const preset = AUTHOR_PRESETS[authorConfig.id] || AUTHOR_PRESETS.leo;
  const normalizedDocument = normalizeAuthorDocument(authorConfig.id || "leo", document);
  const meta = normalizedDocument.meta;

  return {
    id: authorConfig.id,
    file: authorConfig.file,
    label: meta.label || preset.label,
    cardClass: preset.cardClass,
    meta,
    blocks: normalizedDocument.blocks,
    emptyTitle: meta.title || preset.emptyTitle,
    emptyBody: meta.placeholderBody || preset.emptyBody
  };
}

function normalizeNoteMeta(noteMeta = {}) {
  const rawMeta = noteMeta && typeof noteMeta === "object" ? noteMeta : {};
  const numero = Number(rawMeta.numero || 0);
  const cover = rawMeta.cover && typeof rawMeta.cover === "object" ? rawMeta.cover : {};
  const normalizedAuthors = Array.isArray(rawMeta.authors)
    ? rawMeta.authors
      .filter((author) => author && typeof author === "object")
      .map((author) => ({
        id: String(author.id || "leo").trim().toLowerCase(),
        file: String(author.file || "").trim(),
        visible: author.visible !== false
      }))
    : [];

  return {
    ...rawMeta,
    numero,
    collection: rawMeta.collection === "viejas" ? "viejas" : "nuevas",
    titulo: String(rawMeta.titulo || "Nota").trim() || "Nota",
    descripcion: String(rawMeta.descripcion || "").trim(),
    subtitulo: String(rawMeta.subtitulo || "Abrir nota actual").trim() || "Abrir nota actual",
    fecha: String(rawMeta.fecha || "").trim(),
    sortDate: String(rawMeta.sortDate || "").trim(),
    theme: String(rawMeta.theme || (rawMeta.collection === "viejas" ? "theme-archive-notes" : "theme-present-notes")),
    layout: String(rawMeta.layout || "").trim(),
    numeroEtiqueta: String(rawMeta.numeroEtiqueta || "").trim(),
    footerText: String(
      rawMeta.footerText || (rawMeta.collection === "viejas"
        ? "Hecho con amor, hoja por hoja."
        : "Hecho con amor, nota por nota.")
    ).trim(),
    customCss: String(rawMeta.customCss || ""),
    cover: {
      src: String(cover.src || "").trim(),
      alt: String(cover.alt || `Recuerdo de la hoja ${pad(numero || 0)}`).trim(),
      caption: String(cover.caption || "").trim(),
      enabled: cover.enabled !== false,
      height: String(cover.height || "").trim(),
      position: String(cover.position || "").trim()
    },
    music: rawMeta.music && typeof rawMeta.music === "object" ? rawMeta.music : null,
    authors: normalizedAuthors
  };
}

function formatInline(text = "") {
  let formatted = escapeHtml(text);

  formatted = formatted.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  formatted = formatted.replace(/~~(.+?)~~/g, "<del>$1</del>");
  formatted = formatted.replace(/\*(.+?)\*/g, "<em>$1</em>");

  return formatted;
}

function renderMultilineText(text = "", preserveBreaks = false) {
  const lines = String(text).split("\n");

  if (!preserveBreaks) {
    return formatInline(lines.join(" "));
  }

  return lines.map((line) => formatInline(line)).join("<br>");
}

function buildBlockClasses(block = {}, extraClasses = []) {
  const classes = ["note-block", ...extraClasses];
  const style = normalizeStyle(block.style);

  if (style.align !== "default") {
    classes.push(`note-block--align-${style.align}`);
  }

  if (style.fontSize !== "default") {
    classes.push(`note-block--size-${style.fontSize}`);
  }

  if (style.fontFamily !== "default") {
    classes.push(`note-block--family-${style.fontFamily}`);
  }

  return classes;
}

function renderQuoteBlock(block) {
  const flags = normalizeFlags(block.flags, block.type);
  const classes = buildBlockClasses(block, ["note-quote"]);
  const preserveBreaks = block.type === "song" || block.type === "dialogue" || flags.has("breaks");

  if (block.type === "song") {
    classes.push("note-block--song");
  }

  if (block.type === "dialogue") {
    classes.push("note-block--dialogue");
  }

  if (flags.has("center")) {
    classes.push("note-block--center");
  }

  if (flags.has("large")) {
    classes.push("note-block--large");
  }

  if (flags.has("caps")) {
    classes.push("note-block--caps");
  }

  if (block.type === "hero-quote" || flags.has("hero")) {
    classes.push("note-quote--hero");
  }

  const paragraphs = block.paragraphs.length
    ? block.paragraphs
    : [""];

  const contentHtml = paragraphs
    .map((paragraph) => {
      const innerHtml = renderMultilineText(paragraph, preserveBreaks);
      const wrappedHtml = classes.includes("note-quote--hero")
        ? `<em>${innerHtml}</em>`
        : innerHtml;

      return `<p>${wrappedHtml}</p>`;
    })
    .join("");

  const authorHtml = block.author
    ? `<p class="note-quote-author">— ${formatInline(block.author)}</p>`
    : "";

  return `
    <blockquote class="${classes.join(" ")}">
      ${contentHtml}
      ${authorHtml}
    </blockquote>
  `;
}

function renderVisualQuoteItem(item) {
  if (item.kind === "image") {
    const options = normalizeVisualQuoteImageOptions(item.options);
    const styleTokens = [];

    if (options.width) {
      styleTokens.push(`--visual-quote-image-width: ${escapeHtml(options.width)}`);
    }
    if (options.height) {
      styleTokens.push(`--visual-quote-image-height: ${escapeHtml(options.height)}`);
    }
    if (options.padding) {
      styleTokens.push(`--visual-quote-image-padding: ${escapeHtml(options.padding)}`);
    }
    if (options.background) {
      styleTokens.push(`--visual-quote-image-background: ${escapeHtml(options.background)}`);
    }
    if (options.position) {
      styleTokens.push(`--visual-quote-image-position: ${escapeHtml(options.position)}`);
    }
    if (options.radius) {
      styleTokens.push(`--visual-quote-image-radius: ${escapeHtml(options.radius)}`);
    }
    if (options.border) {
      styleTokens.push(`--visual-quote-image-border: ${escapeHtml(options.border)}`);
    }
    if (options.fit === "contain") {
      styleTokens.push("--visual-quote-image-fit: contain");
    }

    const styleAttr = styleTokens.length ? ` style="${styleTokens.join("; ")};"` : "";

    return `
      <span class="note-quote-visual__image"${styleAttr}>
        <img
          src="${escapeHtml(options.src || "")}"
          alt="${escapeHtml(options.alt || "Imagen dentro de la cita")}"
          onerror="this.style.display='none'; this.parentElement.classList.add('is-empty');"
        >
        <span class="note-quote-visual__image-fallback">PNG</span>
      </span>
    `;
  }

  return `<span class="note-quote-visual__text">${formatInline(item.text || "")}</span>`;
}

function renderVisualQuoteBlock(block) {
  const classes = buildBlockClasses(block, ["note-quote", "note-quote--visual"]);
  const layout = normalizeVisualQuoteLayout(block.layout);
  const style = normalizeStyle(block.style);
  const justifyMap = {
    left: "flex-start",
    right: "flex-end",
    center: "center",
    default: "center"
  };
  const styleTokens = [
    `--visual-quote-justify: ${justifyMap[style.align] || "center"}`
  ];

  if (layout.maxWidth) {
    styleTokens.push(`--visual-quote-max-width: ${escapeHtml(layout.maxWidth)}`);
  }
  if (layout.minHeight) {
    styleTokens.push(`--visual-quote-min-height: ${escapeHtml(layout.minHeight)}`);
  }
  if (layout.padding) {
    styleTokens.push(`--visual-quote-padding: ${escapeHtml(layout.padding)}`);
  }
  if (layout.margin) {
    styleTokens.push(`--visual-quote-margin: ${escapeHtml(layout.margin)}`);
  }
  if (layout.lineHeight) {
    styleTokens.push(`--visual-quote-line-height: ${escapeHtml(layout.lineHeight)}`);
  }
  if (layout.letterSpacing) {
    styleTokens.push(`--visual-quote-letter-spacing: ${escapeHtml(layout.letterSpacing)}`);
  }
  if (layout.textTransform) {
    styleTokens.push(`--visual-quote-text-transform: ${escapeHtml(layout.textTransform)}`);
  }
  if (layout.fontSize) {
    styleTokens.push(`--visual-quote-font-size: ${escapeHtml(layout.fontSize)}`);
  }
  if (layout.authorSize) {
    styleTokens.push(`--visual-quote-author-size: ${escapeHtml(layout.authorSize)}`);
  }
  if (layout.rowGap) {
    styleTokens.push(`--visual-quote-row-gap: ${escapeHtml(layout.rowGap)}`);
  }

  const styleAttr = styleTokens.length ? ` style="${styleTokens.join("; ")};"` : "";
  const rows = Array.isArray(block.rows) && block.rows.length
    ? block.rows
    : [{ id: `row-${block.id}`, items: [{ kind: "text", text: "" }] }];
  const rowsHtml = rows
    .map((row) => `
      <div class="note-quote-visual__row">
        ${row.items.map((item) => renderVisualQuoteItem(item)).join("")}
      </div>
    `)
    .join("");
  const authorHtml = block.author
    ? `<p class="note-quote-author">${layout.authorSize ? `<span style="font-size:${escapeHtml(layout.authorSize)};">— ${formatInline(block.author)}</span>` : `— ${formatInline(block.author)}`}</p>`
    : "";

  return `
    <blockquote class="${classes.join(" ")}"${styleAttr}>
      <div class="note-quote-visual__rows">
        ${rowsHtml}
      </div>
      ${authorHtml}
    </blockquote>
  `;
}

function renderImageBlock(block) {
  const options = normalizeImageOptions(block.options);
  const figureClasses = buildBlockClasses(block, ["note-photo-card", "note-inline-image"]);
  const figureStyles = [];
  const imageStyles = [];
  const imgClassNames = [];

  if (options.height) {
    figureStyles.push(`--photo-height: ${escapeHtml(options.height)}`);
  }

  if (options.position) {
    figureStyles.push(`--photo-position: ${escapeHtml(options.position)}`);
  }

  if (options.margin) {
    figureStyles.push(`margin: ${escapeHtml(options.margin)}`);
  }

  if (options.fit === "contain") {
    imageStyles.push("--inline-image-fit: contain");
    imgClassNames.push("note-inline-image__img--contain");
  }

  if (options.padding) {
    imageStyles.push(`--inline-image-padding: ${escapeHtml(options.padding)}`);
  }

  if (options.background) {
    imageStyles.push(`--inline-image-bg: ${escapeHtml(options.background)}`);
  }

  const figureStyleAttr = figureStyles.length
    ? ` style="${figureStyles.join("; ")};"`
    : "";

  const imageStyleAttr = imageStyles.length
    ? ` style="${imageStyles.join("; ")};"`
    : "";

  const captionHtml = options.caption
    ? `<figcaption>${formatInline(options.caption)}</figcaption>`
    : "";

  return `
    <figure class="${figureClasses.join(" ")}"${figureStyleAttr}>
      <img
        src="${escapeHtml(options.src || "")}"
        alt="${escapeHtml(options.alt || "Imagen de la nota")}"
        class="${imgClassNames.join(" ")}"
        onerror="this.style.display='none'; this.parentElement.classList.add('is-empty');"
        ${imageStyleAttr}
      >
      <div class="note-photo-placeholder">
        Agregá una imagen en <strong>${escapeHtml(options.src || "la ruta indicada")}</strong>
      </div>
      ${captionHtml}
    </figure>
  `;
}

function renderQuoteStripImage(options = {}, side = "left") {
  const normalizedOptions = normalizeVisualQuoteImageOptions(options);
  const styleTokens = [];

  if (normalizedOptions.padding) {
    styleTokens.push(`--quote-strip-image-padding: ${escapeHtml(normalizedOptions.padding)}`);
  }
  if (normalizedOptions.background) {
    styleTokens.push(`--quote-strip-image-background: ${escapeHtml(normalizedOptions.background)}`);
  }
  if (normalizedOptions.position) {
    styleTokens.push(`--quote-strip-image-position: ${escapeHtml(normalizedOptions.position)}`);
  }
  if (normalizedOptions.radius) {
    styleTokens.push(`--quote-strip-image-radius: ${escapeHtml(normalizedOptions.radius)}`);
  }
  if (normalizedOptions.border) {
    styleTokens.push(`--quote-strip-image-border: ${escapeHtml(normalizedOptions.border)}`);
  }
  if (normalizedOptions.fit === "contain") {
    styleTokens.push("--quote-strip-image-fit: contain");
  }

  const styleAttr = styleTokens.length ? ` style="${styleTokens.join("; ")};"` : "";
  const placeholderText = side === "right" ? "PNG derecho" : "PNG izquierdo";

  return `
    <figure class="note-quote-strip__side"${styleAttr}>
      <img
        src="${escapeHtml(normalizedOptions.src || "")}"
        alt="${escapeHtml(normalizedOptions.alt || placeholderText)}"
        onerror="this.style.display='none'; this.parentElement.classList.add('is-empty');"
      >
      <div class="note-photo-placeholder">
        ${escapeHtml(placeholderText)}
      </div>
    </figure>
  `;
}

function renderQuoteStripBlock(block) {
  const layout = normalizeQuoteStripLayout(block.layout);
  const paragraphs = Array.isArray(block.paragraphs) && block.paragraphs.length
    ? block.paragraphs.map((paragraph) => String(paragraph || "").replace(/\n\s*\n+/g, "\n").trim()).filter(Boolean)
    : [""];
  const styleTokens = [];

  if (layout.margin) {
    styleTokens.push(`--quote-strip-margin: ${escapeHtml(layout.margin)}`);
  }
  if (layout.gap) {
    styleTokens.push(`--quote-strip-gap: ${escapeHtml(layout.gap)}`);
  }
  if (layout.sideWidth) {
    styleTokens.push(`--quote-strip-side-width: ${escapeHtml(layout.sideWidth)}`);
  }
  if (layout.minHeight) {
    styleTokens.push(`--quote-strip-min-height: ${escapeHtml(layout.minHeight)}`);
  }
  if (layout.quoteMaxWidth) {
    styleTokens.push(`--quote-strip-quote-max-width: ${escapeHtml(layout.quoteMaxWidth)}`);
  }
  if (layout.quotePadding) {
    styleTokens.push(`--quote-strip-quote-padding: ${escapeHtml(layout.quotePadding)}`);
  }

  const styleAttr = styleTokens.length ? ` style="${styleTokens.join("; ")};"` : "";
  const quoteHtml = renderQuoteBlock({
    type: "quote",
    style: block.style,
    flags: ["center", "breaks"],
    paragraphs,
    author: block.author || ""
  });

  return `
    <section class="note-quote-strip"${styleAttr}>
      ${renderQuoteStripImage(block.leftImage, "left")}
      <div class="note-quote-strip__center">
        ${quoteHtml}
      </div>
      ${renderQuoteStripImage(block.rightImage, "right")}
    </section>
  `;
}

function renderParagraphBlock(block) {
  const classes = buildBlockClasses(block, ["note-block--paragraph"]);
  const paragraphs = String(block.text || "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (!paragraphs.length) {
    return `<p class="${classes.join(" ")}"></p>`;
  }

  return paragraphs
    .map((paragraph) => `<p class="${classes.join(" ")}">${renderMultilineText(paragraph, block.preserveBreaks === true)}</p>`)
    .join("");
}

function renderBlock(block) {
  if (block.type === "paragraph") {
    return renderParagraphBlock(block);
  }

  if (block.type === "visual-quote") {
    return renderVisualQuoteBlock(block);
  }

  if (block.type === "quote-strip") {
    return renderQuoteStripBlock(block);
  }

  if (block.type === "divider") {
    return `<hr class="${buildBlockClasses(block).join(" ")}">`;
  }

  if (block.type === "image") {
    return renderImageBlock(block);
  }

  if (block.type === "html") {
    return block.html;
  }

  return renderQuoteBlock(block);
}

function getCollectionData(collectionId = "nuevas") {
  if (collectionId === "viejas") {
    return {
      tab: "viejas",
      backLabel: "Volver a notas viejas",
      pageLabel: "Hoja"
    };
  }

  return {
    tab: "nuevas",
    backLabel: "Volver a notas nuevas",
    pageLabel: "Hoja nueva"
  };
}

async function loadAuthor(authorConfig = {}) {
  if (authorConfig.document) {
    return buildLoadedAuthor(authorConfig, authorConfig.document);
  }

  const preset = AUTHOR_PRESETS[authorConfig.id] || AUTHOR_PRESETS.leo;
  const fileName = authorConfig.file || `${authorConfig.id}.note`;

  try {
    const response = await fetch(`./${fileName}`, { cache: "no-store" });

    if (!response.ok) {
      return buildLoadedAuthor(authorConfig, {
        meta: {
          label: preset.label,
          title: preset.emptyTitle,
          placeholderBody: preset.emptyBody,
          placeholder: true
        },
        blocks: []
      });
    }

    if (fileName.endsWith(".json")) {
      return buildLoadedAuthor(authorConfig, await response.json());
    }

    const rawContent = await response.text();
    const { meta, body } = parseFrontmatter(rawContent);
    return buildLoadedAuthor(authorConfig, {
      meta,
      blocks: parseBlocks(body)
    });
  } catch (_error) {
    return buildLoadedAuthor(authorConfig, {
      meta: {
        label: preset.label,
        title: preset.emptyTitle,
        placeholderBody: preset.emptyBody,
        placeholder: true
      },
      blocks: []
    });
  }
}

function buildPlaceholderHtml(author) {
  return `
    <p class="note-placeholder">
      ${formatInline(author.emptyBody)}
    </p>
  `;
}

function renderMusicControls(musicConfig = {}) {
  const buttonLabel = musicConfig.buttonLabel || DEFAULT_MUSIC_TEXT.buttonLabel;
  const loadingMessage = musicConfig.loadingMessage || DEFAULT_MUSIC_TEXT.loadingMessage;

  return `
    <button class="music-launcher" id="music-launcher" hidden type="button">
      ${escapeHtml(buttonLabel)}
    </button>
    <p class="music-status" id="music-status">${escapeHtml(loadingMessage)}</p>
  `;
}

function renderAuthorCard(author, noteMeta, cardIndex) {
  const spoiler = author.meta.spoiler === true || author.meta.spoiler === "true";
  const variant = String(author.meta.variant || "").toLowerCase();
  const cardClasses = ["note-card", author.cardClass];

  if (variant === "solo") {
    cardClasses.push("note-card--solo");
  }

  if (spoiler) {
    cardClasses.push("note-card--spoiler");
  }

  const title = author.meta.title || author.emptyTitle;
  const helper = author.meta.helper || "";
  const hasContent = author.blocks.length > 0;
  const noteContentHtml = hasContent
    ? author.blocks.map((block) => renderBlock(block)).join("")
    : buildPlaceholderHtml(author);
  const spoilerId = `spoiler-${author.id}-${pad(noteMeta.numero || cardIndex + 1)}`;
  const helperHtml = helper
    ? `<p class="note-helper">${formatInline(helper)}</p>`
    : "";
  const spoilerHtml = spoiler
    ? `
        <label for="${escapeHtml(spoilerId)}" class="spoiler-overlay">
          <span class="spoiler-button">Ver nota de ${escapeHtml(author.label)}</span>
        </label>
      `
    : "";

  const fallbackMusicAuthor = Array.isArray(noteMeta.authors) && noteMeta.authors.length
    ? noteMeta.authors[noteMeta.authors.length - 1].id
    : author.id;
  const musicTarget = noteMeta.music && noteMeta.music.attachToAuthor
    ? noteMeta.music.attachToAuthor
    : fallbackMusicAuthor;
  const musicHtml = noteMeta.music && musicTarget === author.id
    ? renderMusicControls(noteMeta.music)
    : "";

  return `
    <article class="${cardClasses.join(" ")}">
      ${spoiler ? `<input type="checkbox" id="${escapeHtml(spoilerId)}" class="spoiler-toggle">` : ""}
      <span class="note-label">${escapeHtml(author.label)}</span>
      <h2>${escapeHtml(title)}</h2>
      ${helperHtml}
      <div class="note-content">
        ${noteContentHtml}
      </div>
      ${musicHtml}
      ${spoilerHtml}
    </article>
  `;
}

function renderCover(cover = {}) {
  if (cover === false || cover.enabled === false || !cover.src) {
    return "";
  }

  const figureStyles = [];

  if (cover.height) {
    figureStyles.push(`--photo-height: ${escapeHtml(cover.height)}`);
  }

  if (cover.position) {
    figureStyles.push(`--photo-position: ${escapeHtml(cover.position)}`);
  }

  const figureStyleAttr = figureStyles.length
    ? ` style="${figureStyles.join("; ")};"`
    : "";

  const captionHtml = cover.caption
    ? `<figcaption>${formatInline(cover.caption)}</figcaption>`
    : "";

  return `
    <section class="page-media">
      <figure class="note-photo-card note-photo-card--cover"${figureStyleAttr}>
        <img
          src="${escapeHtml(cover.src)}"
          alt="${escapeHtml(cover.alt || `Recuerdo de la hoja ${pad(cover.numero || 0)}`)}"
          onerror="this.style.display='none'; this.parentElement.classList.add('is-empty');"
        >
        <div class="note-photo-placeholder">
          Agregá una foto en <strong>${escapeHtml(cover.src)}</strong>
        </div>
        ${captionHtml}
      </figure>
    </section>
  `;
}

function syncCustomCss(customCss = "") {
  const styleId = "note-custom-style";
  let styleNode = document.getElementById(styleId);

  if (!customCss.trim()) {
    if (styleNode) {
      styleNode.remove();
    }
    return;
  }

  if (!styleNode) {
    styleNode = document.createElement("style");
    styleNode.id = styleId;
    document.head.appendChild(styleNode);
  }

  styleNode.textContent = customCss;
}

function renderPageState(root, title, message) {
  root.innerHTML = `
    <section class="page-state">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(message)}</p>
    </section>
  `;
}

function renderNotePage(root, rawNoteMeta, rawAuthors = []) {
  const noteMeta = normalizeNoteMeta(rawNoteMeta);
  const collection = getCollectionData(noteMeta.collection);
  const visibleAuthors = rawAuthors.filter(Boolean);
  const isSingle = noteMeta.layout === "single" || visibleAuthors.length <= 1;
  const pageLabel = noteMeta.numeroEtiqueta || `${collection.pageLabel} ${pad(noteMeta.numero || 0)}`;

  document.body.className = noteMeta.theme || (noteMeta.collection === "viejas"
    ? "theme-archive-notes"
    : "theme-present-notes");
  syncCustomCss(noteMeta.customCss || "");

  document.title = `${pageLabel} -- ${noteMeta.titulo}`;

  root.innerHTML = `
    <div class="page-topbar">
      <a class="back-link" href="../../index.html?tab=${escapeHtml(collection.tab)}">&larr; ${escapeHtml(collection.backLabel)}</a>
    </div>

    <header class="page-header">
      <p class="page-number">${escapeHtml(pageLabel)}</p>
      <h1>${escapeHtml(noteMeta.titulo || "Nota")}</h1>
      <p class="page-description">${escapeHtml(noteMeta.descripcion || "")}</p>
    </header>

    ${renderCover({ ...(noteMeta.cover || {}), numero: noteMeta.numero })}

    <section class="notes-layout${isSingle ? " notes-layout--single" : ""}">
      ${visibleAuthors.map((author, index) => renderAuthorCard(author, noteMeta, index)).join("")}
    </section>

    <footer class="page-footer">
      ${escapeHtml(noteMeta.footerText || "Hecho con amor, nota por nota.")}
    </footer>
  `;

  if (noteMeta.music && noteMeta.music.youtubeId) {
    initMusicPlayer(noteMeta.music);
  }
}

function initMusicPlayer(musicConfig = {}) {
  const launcher = document.getElementById("music-launcher");
  const status = document.getElementById("music-status");

  if (!launcher || !status) {
    return;
  }

  const messages = {
    playing: musicConfig.playingMessage || DEFAULT_MUSIC_TEXT.playingMessage,
    blocked: musicConfig.blockedMessage || DEFAULT_MUSIC_TEXT.blockedMessage
  };

  const host = document.createElement("div");
  host.className = "youtube-audio-player";
  host.id = "youtube-audio-player";
  host.setAttribute("aria-hidden", "true");
  document.body.appendChild(host);

  let musicPlayer = null;
  let hasTriedAutoplay = false;

  function updateMusicStatus(message) {
    status.textContent = message;
  }

  function showLauncher(message) {
    launcher.hidden = false;
    updateMusicStatus(message);
  }

  function hideLauncher(message) {
    launcher.hidden = true;
    updateMusicStatus(message);
  }

  function startMusicPlayback() {
    if (!musicPlayer || typeof musicPlayer.playVideo !== "function") {
      return;
    }

    musicPlayer.setVolume(Number(musicConfig.volume || 40));
    musicPlayer.unMute();
    musicPlayer.playVideo();
    hideLauncher(messages.playing);
  }

  launcher.addEventListener("click", () => {
    startMusicPlayback();
  });

  window.onYouTubeIframeAPIReady = function () {
    musicPlayer = new window.YT.Player(host, {
      videoId: musicConfig.youtubeId,
      playerVars: {
        autoplay: musicConfig.autoplay === false ? 0 : 1,
        controls: 0,
        fs: 0,
        loop: 1,
        modestbranding: 1,
        playsinline: 1,
        rel: 0,
        playlist: musicConfig.youtubeId
      },
      events: {
        onReady() {
          if (hasTriedAutoplay) {
            return;
          }

          hasTriedAutoplay = true;
          startMusicPlayback();
        },
        onStateChange(event) {
          if (!window.YT || !window.YT.PlayerState) {
            return;
          }

          if (event.data === window.YT.PlayerState.PLAYING) {
            hideLauncher(messages.playing);
          }
        },
        onAutoplayBlocked() {
          showLauncher(messages.blocked);
        }
      }
    });
  };

  const script = document.createElement("script");
  script.src = "https://www.youtube.com/iframe_api";
  document.body.appendChild(script);
}

async function initNotePage() {
  const root = document.getElementById("note-page");

  if (!root) {
    return;
  }

  renderPageState(root, "Cargando nota...", "Estoy armando esta hoja.");

  try {
    const response = await fetch("./note.json", { cache: "no-store" });

    if (!response.ok) {
      throw new Error("No pude cargar la metadata de la nota.");
    }

    const noteMeta = normalizeNoteMeta(await response.json());
    const authorConfigs = Array.isArray(noteMeta.authors) && noteMeta.authors.length
      ? noteMeta.authors.filter((author) => author.visible !== false)
      : [
          { id: "mica", file: "mica.note.json" },
          { id: "leo", file: "leo.note.json" }
        ];
    const authors = await Promise.all(authorConfigs.map((author) => loadAuthor(author)));

    renderNotePage(root, noteMeta, authors);
  } catch (error) {
    renderPageState(
      root,
      "No pude abrir esta nota",
      error instanceof Error ? error.message : "Hubo un problema al cargar la hoja."
    );
  }
}

window.NotePageRenderer = {
  AUTHOR_PRESETS,
  buildBlock,
  buildLoadedAuthor,
  loadAuthor,
  normalizeAuthorDocument,
  normalizeNoteMeta,
  parseBlocks,
  parseFrontmatter,
  renderBlock,
  renderNotePage,
  renderPageState
};

if (!window.__NOTE_PAGE_DISABLE_AUTO_INIT__) {
  void initNotePage();
}
