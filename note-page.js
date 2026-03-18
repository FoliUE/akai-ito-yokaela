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

  const lastLine = contentLines[contentLines.length - 1]?.trim() || "";

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
      blocks.push({
        type: "paragraph",
        text
      });
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
      blocks.push({ type: "divider" });
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
  const flags = new Set(directive.flags || []);

  if (directive.type === "image") {
    return {
      type: "image",
      options: parseDirectiveOptions(directive.lines)
    };
  }

  if (directive.type === "divider") {
    return { type: "divider" };
  }

  if (directive.type === "html") {
    return {
      type: "html",
      html: directive.lines.join("\n").trim()
    };
  }

  const { author, lines } = extractQuoteAuthor(directive.lines);
  const paragraphs = linesToParagraphs(lines);
  const type = directive.type === "hero-quote" || directive.type === "hero_quote"
    ? "quote"
    : directive.type;

  if (directive.type === "hero-quote" || directive.type === "hero_quote") {
    flags.add("hero");
    flags.add("center");
  }

  return {
    type,
    author,
    flags,
    paragraphs
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

function renderQuoteBlock(block) {
  const classes = ["note-quote"];
  const preserveBreaks = block.type === "song" || block.type === "dialogue" || block.flags.has("breaks");

  if (block.type === "song") {
    classes.push("note-block--song");
  }

  if (block.type === "dialogue") {
    classes.push("note-block--dialogue");
  }

  if (block.flags.has("center")) {
    classes.push("note-block--center");
  }

  if (block.flags.has("large")) {
    classes.push("note-block--large");
  }

  if (block.flags.has("caps")) {
    classes.push("note-block--caps");
  }

  if (block.flags.has("hero")) {
    classes.push("note-quote--hero");
  }

  const paragraphs = block.paragraphs.length
    ? block.paragraphs
    : [""];

  const contentHtml = paragraphs
    .map((paragraph) => {
      const innerHtml = renderMultilineText(paragraph, preserveBreaks);
      const wrappedHtml = block.flags.has("hero")
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

function renderImageBlock(block) {
  const options = block.options || {};
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
  }

  if (options.imgPadding || options.padding) {
    imageStyles.push(`--inline-image-padding: ${escapeHtml(options.imgPadding || options.padding)}`);
  }

  if (options.imgBackground || options.background) {
    imageStyles.push(`--inline-image-bg: ${escapeHtml(options.imgBackground || options.background)}`);
  }

  if (options.fit === "contain") {
    imgClassNames.push("note-inline-image__img--contain");
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
    <figure class="note-photo-card note-inline-image"${figureStyleAttr}>
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

function renderBlock(block) {
  if (block.type === "paragraph") {
    return `<p>${renderMultilineText(block.text)}</p>`;
  }

  if (block.type === "divider") {
    return "<hr>";
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
  const preset = AUTHOR_PRESETS[authorConfig.id] || AUTHOR_PRESETS.leo;
  const response = await fetch(`./${authorConfig.file}`, { cache: "no-store" });
  const rawContent = response.ok ? await response.text() : "";
  const { meta, body } = parseFrontmatter(rawContent);

  return {
    id: authorConfig.id,
    file: authorConfig.file,
    label: meta.label || preset.label,
    cardClass: preset.cardClass,
    meta,
    blocks: parseBlocks(body),
    emptyTitle: meta.title || preset.emptyTitle,
    emptyBody: meta.placeholderBody || preset.emptyBody
  };
}

function buildPlaceholderHtml(author) {
  return `
    <p class="note-placeholder">
      ${formatInline(author.emptyBody)}
    </p>
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
  const hasContent = author.blocks.length > 0 && author.meta.placeholder !== true;
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
  const musicTarget = noteMeta.music?.attachToAuthor || fallbackMusicAuthor;
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

function renderCover(cover = {}) {
  if (cover === false || cover.enabled === false || !cover.src) {
    return "";
  }

  const figureStyles = [];

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
      <figure class="note-photo-card"${figureStyleAttr}>
        <img
          src="${escapeHtml(cover.src)}"
          alt="${escapeHtml(cover.alt || `Recuerdo de la hoja ${pad(cover.numero || "")}`)}"
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

function renderPageState(root, title, message) {
  root.innerHTML = `
    <section class="page-state">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(message)}</p>
    </section>
  `;
}

function renderNotePage(root, noteMeta, authors) {
  const collection = getCollectionData(noteMeta.collection);
  const visibleAuthors = authors.filter((author) => author);
  const isSingle = noteMeta.layout === "single" || visibleAuthors.length <= 1;
  const pageLabel = noteMeta.numeroEtiqueta || `${collection.pageLabel} ${pad(noteMeta.numero || 0)}`;

  document.body.className = noteMeta.theme || (noteMeta.collection === "viejas"
    ? "theme-archive-notes"
    : "theme-present-notes");

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
      Hecho con amor, nota por nota.
    </footer>
  `;

  if (noteMeta.music?.youtubeId) {
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

    const noteMeta = await response.json();
    const authorConfigs = Array.isArray(noteMeta.authors) && noteMeta.authors.length
      ? noteMeta.authors.filter((author) => author.visible !== false)
      : [
          { id: "mica", file: "mica.note" },
          { id: "leo", file: "leo.note" }
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

void initNotePage();
