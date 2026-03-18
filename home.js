const grid = document.getElementById("notes-grid");
const searchInput = document.getElementById("search-notes");
const toggles = Array.from(document.querySelectorAll(".summary-toggle"));
const collectionKicker = document.getElementById("collection-kicker");
const collectionTitle = document.getElementById("collection-title");
const collectionDescription = document.getElementById("collection-description");
const notesCount = document.getElementById("notes-count");
const notesHint = document.getElementById("notes-hint");

const defaultCollectionId =
  COLECCIONES_NOTAS.find((collection) => collection.defaultTab)?.id ||
  COLECCIONES_NOTAS[0]?.id ||
  "nuevas";

let activeCollectionId = getCollectionIdFromUrl();
let renderSequence = 0;

const DATE_PATTERN = /\b(\d{2})\/(\d{2})\/(\d{2,4})\b/;
const noteMetaCache = new Map();

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

function getCollection(id) {
  return COLECCIONES_NOTAS.find((collection) => collection.id === id) || COLECCIONES_NOTAS[0];
}

function getCollectionIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");

  return COLECCIONES_NOTAS.some((collection) => collection.id === tab)
    ? tab
    : defaultCollectionId;
}

function updateUrl(id) {
  const url = new URL(window.location.href);

  if (id === defaultCollectionId) {
    url.searchParams.delete("tab");
  } else {
    url.searchParams.set("tab", id);
  }

  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function parseSortDate(rawValue) {
  if (!rawValue) {
    return null;
  }

  const normalizedValue = String(rawValue).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    return normalizedValue;
  }

  const match = normalizedValue.match(DATE_PATTERN);

  if (!match) {
    return null;
  }

  const [, day, month, yearFragment] = match;
  const year = yearFragment.length === 2 ? `20${yearFragment}` : yearFragment;

  return `${year}-${month}-${day}`;
}

function getSortValue(note) {
  const parsedSortDate = parseSortDate(note.sortDate);

  if (parsedSortDate) {
    return `date:${parsedSortDate}`;
  }

  const fallbackNumber = note.orden ?? note.numero ?? 0;
  return `number:${String(fallbackNumber).padStart(6, "0")}`;
}

async function resolveNoteMetadata(note) {
  if (!note?.metaHref) {
    return null;
  }

  if (noteMetaCache.has(note.metaHref)) {
    return noteMetaCache.get(note.metaHref);
  }

  const metadataPromise = fetch(note.metaHref, { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) {
        return null;
      }

      return response.json();
    })
    .catch(() => null);

  noteMetaCache.set(note.metaHref, metadataPromise);
  return metadataPromise;
}

function hydrateNoteFromMetadata(collection, note, metadata) {
  if (!metadata) {
    return;
  }

  note.titulo = metadata.titulo || note.titulo || `${collection.label} ${pad(note.numero)}`;
  note.subtitulo = metadata.subtitulo || note.subtitulo || collection.cardCta || "Abrir nota";
  note.descripcion = metadata.descripcion || note.descripcion || "";
  note.fecha = metadata.fecha || note.fecha || "";
  note.etiqueta = metadata.etiqueta || note.etiqueta || "";

  const resolvedSortDate = parseSortDate(metadata.sortDate || metadata.fecha || note.sortDate);

  if (resolvedSortDate) {
    note.sortDate = resolvedSortDate;
  }
}

async function hydrateCollectionMetadata(collection) {
  await Promise.all(
    collection.notes.map(async (note) => {
      const metadata = await resolveNoteMetadata(note);
      hydrateNoteFromMetadata(collection, note, metadata);
    })
  );
}

function getSortedNotes(collection) {
  const notes = [...collection.notes];
  const direction = collection.order === "desc" ? -1 : 1;

  return notes.sort((left, right) => {
    const leftValue = getSortValue(left);
    const rightValue = getSortValue(right);

    if (leftValue === rightValue) {
      return 0;
    }

    return leftValue > rightValue ? direction : -direction;
  });
}

function matchesQuery(note, query) {
  if (!query) {
    return true;
  }

  const searchableFields = [
    note.numero ? pad(note.numero) : "",
    note.slug || "",
    note.titulo || "",
    note.subtitulo || "",
    note.fecha || "",
    note.etiqueta || "",
    note.descripcion || ""
  ];

  return searchableFields.some((field) =>
    String(field).toLowerCase().includes(query)
  );
}

function buildEmptyState(collection, query) {
  if (!collection.notes.length && !query) {
    return `
      <div class="notes-empty">
        <strong class="notes-empty-title">${escapeHtml(collection.emptyTitle)}</strong>
        <p>${escapeHtml(collection.emptyText)}</p>
      </div>
    `;
  }

  return `
    <div class="notes-empty">
      <strong class="notes-empty-title">No encontré notas con ese criterio</strong>
      <p>Probá con otro número o una parte distinta del título.</p>
    </div>
  `;
}

function buildNoteCard(collection, note) {
  const number = note.displayNumber || (note.numero ? pad(note.numero) : "00");
  const eyebrow = note.etiqueta || `${collection.badge} ${number}`;
  const title = note.titulo || `${collection.label} ${number}`;
  const subtitle = note.subtitulo || collection.cardCta || "Abrir nota";

  return `
    <a class="note-link note-link--${escapeHtml(collection.id)}" href="${escapeHtml(note.href)}">
      <span class="note-number">${escapeHtml(eyebrow)}</span>
      <span class="note-title">${escapeHtml(title)}</span>
      <span class="note-subtitle">${escapeHtml(subtitle)}</span>
    </a>
  `;
}

function renderNotes() {
  const collection = getCollection(activeCollectionId);
  const query = searchInput.value.trim().toLowerCase();
  const visibleNotes = getSortedNotes(collection).filter((note) => matchesQuery(note, query));

  if (!visibleNotes.length) {
    grid.innerHTML = buildEmptyState(collection, query);
    return;
  }

  grid.innerHTML = visibleNotes.map((note) => buildNoteCard(collection, note)).join("");
}

async function renderCollection() {
  const currentSequence = ++renderSequence;
  const collection = getCollection(activeCollectionId);
  const totalNotes = collection.notes.length;

  document.body.dataset.collection = collection.id;
  collectionKicker.textContent = collection.kicker;
  collectionTitle.textContent = collection.titulo;
  collectionDescription.textContent = collection.descripcion;
  notesCount.textContent = `${totalNotes} ${totalNotes === 1 ? "nota" : "notas"}`;
  notesHint.textContent = collection.ayuda;
  searchInput.placeholder = collection.searchPlaceholder;

  toggles.forEach((toggle) => {
    const isActive = toggle.dataset.tab === collection.id;
    toggle.classList.toggle("is-active", isActive);
    toggle.setAttribute("aria-pressed", String(isActive));
  });

  await hydrateCollectionMetadata(collection);

  if (currentSequence !== renderSequence) {
    return;
  }

  renderNotes();
}

toggles.forEach((toggle) => {
  toggle.addEventListener("click", () => {
    if (toggle.dataset.tab === activeCollectionId) {
      return;
    }

    activeCollectionId = toggle.dataset.tab;
    searchInput.value = "";
    updateUrl(activeCollectionId);
    void renderCollection();
  });
});

searchInput.addEventListener("input", () => {
  void renderCollection();
});

void renderCollection();
