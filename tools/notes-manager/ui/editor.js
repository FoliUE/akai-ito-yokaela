const state = {
  bootstrap: null,
  collections: [],
  notesByCollection: {
    nuevas: [],
    viejas: []
  },
  activeCollection: "nuevas",
  activeSlugByCollection: {
    nuevas: "",
    viejas: ""
  },
  activeSlug: "",
  activeNote: null,
  activeAuthorId: "mica",
  previewScale: 1.1,
  search: "",
  dirty: false
};

const dom = {
  collectionTabs: document.getElementById("collectionTabs"),
  notesList: document.getElementById("notesList"),
  noteSearchInput: document.getElementById("noteSearchInput"),
  reloadNotesButton: document.getElementById("reloadNotesButton"),
  createNoteButton: document.getElementById("createNoteButton"),
  saveNoteButton: document.getElementById("saveNoteButton"),
  uploadCoverButton: document.getElementById("uploadCoverButton"),
  workspaceTitle: document.getElementById("workspaceTitle"),
  workspaceStatus: document.getElementById("workspaceStatus"),
  previewChip: document.getElementById("previewChip"),
  previewScaleSelect: document.getElementById("previewScaleSelect"),
  noteMetaForm: document.getElementById("noteMetaForm"),
  themeSelect: document.getElementById("themeSelect"),
  authorToggles: document.getElementById("authorToggles"),
  authorTabs: document.getElementById("authorTabs"),
  authorPanel: document.getElementById("authorPanel"),
  previewFrame: document.getElementById("previewFrame"),
  createDialog: document.getElementById("createDialog"),
  createNoteForm: document.getElementById("createNoteForm"),
  createThemeSelect: document.getElementById("createThemeSelect"),
  confirmCreateNoteButton: document.getElementById("confirmCreateNoteButton"),
  cancelCreateNoteButton: document.getElementById("cancelCreateNoteButton")
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Falló la operación (${response.status}).`);
  }

  return data;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function getThemeOptions() {
  return state.bootstrap && state.bootstrap.themes ? state.bootstrap.themes : [];
}

function fallbackSortDate() {
  return state.activeCollection === "viejas" ? "" : todayIso();
}

function getCollections() {
  return Array.isArray(state.collections) ? state.collections : [];
}

function getCollectionMeta(collectionId = state.activeCollection) {
  return getCollections().find((collection) => collection.id === collectionId) || {
    id: collectionId,
    label: collectionId === "viejas" ? "Notas viejas" : "Notas nuevas",
    canCreate: collectionId !== "viejas",
    notes: []
  };
}

function getNotesForCollection(collectionId = state.activeCollection) {
  return Array.isArray(state.notesByCollection[collectionId]) ? state.notesByCollection[collectionId] : [];
}

function syncEditorTheme() {
  document.body.dataset.collection = state.activeCollection === "viejas" ? "viejas" : "nuevas";
}

function confirmDiscardChanges(actionLabel = "cambiar de hoja") {
  if (!state.dirty) {
    return true;
  }

  return window.confirm(`Tenés cambios sin guardar. ¿Querés continuar y ${actionLabel}?`);
}

function defaultAuthorDocument(authorId) {
  const preset = state.bootstrap && state.bootstrap.authorPresets
    ? state.bootstrap.authorPresets[authorId]
    : null;

  return {
    meta: {
      label: preset && preset.label ? preset.label : authorId,
      title: preset && preset.default_title ? preset.default_title : "",
      helper: preset && preset.default_helper ? preset.default_helper : "",
      spoiler: false,
      variant: "",
      placeholder: false,
      placeholderBody: preset && preset.default_placeholder ? preset.default_placeholder : ""
    },
    blocks: []
  };
}

function defaultVisualQuoteImageOptions() {
  return {
    src: "",
    alt: "",
    width: "120px",
    height: "120px",
    fit: "cover",
    padding: "",
    background: "rgba(255, 255, 255, 0.06)",
    position: "",
    radius: "12px",
    border: "1px solid rgba(255, 255, 255, 0.08)"
  };
}

function defaultVisualQuoteLayout() {
  return {
    maxWidth: "420px",
    minHeight: "340px",
    padding: "2rem 1.6rem",
    margin: "2rem auto 0",
    lineHeight: "1.55",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    fontSize: "3rem",
    authorSize: "1.1rem",
    rowGap: "0.65rem"
  };
}

function defaultQuoteStripLayout() {
  return {
    margin: "1.5rem 0",
    gap: "1rem",
    sideWidth: "72px",
    minHeight: "320px",
    quoteMaxWidth: "320px",
    quotePadding: "1.25rem 1rem"
  };
}

function defaultQuoteStripImageOptions(sideLabel = "") {
  return {
    src: "",
    alt: sideLabel ? `PNG ${sideLabel}` : "",
    width: "",
    height: "",
    fit: "cover",
    padding: "",
    background: "rgba(255, 255, 255, 0.03)",
    position: "50% 50%",
    radius: "18px",
    border: "1px solid rgba(255, 255, 255, 0.04)"
  };
}

function defaultVisualQuoteRow(items = []) {
  return {
    id: `row-${Math.random().toString(36).slice(2, 8)}`,
    items
  };
}

function defaultVisualQuoteTextItem(text = "") {
  return {
    id: `item-${Math.random().toString(36).slice(2, 8)}`,
    kind: "text",
    text
  };
}

function defaultVisualQuoteImageItem() {
  return {
    id: `item-${Math.random().toString(36).slice(2, 8)}`,
    kind: "image",
    options: defaultVisualQuoteImageOptions()
  };
}

function ensureVisualQuoteBlockState(block) {
  block.layout = {
    ...defaultVisualQuoteLayout(),
    ...(block.layout && typeof block.layout === "object" ? block.layout : {})
  };

  const rows = Array.isArray(block.rows) ? block.rows : [];
  block.rows = rows
    .map((row) => {
      const rawRow = row && typeof row === "object" ? row : {};
      const items = Array.isArray(rawRow.items) ? rawRow.items : [];

      return {
        id: rawRow.id || `row-${Math.random().toString(36).slice(2, 8)}`,
        items: items
          .map((item) => {
            const rawItem = item && typeof item === "object" ? item : {};
            if (String(rawItem.kind || rawItem.type || "text").trim().toLowerCase() === "image") {
              return {
                id: rawItem.id || `item-${Math.random().toString(36).slice(2, 8)}`,
                kind: "image",
                options: {
                  ...defaultVisualQuoteImageOptions(),
                  ...(rawItem.options && typeof rawItem.options === "object" ? rawItem.options : rawItem)
                }
              };
            }

            return {
              id: rawItem.id || `item-${Math.random().toString(36).slice(2, 8)}`,
              kind: "text",
              text: String(rawItem.text || "").trim()
            };
          })
          .filter((item) => item.kind === "image" || item.text)
      };
    })
    .filter((row) => row.items.length);

  if (!block.rows.length) {
    block.rows = [
      defaultVisualQuoteRow([
        defaultVisualQuoteTextItem("WHERE DO"),
        defaultVisualQuoteTextItem("BROKEN"),
        defaultVisualQuoteTextItem("HEARTS GO??")
      ])
    ];
  }
}

function ensureQuoteStripBlockState(block) {
  block.layout = {
    ...defaultQuoteStripLayout(),
    ...(block.layout && typeof block.layout === "object" ? block.layout : {})
  };
  block.leftImage = {
    ...defaultQuoteStripImageOptions("izquierdo"),
    ...(block.leftImage && typeof block.leftImage === "object" ? block.leftImage : {})
  };
  block.rightImage = {
    ...defaultQuoteStripImageOptions("derecho"),
    ...(block.rightImage && typeof block.rightImage === "object" ? block.rightImage : {})
  };

  if (!Array.isArray(block.paragraphs)) {
    block.paragraphs = [];
  }
}

function mergeAdjacentParagraphBlocks(blocks = []) {
  const mergedBlocks = [];
  let merges = 0;

  blocks.forEach((block) => {
    const previous = mergedBlocks[mergedBlocks.length - 1];

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
      merges += 1;
      return;
    }

    mergedBlocks.push(block);
  });

  return {
    blocks: mergedBlocks,
    merges
  };
}

function authorOrder(authorId) {
  return authorId === "mica" ? 0 : authorId === "leo" ? 1 : 99;
}

function pickActiveAuthorId(authors, preferredAuthorId = state.activeAuthorId) {
  const enabledAuthors = Array.isArray(authors)
    ? authors.filter((author) => author && author.enabled !== false)
    : [];

  if (preferredAuthorId && enabledAuthors.some((author) => author.id === preferredAuthorId)) {
    return preferredAuthorId;
  }

  return enabledAuthors[0] ? enabledAuthors[0].id : preferredAuthorId || "mica";
}

function getPreviewScale() {
  const numericScale = Number(state.previewScale);
  return Number.isFinite(numericScale) && numericScale >= 1 && numericScale <= 1.2
    ? numericScale
    : 1.1;
}

function ensureAuthor(authorId) {
  if (!state.activeNote) {
    return null;
  }

  let author = state.activeNote.authors.find((item) => item.id === authorId);

  if (!author) {
    author = {
      id: authorId,
      enabled: false,
      file: `${authorId}.note.json`,
      document: defaultAuthorDocument(authorId)
    };
    state.activeNote.authors.push(author);
    state.activeNote.authors.sort((left, right) => authorOrder(left.id) - authorOrder(right.id));
  }

  return author;
}

function getEnabledAuthors() {
  if (!state.activeNote) {
    return [];
  }

  return state.activeNote.authors.filter((author) => author.enabled !== false);
}

function getActiveAuthor() {
  if (!state.activeNote) {
    return null;
  }

  const enabledAuthors = getEnabledAuthors();

  if (!enabledAuthors.some((author) => author.id === state.activeAuthorId)) {
    state.activeAuthorId = enabledAuthors[0] ? enabledAuthors[0].id : "mica";
  }

  return enabledAuthors.find((author) => author.id === state.activeAuthorId) || null;
}

function setDirty(value) {
  state.dirty = value;
  dom.saveNoteButton.disabled = !state.activeNote;
  dom.previewChip.textContent = value
    ? "Tenés cambios sin guardar"
    : "Todo sincronizado";
}

function setStatus(message, isError = false) {
  dom.workspaceStatus.textContent = message;
  dom.workspaceStatus.classList.toggle("status-error", Boolean(isError));
}

function syncCoverMetaFields() {
  if (!state.activeNote) {
    return;
  }

  const cover = state.activeNote.note.cover || {};
  dom.noteMetaForm.coverAlt.value = cover.alt || "";
  dom.noteMetaForm.coverEnabled.checked = cover.enabled !== false;
  dom.noteMetaForm.coverHeight.value = cover.height || "";
  dom.noteMetaForm.coverPosition.value = cover.position || "";
  dom.noteMetaForm.coverCaption.value = cover.caption || "";
}

function applyCoverPreviewAdjustments({ position, height } = {}) {
  if (!state.activeNote) {
    return;
  }

  const note = state.activeNote.note;
  const currentCover = note.cover || {};
  let hasChanges = false;
  note.cover = {
    ...currentCover
  };

  if (typeof position === "string" && position !== (currentCover.position || "")) {
    note.cover.position = position;
    hasChanges = true;
  }

  if (typeof height === "string" && height !== (currentCover.height || "")) {
    note.cover.height = height;
    hasChanges = true;
  }

  if (document.activeElement !== dom.noteMetaForm.coverPosition) {
    dom.noteMetaForm.coverPosition.value = note.cover.position || "";
  }

  if (document.activeElement !== dom.noteMetaForm.coverHeight) {
    dom.noteMetaForm.coverHeight.value = note.cover.height || "";
  }

  if (hasChanges) {
    setDirty(true);
  }
}

function fillThemeSelect(selectElement, selectedValue) {
  const options = getThemeOptions()
    .map((theme) => `<option value="${theme.value}">${theme.label}</option>`)
    .join("");
  selectElement.innerHTML = options;
  if (selectedValue) {
    selectElement.value = selectedValue;
  }
  enhanceSelects(selectElement.parentElement || document);
}

function closeAllCustomSelects(exceptShell = null) {
  document.querySelectorAll(".select-shell.is-open").forEach((shell) => {
    if (shell !== exceptShell) {
      shell.classList.remove("is-open");
      const trigger = shell.querySelector(".select-shell__trigger");
      const menu = shell.querySelector(".select-shell__menu");
      if (trigger) {
        trigger.setAttribute("aria-expanded", "false");
      }
      if (menu) {
        menu.hidden = true;
      }
    }
  });
}

function syncCustomSelect(selectElement) {
  const shell = selectElement.closest(".select-shell");
  if (!shell) {
    return;
  }

  const trigger = shell.querySelector(".select-shell__trigger");
  const valueElement = shell.querySelector(".select-shell__value");
  const menu = shell.querySelector(".select-shell__menu");
  const selectedOption = selectElement.options[selectElement.selectedIndex] || selectElement.options[0];

  valueElement.textContent = selectedOption ? selectedOption.textContent : "Seleccionar";
  shell.classList.toggle("is-disabled", Boolean(selectElement.disabled));
  trigger.disabled = Boolean(selectElement.disabled);

  menu.innerHTML = Array.from(selectElement.options)
    .map((option) => `
      <button
        class="select-shell__option${option.selected ? " is-selected" : ""}"
        type="button"
        data-select-value="${escapeHtml(option.value)}"
        ${option.disabled ? "disabled" : ""}
      >
        ${escapeHtml(option.textContent || option.value)}
      </button>
    `)
    .join("");

  menu.querySelectorAll("[data-select-value]").forEach((button) => {
    button.addEventListener("click", () => {
      selectElement.value = button.dataset.selectValue;
      selectElement.dispatchEvent(new Event("input", { bubbles: true }));
      selectElement.dispatchEvent(new Event("change", { bubbles: true }));
      closeAllCustomSelects();
      trigger.focus();
    });
  });
}

function enhanceSelects(root = document) {
  const scope = root instanceof Element || root instanceof Document ? root : document;
  scope.querySelectorAll("select").forEach((selectElement) => {
    if (selectElement.dataset.customSelectReady === "true") {
      syncCustomSelect(selectElement);
      return;
    }

    selectElement.dataset.customSelectReady = "true";
    selectElement.classList.add("native-select");
    selectElement.tabIndex = -1;
    selectElement.setAttribute("aria-hidden", "true");

    const shell = document.createElement("div");
    shell.className = "select-shell";
    shell.innerHTML = `
      <button class="select-shell__trigger" type="button" aria-expanded="false">
        <span class="select-shell__value"></span>
        <span class="select-shell__icon" aria-hidden="true">▾</span>
      </button>
      <div class="select-shell__menu" hidden></div>
    `;

    selectElement.parentNode.insertBefore(shell, selectElement);
    shell.appendChild(selectElement);

    const trigger = shell.querySelector(".select-shell__trigger");
    const menu = shell.querySelector(".select-shell__menu");

    trigger.addEventListener("click", () => {
      if (selectElement.disabled) {
        return;
      }

      const willOpen = !shell.classList.contains("is-open");
      closeAllCustomSelects(shell);
      shell.classList.toggle("is-open", willOpen);
      trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
      menu.hidden = !willOpen;

      if (willOpen) {
        requestAnimationFrame(() => {
          const selectedButton = menu.querySelector(".select-shell__option.is-selected");
          const firstButton = menu.querySelector(".select-shell__option");
          const targetButton = selectedButton || firstButton;
          if (targetButton) {
            targetButton.focus();
          }
        });
      }
    });

    trigger.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        trigger.click();
      }

      if (event.key === "Escape") {
        closeAllCustomSelects();
      }
    });

    menu.addEventListener("keydown", (event) => {
      const options = Array.from(menu.querySelectorAll(".select-shell__option"));
      const currentIndex = options.indexOf(document.activeElement);

      if (event.key === "Escape") {
        event.preventDefault();
        closeAllCustomSelects();
        trigger.focus();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const next = options[Math.min(currentIndex + 1, options.length - 1)] || options[0];
        if (next) {
          next.focus();
        }
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        const previous = options[Math.max(currentIndex - 1, 0)] || options[0];
        if (previous) {
          previous.focus();
        }
      }
    });

    selectElement.addEventListener("change", () => syncCustomSelect(selectElement));
    selectElement.addEventListener("input", () => syncCustomSelect(selectElement));
    syncCustomSelect(selectElement);
  });
}

function bindGlobalEvents() {
  window.addEventListener("message", (event) => {
    if (event.source !== dom.previewFrame.contentWindow) {
      return;
    }

    const data = event.data || {};
    if (data.source !== "yokaela-preview" || data.type !== "cover-adjust") {
      return;
    }

    applyCoverPreviewAdjustments({
      position: typeof data.position === "string" ? data.position : undefined,
      height: typeof data.height === "string" ? data.height : undefined
    });
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".select-shell")) {
      closeAllCustomSelects();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllCustomSelects();
    }
  });

  dom.noteSearchInput.addEventListener("input", () => {
    state.search = dom.noteSearchInput.value.trim().toLowerCase();
    renderNotesList();
  });

  dom.reloadNotesButton.addEventListener("click", async () => {
    if (!confirmDiscardChanges("recargar la lista")) {
      return;
    }
    await loadBootstrap(state.activeSlug);
  });

  dom.previewScaleSelect.value = String(getPreviewScale());
  dom.previewScaleSelect.addEventListener("change", () => {
    state.previewScale = Number(dom.previewScaleSelect.value || "1.1");
    renderPreview();
  });

  dom.createNoteButton.addEventListener("click", openCreateDialog);
  dom.confirmCreateNoteButton.addEventListener("click", createNoteFromDialog);
  dom.cancelCreateNoteButton.addEventListener("click", closeCreateDialog);
  dom.saveNoteButton.addEventListener("click", saveActiveNote);
  dom.uploadCoverButton.addEventListener("click", uploadCoverImage);
  dom.noteMetaForm.addEventListener("input", handleNoteMetaChange);
  dom.noteMetaForm.addEventListener("change", handleNoteMetaChange);
  dom.createDialog.addEventListener("close", resetCreateDialog);
}

async function loadBootstrap(preferredSlug = "") {
  const data = await api("/api/bootstrap");
  state.bootstrap = data;
  state.collections = Array.isArray(data.collections) ? data.collections : [];
  state.notesByCollection = state.collections.reduce((accumulator, collection) => {
    accumulator[collection.id] = Array.isArray(collection.notes) ? collection.notes : [];
    return accumulator;
  }, { nuevas: [], viejas: [] });
  if (!state.collections.some((collection) => collection.id === state.activeCollection)) {
    state.activeCollection = data.defaultCollection || (state.collections[0] ? state.collections[0].id : "") || "nuevas";
  }
  syncEditorTheme();

  fillThemeSelect(
    dom.themeSelect,
    state.activeNote && state.activeNote.note ? state.activeNote.note.theme : "theme-present-notes"
  );
  fillThemeSelect(dom.createThemeSelect, "theme-present-notes");
  renderCollectionTabs();
  renderNotesList();

  const preferredCollection = preferredSlug && typeof preferredSlug === "object"
    ? preferredSlug.collection || state.activeCollection
    : state.activeCollection;
  const preferredNoteSlug = preferredSlug && typeof preferredSlug === "object"
    ? preferredSlug.slug || ""
    : preferredSlug;

  if (preferredNoteSlug) {
    await openNote(preferredNoteSlug, preferredCollection);
    return;
  }

  const rememberedSlug = state.activeSlugByCollection[state.activeCollection] || "";
  if (rememberedSlug) {
    await openNote(rememberedSlug, state.activeCollection);
    return;
  }

  const activeNotes = getNotesForCollection();
  if (activeNotes.length) {
    const fallbackNote = state.activeCollection === "viejas"
      ? activeNotes[0]
      : activeNotes[activeNotes.length - 1];
    await openNote(fallbackNote.slug, state.activeCollection);
  } else {
    renderWorkspaceEmpty();
  }
}

function renderCollectionTabs() {
  syncEditorTheme();
  dom.collectionTabs.innerHTML = getCollections()
    .map((collection) => `
      <button
        class="collection-tab${collection.id === state.activeCollection ? " is-active" : ""}"
        type="button"
        data-collection-tab="${collection.id}"
      >
        ${escapeHtml(collection.label)}
      </button>
    `)
    .join("");

  const activeCollection = getCollectionMeta();
  dom.createNoteButton.disabled = activeCollection.canCreate === false;
  dom.createNoteButton.textContent = activeCollection.canCreate === false ? "Archivo fijo" : "Nueva hoja";

  dom.collectionTabs.querySelectorAll("[data-collection-tab]").forEach((button) => {
    button.addEventListener("click", async () => {
      const nextCollection = button.dataset.collectionTab;
      if (!nextCollection || nextCollection === state.activeCollection) {
        return;
      }

      if (!confirmDiscardChanges("cambiar de colección")) {
        return;
      }

      state.activeCollection = nextCollection;
      state.activeSlug = state.activeSlugByCollection[nextCollection] || "";
      state.activeNote = null;
      renderCollectionTabs();
      renderNotesList();

      const rememberedSlug = state.activeSlugByCollection[nextCollection] || "";
      const notes = getNotesForCollection(nextCollection);
      if (rememberedSlug) {
        await openNote(rememberedSlug, nextCollection);
        return;
      }

      if (notes.length) {
        const fallbackNote = nextCollection === "viejas" ? notes[0] : notes[notes.length - 1];
        await openNote(fallbackNote.slug, nextCollection);
        return;
      }

      renderWorkspaceEmpty();
    });
  });
}

function renderNotesList() {
  const activeCollection = getCollectionMeta();
  const filtered = getNotesForCollection().filter((note) => {
    if (!state.search) {
      return true;
    }

    const haystack = `${note.slug} ${note.titulo} ${note.descripcion}`.toLowerCase();
    return haystack.includes(state.search);
  });

  if (!filtered.length) {
    dom.notesList.innerHTML = `
      <div class="empty-state">
        <strong>No encontré notas.</strong>
        <p>Probá otra búsqueda o ${activeCollection.canCreate === false ? "abrí otra hoja del archivo." : "creá una hoja nueva."}</p>
      </div>
    `;
    return;
  }

  dom.notesList.innerHTML = filtered
    .map((note) => `
      <button
        class="note-list-item${state.activeSlug === note.slug ? " is-active" : ""}"
        type="button"
        data-note-slug="${note.slug}"
      >
        <span class="note-list-item__number">${activeCollection.id === "viejas" ? "Archivo" : "Hoja"} ${note.slug}</span>
        <span class="note-list-item__title">${escapeHtml(note.titulo)}</span>
        <span class="note-list-item__meta">${escapeHtml(note.fecha || "Sin fecha")}</span>
      </button>
    `)
    .join("");

  dom.notesList.querySelectorAll("[data-note-slug]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirmDiscardChanges("abrir otra hoja")) {
        return;
      }
      await openNote(button.dataset.noteSlug, state.activeCollection);
    });
  });
}

function renderWorkspaceEmpty() {
  syncEditorTheme();
  state.activeSlug = "";
  state.activeNote = null;
  dom.workspaceTitle.textContent = state.activeCollection === "viejas" ? "Elegí una hoja del archivo" : "Elegí o creá una hoja";
  setStatus(
    state.activeCollection === "viejas"
      ? "Abrí una nota vieja para reconstruirla y ajustarla desde el mismo editor."
      : "Todavía no hay una hoja abierta en el editor."
  );
  dom.saveNoteButton.disabled = true;
  dom.uploadCoverButton.disabled = true;
  dom.authorToggles.innerHTML = "";
  dom.authorTabs.innerHTML = "";
  dom.authorPanel.innerHTML = `
    <div class="empty-state">
      <strong>El editor está listo.</strong>
      <p>${state.activeCollection === "viejas"
        ? "Elegí una hoja del archivo para verla reconstruida y corregirla desde acá."
        : "Creá una hoja nueva o abrí una de la lista lateral para empezar a escribir."}</p>
    </div>
  `;
  dom.previewFrame.srcdoc = `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="UTF-8">
        <style>
          body { margin: 0; background:
            ${state.activeCollection === "viejas"
              ? "radial-gradient(circle at top left, rgba(98, 104, 116, 0.14), transparent 28%), radial-gradient(circle at bottom right, rgba(50, 56, 66, 0.18), transparent 30%), #11141a"
              : "radial-gradient(circle at top left, rgba(194, 139, 255, 0.18), transparent 28%), radial-gradient(circle at bottom right, rgba(116, 90, 216, 0.18), transparent 30%), #1b1430"};
            color: ${state.activeCollection === "viejas" ? "#eceef2" : "#f3eaff"};
            font-family: Segoe UI, sans-serif; display: grid; place-items: center; min-height: 100vh; }
          div { text-align: center; max-width: 420px; line-height: 1.7; color: ${state.activeCollection === "viejas" ? "#b5bbc4" : "#dacdf2"}; }
          strong { display: block; margin-bottom: 10px; color: white; }
        </style>
      </head>
      <body>
        <div>
          <strong>Preview vacío</strong>
          ${state.activeCollection === "viejas"
            ? "Elegí una hoja del archivo para ver su reconstrucción acá mismo."
            : "Elegí una nota para ver la maqueta acá mismo."}
        </div>
      </body>
    </html>
  `;
}

async function openNote(slug, collection = state.activeCollection) {
  if (!slug) {
    return;
  }

  const data = await api(`/api/notes/${collection}/${slug}`);
  const nextActiveAuthorId = pickActiveAuthorId(data.authors, state.activeAuthorId);
  state.activeCollection = collection;
  state.activeSlug = slug;
  state.activeSlugByCollection[collection] = slug;
  state.activeNote = clone(data);
  state.activeAuthorId = nextActiveAuthorId;
  setDirty(false);
  syncWorkspace();
}

function syncWorkspace() {
  if (!state.activeNote) {
    renderWorkspaceEmpty();
    return;
  }

  renderCollectionTabs();
  renderNotesList();
  renderNoteMetaForm();
  renderAuthorControls();
  renderAuthorPanel();
  renderPreview();

  dom.workspaceTitle.textContent = `${state.activeCollection === "viejas" ? "Archivo" : "Hoja"} ${state.activeSlug} · ${state.activeNote.note.titulo}`;
  setStatus("La vista previa usa el mismo renderer que la nota publicada.");
  dom.uploadCoverButton.disabled = false;
}

function renderNoteMetaForm() {
  const note = state.activeNote.note;
  dom.noteMetaForm.titulo.value = note.titulo || "";
  dom.noteMetaForm.descripcion.value = note.descripcion || "";
  dom.noteMetaForm.sortDate.value = note.sortDate || fallbackSortDate();
  syncCoverMetaFields();
  fillThemeSelect(dom.themeSelect, note.theme || "theme-present-notes");
  enhanceSelects(dom.noteMetaForm);
}

function handleNoteMetaChange() {
  if (!state.activeNote) {
    return;
  }

  const note = state.activeNote.note;
  note.titulo = dom.noteMetaForm.titulo.value.trim();
  note.descripcion = dom.noteMetaForm.descripcion.value.trim();
  note.sortDate = dom.noteMetaForm.sortDate.value || fallbackSortDate();
  note.theme = dom.noteMetaForm.theme.value || "theme-present-notes";
  note.cover = {
    ...(note.cover || {}),
    alt: dom.noteMetaForm.coverAlt.value.trim(),
    enabled: dom.noteMetaForm.coverEnabled.checked,
    height: dom.noteMetaForm.coverHeight.value.trim(),
    position: dom.noteMetaForm.coverPosition.value.trim(),
    caption: dom.noteMetaForm.coverCaption.value.trim()
  };

  setDirty(true);
  renderNotesList();
  renderPreview();
}

function renderAuthorControls() {
  const authors = ["mica", "leo"].map((authorId) => ensureAuthor(authorId));

  dom.authorToggles.innerHTML = authors
    .map((author) => `
      <button
        class="author-toggle${author.enabled !== false ? " is-active" : ""}"
        type="button"
        data-toggle-author="${author.id}"
      >
        ${author.id === "mica" ? "Mica" : "Leo"}
      </button>
    `)
    .join("");

  dom.authorTabs.innerHTML = getEnabledAuthors()
    .map((author) => `
      <button
        class="author-tab${state.activeAuthorId === author.id ? " is-active" : ""}"
        type="button"
        data-author-tab="${author.id}"
      >
        ${author.id === "mica" ? "Bloque de Mica" : "Bloque de Leo"}
      </button>
    `)
    .join("");

  dom.authorToggles.querySelectorAll("[data-toggle-author]").forEach((button) => {
    button.addEventListener("click", () => {
      const author = ensureAuthor(button.dataset.toggleAuthor);
      author.enabled = !(author.enabled !== false);
      if (author.enabled !== false) {
        state.activeAuthorId = author.id;
      } else if (state.activeAuthorId === author.id) {
        state.activeAuthorId = pickActiveAuthorId(state.activeNote.authors, author.id);
      }
      setDirty(true);
      renderAuthorControls();
      renderAuthorPanel();
      renderPreview();
    });
  });

  dom.authorTabs.querySelectorAll("[data-author-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeAuthorId = button.dataset.authorTab;
      renderAuthorControls();
      renderAuthorPanel();
    });
  });
}

function renderAuthorPanel() {
  const author = getActiveAuthor();

  if (!author) {
    dom.authorPanel.innerHTML = `
      <div class="empty-state">
        <strong>No hay bloques activos.</strong>
        <p>Activá Mica o Leo para empezar a escribir.</p>
      </div>
    `;
    return;
  }

  dom.authorPanel.innerHTML = `
    <div class="author-editor">
      <div class="author-settings">
        <div class="form-grid">
          <label>
            <span>Título del bloque</span>
            <input type="text" data-author-meta="title" value="${escapeHtml(author.document.meta.title || "")}">
          </label>

          <label>
            <span>Helper / bajada</span>
            <input type="text" data-author-meta="helper" value="${escapeHtml(author.document.meta.helper || "")}">
          </label>

          <label>
            <span>Label visible</span>
            <input type="text" data-author-meta="label" value="${escapeHtml(author.document.meta.label || "")}">
          </label>

          <label>
            <span>Variante</span>
            <select data-author-meta="variant">
              <option value="">Normal</option>
              <option value="solo"${author.document.meta.variant === "solo" ? " selected" : ""}>Solo / centrado</option>
            </select>
          </label>

          <label class="full-row">
            <span>Texto si este bloque todavía está vacío</span>
            <input type="text" data-author-meta="placeholderBody" value="${escapeHtml(author.document.meta.placeholderBody || "")}">
          </label>
        </div>

        <div class="author-checkline">
          <label><input type="checkbox" data-author-meta-check="spoiler"${author.document.meta.spoiler ? " checked" : ""}> Bloque con spoiler</label>
        </div>
      </div>

      <div class="block-toolbar">
        ${renderAddBlockButtons()}
        <button class="soft-button" type="button" data-merge-text-blocks>Unir textos seguidos</button>
      </div>

      <div class="blocks-list">
        ${author.document.blocks.length
          ? author.document.blocks.map((block, index) => renderBlockEditor(block, index)).join("")
          : `
            <div class="empty-state">
              <strong>Este bloque está vacío.</strong>
              <p>Agregá un párrafo, una cita, una canción o la estructura que quieras desde los botones de arriba.</p>
            </div>
          `}
      </div>
    </div>
  `;

  enhanceSelects(dom.authorPanel);
  bindAuthorPanelEvents(author);
}

function renderAddBlockButtons() {
  return [
    ["paragraph", "Texto"],
    ["quote", "Cita"],
    ["visual-quote", "Cita visual"],
    ["quote-strip", "Cita con PNG"],
    ["song", "Canción"],
    ["dialogue", "Diálogo"],
    ["hero-quote", "Cita grande"],
    ["image", "Imagen"],
    ["divider", "Separador"]
  ]
    .map(([type, label]) => `
      <button class="add-block-button" type="button" data-add-block="${type}">
        + ${label}
      </button>
    `)
    .join("");
}

function renderVisualQuoteItemEditor(block, row, rowIndex, item, itemIndex) {
  if (item.kind === "image") {
    const options = item.options || {};

    return `
      <article class="visual-quote-item visual-quote-item--image">
        <div class="visual-quote-item__head">
          <strong>PNG ${itemIndex + 1}</strong>
          <div class="visual-quote-item__actions">
            <button class="soft-button" type="button" data-visual-move-item="left" data-visual-row-index="${rowIndex}" data-visual-item-index="${itemIndex}">←</button>
            <button class="soft-button" type="button" data-visual-move-item="right" data-visual-row-index="${rowIndex}" data-visual-item-index="${itemIndex}">→</button>
            <button class="soft-button" type="button" data-visual-remove-item data-visual-row-index="${rowIndex}" data-visual-item-index="${itemIndex}">Eliminar</button>
          </div>
        </div>
        <div class="block-card__grid">
          <label>
            <span>Archivo / ruta</span>
            <small class="field-tip">La imagen que va adentro de la cita.</small>
            <input type="text" data-visual-item-field="src" data-visual-row-index="${rowIndex}" data-visual-item-index="${itemIndex}" value="${escapeHtml(options.src || "")}" placeholder="../../assets/img/...">
          </label>
          <label>
            <span>Texto alternativo</span>
            <small class="field-tip">Describe el PNG por si no carga.</small>
            <input type="text" data-visual-item-field="alt" data-visual-row-index="${rowIndex}" data-visual-item-index="${itemIndex}" value="${escapeHtml(options.alt || "")}" placeholder="Descripción breve del PNG">
          </label>
          <label>
            <span>Encuadre</span>
            <small class="field-tip">Si llena el marco o se ve completo.</small>
            <select data-visual-item-field="fit" data-visual-row-index="${rowIndex}" data-visual-item-index="${itemIndex}">
              ${renderSelectOptions(["cover", "contain"], options.fit || "cover")}
            </select>
          </label>
        </div>
        <div class="block-card__grid">
          <label>
            <span>Ancho</span>
            <small class="field-tip">Ejemplo: 120px.</small>
            <input type="text" data-visual-item-field="width" data-visual-row-index="${rowIndex}" data-visual-item-index="${itemIndex}" value="${escapeHtml(options.width || "")}" placeholder="120px">
          </label>
          <label>
            <span>Alto</span>
            <small class="field-tip">Ejemplo: 120px.</small>
            <input type="text" data-visual-item-field="height" data-visual-row-index="${rowIndex}" data-visual-item-index="${itemIndex}" value="${escapeHtml(options.height || "")}" placeholder="120px">
          </label>
          <label>
            <span>Posición</span>
            <small class="field-tip">Qué parte del PNG querés priorizar.</small>
            <input type="text" data-visual-item-field="position" data-visual-row-index="${rowIndex}" data-visual-item-index="${itemIndex}" value="${escapeHtml(options.position || "")}" placeholder="50% 50%">
          </label>
        </div>
        <div class="block-card__grid">
          <label>
            <span>Fondo</span>
            <small class="field-tip">Color o transparencia detrás del PNG.</small>
            <input type="text" data-visual-item-field="background" data-visual-row-index="${rowIndex}" data-visual-item-index="${itemIndex}" value="${escapeHtml(options.background || "")}" placeholder="rgba(255,255,255,0.06)">
          </label>
          <label>
            <span>Borde</span>
            <small class="field-tip">Borde del marco del PNG.</small>
            <input type="text" data-visual-item-field="border" data-visual-row-index="${rowIndex}" data-visual-item-index="${itemIndex}" value="${escapeHtml(options.border || "")}" placeholder="1px solid rgba(...)">
          </label>
          <label>
            <span>Radio</span>
            <small class="field-tip">Qué tan redondeadas van las esquinas.</small>
            <input type="text" data-visual-item-field="radius" data-visual-row-index="${rowIndex}" data-visual-item-index="${itemIndex}" value="${escapeHtml(options.radius || "")}" placeholder="12px">
          </label>
        </div>
        <div class="block-card__grid">
          <label class="full-row">
            <span>Espacio interno</span>
            <small class="field-tip">Separación entre el PNG y su marco interior.</small>
            <input type="text" data-visual-item-field="padding" data-visual-row-index="${rowIndex}" data-visual-item-index="${itemIndex}" value="${escapeHtml(options.padding || "")}" placeholder="0 o 12px">
          </label>
        </div>
        <div class="block-toolbar">
          <button class="soft-button" type="button" data-upload-visual-image="${block.id}" data-visual-row-index="${rowIndex}" data-visual-item-index="${itemIndex}">Subir PNG</button>
        </div>
      </article>
    `;
  }

  return `
    <article class="visual-quote-item">
      <div class="visual-quote-item__head">
        <strong>Texto ${itemIndex + 1}</strong>
        <div class="visual-quote-item__actions">
          <button class="soft-button" type="button" data-visual-move-item="left" data-visual-row-index="${rowIndex}" data-visual-item-index="${itemIndex}">←</button>
          <button class="soft-button" type="button" data-visual-move-item="right" data-visual-row-index="${rowIndex}" data-visual-item-index="${itemIndex}">→</button>
          <button class="soft-button" type="button" data-visual-remove-item data-visual-row-index="${rowIndex}" data-visual-item-index="${itemIndex}">Eliminar</button>
        </div>
      </div>
      <label>
        <span>Texto</span>
        <textarea rows="3" data-visual-item-field="text" data-visual-row-index="${rowIndex}" data-visual-item-index="${itemIndex}" placeholder="Texto de esta línea">${escapeHtml(item.text || "")}</textarea>
      </label>
    </article>
  `;
}

function renderVisualQuoteRowEditor(block, row, rowIndex) {
  return `
    <section class="visual-quote-row">
      <div class="visual-quote-row__head">
        <strong>Línea ${rowIndex + 1}</strong>
        <div class="visual-quote-row__actions">
          <button class="soft-button" type="button" data-visual-move-row="up" data-visual-row-index="${rowIndex}">Subir</button>
          <button class="soft-button" type="button" data-visual-move-row="down" data-visual-row-index="${rowIndex}">Bajar</button>
          <button class="soft-button" type="button" data-visual-remove-row data-visual-row-index="${rowIndex}">Eliminar línea</button>
        </div>
      </div>
      <div class="visual-quote-row__toolbar">
        <button class="soft-button" type="button" data-visual-add-item="text" data-visual-row-index="${rowIndex}">+ Texto</button>
        <button class="soft-button" type="button" data-visual-add-item="image" data-visual-row-index="${rowIndex}">+ PNG</button>
      </div>
      <div class="visual-quote-row__items">
        ${row.items.map((item, itemIndex) => renderVisualQuoteItemEditor(block, row, rowIndex, item, itemIndex)).join("")}
      </div>
    </section>
  `;
}

function renderQuoteStripImageEditor(block, sideKey, sideLabel) {
  ensureQuoteStripBlockState(block);
  const options = sideKey === "right" ? block.rightImage : block.leftImage;

  return `
    <section class="visual-quote-row">
      <div class="visual-quote-row__head">
        <strong>PNG ${sideLabel}</strong>
      </div>
      <div class="block-card__grid">
        <label>
          <span>Archivo / ruta</span>
          <small class="field-tip">La imagen lateral de esta composición.</small>
          <input type="text" data-quote-strip-image-field="src" data-quote-strip-side="${sideKey}" value="${escapeHtml(options.src || "")}" placeholder="../../assets/img/...">
        </label>
        <label>
          <span>Texto alternativo</span>
          <small class="field-tip">Describe el PNG por si no carga.</small>
          <input type="text" data-quote-strip-image-field="alt" data-quote-strip-side="${sideKey}" value="${escapeHtml(options.alt || "")}" placeholder="Descripción breve del PNG">
        </label>
        <label>
          <span>Encuadre</span>
          <small class="field-tip">Si llena el marco o se ve completo.</small>
          <select data-quote-strip-image-field="fit" data-quote-strip-side="${sideKey}">
            ${renderSelectOptions(["cover", "contain"], options.fit || "cover")}
          </select>
        </label>
      </div>
      <div class="block-card__grid">
        <label>
          <span>Posición</span>
          <small class="field-tip">Qué parte del PNG querés priorizar.</small>
          <input type="text" data-quote-strip-image-field="position" data-quote-strip-side="${sideKey}" value="${escapeHtml(options.position || "")}" placeholder="50% 50%">
        </label>
        <label>
          <span>Fondo</span>
          <small class="field-tip">Color o transparencia detrás del PNG.</small>
          <input type="text" data-quote-strip-image-field="background" data-quote-strip-side="${sideKey}" value="${escapeHtml(options.background || "")}" placeholder="rgba(255,255,255,0.03)">
        </label>
        <label>
          <span>Borde</span>
          <small class="field-tip">Borde del marco del PNG.</small>
          <input type="text" data-quote-strip-image-field="border" data-quote-strip-side="${sideKey}" value="${escapeHtml(options.border || "")}" placeholder="1px solid rgba(...)">
        </label>
      </div>
      <div class="block-card__grid">
        <label>
          <span>Radio</span>
          <small class="field-tip">Qué tan redondeadas van las esquinas.</small>
          <input type="text" data-quote-strip-image-field="radius" data-quote-strip-side="${sideKey}" value="${escapeHtml(options.radius || "")}" placeholder="18px">
        </label>
        <label class="full-row">
          <span>Espacio interno</span>
          <small class="field-tip">Separación entre el PNG y su marco interior.</small>
          <input type="text" data-quote-strip-image-field="padding" data-quote-strip-side="${sideKey}" value="${escapeHtml(options.padding || "")}" placeholder="0 o 12px">
        </label>
      </div>
      <div class="block-toolbar">
        <button class="soft-button" type="button" data-upload-quote-strip-image="${block.id}" data-quote-strip-side="${sideKey}">Subir PNG ${sideLabel}</button>
      </div>
    </section>
  `;
}

function renderBlockEditor(block, index) {
  const style = block.style || {};
  const styleControls = `
    <div class="block-card__grid">
      <label>
        <span>Tamaño</span>
        <select data-block-style="fontSize">
          ${renderSelectOptions(["default", "sm", "md", "lg", "xl", "hero"], style.fontSize || "default")}
        </select>
      </label>
      <label>
        <span>Fuente</span>
        <select data-block-style="fontFamily">
          ${renderSelectOptions(["default", "body", "serif", "display", "script"], style.fontFamily || "default")}
        </select>
      </label>
      <label>
        <span>Alineación</span>
        <select data-block-style="align">
          ${renderSelectOptions(["default", "left", "center", "right"], style.align || "default")}
        </select>
      </label>
    </div>
  `;

  let bodyHtml = "";

  if (block.type === "paragraph") {
    bodyHtml = `
      <p class="field-help">
        Usá un solo bloque de texto y separá párrafos con doble Enter.
        No hace falta crear un bloque nuevo por cada párrafo.
      </p>
      <label>
        <span>Texto</span>
        <textarea rows="7" data-block-field="text">${escapeHtml(block.text || "")}</textarea>
      </label>
      <label class="check-field full-row">
        <input type="checkbox" data-block-check="preserveBreaks"${block.preserveBreaks ? " checked" : ""}>
        <span>Respetar los saltos de línea tal como fueron escritos</span>
      </label>
      ${styleControls}
    `;
  } else if (block.type === "visual-quote") {
    ensureVisualQuoteBlockState(block);
    const layout = block.layout || {};
    bodyHtml = `
      <p class="field-help">
        Esta cita se arma por líneas. En cada línea podés mezclar texto y PNGs sin escribir HTML.
      </p>
      <label>
        <span>Autor / firma</span>
        <input type="text" data-block-field="author" value="${escapeHtml(block.author || "")}" placeholder="Tumblr, canción, autor, etc.">
      </label>
      <div class="block-card__grid">
        <label>
          <span>Ancho máximo</span>
          <small class="field-tip">Hasta dónde puede crecer la cita. Ejemplo: 420px.</small>
          <input type="text" data-visual-layout="maxWidth" value="${escapeHtml(layout.maxWidth || "")}" placeholder="420px">
        </label>
        <label>
          <span>Alto mínimo</span>
          <small class="field-tip">Sirve para citas altas como la de la hoja 36.</small>
          <input type="text" data-visual-layout="minHeight" value="${escapeHtml(layout.minHeight || "")}" placeholder="340px">
        </label>
        <label>
          <span>Tamaño del texto</span>
          <small class="field-tip">Ejemplo: 3rem.</small>
          <input type="text" data-visual-layout="fontSize" value="${escapeHtml(layout.fontSize || "")}" placeholder="3rem">
        </label>
      </div>
      <div class="block-card__grid">
        <label>
          <span>Margen externo</span>
          <small class="field-tip">Separación con el contenido de alrededor.</small>
          <input type="text" data-visual-layout="margin" value="${escapeHtml(layout.margin || "")}" placeholder="2rem auto 0">
        </label>
        <label>
          <span>Padding interno</span>
          <small class="field-tip">Espacio interno de la cita.</small>
          <input type="text" data-visual-layout="padding" value="${escapeHtml(layout.padding || "")}" placeholder="2rem 1.6rem">
        </label>
        <label>
          <span>Interlineado</span>
          <small class="field-tip">Qué tan separadas se ven las líneas.</small>
          <input type="text" data-visual-layout="lineHeight" value="${escapeHtml(layout.lineHeight || "")}" placeholder="1.55">
        </label>
      </div>
      <div class="block-card__grid">
        <label>
          <span>Espaciado entre letras</span>
          <small class="field-tip">Útil para citas en mayúsculas.</small>
          <input type="text" data-visual-layout="letterSpacing" value="${escapeHtml(layout.letterSpacing || "")}" placeholder="0.08em">
        </label>
        <label>
          <span>Transformación</span>
          <small class="field-tip">Si querés forzar mayúsculas.</small>
          <select data-visual-layout="textTransform">
            <option value=""${!(layout.textTransform || "") ? " selected" : ""}>Como venga</option>
            <option value="none"${layout.textTransform === "none" ? " selected" : ""}>Sin forzar</option>
            <option value="uppercase"${layout.textTransform === "uppercase" ? " selected" : ""}>Mayúsculas</option>
          </select>
        </label>
        <label>
          <span>Tamaño de la firma</span>
          <small class="field-tip">Tamaño del autor abajo a la derecha.</small>
          <input type="text" data-visual-layout="authorSize" value="${escapeHtml(layout.authorSize || "")}" placeholder="1.1rem">
        </label>
      </div>
      <label>
        <span>Separación entre líneas</span>
        <small class="field-tip">Espacio vertical entre una línea y otra de la cita.</small>
        <input type="text" data-visual-layout="rowGap" value="${escapeHtml(layout.rowGap || "")}" placeholder="0.65rem">
      </label>
      <div class="block-toolbar">
        <button class="soft-button" type="button" data-visual-add-row>+ Línea</button>
      </div>
      <div class="visual-quote-editor">
        ${block.rows.map((row, rowIndex) => renderVisualQuoteRowEditor(block, row, rowIndex)).join("")}
      </div>
      ${styleControls}
    `;
  } else if (block.type === "quote-strip") {
    ensureQuoteStripBlockState(block);
    const layout = block.layout || {};
    bodyHtml = `
      <p class="field-help">
        Esta composición usa una sola caja de texto para la cita central y dos slots para PNGs laterales, sin escribir HTML.
      </p>
      <label>
        <span>Texto central</span>
        <textarea rows="6" data-block-field="paragraphs">${escapeHtml((block.paragraphs || []).join("\n\n"))}</textarea>
      </label>
      <label>
        <span>Autor / firma</span>
        <input type="text" data-block-field="author" value="${escapeHtml(block.author || "")}" placeholder="Tumblr, autor, canción, etc.">
      </label>
      <div class="block-card__grid">
        <label>
          <span>Margen externo</span>
          <small class="field-tip">Separación con el contenido de alrededor.</small>
          <input type="text" data-quote-strip-layout="margin" value="${escapeHtml(layout.margin || "")}" placeholder="1.5rem 0">
        </label>
        <label>
          <span>Separación interna</span>
          <small class="field-tip">Espacio entre los PNGs y la cita central.</small>
          <input type="text" data-quote-strip-layout="gap" value="${escapeHtml(layout.gap || "")}" placeholder="1rem">
        </label>
        <label>
          <span>Ancho lateral</span>
          <small class="field-tip">Ancho de cada columna con PNG.</small>
          <input type="text" data-quote-strip-layout="sideWidth" value="${escapeHtml(layout.sideWidth || "")}" placeholder="72px">
        </label>
      </div>
      <div class="block-card__grid">
        <label>
          <span>Alto mínimo</span>
          <small class="field-tip">Altura mínima de las columnas laterales.</small>
          <input type="text" data-quote-strip-layout="minHeight" value="${escapeHtml(layout.minHeight || "")}" placeholder="320px">
        </label>
        <label>
          <span>Ancho máximo de la cita</span>
          <small class="field-tip">Hasta dónde puede crecer el cuadro central.</small>
          <input type="text" data-quote-strip-layout="quoteMaxWidth" value="${escapeHtml(layout.quoteMaxWidth || "")}" placeholder="320px">
        </label>
        <label>
          <span>Padding de la cita</span>
          <small class="field-tip">Espacio interno del cuadro central.</small>
          <input type="text" data-quote-strip-layout="quotePadding" value="${escapeHtml(layout.quotePadding || "")}" placeholder="1.25rem 1rem">
        </label>
      </div>
      ${renderQuoteStripImageEditor(block, "left", "izquierdo")}
      ${renderQuoteStripImageEditor(block, "right", "derecho")}
      ${styleControls}
    `;
  } else if (block.type === "html") {
    bodyHtml = `
      <p class="field-help">
        Este bloque conserva HTML especial importado de notas viejas.
        Solo hace falta tocarlo si querés ajustar algo muy puntual.
      </p>
      <label>
        <span>HTML especial</span>
        <textarea rows="10" data-block-field="html">${escapeHtml(block.html || "")}</textarea>
      </label>
      ${styleControls}
    `;
  } else if (block.type === "image") {
    const options = block.options || {};
    bodyHtml = `
      <p class="field-help">
        <strong>Alt</strong> describe la imagen con palabras.
        <strong>Altura</strong> define qué tan alta se ve en la nota.
      </p>
      <div class="block-card__grid">
        <label>
          <span>Archivo / ruta</span>
          <small class="field-tip">Dónde está guardada la imagen o a qué archivo apunta este bloque.</small>
          <input type="text" data-image-field="src" value="${escapeHtml(options.src || "")}" placeholder="../assets/img/...">
        </label>
        <label>
          <span>Texto alternativo (alt)</span>
          <small class="field-tip">Una descripción breve por si la imagen no carga o para accesibilidad.</small>
          <input type="text" data-image-field="alt" value="${escapeHtml(options.alt || "")}" placeholder="Descripción breve de la imagen">
        </label>
        <label>
          <span>Epígrafe</span>
          <small class="field-tip">Texto opcional que aparece debajo de la imagen.</small>
          <input type="text" data-image-field="caption" value="${escapeHtml(options.caption || "")}" placeholder="Texto opcional debajo de la imagen">
        </label>
        <label>
          <span>Altura visible</span>
          <small class="field-tip">Qué alto tiene el bloque en pantalla. Ejemplo: 240px.</small>
          <input type="text" data-image-field="height" value="${escapeHtml(options.height || "")}" placeholder="240px">
        </label>
        <label>
          <span>Encuadre</span>
          <small class="field-tip">Si llena todo el marco o si muestra la imagen completa con bordes.</small>
          <select data-image-field="fit">
            ${renderSelectOptions(["cover", "contain"], options.fit || "cover")}
          </select>
        </label>
        <label>
          <span>Espacio interno</span>
          <small class="field-tip">Separación entre la imagen y el borde interior del marco.</small>
          <input type="text" data-image-field="padding" value="${escapeHtml(options.padding || "")}" placeholder="24px">
        </label>
      </div>
      <div class="block-card__grid">
        <label>
          <span>Fondo del marco</span>
          <small class="field-tip">Color o transparencia que se ve detrás de la imagen.</small>
          <input type="text" data-image-field="background" value="${escapeHtml(options.background || "")}" placeholder="rgba(255,255,255,0.04)">
        </label>
        <label>
          <span>Posición de la imagen</span>
          <small class="field-tip">Qué parte de la imagen querés priorizar. Ejemplo: 50% 50%.</small>
          <input type="text" data-image-field="position" value="${escapeHtml(options.position || "")}" placeholder="50% 50%">
        </label>
        <label>
          <span>Espacio externo</span>
          <small class="field-tip">Separación de este bloque con el contenido que lo rodea.</small>
          <input type="text" data-image-field="margin" value="${escapeHtml(options.margin || "")}" placeholder="0 0 1rem">
        </label>
      </div>
      <div class="block-toolbar">
        <button class="soft-button" type="button" data-upload-inline-image="${block.id}">Subir imagen</button>
      </div>
      ${styleControls}
    `;
  } else if (block.type === "divider") {
    bodyHtml = `
      <p class="workspace-status">Este bloque agrega un separador visual entre secciones.</p>
      ${styleControls}
    `;
  } else {
    bodyHtml = `
      <label>
        <span>Contenido</span>
        <textarea rows="6" data-block-field="paragraphs">${escapeHtml((block.paragraphs || []).join("\n\n"))}</textarea>
      </label>
      <label>
        <span>Autor / firma</span>
        <input type="text" data-block-field="author" value="${escapeHtml(block.author || "")}" placeholder="Autor alineado a la derecha">
      </label>
      ${styleControls}
    `;
  }

  return `
    <article class="block-card" data-block-id="${block.id}">
      <div class="block-card__head">
        <div class="block-card__title">Bloque ${index + 1}</div>
        <div class="block-card__actions">
          <button class="soft-button" type="button" data-move-block="up">Subir</button>
          <button class="soft-button" type="button" data-move-block="down">Bajar</button>
          <button class="soft-button" type="button" data-duplicate-block>Duplicar</button>
          <button class="soft-button" type="button" data-remove-block>Eliminar</button>
        </div>
      </div>

      <div class="block-card__layout">
        <label>
          <span>Tipo de bloque</span>
          <select data-block-field="type">
            ${renderSelectOptions(["paragraph", "quote", "visual-quote", "quote-strip", "song", "dialogue", "hero-quote", "image", "divider", "html"], block.type)}
          </select>
        </label>
        ${bodyHtml}
      </div>
    </article>
  `;
}

function renderSelectOptions(values, selected) {
  return values
    .map((value) => `<option value="${value}"${value === selected ? " selected" : ""}>${formatOptionLabel(value)}</option>`)
    .join("");
}

function formatOptionLabel(value) {
  const labels = {
    default: "Predeterminado",
    sm: "Chico",
    md: "Medio",
    lg: "Grande",
    xl: "Muy grande",
    hero: "Hero",
    body: "Cuerpo",
    serif: "Serif",
    display: "Display",
    script: "Script",
    left: "Izquierda",
    center: "Centro",
    right: "Derecha",
    paragraph: "Texto",
    quote: "Cita",
    "visual-quote": "Cita visual",
    "quote-strip": "Cita con PNG",
    song: "Canción",
    dialogue: "Diálogo",
    "hero-quote": "Cita grande",
    image: "Imagen",
    divider: "Separador",
    html: "HTML especial",
    cover: "Cover",
    contain: "Contain",
    none: "Sin forzar",
    uppercase: "Mayúsculas"
  };

  return labels[value] || value;
}

function bindAuthorPanelEvents(author) {
  dom.authorPanel.querySelectorAll("[data-author-meta]").forEach((input) => {
    input.addEventListener("input", () => {
      author.document.meta[input.dataset.authorMeta] = input.value;
      setDirty(true);
      renderPreview();
    });
  });

  dom.authorPanel.querySelectorAll("[data-author-meta-check]").forEach((input) => {
    input.addEventListener("change", () => {
      author.document.meta[input.dataset.authorMetaCheck] = input.checked;
      setDirty(true);
      renderPreview();
    });
  });

  dom.authorPanel.querySelectorAll("[data-add-block]").forEach((button) => {
    button.addEventListener("click", () => {
      author.document.meta.placeholder = false;
      author.document.blocks.push(createBlock(button.dataset.addBlock));
      setDirty(true);
      renderAuthorPanel();
      renderPreview();
    });
  });

  dom.authorPanel.querySelectorAll("[data-merge-text-blocks]").forEach((button) => {
    button.addEventListener("click", () => {
      const merged = mergeAdjacentParagraphBlocks(author.document.blocks);
      if (!merged.merges) {
        setStatus("No había bloques de texto seguidos para unir.");
        return;
      }

      author.document.blocks = merged.blocks;
      setDirty(true);
      setStatus(`Uní ${merged.merges} bloque${merged.merges === 1 ? "" : "s"} de texto consecutivo${merged.merges === 1 ? "" : "s"}.`);
      renderAuthorPanel();
      renderPreview();
    });
  });

  dom.authorPanel.querySelectorAll("[data-block-id]").forEach((blockElement) => {
    const block = author.document.blocks.find((item) => item.id === blockElement.dataset.blockId);
    if (!block) {
      return;
    }

    blockElement.querySelectorAll("[data-block-field]").forEach((input) => {
      input.addEventListener("input", () => {
        applyBlockFieldChange(block, input.dataset.blockField, input.value);
      });

      input.addEventListener("change", () => {
        applyBlockFieldChange(block, input.dataset.blockField, input.value);
      });
    });

    blockElement.querySelectorAll("[data-block-style]").forEach((input) => {
      input.addEventListener("change", () => {
        block.style = block.style || {};
        block.style[input.dataset.blockStyle] = input.value;
        setDirty(true);
        renderPreview();
      });
    });

    blockElement.querySelectorAll("[data-block-check]").forEach((input) => {
      input.addEventListener("change", () => {
        block[input.dataset.blockCheck] = input.checked;
        setDirty(true);
        renderPreview();
      });
    });

    blockElement.querySelectorAll("[data-image-field]").forEach((input) => {
      input.addEventListener("input", () => {
        block.options = block.options || {};
        block.options[input.dataset.imageField] = input.value;
        setDirty(true);
        renderPreview();
      });

      input.addEventListener("change", () => {
        block.options = block.options || {};
        block.options[input.dataset.imageField] = input.value;
        setDirty(true);
        renderPreview();
      });
    });

    blockElement.querySelectorAll("[data-visual-layout]").forEach((input) => {
      input.addEventListener("input", () => {
        ensureVisualQuoteBlockState(block);
        block.layout[input.dataset.visualLayout] = input.value;
        setDirty(true);
        renderPreview();
      });

      input.addEventListener("change", () => {
        ensureVisualQuoteBlockState(block);
        block.layout[input.dataset.visualLayout] = input.value;
        setDirty(true);
        renderPreview();
      });
    });

    blockElement.querySelectorAll("[data-quote-strip-layout]").forEach((input) => {
      input.addEventListener("input", () => {
        ensureQuoteStripBlockState(block);
        block.layout[input.dataset.quoteStripLayout] = input.value;
        setDirty(true);
        renderPreview();
      });

      input.addEventListener("change", () => {
        ensureQuoteStripBlockState(block);
        block.layout[input.dataset.quoteStripLayout] = input.value;
        setDirty(true);
        renderPreview();
      });
    });

    blockElement.querySelectorAll("[data-quote-strip-image-field]").forEach((input) => {
      const sideKey = input.dataset.quoteStripSide === "right" ? "rightImage" : "leftImage";

      input.addEventListener("input", () => {
        ensureQuoteStripBlockState(block);
        block[sideKey][input.dataset.quoteStripImageField] = input.value;
        setDirty(true);
        renderPreview();
      });

      input.addEventListener("change", () => {
        ensureQuoteStripBlockState(block);
        block[sideKey][input.dataset.quoteStripImageField] = input.value;
        setDirty(true);
        renderPreview();
      });
    });

    blockElement.querySelectorAll("[data-visual-item-field]").forEach((input) => {
      const rowIndex = Number(input.dataset.visualRowIndex);
      const itemIndex = Number(input.dataset.visualItemIndex);

      input.addEventListener("input", () => {
        ensureVisualQuoteBlockState(block);
        const row = block.rows[rowIndex];
        const item = row && row.items ? row.items[itemIndex] : null;
        if (!item) {
          return;
        }

        if (item.kind === "image") {
          item.options = item.options || {};
          item.options[input.dataset.visualItemField] = input.value;
        } else {
          item[input.dataset.visualItemField] = input.value;
        }

        setDirty(true);
        renderPreview();
      });

      input.addEventListener("change", () => {
        ensureVisualQuoteBlockState(block);
        const row = block.rows[rowIndex];
        const item = row && row.items ? row.items[itemIndex] : null;
        if (!item) {
          return;
        }

        if (item.kind === "image") {
          item.options = item.options || {};
          item.options[input.dataset.visualItemField] = input.value;
        } else {
          item[input.dataset.visualItemField] = input.value;
        }

        setDirty(true);
        renderPreview();
      });
    });

    const removeButton = blockElement.querySelector("[data-remove-block]");
    if (removeButton) {
      removeButton.addEventListener("click", () => {
        author.document.blocks = author.document.blocks.filter((item) => item.id !== block.id);
        setDirty(true);
        renderAuthorPanel();
        renderPreview();
      });
    }

    const duplicateButton = blockElement.querySelector("[data-duplicate-block]");
    if (duplicateButton) {
      duplicateButton.addEventListener("click", () => {
        const duplicate = clone(block);
        duplicate.id = `${block.id}-copy-${Math.random().toString(36).slice(2, 5)}`;
        author.document.blocks.splice(author.document.blocks.indexOf(block) + 1, 0, duplicate);
        setDirty(true);
        renderAuthorPanel();
        renderPreview();
      });
    }

    blockElement.querySelectorAll("[data-move-block]").forEach((button) => {
      button.addEventListener("click", () => {
        moveBlock(author.document.blocks, block.id, button.dataset.moveBlock);
        setDirty(true);
        renderAuthorPanel();
        renderPreview();
      });
    });

    blockElement.querySelectorAll("[data-visual-add-row]").forEach((button) => {
      button.addEventListener("click", () => {
        ensureVisualQuoteBlockState(block);
        block.rows.push(defaultVisualQuoteRow([defaultVisualQuoteTextItem("")]));
        setDirty(true);
        renderAuthorPanel();
        renderPreview();
      });
    });

    blockElement.querySelectorAll("[data-visual-remove-row]").forEach((button) => {
      button.addEventListener("click", () => {
        ensureVisualQuoteBlockState(block);
        const rowIndex = Number(button.dataset.visualRowIndex);
        block.rows.splice(rowIndex, 1);
        if (!block.rows.length) {
          block.rows.push(defaultVisualQuoteRow([defaultVisualQuoteTextItem("")]));
        }
        setDirty(true);
        renderAuthorPanel();
        renderPreview();
      });
    });

    blockElement.querySelectorAll("[data-visual-move-row]").forEach((button) => {
      button.addEventListener("click", () => {
        ensureVisualQuoteBlockState(block);
        const rowIndex = Number(button.dataset.visualRowIndex);
        const targetIndex = button.dataset.visualMoveRow === "up" ? rowIndex - 1 : rowIndex + 1;
        if (targetIndex < 0 || targetIndex >= block.rows.length) {
          return;
        }
        const [row] = block.rows.splice(rowIndex, 1);
        block.rows.splice(targetIndex, 0, row);
        setDirty(true);
        renderAuthorPanel();
        renderPreview();
      });
    });

    blockElement.querySelectorAll("[data-visual-add-item]").forEach((button) => {
      button.addEventListener("click", () => {
        ensureVisualQuoteBlockState(block);
        const rowIndex = Number(button.dataset.visualRowIndex);
        const row = block.rows[rowIndex];
        if (!row) {
          return;
        }
        row.items.push(button.dataset.visualAddItem === "image" ? defaultVisualQuoteImageItem() : defaultVisualQuoteTextItem(""));
        setDirty(true);
        renderAuthorPanel();
        renderPreview();
      });
    });

    blockElement.querySelectorAll("[data-visual-remove-item]").forEach((button) => {
      button.addEventListener("click", () => {
        ensureVisualQuoteBlockState(block);
        const rowIndex = Number(button.dataset.visualRowIndex);
        const itemIndex = Number(button.dataset.visualItemIndex);
        const row = block.rows[rowIndex];
        if (!row) {
          return;
        }
        row.items.splice(itemIndex, 1);
        if (!row.items.length) {
          block.rows.splice(rowIndex, 1);
        }
        if (!block.rows.length) {
          block.rows.push(defaultVisualQuoteRow([defaultVisualQuoteTextItem("")]));
        }
        setDirty(true);
        renderAuthorPanel();
        renderPreview();
      });
    });

    blockElement.querySelectorAll("[data-visual-move-item]").forEach((button) => {
      button.addEventListener("click", () => {
        ensureVisualQuoteBlockState(block);
        const rowIndex = Number(button.dataset.visualRowIndex);
        const itemIndex = Number(button.dataset.visualItemIndex);
        const row = block.rows[rowIndex];
        if (!row) {
          return;
        }
        const targetIndex = button.dataset.visualMoveItem === "left" ? itemIndex - 1 : itemIndex + 1;
        if (targetIndex < 0 || targetIndex >= row.items.length) {
          return;
        }
        const [item] = row.items.splice(itemIndex, 1);
        row.items.splice(targetIndex, 0, item);
        setDirty(true);
        renderAuthorPanel();
        renderPreview();
      });
    });

    const inlineUploadButton = blockElement.querySelector("[data-upload-inline-image]");
    if (inlineUploadButton) {
      inlineUploadButton.addEventListener("click", async () => {
        const dataUrl = await chooseFileAsDataUrl();
        if (!dataUrl) {
          return;
        }

        try {
          const uploaded = await api(`/api/uploads/inline/${state.activeCollection}/${state.activeSlug}/${block.id}`, {
            method: "POST",
            body: JSON.stringify({ dataUrl })
          });
          block.options = block.options || {};
          block.options.src = uploaded.src;
          setDirty(true);
          renderAuthorPanel();
          renderPreview();
        } catch (error) {
          setStatus(error.message, true);
        }
      });
    }

    blockElement.querySelectorAll("[data-upload-visual-image]").forEach((uploadButton) => {
      uploadButton.addEventListener("click", async () => {
        const dataUrl = await chooseFileAsDataUrl();
        if (!dataUrl) {
          return;
        }

        const rowIndex = Number(uploadButton.dataset.visualRowIndex);
        const itemIndex = Number(uploadButton.dataset.visualItemIndex);
        ensureVisualQuoteBlockState(block);
        const row = block.rows[rowIndex];
        const item = row && row.items ? row.items[itemIndex] : null;
        if (!item || item.kind !== "image") {
          return;
        }

        try {
          const uploaded = await api(`/api/uploads/inline/${state.activeCollection}/${state.activeSlug}/${block.id}-${item.id}`, {
            method: "POST",
            body: JSON.stringify({ dataUrl })
          });
          item.options = item.options || {};
          item.options.src = uploaded.src;
          setDirty(true);
          renderAuthorPanel();
          renderPreview();
        } catch (error) {
          setStatus(error.message, true);
        }
      });
    });

    blockElement.querySelectorAll("[data-upload-quote-strip-image]").forEach((uploadButton) => {
      uploadButton.addEventListener("click", async () => {
        const dataUrl = await chooseFileAsDataUrl();
        if (!dataUrl) {
          return;
        }

        const sideKey = uploadButton.dataset.quoteStripSide === "right" ? "rightImage" : "leftImage";
        ensureQuoteStripBlockState(block);

        try {
          const uploaded = await api(`/api/uploads/inline/${state.activeCollection}/${state.activeSlug}/${block.id}-${sideKey}`, {
            method: "POST",
            body: JSON.stringify({ dataUrl })
          });
          block[sideKey].src = uploaded.src;
          setDirty(true);
          renderAuthorPanel();
          renderPreview();
        } catch (error) {
          setStatus(error.message, true);
        }
      });
    });
  });
}

function createBlock(type) {
  const id = `block-${Math.random().toString(36).slice(2, 8)}`;

  if (type === "paragraph") {
    return {
      id,
      type,
      style: { fontSize: "default", fontFamily: "default", align: "default" },
      text: "",
      preserveBreaks: false
    };
  }

  if (type === "html") {
    return {
      id,
      type,
      style: { fontSize: "default", fontFamily: "default", align: "default" },
      html: ""
    };
  }

  if (type === "visual-quote") {
    return {
      id,
      type,
      style: { fontSize: "default", fontFamily: "default", align: "center" },
      author: "",
      layout: defaultVisualQuoteLayout(),
      rows: [
        defaultVisualQuoteRow([defaultVisualQuoteTextItem("Primera línea")]),
        defaultVisualQuoteRow([defaultVisualQuoteTextItem("Segunda línea"), defaultVisualQuoteImageItem()]),
        defaultVisualQuoteRow([defaultVisualQuoteTextItem("Tercera línea")])
      ]
    };
  }

  if (type === "quote-strip") {
    return {
      id,
      type,
      style: { fontSize: "default", fontFamily: "default", align: "center" },
      author: "",
      paragraphs: [],
      leftImage: defaultQuoteStripImageOptions("izquierdo"),
      rightImage: defaultQuoteStripImageOptions("derecho"),
      layout: defaultQuoteStripLayout()
    };
  }

  if (type === "image") {
    return {
      id,
      type,
      style: { fontSize: "default", fontFamily: "default", align: "default" },
      options: {
        src: "",
        alt: "",
        caption: "",
        height: "",
        fit: "cover",
        padding: "",
        background: "",
        position: "",
        margin: ""
      }
    };
  }

  if (type === "divider") {
    return {
      id,
      type,
      style: { fontSize: "default", fontFamily: "default", align: "default" }
    };
  }

  return {
    id,
    type,
    style: { fontSize: "default", fontFamily: "default", align: "default" },
    author: "",
    paragraphs: []
  };
}

function applyBlockFieldChange(block, field, value) {
  if (field === "type") {
    const replacement = createBlock(value);
    replacement.id = block.id;
    Object.keys(block).forEach((key) => delete block[key]);
    Object.assign(block, replacement);
    setDirty(true);
    renderAuthorPanel();
    renderPreview();
    return;
  }

  if (field === "paragraphs") {
    block.paragraphs = value
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
  } else if (field === "author" && block.type === "visual-quote") {
    block.author = value;
  } else {
    block[field] = value;
  }

  const activeAuthor = getActiveAuthor();
  if (activeAuthor) {
    activeAuthor.document.meta.placeholder = false;
  }

  setDirty(true);
  renderPreview();
}

function moveBlock(blocks, blockId, direction) {
  const index = blocks.findIndex((block) => block.id === blockId);
  if (index === -1) {
    return;
  }

  const targetIndex = direction === "up" ? index - 1 : index + 1;

  if (targetIndex < 0 || targetIndex >= blocks.length) {
    return;
  }

  const [block] = blocks.splice(index, 1);
  blocks.splice(targetIndex, 0, block);
}

function toPreviewAssetPath(path) {
  const value = String(path || "").trim();

  if (!value) {
    return "";
  }

  if (/^(https?:|data:|blob:|\/)/i.test(value)) {
    return value;
  }

  const normalized = value.replace(/\\/g, "/");
  if (normalized.startsWith("../../")) {
    return `/${normalized.slice(6)}`;
  }

  if (normalized.startsWith("../")) {
    return `/${normalized.slice(3)}`;
  }

  if (normalized.startsWith("./")) {
    return `/${normalized.slice(2)}`;
  }

  return `/${normalized.replace(/^\/+/, "")}`;
}

function rewriteRelativeAssetPathsInHtml(html) {
  return String(html || "").replace(
    /\b(src|href)=("([^"]*)"|'([^']*)')/gi,
    (match, attributeName, quotedValue, doubleQuoted, singleQuoted) => {
      const rawValue = typeof doubleQuoted === "string" && doubleQuoted.length
        ? doubleQuoted
        : singleQuoted || "";
      const normalizedValue = toPreviewAssetPath(rawValue);
      const quote = quotedValue.startsWith("'") ? "'" : '"';
      return `${attributeName}=${quote}${normalizedValue}${quote}`;
    }
  );
}

function preparePreviewAuthors(authors) {
  return authors.map((author) => {
    const prepared = clone(author);
    if (!prepared.document || !Array.isArray(prepared.document.blocks)) {
      return prepared;
    }

    prepared.document.blocks = prepared.document.blocks.map((block) => {
      if (block.type === "image" && block.options) {
        return {
          ...block,
          options: {
            ...block.options,
            src: toPreviewAssetPath(block.options.src)
          }
        };
      }

      if (block.type === "visual-quote" && Array.isArray(block.rows)) {
        return {
          ...block,
          rows: block.rows.map((row) => ({
            ...row,
            items: Array.isArray(row.items)
              ? row.items.map((item) => item.kind === "image"
                ? {
                    ...item,
                    options: {
                      ...(item.options || {}),
                      src: toPreviewAssetPath(item.options && item.options.src ? item.options.src : "")
                    }
                  }
                : item)
              : []
          }))
        };
      }

      if (block.type === "quote-strip") {
        return {
          ...block,
          leftImage: {
            ...(block.leftImage || {}),
            src: toPreviewAssetPath(block.leftImage && block.leftImage.src ? block.leftImage.src : "")
          },
          rightImage: {
            ...(block.rightImage || {}),
            src: toPreviewAssetPath(block.rightImage && block.rightImage.src ? block.rightImage.src : "")
          }
        };
      }

      if (block.type === "html") {
        return {
          ...block,
          html: rewriteRelativeAssetPathsInHtml(block.html)
        };
      }

      return block;
    });

    return prepared;
  });
}

function buildPreviewEditorScript() {
  return `
    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function parseCoverPosition(value) {
      const match = String(value || "").trim().match(/^(-?\\d+(?:\\.\\d+)?)%\\s+(-?\\d+(?:\\.\\d+)?)%$/);
      return match ? [Number(match[1]), Number(match[2])] : [50, 50];
    }

    function formatPercent(value) {
      return (Math.round(value * 10) / 10).toFixed(1).replace(/\\.0$/, "");
    }

    function initCoverPreviewEditor() {
      const figure = document.querySelector(".page-media .note-photo-card--cover");
      const image = figure ? figure.querySelector("img") : null;
      if (!figure || !image) {
        return;
      }

      function getCurrentPosition() {
        const inlineValue = figure.style.getPropertyValue("--photo-position").trim();
        return inlineValue || "50% 50%";
      }

      function syncParent() {
        window.parent.postMessage({
          source: "yokaela-preview",
          type: "cover-adjust",
          position: getCurrentPosition()
        }, "*");
      }

      function applyPosition(x, y) {
        const safeX = clamp(x, 0, 100);
        const safeY = clamp(y, 0, 100);
        figure.style.setProperty("--photo-position", formatPercent(safeX) + "% " + formatPercent(safeY) + "%");
        syncParent();
      }

      const dragState = {
        startX: 0,
        startY: 0,
        startPositionX: 50,
        startPositionY: 50,
        isActive: false
      };

      function enableEditor() {
        if (figure.classList.contains("is-cover-adjustable") || figure.classList.contains("is-empty")) {
          return;
        }

        document.body.classList.add("note-preview-editor");
        figure.classList.add("is-cover-adjustable");

        const badge = document.createElement("div");
        badge.className = "cover-editor-badge";
        badge.textContent = "Arrastrá la foto para mover el encuadre.";

        figure.appendChild(badge);

        figure.addEventListener("pointerdown", (event) => {
          startDrag(event);
        });
      }

      function startDrag(event) {
        if (event.button !== 0) {
          return;
        }

        event.preventDefault();
        dragState.isActive = true;
        dragState.startX = event.clientX;
        dragState.startY = event.clientY;
        const [positionX, positionY] = parseCoverPosition(getCurrentPosition());
        dragState.startPositionX = positionX;
        dragState.startPositionY = positionY;
        figure.classList.add("is-dragging");
      }

      window.addEventListener("pointermove", (event) => {
        if (!dragState.isActive) {
          return;
        }

        const width = Math.max(image.getBoundingClientRect().width, 1);
        const height = Math.max(image.getBoundingClientRect().height, 1);
        const deltaX = ((event.clientX - dragState.startX) / width) * 100;
        const deltaY = ((event.clientY - dragState.startY) / height) * 100;
        applyPosition(dragState.startPositionX + deltaX, dragState.startPositionY + deltaY);
      });

      function endDrag() {
        if (!dragState.isActive) {
          return;
        }

        dragState.isActive = false;
        figure.classList.remove("is-dragging");
      }

      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);

      if (image.complete) {
        if (image.naturalWidth > 0) {
          enableEditor();
        }
        return;
      }

      image.addEventListener("load", enableEditor, { once: true });
    }
  `;
}

function buildPreviewDocument() {
  const note = clone(state.activeNote.note);
  const previewScale = getPreviewScale();
  const previewWidth = `${(100 / previewScale).toFixed(4)}%`;
  note.cover = {
    ...(note.cover || {}),
    height: note.cover && note.cover.height ? note.cover.height : "520px",
    src: toPreviewAssetPath(note.cover && note.cover.src ? note.cover.src : "")
  };
  note.music = null;

  const authors = preparePreviewAuthors(getEnabledAuthors().map((author) => ({
    id: author.id,
    file: author.file,
    document: author.document
  })));

  const previewPayload = serializeForInlineScript({ note, authors });

  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="icon" type="image/png" href="/favicon.png">
        <link rel="stylesheet" href="/styles.css">
        <script>window.__NOTE_PAGE_DISABLE_AUTO_INIT__ = true;</script>
        <script src="/note-page.js"></script>
      </head>
      <body class="theme-present-notes">
        <div id="preview-root" style="width: ${previewWidth}; margin: 0 auto; zoom: ${previewScale};">
          <main class="page-shell" id="note-page"></main>
        </div>
        <script>
          ${buildPreviewEditorScript()}
          const payload = ${previewPayload};
          const renderer = window.NotePageRenderer;
          const authors = payload.authors.map((author) =>
            renderer.buildLoadedAuthor({ id: author.id, file: author.file }, author.document)
          );
          renderer.renderNotePage(document.getElementById("note-page"), payload.note, authors);
          initCoverPreviewEditor();
        </script>
      </body>
    </html>
  `;
}

function renderPreview() {
  if (!state.activeNote) {
    return;
  }

  dom.previewFrame.srcdoc = buildPreviewDocument();
}

async function saveActiveNote() {
  if (!state.activeNote || !state.activeSlug) {
    return;
  }

  try {
    const saved = await api(`/api/notes/${state.activeCollection}/${state.activeSlug}`, {
      method: "PUT",
      body: JSON.stringify(state.activeNote)
    });

    state.activeNote = clone(saved);
    setDirty(false);
    setStatus(`${state.activeCollection === "viejas" ? "Archivo" : "Hoja"} ${state.activeSlug} guardada.`);
    await loadBootstrap({ collection: state.activeCollection, slug: state.activeSlug });
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function uploadCoverImage() {
  if (!state.activeSlug) {
    return;
  }

  const dataUrl = await chooseFileAsDataUrl();
  if (!dataUrl) {
    return;
  }

  try {
    const uploaded = await api(`/api/uploads/cover/${state.activeCollection}/${state.activeSlug}`, {
      method: "POST",
      body: JSON.stringify({ dataUrl })
    });
    state.activeNote.note.cover = {
      ...(state.activeNote.note.cover || {}),
      src: uploaded.src,
      enabled: true
    };
    setDirty(true);
    syncCoverMetaFields();
    renderPreview();
    setStatus("Foto central actualizada. Guardá la hoja para dejar todo sincronizado.");
  } catch (error) {
    setStatus(error.message, true);
  }
}

function openCreateDialog() {
  if (getCollectionMeta().canCreate === false) {
    setStatus("Las notas viejas no se crean desde acá: se editan y reconstruyen.", true);
    return;
  }

  dom.createNoteForm.reset();
  dom.createNoteForm.sortDate.value = todayIso();
  fillThemeSelect(dom.createThemeSelect, "theme-present-notes");
  enhanceSelects(dom.createNoteForm);
  dom.createDialog.showModal();
}

function resetCreateDialog() {
  dom.createNoteForm.reset();
  dom.createNoteForm.sortDate.value = todayIso();
  fillThemeSelect(dom.createThemeSelect, "theme-present-notes");
  enhanceSelects(dom.createNoteForm);
}

function closeCreateDialog() {
  dom.createDialog.close("cancel");
}

async function createNoteFromDialog() {
  if (!dom.createNoteForm.reportValidity()) {
    return;
  }

  const formData = new FormData(dom.createNoteForm);
  const authorIds = formData.getAll("authorIds");

  try {
    const created = await api("/api/notes", {
      method: "POST",
      body: JSON.stringify({
        authorIds,
        note: {
          collection: "nuevas",
          titulo: String(formData.get("titulo") || "").trim(),
          descripcion: String(formData.get("descripcion") || "").trim(),
          sortDate: String(formData.get("sortDate") || todayIso()),
          theme: String(formData.get("theme") || "theme-present-notes"),
          cover: {
            alt: String(formData.get("coverAlt") || "").trim()
          }
        }
      })
    });

    dom.createDialog.close();
    state.activeNote = clone(created);
    state.activeCollection = "nuevas";
    state.activeSlug = created.slug;
    state.activeSlugByCollection.nuevas = created.slug;
    state.activeAuthorId = pickActiveAuthorId(state.activeNote.authors, state.activeAuthorId);
    setDirty(false);
    await loadBootstrap({ collection: "nuevas", slug: created.slug });
    setStatus(`Hoja ${created.slug} creada. Ya podés empezar a escribir.`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function chooseFileAsDataUrl() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", () => {
      const file = input.files && input.files[0] ? input.files[0] : null;
      if (!file) {
        resolve("");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });
    input.click();
  });
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function serializeForInlineScript(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

async function init() {
  bindGlobalEvents();
  await loadBootstrap();
}

void init();
