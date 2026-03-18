from __future__ import annotations

import base64
import datetime as dt
import io
import json
import re
import shutil
import sys
import uuid
from dataclasses import dataclass, field
from html import escape as escape_html
from html.parser import HTMLParser
from pathlib import Path

from PIL import Image


AUTHOR_PRESETS = {
    "mica": {
        "label": "Mica",
        "default_title": "Tu espacio",
        "default_helper": "Todavía no hay una nota tuya en esta hoja, pero el lugar ya está guardado para vos.",
        "default_placeholder": "Esta hoja queda abierta para cuando quieras escribir.",
        "default_variant": "",
    },
    "leo": {
        "label": "Leo",
        "default_title": "Tu respuesta",
        "default_helper": "Este espacio queda listo para cuando quieras sumar tu nota.",
        "default_placeholder": "Este espacio queda abierto para cuando quieras sumar tu nota.",
        "default_variant": "",
    },
}

FRONTMATTER_ORDER = [
    "label",
    "title",
    "helper",
    "spoiler",
    "variant",
    "placeholder",
    "placeholderBody",
]

BLOCK_TYPES = (
    "paragraph",
    "quote",
    "song",
    "dialogue",
    "hero-quote",
    "visual-quote",
    "quote-strip",
    "image",
    "divider",
    "html",
)

BLOCK_FONT_SIZES = ("default", "sm", "md", "lg", "xl", "hero")
BLOCK_FONT_FAMILIES = ("default", "body", "serif", "display", "script")
BLOCK_ALIGNS = ("default", "left", "center", "right")
NOTE_THEMES = (
    "theme-present-notes",
    "theme-archive-notes",
    "theme-sadness",
    "theme-soft-romance",
    "theme-loneliness",
    "theme-joy",
)


def configure_stdio() -> None:
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if stream and hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")


def detect_root() -> Path:
    candidates = []
    cwd = Path.cwd().resolve()

    if getattr(sys, "frozen", False):
        executable_parent = Path(sys.executable).resolve().parent
        candidates.extend([executable_parent, *executable_parent.parents])

    script_dir = Path(__file__).resolve().parent
    candidates.extend([cwd, *cwd.parents, script_dir, *script_dir.parents])

    seen: set[Path] = set()

    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved in seen:
            continue
        seen.add(resolved)

        if (resolved / "hojas.js").exists() and (resolved / "new-notes").is_dir():
            return resolved

    return Path(__file__).resolve().parents[2]


def detect_tool_home() -> Path:
    if getattr(sys, "frozen", False):
        executable_parent = Path(sys.executable).resolve().parent
        if executable_parent.name == "dist":
            return executable_parent.parent
        return executable_parent

    return Path(__file__).resolve().parent


ROOT = detect_root()
TOOL_HOME = detect_tool_home()
UI_DIR = TOOL_HOME / "ui"
NEW_NOTES_DIR = ROOT / "new-notes"
OLD_NOTES_DIR = ROOT / "old-notes"
NEW_IMAGE_DIR = ROOT / "assets" / "img" / "new-notes"
OLD_IMAGE_DIR = ROOT / "assets" / "img" / "old-notes"
DATA_FILE = ROOT / "hojas.js"
FAVICON_FILE = ROOT / "favicon.png"

INDEX_TEMPLATE = """<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cargando nota...</title>
  <link rel="icon" type="image/png" href="../../favicon.png">
  <link rel="stylesheet" href="../../styles.css">
</head>
<body class="theme-present-notes">
  <main class="page-shell" id="note-page">
    <section class="page-state">
      <strong>Cargando nota...</strong>
      <p>Estoy armando esta hoja.</p>
    </section>
  </main>
  <script src="../../note-page.js"></script>
</body>
</html>
"""

LEGACY_INDEX_FILE_NAME = "legacy-index.html"
VOID_HTML_TAGS = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
}
BLOCK_LEVEL_TAGS = {
    "article",
    "blockquote",
    "div",
    "figure",
    "figcaption",
    "header",
    "hr",
    "li",
    "ol",
    "p",
    "section",
    "ul",
}
COLLECTION_CONFIGS = {
    "nuevas": {
        "notes_dir": NEW_NOTES_DIR,
        "image_dir": NEW_IMAGE_DIR,
        "cover_template": "../../assets/img/new-notes/{slug}.jpeg",
        "default_theme": "theme-present-notes",
        "default_subtitle": "Abrir nota actual",
        "default_cover_alt": "Recuerdo de la hoja nueva {slug}",
        "default_footer": "Hecho con amor, nota por nota.",
        "page_label": "Hoja nueva",
    },
    "viejas": {
        "notes_dir": OLD_NOTES_DIR,
        "image_dir": OLD_IMAGE_DIR,
        "cover_template": "../../assets/img/old-notes/{slug}.jpeg",
        "default_theme": "theme-archive-notes",
        "default_subtitle": "Abrir hoja del archivo",
        "default_cover_alt": "Recuerdo de la hoja {slug}",
        "default_footer": "Hecho con amor, hoja por hoja.",
        "page_label": "Hoja",
    },
}


@dataclass
class LegacyHtmlNode:
    tag: str
    attrs: dict[str, str] = field(default_factory=dict)
    children: list["LegacyHtmlNode"] = field(default_factory=list)
    text: str = ""

    @property
    def is_text(self) -> bool:
        return self.tag == "#text"

    @property
    def is_comment(self) -> bool:
        return self.tag == "#comment"


class LegacyHtmlTreeParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root = LegacyHtmlNode("#document")
        self.stack: list[LegacyHtmlNode] = [self.root]

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        node = LegacyHtmlNode(
            tag=tag.lower(),
            attrs={str(key).lower(): str(value or "") for key, value in attrs},
        )
        self.stack[-1].children.append(node)
        if node.tag not in VOID_HTML_TAGS:
            self.stack.append(node)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        node = LegacyHtmlNode(
            tag=tag.lower(),
            attrs={str(key).lower(): str(value or "") for key, value in attrs},
        )
        self.stack[-1].children.append(node)

    def handle_endtag(self, tag: str) -> None:
        normalized_tag = tag.lower()
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == normalized_tag:
                del self.stack[index:]
                break

    def handle_data(self, data: str) -> None:
        if data:
            self.stack[-1].children.append(LegacyHtmlNode("#text", text=data))

    def handle_comment(self, data: str) -> None:
        self.stack[-1].children.append(LegacyHtmlNode("#comment", text=data))


def normalize_collection_id(raw_collection: object) -> str:
    return "viejas" if str(raw_collection or "").strip().lower() == "viejas" else "nuevas"


def collection_config(collection: object) -> dict[str, object]:
    return COLLECTION_CONFIGS[normalize_collection_id(collection)]


def notes_dir_for(collection: object) -> Path:
    return Path(collection_config(collection)["notes_dir"])


def image_dir_for(collection: object) -> Path:
    return Path(collection_config(collection)["image_dir"])


def cover_src_for(collection: object, slug: str) -> str:
    return str(collection_config(collection)["cover_template"]).format(slug=slug)


def asset_src_for(collection: object, file_name: str) -> str:
    normalized_collection = normalize_collection_id(collection)
    folder = "new-notes" if normalized_collection == "nuevas" else "old-notes"
    return f"../../assets/img/{folder}/{file_name}"


def default_cover_alt(collection: object, slug: str) -> str:
    return str(collection_config(collection)["default_cover_alt"]).format(slug=slug)


def default_theme_for(collection: object) -> str:
    return str(collection_config(collection)["default_theme"])


def default_subtitle_for(collection: object) -> str:
    return str(collection_config(collection)["default_subtitle"])


def default_footer_for(collection: object) -> str:
    return str(collection_config(collection)["default_footer"])


def parse_style_attribute(raw_style: str) -> dict[str, str]:
    style_map: dict[str, str] = {}
    for chunk in str(raw_style or "").split(";"):
        if ":" not in chunk:
            continue
        key, value = chunk.split(":", 1)
        normalized_key = key.strip().lower()
        normalized_value = value.strip()
        if normalized_key and normalized_value:
            style_map[normalized_key] = normalized_value
    return style_map


def node_classes(node: LegacyHtmlNode) -> set[str]:
    return {token for token in node.attrs.get("class", "").split() if token}


def has_class(node: LegacyHtmlNode, class_name: str) -> bool:
    return class_name in node_classes(node)


def meaningfully_has_children(node: LegacyHtmlNode) -> bool:
    return any(not child.is_comment and (not child.is_text or child.text.strip()) for child in node.children)


def direct_children(node: LegacyHtmlNode) -> list[LegacyHtmlNode]:
    return [child for child in node.children if not child.is_comment and (not child.is_text or child.text.strip())]


def walk_nodes(node: LegacyHtmlNode) -> list[LegacyHtmlNode]:
    nodes = [node]
    for child in node.children:
        nodes.extend(walk_nodes(child))
    return nodes


def find_first(node: LegacyHtmlNode, predicate) -> LegacyHtmlNode | None:
    for candidate in walk_nodes(node):
        if predicate(candidate):
            return candidate
    return None


def find_all(node: LegacyHtmlNode, predicate) -> list[LegacyHtmlNode]:
    return [candidate for candidate in walk_nodes(node) if predicate(candidate)]


def serialize_legacy_node(node: LegacyHtmlNode) -> str:
    if node.is_text:
        return escape_html(node.text)

    if node.is_comment:
        return f"<!--{node.text}-->"

    attrs = []
    for key, value in node.attrs.items():
        if value == "":
            attrs.append(f" {key}")
        else:
            attrs.append(f' {key}="{escape_html(value)}"')
    attrs_text = "".join(attrs)

    if node.tag in VOID_HTML_TAGS:
        return f"<{node.tag}{attrs_text}>"

    children_html = "".join(serialize_legacy_node(child) for child in node.children)
    return f"<{node.tag}{attrs_text}>{children_html}</{node.tag}>"


def inner_html(node: LegacyHtmlNode) -> str:
    return "".join(serialize_legacy_node(child) for child in node.children)


def plain_text(node: LegacyHtmlNode) -> str:
    if node.is_text:
        return node.text

    if node.tag == "br":
        return "\n"

    text_parts: list[str] = []
    for child in node.children:
        text_parts.append(plain_text(child))

    return "".join(text_parts)


def normalize_inline_text(raw_text: str, *, preserve_breaks: bool = False) -> str:
    text = str(raw_text or "").replace("\xa0", " ")
    if preserve_breaks:
        lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.split("\n")]
        while lines and not lines[0]:
            lines.pop(0)
        while lines and not lines[-1]:
            lines.pop()
        return "\n".join(lines)
    return re.sub(r"\s+", " ", text).strip()


def normalize_signature_text(raw_text: object) -> str:
    text = str(raw_text or "").strip()
    if not text:
        return ""
    return re.sub(r"\s+-\s+", " — ", text)


def contains_tag(node: LegacyHtmlNode, tag_name: str) -> bool:
    return any(candidate.tag == tag_name for candidate in walk_nodes(node))


def has_complex_inline_markup(node: LegacyHtmlNode) -> bool:
    allowed_tags = {"#text", "br", "em", "strong", "span", "i", "b", "u", "small", "sup", "sub"}
    return any(candidate.tag not in allowed_tags for candidate in walk_nodes(node))


def parse_legacy_document(raw_html: str) -> LegacyHtmlNode:
    parser = LegacyHtmlTreeParser()
    parser.feed(raw_html)
    parser.close()
    return parser.root


def find_direct_child(node: LegacyHtmlNode, predicate) -> LegacyHtmlNode | None:
    for child in direct_children(node):
        if predicate(child):
            return child
    return None


def pad(number: int) -> str:
    return f"{number:02d}"


def next_note_number() -> int:
    max_number = 0

    for directory in NEW_NOTES_DIR.iterdir():
        if directory.is_dir() and re.fullmatch(r"\d{2}", directory.name):
            max_number = max(max_number, int(directory.name))

    return max_number + 1


def author_sort_key(author_id: str) -> int:
    order = {"mica": 0, "leo": 1}
    return order.get(author_id, 99)


def new_author_filename(author_id: str) -> str:
    return f"{author_id}.note.json"


def ensure_author_entry(note_data: dict[str, object], author_id: str) -> dict[str, object]:
    authors = note_data.setdefault("authors", [])
    assert isinstance(authors, list)

    for author in authors:
        if author.get("id") == author_id:
            if not author.get("file"):
                author["file"] = new_author_filename(author_id)
            return author

    new_entry = {"id": author_id, "file": new_author_filename(author_id)}
    authors.append(new_entry)
    authors.sort(key=lambda item: author_sort_key(str(item.get("id", ""))))

    if len(authors) > 1 and note_data.get("layout") == "single":
        note_data.pop("layout", None)

    if len(authors) == 1:
        note_data["layout"] = "single"

    return new_entry


def parse_frontmatter(raw_content: str) -> tuple[dict[str, object], str]:
    normalized = raw_content.replace("\r\n", "\n")

    if not normalized.startswith("---\n"):
        return {}, normalized.strip()

    end_index = normalized.find("\n---\n", 4)
    if end_index == -1:
        return {}, normalized.strip()

    frontmatter = normalized[4:end_index]
    body = normalized[end_index + 5 :].strip()
    meta: dict[str, object] = {}

    for line in frontmatter.split("\n"):
        trimmed = line.strip()
        if not trimmed or trimmed.startswith("#") or ":" not in trimmed:
            continue
        key, value = trimmed.split(":", 1)
        meta[key.strip()] = coerce_frontmatter_value(value)

    return meta, body


def serialize_frontmatter(meta: dict[str, object]) -> str:
    lines = ["---"]
    remaining_keys = [key for key in meta if key not in FRONTMATTER_ORDER]
    ordered_keys = [key for key in FRONTMATTER_ORDER if key in meta] + sorted(remaining_keys)

    for key in ordered_keys:
        value = meta[key]
        if value in ("", None, False):
            continue
        if isinstance(value, bool):
            value_text = "true" if value else "false"
        else:
            value_text = str(value)
        lines.append(f"{key}: {value_text}")

    lines.append("---")
    return "\n".join(lines)


def coerce_frontmatter_value(raw_value: str) -> object:
    value = raw_value.strip()

    if value == "true":
        return True
    if value == "false":
        return False
    if value == "null":
        return None
    if re.fullmatch(r"-?\d+", value):
        return int(value)
    if re.fullmatch(r"-?\d+\.\d+", value):
        return float(value)
    return value


def coerce_directive_value(raw_value: str) -> object:
    value = raw_value.strip()
    if value.lower() == "true":
        return True
    if value.lower() == "false":
        return False
    if value.lower() == "null":
        return None
    if re.fullmatch(r"-?\d+", value):
        return int(value)
    if re.fullmatch(r"-?\d+\.\d+", value):
        return float(value)
    if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
        return value[1:-1]
    return value


def parse_directive_options(lines: list[str]) -> dict[str, object]:
    options: dict[str, object] = {}
    for line in lines:
        trimmed = line.strip()
        if not trimmed:
            continue
        match = re.match(r"^([A-Za-z][\w-]*)\s*(=|:)\s*(.+)$", trimmed)
        if not match:
            continue
        key, _separator, value = match.groups()
        options[key] = coerce_directive_value(value)
    return options


def extract_quote_author(lines: list[str]) -> tuple[list[str], str]:
    content_lines = list(lines)
    while content_lines and not content_lines[-1].strip():
        content_lines.pop()

    last_line = content_lines[-1].strip() if content_lines else ""

    if not re.match(r"^[-—]\s+", last_line):
        return content_lines, ""

    content_lines.pop()
    return content_lines, re.sub(r"^[-—]\s+", "", last_line).strip()


def lines_to_paragraphs(lines: list[str]) -> list[str]:
    paragraphs: list[str] = []
    current: list[str] = []

    for line in lines:
        if not line.strip():
            if current:
                paragraphs.append("\n".join(current).strip())
                current = []
            continue
        current.append(line)

    if current:
        paragraphs.append("\n".join(current).strip())

    return paragraphs


def normalize_flags(raw_flags: object, block_type: str = "") -> list[str]:
    flags: list[str] = []
    if isinstance(raw_flags, (list, tuple, set)):
        flags = [str(flag).strip().lower() for flag in raw_flags if str(flag).strip()]
    elif raw_flags:
        flags = [str(raw_flags).strip().lower()]

    if block_type == "hero-quote":
        for default_flag in ("hero", "center"):
            if default_flag not in flags:
                flags.append(default_flag)

    deduped: list[str] = []
    seen: set[str] = set()
    for flag in flags:
        if flag not in seen:
            deduped.append(flag)
            seen.add(flag)
    return deduped


def normalize_paragraphs(raw_value: object) -> list[str]:
    if isinstance(raw_value, list):
        return [str(item).strip() for item in raw_value if str(item).strip()]
    if isinstance(raw_value, str) and raw_value.strip():
        return [part.strip() for part in raw_value.split("\n\n") if part.strip()]
    return []


def normalize_style(raw_style: object) -> dict[str, str]:
    style = raw_style if isinstance(raw_style, dict) else {}

    font_size = str(style.get("fontSize", "default")).strip().lower() or "default"
    if font_size not in BLOCK_FONT_SIZES:
        font_size = "default"

    font_family = str(style.get("fontFamily", "default")).strip().lower() or "default"
    if font_family not in BLOCK_FONT_FAMILIES:
        font_family = "default"

    align = str(style.get("align", "default")).strip().lower() or "default"
    if align not in BLOCK_ALIGNS:
        align = "default"

    return {
        "fontSize": font_size,
        "fontFamily": font_family,
        "align": align,
    }


def normalize_image_options(raw_options: object) -> dict[str, object]:
    options = raw_options if isinstance(raw_options, dict) else {}
    return {
        "src": str(options.get("src", "")).strip(),
        "alt": str(options.get("alt", "")).strip(),
        "caption": str(options.get("caption", "")).strip(),
        "height": str(options.get("height", "")).strip(),
        "fit": str(options.get("fit", "cover")).strip() or "cover",
        "padding": str(options.get("padding", "")).strip(),
        "background": str(options.get("background", "")).strip(),
        "position": str(options.get("position", "")).strip(),
        "margin": str(options.get("margin", "")).strip(),
    }


def normalize_visual_quote_image_options(raw_options: object) -> dict[str, object]:
    options = raw_options if isinstance(raw_options, dict) else {}
    fit = str(options.get("fit", "cover")).strip().lower() or "cover"
    if fit not in {"cover", "contain"}:
        fit = "cover"

    return {
        "src": str(options.get("src", "")).strip(),
        "alt": str(options.get("alt", "")).strip(),
        "width": str(options.get("width", "")).strip(),
        "height": str(options.get("height", "")).strip(),
        "fit": fit,
        "padding": str(options.get("padding", "")).strip(),
        "background": str(options.get("background", "")).strip(),
        "position": str(options.get("position", "")).strip(),
        "radius": str(options.get("radius", "")).strip(),
        "border": str(options.get("border", "")).strip(),
    }


def build_visual_quote_item(item_kind: str, **overrides: object) -> dict[str, object]:
    normalized_kind = "image" if str(item_kind).strip().lower() == "image" else "text"
    item: dict[str, object] = {
        "id": str(overrides.pop("id", f"item-{uuid.uuid4().hex[:8]}")).strip() or f"item-{uuid.uuid4().hex[:8]}",
        "kind": normalized_kind,
    }

    if normalized_kind == "image":
        item["options"] = normalize_visual_quote_image_options(overrides.pop("options", {}))
    else:
        item["text"] = str(overrides.pop("text", "")).strip()

    for key, value in overrides.items():
        item[key] = value

    return item


def normalize_visual_quote_items(raw_items: object) -> list[dict[str, object]]:
    items = raw_items if isinstance(raw_items, list) else []
    normalized_items: list[dict[str, object]] = []

    for raw_item in items:
        item = raw_item if isinstance(raw_item, dict) else {}
        item_kind = str(item.get("kind") or item.get("type") or "text").strip().lower()
        if item_kind == "image":
            normalized_items.append(
                build_visual_quote_item(
                    "image",
                    id=str(item.get("id") or f"item-{uuid.uuid4().hex[:8]}"),
                    options=item.get("options", item),
                )
            )
            continue

        text = str(item.get("text") or "").strip()
        if text:
            if normalized_items and normalized_items[-1].get("kind") == "text":
                normalized_items[-1]["text"] = f"{normalized_items[-1]['text']} {text}".strip()
            else:
                normalized_items.append(
                    build_visual_quote_item(
                        "text",
                        id=str(item.get("id") or f"item-{uuid.uuid4().hex[:8]}"),
                        text=text,
                    )
                )

    return normalized_items


def normalize_visual_quote_rows(raw_rows: object) -> list[dict[str, object]]:
    rows = raw_rows if isinstance(raw_rows, list) else []
    normalized_rows: list[dict[str, object]] = []

    for raw_row in rows:
        row = raw_row if isinstance(raw_row, dict) else {}
        items = normalize_visual_quote_items(row.get("items", []))
        if not items:
            continue
        normalized_rows.append(
            {
                "id": str(row.get("id") or f"row-{uuid.uuid4().hex[:8]}").strip() or f"row-{uuid.uuid4().hex[:8]}",
                "items": items,
            }
        )

    return normalized_rows


def normalize_visual_quote_layout(raw_layout: object) -> dict[str, str]:
    layout = raw_layout if isinstance(raw_layout, dict) else {}
    text_transform = str(layout.get("textTransform", "")).strip().lower()
    if text_transform not in {"", "none", "uppercase"}:
        text_transform = ""

    return {
        "maxWidth": str(layout.get("maxWidth", "")).strip(),
        "minHeight": str(layout.get("minHeight", "")).strip(),
        "padding": str(layout.get("padding", "")).strip(),
        "margin": str(layout.get("margin", "")).strip(),
        "lineHeight": str(layout.get("lineHeight", "")).strip(),
        "letterSpacing": str(layout.get("letterSpacing", "")).strip(),
        "textTransform": text_transform,
        "fontSize": str(layout.get("fontSize", "")).strip(),
        "authorSize": str(layout.get("authorSize", "")).strip(),
        "rowGap": str(layout.get("rowGap", "")).strip(),
    }


def normalize_quote_strip_layout(raw_layout: object) -> dict[str, str]:
    layout = raw_layout if isinstance(raw_layout, dict) else {}
    return {
        "margin": str(layout.get("margin", "")).strip(),
        "gap": str(layout.get("gap", "")).strip(),
        "sideWidth": str(layout.get("sideWidth", "")).strip(),
        "minHeight": str(layout.get("minHeight", "")).strip(),
        "quoteMaxWidth": str(layout.get("quoteMaxWidth", "")).strip(),
        "quotePadding": str(layout.get("quotePadding", "")).strip(),
    }


def build_block(block_type: str, **overrides: object) -> dict[str, object]:
    normalized_type = block_type if block_type in BLOCK_TYPES else "paragraph"
    block: dict[str, object] = {
        "id": overrides.pop("id", f"block-{uuid.uuid4().hex[:8]}"),
        "type": normalized_type,
        "style": normalize_style(overrides.pop("style", {})),
    }

    if normalized_type == "paragraph":
        block["text"] = str(overrides.pop("text", ""))
        block["preserveBreaks"] = overrides.pop("preserveBreaks", False) is True
    elif normalized_type == "html":
        block["html"] = str(overrides.pop("html", ""))
    elif normalized_type == "visual-quote":
        block["rows"] = normalize_visual_quote_rows(overrides.pop("rows", []))
        block["author"] = str(overrides.pop("author", "")).strip()
        block["layout"] = normalize_visual_quote_layout(overrides.pop("layout", {}))
    elif normalized_type == "quote-strip":
        block["paragraphs"] = [
            re.sub(r"\n\s*\n+", "\n", paragraph).strip()
            for paragraph in normalize_paragraphs(overrides.pop("paragraphs", []))
            if re.sub(r"\n\s*\n+", "\n", paragraph).strip()
        ]
        block["author"] = str(overrides.pop("author", "")).strip()
        block["leftImage"] = normalize_visual_quote_image_options(overrides.pop("leftImage", {}))
        block["rightImage"] = normalize_visual_quote_image_options(overrides.pop("rightImage", {}))
        block["layout"] = normalize_quote_strip_layout(overrides.pop("layout", {}))
    elif normalized_type == "image":
        block["options"] = normalize_image_options(overrides.pop("options", {}))
    elif normalized_type == "divider":
        pass
    else:
        block["paragraphs"] = normalize_paragraphs(overrides.pop("paragraphs", []))
        block["author"] = str(overrides.pop("author", "")).strip()
        block["flags"] = normalize_flags(overrides.pop("flags", []), normalized_type)

    for key, value in overrides.items():
        block[key] = value

    return block


def build_directive_block(directive: dict[str, object]) -> dict[str, object]:
    block_type = str(directive.get("type", "quote")).strip().lower()
    flags = directive.get("flags", [])
    lines = directive.get("lines", [])
    assert isinstance(lines, list)

    if block_type == "image":
        return build_block("image", options=parse_directive_options(lines))

    if block_type == "divider":
        return build_block("divider")

    if block_type in {"hero-quote", "hero_quote"}:
        block_type = "hero-quote"

    content_lines, author = extract_quote_author(lines)
    paragraphs = lines_to_paragraphs(content_lines)
    return build_block(block_type, paragraphs=paragraphs, author=author, flags=flags)


def parse_legacy_blocks(raw_body: str) -> list[dict[str, object]]:
    normalized = raw_body.replace("\r\n", "\n").strip()
    if not normalized:
        return []

    lines = normalized.split("\n")
    blocks: list[dict[str, object]] = []
    paragraph_lines: list[str] = []
    directive: dict[str, object] | None = None

    def flush_paragraph() -> None:
        nonlocal paragraph_lines
        text = " ".join(line.strip() for line in paragraph_lines).strip()
        if text:
            blocks.append(build_block("paragraph", text=text))
        paragraph_lines = []

    for line in lines:
        trimmed = line.strip()

        if directive is not None:
            if trimmed == ":::":
                blocks.append(build_directive_block(directive))
                directive = None
            else:
                directive["lines"].append(line)
            continue

        if trimmed.startswith(":::"):
            flush_paragraph()
            tokens = [token for token in trimmed[3:].strip().split() if token]
            block_type = (tokens[0] if tokens else "quote").lower()
            flags = [token.lower() for token in tokens[1:]]
            directive = {"type": block_type, "flags": flags, "lines": []}
            continue

        if trimmed == "---":
            flush_paragraph()
            blocks.append(build_block("divider"))
            continue

        if not trimmed:
            flush_paragraph()
            continue

        paragraph_lines.append(line)

    if directive is not None:
        blocks.append(build_directive_block(directive))

    flush_paragraph()
    return blocks


def default_author_document(author_id: str) -> dict[str, object]:
    preset = AUTHOR_PRESETS[author_id]
    return {
        "meta": {
            "label": preset["label"],
            "title": preset["default_title"],
            "helper": preset["default_helper"],
            "spoiler": False,
            "variant": preset["default_variant"],
            "placeholder": False,
            "placeholderBody": preset["default_placeholder"],
        },
        "blocks": [],
    }


def normalize_author_document(author_id: str, raw_document: object) -> dict[str, object]:
    preset = AUTHOR_PRESETS[author_id]
    document = raw_document if isinstance(raw_document, dict) else {}
    raw_meta = document.get("meta", {})
    raw_blocks = document.get("blocks", [])

    meta = raw_meta if isinstance(raw_meta, dict) else {}
    blocks = raw_blocks if isinstance(raw_blocks, list) else []

    def normalize_meta_string(field: str, fallback: str = "") -> str:
        if field not in meta:
            return fallback
        value = meta.get(field)
        if value is None:
            return ""
        return str(value).strip()

    normalized_meta: dict[str, object] = {
        "label": str(meta.get("label") or preset["label"]).strip() or preset["label"],
        "title": normalize_meta_string("title", preset["default_title"]),
        "helper": str(meta.get("helper") or "").strip(),
        "spoiler": bool(meta.get("spoiler", False)),
        "variant": str(meta.get("variant") or "").strip(),
        "placeholder": bool(meta.get("placeholder", False)),
        "placeholderBody": normalize_meta_string("placeholderBody", preset["default_placeholder"]),
    }

    normalized_blocks = compact_author_blocks([normalize_block(block) for block in blocks])

    return {
        "meta": normalized_meta,
        "blocks": normalized_blocks,
    }


def normalize_block(raw_block: object) -> dict[str, object]:
    block = raw_block if isinstance(raw_block, dict) else {}
    block_type = str(block.get("type") or "paragraph").strip().lower()

    if block_type == "hero_quote":
        block_type = "hero-quote"

    if block_type not in BLOCK_TYPES:
        block_type = "paragraph"

    if block_type == "paragraph":
        return build_block(
            "paragraph",
            id=str(block.get("id") or f"block-{uuid.uuid4().hex[:8]}"),
            text=str(block.get("text") or "").strip(),
            preserveBreaks=block.get("preserveBreaks", False) is True,
            style=block.get("style", {}),
        )

    if block_type == "visual-quote":
        return build_block(
            "visual-quote",
            id=str(block.get("id") or f"block-{uuid.uuid4().hex[:8]}"),
            rows=block.get("rows", []),
            author=normalize_signature_text(block.get("author")),
            layout=block.get("layout", {}),
            style=block.get("style", {}),
        )

    if block_type == "quote-strip":
        return build_block(
            "quote-strip",
            id=str(block.get("id") or f"block-{uuid.uuid4().hex[:8]}"),
            paragraphs=block.get("paragraphs", []),
            author=normalize_signature_text(block.get("author")),
            leftImage=block.get("leftImage", {}),
            rightImage=block.get("rightImage", {}),
            layout=block.get("layout", {}),
            style=block.get("style", {}),
        )

    if block_type == "html":
        converted_html_block = convert_html_block_to_structured_block(block)
        if converted_html_block is not None:
            return converted_html_block
        return build_block(
            "html",
            id=str(block.get("id") or f"block-{uuid.uuid4().hex[:8]}"),
            html=str(block.get("html") or ""),
            style=block.get("style", {}),
        )

    if block_type == "image":
        return build_block(
            "image",
            id=str(block.get("id") or f"block-{uuid.uuid4().hex[:8]}"),
            options=block.get("options", {}),
            style=block.get("style", {}),
        )

    if block_type == "divider":
        return build_block(
            "divider",
            id=str(block.get("id") or f"block-{uuid.uuid4().hex[:8]}"),
            style=block.get("style", {}),
        )

    return build_block(
        block_type,
        id=str(block.get("id") or f"block-{uuid.uuid4().hex[:8]}"),
        paragraphs=block.get("paragraphs", []),
        author=normalize_signature_text(block.get("author")),
        flags=block.get("flags", []),
        style=block.get("style", {}),
    )


def compact_author_blocks(blocks: list[dict[str, object]]) -> list[dict[str, object]]:
    compacted: list[dict[str, object]] = []
    for block in blocks:
        if (
            compacted
            and block.get("type") == "paragraph"
            and compacted[-1].get("type") == "paragraph"
            and block.get("style") == compacted[-1].get("style")
        ):
            left_text = str(compacted[-1].get("text") or "").strip()
            right_text = str(block.get("text") or "").strip()
            if right_text:
                compacted[-1]["text"] = f"{left_text}\n\n{right_text}".strip()
            compacted[-1]["preserveBreaks"] = (
                compacted[-1].get("preserveBreaks", False) is True or block.get("preserveBreaks", False) is True
            )
            continue
        compacted.append(block)
    return compacted


def load_author_document(note_dir: Path, author_config: dict[str, object]) -> dict[str, object]:
    author_id = str(author_config.get("id") or "leo")
    file_name = str(author_config.get("file") or new_author_filename(author_id))
    author_path = note_dir / file_name

    if author_path.exists() and author_path.suffix == ".json":
        raw_document = json.loads(author_path.read_text(encoding="utf-8"))
        return normalize_author_document(author_id, raw_document)

    if author_path.exists():
        meta, body = parse_frontmatter(author_path.read_text(encoding="utf-8"))
        return normalize_author_document(author_id, {"meta": meta, "blocks": parse_legacy_blocks(body)})

    return normalize_author_document(author_id, default_author_document(author_id))


def save_author_document(note_dir: Path, note_data: dict[str, object], author_id: str, document: dict[str, object]) -> str:
    normalized_document = normalize_author_document(author_id, document)
    author_entry = ensure_author_entry(note_data, author_id)
    file_name = str(author_entry.get("file") or new_author_filename(author_id))

    if not file_name.endswith(".json"):
        file_name = new_author_filename(author_id)
        author_entry["file"] = file_name

    target = note_dir / file_name
    target.write_text(json.dumps(normalized_document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return file_name


def infer_font_size(value: str) -> str:
    raw_value = str(value or "").strip().lower()
    if not raw_value:
        return "default"
    if "clamp(" in raw_value:
        return "hero"
    if raw_value == "larger":
        return "lg"

    match = re.search(r"-?\d+(?:\.\d+)?", raw_value)
    if not match:
        return "default"

    number = float(match.group(0))
    if "px" in raw_value:
        number = number / 16

    if number >= 2:
        return "hero"
    if number >= 1.55:
        return "xl"
    if number >= 1.3:
        return "lg"
    if number >= 1.05:
        return "md"
    if number < 0.95:
        return "sm"
    return "default"


def infer_font_family(value: str) -> str:
    raw_value = str(value or "").strip().lower()
    if not raw_value:
        return "default"
    if any(token in raw_value for token in ("georgia", "times", "serif")):
        return "serif"
    if any(token in raw_value for token in ("cursive", "script", "hand")):
        return "script"
    if any(token in raw_value for token in ("display", "decorative", "playfair")):
        return "display"
    return "default"


def infer_align(value: str) -> str:
    raw_value = str(value or "").strip().lower()
    if raw_value in {"left", "center", "right"}:
        return raw_value
    return "default"


def style_from_style_map(style_map: dict[str, str]) -> dict[str, str]:
    return normalize_style(
        {
            "fontSize": infer_font_size(style_map.get("font-size", "")),
            "fontFamily": infer_font_family(style_map.get("font-family", "")),
            "align": infer_align(style_map.get("text-align", "")),
        }
    )


def build_html_block_from_node(node: LegacyHtmlNode) -> dict[str, object]:
    return build_block("html", html=serialize_legacy_node(node))


def build_html_block_from_wrapped_content(node: LegacyHtmlNode) -> dict[str, object]:
    attrs = dict(node.attrs)
    class_tokens = [token for token in attrs.get("class", "").split() if token and token != "note-content"]
    if class_tokens:
        attrs["class"] = " ".join(class_tokens)
    else:
        attrs.pop("class", None)

    wrapper = LegacyHtmlNode(tag="div", attrs=attrs, children=node.children)
    return build_block("html", html=serialize_legacy_node(wrapper))


def first_fragment_node(raw_html: str) -> LegacyHtmlNode | None:
    fragment_root = parse_legacy_document(raw_html)
    for child in direct_children(fragment_root):
        if child.tag not in {"#text", "#comment"}:
            return child
    return None


def node_is_visual_quote_image_wrapper(node: LegacyHtmlNode) -> bool:
    if node.tag not in {"span", "figure", "div"}:
        return False
    meaningful = direct_children(node)
    return bool(meaningful) and any(child.tag == "img" for child in meaningful)


def visual_quote_image_item_from_node(node: LegacyHtmlNode) -> dict[str, object] | None:
    image_node = node if node.tag == "img" else find_first(node, lambda candidate: candidate.tag == "img")
    if image_node is None:
        return None

    wrapper_style = {} if node.tag == "img" else parse_style_attribute(node.attrs.get("style", ""))
    image_style = parse_style_attribute(image_node.attrs.get("style", ""))

    return build_visual_quote_item(
        "image",
        options={
            "src": str(image_node.attrs.get("src", "")).strip(),
            "alt": str(image_node.attrs.get("alt", "")).strip(),
            "width": str(wrapper_style.get("width", image_node.attrs.get("width", ""))).strip(),
            "height": str(wrapper_style.get("height", image_node.attrs.get("height", ""))).strip(),
            "fit": "contain" if image_style.get("object-fit", "").strip().lower() == "contain" else "cover",
            "padding": str(wrapper_style.get("padding", "")).strip(),
            "background": str(wrapper_style.get("background", "")).strip(),
            "position": str(image_style.get("object-position", "")).strip(),
            "radius": str(wrapper_style.get("border-radius", "")).strip(),
            "border": str(wrapper_style.get("border", "")).strip(),
        },
    )


def extract_visual_quote_rows_from_inline_node(node: LegacyHtmlNode) -> list[dict[str, object]] | None:
    rows: list[list[dict[str, object]]] = [[]]
    inline_tags = {"span", "em", "strong", "i", "b", "u", "small", "sup", "sub"}

    def current_row() -> list[dict[str, object]]:
        return rows[-1]

    def append_text(raw_text: str) -> None:
        text = normalize_inline_text(raw_text)
        if not text:
            return
        if current_row() and current_row()[-1].get("kind") == "text":
            current_row()[-1]["text"] = f"{current_row()[-1]['text']} {text}".strip()
            return
        current_row().append(build_visual_quote_item("text", text=text))

    def append_row_break() -> None:
        if not current_row():
            return
        rows.append([])

    def visit(current_node: LegacyHtmlNode) -> bool:
        for child in current_node.children:
            if child.is_comment:
                continue
            if child.is_text:
                append_text(child.text)
                continue
            if child.tag == "br":
                append_row_break()
                continue
            if child.tag == "img":
                image_item = visual_quote_image_item_from_node(child)
                if image_item is None:
                    return False
                current_row().append(image_item)
                continue
            if child.tag in inline_tags:
                if node_is_visual_quote_image_wrapper(child):
                    image_item = visual_quote_image_item_from_node(child)
                    if image_item is None:
                        return False
                    current_row().append(image_item)
                    continue
                if not visit(child):
                    return False
                continue
            return False
        return True

    if not visit(node):
        return None

    normalized_rows: list[dict[str, object]] = []
    for row_items in rows:
        compact_items = normalize_visual_quote_items(row_items)
        if compact_items:
            normalized_rows.append({"id": f"row-{uuid.uuid4().hex[:8]}", "items": compact_items})

    return normalized_rows or None


def build_visual_quote_block_from_legacy(
    node: LegacyHtmlNode,
    *,
    block_id: str | None = None,
    fallback_style: object = None,
) -> dict[str, object] | None:
    paragraph_nodes = [child for child in direct_children(node) if child.tag == "p"]
    if not paragraph_nodes:
        return None

    style_map = parse_style_attribute(node.attrs.get("style", ""))
    author = ""
    author_style_map: dict[str, str] = {}
    content_nodes = paragraph_nodes
    last_paragraph_text = normalize_inline_text(plain_text(paragraph_nodes[-1]), preserve_breaks=contains_tag(paragraph_nodes[-1], "br"))
    last_paragraph_style = parse_style_attribute(paragraph_nodes[-1].attrs.get("style", ""))
    if last_paragraph_style.get("text-align", "").strip().lower() == "right" or re.match(r"^[-—]\s*", last_paragraph_text):
        author = re.sub(r"^[-—]\s*", "", last_paragraph_text).strip()
        author_style_map = last_paragraph_style
        content_nodes = paragraph_nodes[:-1]

    if not content_nodes or not any(contains_tag(content_node, "img") for content_node in content_nodes):
        return None

    rows: list[dict[str, object]] = []
    first_content_style: dict[str, str] = {}
    for index, content_node in enumerate(content_nodes):
        row_group = extract_visual_quote_rows_from_inline_node(content_node)
        if not row_group:
            return None
        if index == 0:
            first_content_style = parse_style_attribute(content_node.attrs.get("style", ""))
        rows.extend(row_group)

    layout = normalize_visual_quote_layout(
        {
            "maxWidth": style_map.get("width", style_map.get("max-width", "")),
            "minHeight": style_map.get("min-height", ""),
            "padding": style_map.get("padding", ""),
            "margin": style_map.get("margin", ""),
            "lineHeight": style_map.get("line-height", first_content_style.get("line-height", "")),
            "letterSpacing": first_content_style.get("letter-spacing", ""),
            "textTransform": first_content_style.get("text-transform", style_map.get("text-transform", "")),
            "fontSize": style_map.get("font-size", first_content_style.get("font-size", "")),
            "authorSize": author_style_map.get("font-size", ""),
            "rowGap": "",
        }
    )

    style = normalize_style(
        {
            "fontSize": "default",
            "fontFamily": infer_font_family(first_content_style.get("font-family", style_map.get("font-family", ""))),
            "align": infer_align(style_map.get("text-align", first_content_style.get("text-align", ""))),
        }
    )

    if isinstance(fallback_style, dict):
        normalized_fallback_style = normalize_style(fallback_style)
        merged_style = dict(style)
        for key in ("fontSize", "fontFamily", "align"):
            if normalized_fallback_style.get(key) not in {"", "default"}:
                merged_style[key] = str(normalized_fallback_style[key])
        style = normalize_style(merged_style)

    return build_block(
        "visual-quote",
        id=block_id or f"block-{uuid.uuid4().hex[:8]}",
        rows=rows,
        author=author,
        layout=layout,
        style=style,
    )


def build_quote_strip_block_from_legacy(
    node: LegacyHtmlNode,
    *,
    block_id: str | None = None,
    fallback_style: object = None,
) -> dict[str, object] | None:
    if node.tag not in {"div", "section"}:
        return None

    children = [child for child in direct_children(node) if not child.is_comment]
    if len(children) < 3:
        return None

    left_image_node = children[0]
    center_node = children[1]
    right_image_node = children[-1]

    left_image = visual_quote_image_item_from_node(left_image_node)
    right_image = visual_quote_image_item_from_node(right_image_node)
    quote_node = center_node if center_node.tag == "blockquote" else find_first(
        center_node,
        lambda candidate: candidate.tag == "blockquote",
    )

    if left_image is None or right_image is None or quote_node is None:
        return None

    paragraphs, author = extract_paragraphs_from_blockquote(quote_node)
    if not paragraphs and not author:
        return None

    quote_style_map = parse_style_attribute(quote_node.attrs.get("style", ""))
    style = normalize_style(
        {
            "fontSize": infer_font_size(quote_style_map.get("font-size", "")),
            "fontFamily": infer_font_family(quote_style_map.get("font-family", "")),
            "align": "center",
        }
    )

    if isinstance(fallback_style, dict):
        normalized_fallback_style = normalize_style(fallback_style)
        merged_style = dict(style)
        for key in ("fontSize", "fontFamily", "align"):
            if normalized_fallback_style.get(key) not in {"", "default"}:
                merged_style[key] = str(normalized_fallback_style[key])
        style = normalize_style(merged_style)

    return build_block(
        "quote-strip",
        id=block_id or f"block-{uuid.uuid4().hex[:8]}",
        paragraphs=paragraphs,
        author=author,
        leftImage=left_image.get("options", {}),
        rightImage=right_image.get("options", {}),
        layout={
            "margin": "1.5rem 0",
            "gap": "1rem",
            "sideWidth": "72px",
            "minHeight": "320px",
            "quoteMaxWidth": "320px",
            "quotePadding": "1.25rem 1rem",
        },
        style=style,
    )


def convert_html_block_to_structured_block(block: dict[str, object]) -> dict[str, object] | None:
    raw_html = str(block.get("html") or "")
    if not raw_html.strip():
        return None

    fragment_node = first_fragment_node(raw_html)
    if fragment_node is None:
        return None

    block_id = str(block.get("id") or f"block-{uuid.uuid4().hex[:8]}")
    fallback_style = block.get("style", {})

    if fragment_node.tag in {"div", "section"}:
        quote_strip = build_quote_strip_block_from_legacy(
            fragment_node,
            block_id=block_id,
            fallback_style=fallback_style,
        )
        if quote_strip is not None:
            return quote_strip

    if fragment_node.tag == "blockquote":
        visual_quote = build_visual_quote_block_from_legacy(
            fragment_node,
            block_id=block_id,
            fallback_style=fallback_style,
        )
        if visual_quote is not None:
            return visual_quote

    if fragment_node.tag == "figure" and find_first(fragment_node, lambda candidate: candidate.tag == "img") is not None:
        image_block = import_legacy_image(fragment_node)
        if image_block:
            image_block[0]["id"] = block_id
            return image_block[0]

    return None


def extract_paragraphs_from_blockquote(node: LegacyHtmlNode) -> tuple[list[str], str]:
    paragraph_nodes = [child for child in direct_children(node) if child.tag == "p"]
    if paragraph_nodes:
        paragraphs = [
            normalize_inline_text(plain_text(paragraph_node), preserve_breaks=contains_tag(paragraph_node, "br"))
            for paragraph_node in paragraph_nodes
        ]
        paragraphs = [paragraph for paragraph in paragraphs if paragraph]

        author = ""
        if paragraphs:
            last_paragraph_style = parse_style_attribute(paragraph_nodes[-1].attrs.get("style", ""))
            last_paragraph = paragraphs[-1]
            if last_paragraph_style.get("text-align", "").strip().lower() == "right" or re.match(
                r"^[-—]\s*", last_paragraph
            ):
                author = re.sub(r"^[-—]\s*", "", last_paragraph).strip()
                paragraphs = paragraphs[:-1]

        return paragraphs, author

    raw_text = normalize_inline_text(plain_text(node), preserve_breaks=True)
    content_lines, author = extract_quote_author(raw_text.split("\n"))
    return lines_to_paragraphs(content_lines), author


def detect_quote_block_type(paragraphs: list[str], style_map: dict[str, str]) -> tuple[str, list[str]]:
    lines = [line.strip() for paragraph in paragraphs for line in paragraph.split("\n") if line.strip()]
    dialogue_hits = sum(
        1
        for line in lines
        if line.startswith("•") or re.match(r"^[^:]{1,32}:\s*", line) or re.match(r"^[A-ZÁÉÍÓÚÑ][^:]{0,28}:\s*", line)
    )
    multiline_hits = sum(1 for paragraph in paragraphs if "\n" in paragraph)
    flags: list[str] = []

    if dialogue_hits >= 2:
        block_type = "dialogue"
    elif multiline_hits >= max(1, len(paragraphs) // 2) and len(lines) >= 6:
        block_type = "song"
    elif style_map.get("text-transform", "").strip().lower() == "uppercase" or "clamp(" in style_map.get(
        "font-size", ""
    ).lower():
        block_type = "hero-quote"
    else:
        block_type = "quote"

    if block_type == "quote" and multiline_hits:
        flags.append("breaks")
    if infer_align(style_map.get("text-align", "")) == "center":
        flags.append("center")
    if style_map.get("text-transform", "").strip().lower() == "uppercase":
        flags.append("caps")

    return block_type, flags


def import_legacy_paragraph(node: LegacyHtmlNode) -> list[dict[str, object]]:
    text = normalize_inline_text(plain_text(node), preserve_breaks=contains_tag(node, "br"))
    if not text:
        return []
    style_map = parse_style_attribute(node.attrs.get("style", ""))
    return [
        build_block(
            "paragraph",
            text=text,
            preserveBreaks=contains_tag(node, "br"),
            style=style_from_style_map(style_map),
        )
    ]


def import_legacy_blockquote(node: LegacyHtmlNode) -> list[dict[str, object]]:
    if contains_tag(node, "img"):
        visual_quote = build_visual_quote_block_from_legacy(node)
        return [visual_quote] if visual_quote is not None else [build_html_block_from_node(node)]

    meaningful = direct_children(node)
    if any(child.tag not in {"#text", "br", "p"} for child in meaningful):
        return [build_html_block_from_node(node)]

    style_map = parse_style_attribute(node.attrs.get("style", ""))
    paragraphs, author = extract_paragraphs_from_blockquote(node)
    if not paragraphs and not author:
        return []

    block_type, flags = detect_quote_block_type(paragraphs, style_map)
    return [
        build_block(
            block_type,
            paragraphs=paragraphs,
            author=author,
            flags=flags,
            style=style_from_style_map(style_map),
        )
    ]


def import_legacy_image(node: LegacyHtmlNode) -> list[dict[str, object]]:
    image_node = find_first(node, lambda candidate: candidate.tag == "img")
    if image_node is None:
        return [build_html_block_from_node(node)]

    figure_style = parse_style_attribute(node.attrs.get("style", ""))
    image_style = parse_style_attribute(image_node.attrs.get("style", ""))
    options = {
        "src": str(image_node.attrs.get("src", "")).strip(),
        "alt": str(image_node.attrs.get("alt", "")).strip(),
        "caption": "",
        "height": str(figure_style.get("--photo-height", "")).strip(),
        "fit": "contain" if image_style.get("object-fit", "").strip().lower() == "contain" else "cover",
        "padding": str(image_style.get("padding", "")).strip(),
        "background": str(image_style.get("background", "")).strip(),
        "position": str(
            figure_style.get("--photo-position", image_style.get("object-position", ""))
        ).strip(),
        "margin": str(figure_style.get("margin", "")).strip(),
    }

    caption_node = find_direct_child(node, lambda child: child.tag == "figcaption")
    if caption_node is not None:
        options["caption"] = normalize_inline_text(plain_text(caption_node))

    return [build_block("image", options=options, style=style_from_style_map(figure_style))]


def import_legacy_content_blocks(content_node: LegacyHtmlNode) -> list[dict[str, object]]:
    if content_node.attrs.get("style") or len(node_classes(content_node) - {"note-content"}) > 0:
        return [build_html_block_from_wrapped_content(content_node)]

    blocks: list[dict[str, object]] = []
    for child in direct_children(content_node):
        if child.is_text:
            text = normalize_inline_text(child.text)
            if text:
                blocks.append(build_block("paragraph", text=text))
            continue

        if child.tag == "p":
            blocks.extend(import_legacy_paragraph(child))
            continue

        if child.tag == "blockquote":
            blocks.extend(import_legacy_blockquote(child))
            continue

        if child.tag == "figure" and has_class(child, "note-photo-card"):
            blocks.extend(import_legacy_image(child))
            continue

        if child.tag == "hr":
            blocks.append(build_block("divider"))
            continue

        if child.tag == "div":
            blocks.append(build_html_block_from_node(child))
            continue

        blocks.append(build_html_block_from_node(child))

    return blocks


def import_legacy_author_document(article_node: LegacyHtmlNode) -> tuple[str, dict[str, object]] | None:
    article_classes = node_classes(article_node)
    author_id = "mica" if "note-card--mica" in article_classes else "leo" if "note-card--leo" in article_classes else ""
    if author_id not in AUTHOR_PRESETS:
        return None

    label_node = find_direct_child(article_node, lambda child: child.tag == "span" and has_class(child, "note-label"))
    title_node = find_direct_child(article_node, lambda child: child.tag == "h2")
    helper_node = find_direct_child(
        article_node,
        lambda child: child.tag == "p" and ("note-helper" in node_classes(child) or "note-date" in node_classes(child)),
    )
    content_node = find_direct_child(article_node, lambda child: child.tag == "div" and has_class(child, "note-content"))
    preset = AUTHOR_PRESETS[author_id]

    document = {
        "meta": {
            "label": normalize_inline_text(plain_text(label_node)) if label_node else preset["label"],
            "title": normalize_inline_text(plain_text(title_node)) if title_node else preset["default_title"],
            "helper": normalize_inline_text(plain_text(helper_node)) if helper_node else "",
            "spoiler": "note-card--spoiler" in article_classes,
            "variant": "solo" if "note-card--solo" in article_classes else "",
            "placeholder": False,
            "placeholderBody": preset["default_placeholder"],
        },
        "blocks": import_legacy_content_blocks(content_node) if content_node is not None else [],
    }

    return author_id, normalize_author_document(author_id, document)


def extract_legacy_cover(root: LegacyHtmlNode, slug: str) -> dict[str, object]:
    page_media = find_first(root, lambda node: node.tag == "section" and has_class(node, "page-media"))
    figure_node = (
        find_first(page_media, lambda node: node.tag == "figure" and has_class(node, "note-photo-card"))
        if page_media is not None
        else None
    )
    if figure_node is None:
        return {
            "src": cover_src_for("viejas", slug),
            "alt": default_cover_alt("viejas", slug),
            "caption": "",
            "enabled": False,
            "height": "",
            "position": "",
        }

    image_node = find_first(figure_node, lambda node: node.tag == "img")
    figure_style = parse_style_attribute(figure_node.attrs.get("style", ""))
    caption_node = find_direct_child(figure_node, lambda child: child.tag == "figcaption")

    return {
        "src": str(image_node.attrs.get("src", "")).strip() if image_node else cover_src_for("viejas", slug),
        "alt": str(image_node.attrs.get("alt", "")).strip() if image_node else default_cover_alt("viejas", slug),
        "caption": normalize_inline_text(plain_text(caption_node)) if caption_node else "",
        "enabled": True,
        "height": str(figure_style.get("--photo-height", "")).strip(),
        "position": str(figure_style.get("--photo-position", "")).strip(),
    }


def legacy_source_file(note_dir: Path) -> Path:
    backup_path = note_dir / LEGACY_INDEX_FILE_NAME
    if backup_path.exists():
        return backup_path
    return note_dir / "index.html"


def import_legacy_note(note_dir: Path) -> tuple[dict[str, object], dict[str, dict[str, object]]]:
    slug = note_dir.name
    raw_html = legacy_source_file(note_dir).read_text(encoding="utf-8")
    root = parse_legacy_document(raw_html)
    body_node = find_first(root, lambda node: node.tag == "body")
    header_node = find_first(root, lambda node: node.tag == "header" and has_class(node, "page-header"))
    layout_node = find_first(root, lambda node: node.tag == "section" and has_class(node, "notes-layout"))
    title_node = find_direct_child(header_node, lambda child: child.tag == "h1") if header_node else None
    description_node = (
        find_direct_child(header_node, lambda child: child.tag == "p" and has_class(child, "page-description"))
        if header_node
        else None
    )
    theme = default_theme_for("viejas")
    if body_node is not None:
        for class_name in node_classes(body_node):
            if class_name.startswith("theme-"):
                theme = class_name
                break

    author_documents: dict[str, dict[str, object]] = {}
    if layout_node is not None:
        for article_node in direct_children(layout_node):
            if article_node.tag != "article" or "note-card" not in node_classes(article_node):
                continue
            imported = import_legacy_author_document(article_node)
            if imported is None:
                continue
            author_id, document = imported
            author_documents[author_id] = document

    if not author_documents:
        author_documents["mica"] = default_author_document("mica")
        author_documents["leo"] = default_author_document("leo")

    style_nodes = find_all(root, lambda node: node.tag == "style")
    custom_css = "\n\n".join(plain_text(style_node).strip() for style_node in style_nodes if plain_text(style_node).strip())

    note_payload: dict[str, object] = {
        "numero": int(slug),
        "collection": "viejas",
        "titulo": normalize_inline_text(plain_text(title_node)) if title_node else f"Hoja {slug}",
        "descripcion": normalize_inline_text(plain_text(description_node)) if description_node else "",
        "subtitulo": default_subtitle_for("viejas"),
        "fecha": "",
        "sortDate": "",
        "theme": theme if theme in NOTE_THEMES else default_theme_for("viejas"),
        "footerText": default_footer_for("viejas"),
        "cover": extract_legacy_cover(root, slug),
        "authors": [
            {"id": author_id, "file": new_author_filename(author_id), "visible": True}
            for author_id in sorted(author_documents.keys(), key=author_sort_key)
        ],
    }

    if len(author_documents) == 1:
        note_payload["layout"] = "single"

    if custom_css:
        note_payload["customCss"] = custom_css

    return normalize_note_payload(note_payload), author_documents


def build_note_payload(
    number: int,
    title: str,
    description: str,
    date_value: dt.date,
    authors: list[str],
    music: dict[str, object] | None,
    *,
    theme: str = "theme-present-notes",
    collection: str = "nuevas",
) -> dict[str, object]:
    normalized_collection = normalize_collection_id(collection)
    slug = pad(number)
    short_year = str(date_value.year)[2:]

    payload: dict[str, object] = {
        "numero": number,
        "collection": normalized_collection,
        "titulo": title,
        "descripcion": description,
        "subtitulo": default_subtitle_for(normalized_collection),
        "fecha": f"{date_value.day:02d}/{date_value.month:02d}/{short_year}",
        "sortDate": date_value.isoformat(),
        "theme": theme if theme in NOTE_THEMES else default_theme_for(normalized_collection),
        "footerText": default_footer_for(normalized_collection),
        "cover": {
            "src": cover_src_for(normalized_collection, slug),
            "alt": default_cover_alt(normalized_collection, slug),
            "enabled": True,
            "height": "",
            "position": "",
            "caption": "",
        },
        "authors": [{"id": author_id, "file": new_author_filename(author_id)} for author_id in authors],
    }

    if len(authors) == 1:
        payload["layout"] = "single"

    if music:
        payload["music"] = music

    return payload


def load_note_json(note_dir: Path) -> dict[str, object]:
    return json.loads((note_dir / "note.json").read_text(encoding="utf-8"))


def save_note_json(note_dir: Path, payload: dict[str, object]) -> None:
    (note_dir / "note.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def normalize_note_payload(raw_note: object) -> dict[str, object]:
    note = raw_note if isinstance(raw_note, dict) else {}
    number = int(note.get("numero") or 0)
    slug = pad(number) if number else ""
    collection = normalize_collection_id(note.get("collection"))
    authors = note.get("authors", [])
    if not isinstance(authors, list):
        authors = []

    normalized_authors: list[dict[str, object]] = []
    for author in authors:
        if not isinstance(author, dict):
            continue
        author_id = str(author.get("id") or "").strip().lower()
        if author_id not in AUTHOR_PRESETS:
            continue
        normalized_authors.append(
            {
                "id": author_id,
                "file": str(author.get("file") or new_author_filename(author_id)),
                "visible": author.get("visible", True) is not False,
            }
        )

    if not normalized_authors:
        normalized_authors = [
            {"id": "mica", "file": new_author_filename("mica"), "visible": True},
            {"id": "leo", "file": new_author_filename("leo"), "visible": True},
        ]

    theme = str(note.get("theme") or default_theme_for(collection))
    if theme not in NOTE_THEMES:
        theme = default_theme_for(collection)

    cover = note.get("cover", {})
    if not isinstance(cover, dict):
        cover = {}

    normalized: dict[str, object] = {
        "numero": number,
        "collection": collection,
        "titulo": str(note.get("titulo") or f"Nueva nota {slug}").strip() or f"Nueva nota {slug}",
        "descripcion": str(note.get("descripcion") or "").strip(),
        "subtitulo": str(note.get("subtitulo") or default_subtitle_for(collection)).strip() or default_subtitle_for(collection),
        "fecha": str(note.get("fecha") or "").strip(),
        "sortDate": str(note.get("sortDate") or "").strip(),
        "theme": theme,
        "layout": "single" if str(note.get("layout") or "") == "single" else "",
        "footerText": str(note.get("footerText") or default_footer_for(collection)).strip() or default_footer_for(collection),
        "customCss": str(note.get("customCss") or ""),
        "cover": {
            "src": str(cover.get("src") or (cover_src_for(collection, slug) if slug else "")).strip(),
            "alt": str(cover.get("alt") or (default_cover_alt(collection, slug) if slug else "Recuerdo de la nota")).strip(),
            "caption": str(cover.get("caption") or "").strip(),
            "enabled": cover.get("enabled", True) is not False,
            "height": str(cover.get("height") or "").strip(),
            "position": str(cover.get("position") or "").strip(),
        },
        "authors": normalized_authors,
    }

    music = note.get("music")
    if isinstance(music, dict) and music.get("youtubeId"):
        normalized["music"] = {
            "youtubeId": str(music.get("youtubeId") or "").strip(),
            "volume": int(music.get("volume") or 40),
            "autoplay": music.get("autoplay", True) is not False,
            "attachToAuthor": str(music.get("attachToAuthor") or normalized_authors[-1]["id"]),
            "buttonLabel": str(music.get("buttonLabel") or "Reproducir canción"),
            "loadingMessage": str(
                music.get("loadingMessage") or "Intentando reproducir la canción al abrir esta hoja."
            ),
            "playingMessage": str(music.get("playingMessage") or "Reproduciendo la canción de fondo."),
            "blockedMessage": str(
                music.get("blockedMessage")
                or "Tu navegador bloqueó el autoplay con sonido. Tocá el botón para iniciar la canción."
            ),
        }

    return normalized


def ensure_generic_note_page(note_dir: Path) -> None:
    (note_dir / "index.html").write_text(INDEX_TEMPLATE, encoding="utf-8")


def materialize_legacy_note_data(note_dir: Path, *, overwrite: bool = False) -> str:
    note_json_path = note_dir / "note.json"
    backup_index = note_dir / LEGACY_INDEX_FILE_NAME
    existed_before = note_json_path.exists()

    if existed_before and not overwrite:
        ensure_generic_note_page(note_dir)
        return "existing"

    if overwrite and existed_before and not backup_index.exists():
        raise FileNotFoundError(
            f"No encontré {LEGACY_INDEX_FILE_NAME} en {note_dir}. "
            "No puedo reimportar esa nota sin la copia HTML original."
        )

    imported_note, author_documents = import_legacy_note(note_dir)
    current_index = note_dir / "index.html"

    if current_index.exists() and not backup_index.exists():
        shutil.copyfile(current_index, backup_index)

    save_note_json(note_dir, imported_note)
    for author_id, document in author_documents.items():
        (note_dir / new_author_filename(author_id)).write_text(
            json.dumps(document, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    ensure_generic_note_page(note_dir)
    return "updated" if existed_before else "created"


def ensure_legacy_note_data(note_dir: Path) -> None:
    materialize_legacy_note_data(note_dir, overwrite=False)


def sync_legacy_archive(*, overwrite: bool = False) -> dict[str, int]:
    stats = {
        "processed": 0,
        "created": 0,
        "updated": 0,
        "existing": 0,
    }

    for note_dir in sorted(OLD_NOTES_DIR.glob("[0-9][0-9]")):
        result = materialize_legacy_note_data(note_dir, overwrite=overwrite)
        stats["processed"] += 1
        if result in stats:
            stats[result] += 1

    return stats


def normalize_all_notes() -> dict[str, int]:
    stats = {
        "nuevas": 0,
        "viejas": 0,
        "processed": 0,
    }

    for collection in ("nuevas", "viejas"):
        for note in list_notes(collection):
            slug = pad(int(note.get("numero") or 0))
            payload = load_note_editor_payload(slug, collection)
            save_note_from_editor_payload(slug, payload, collection)
            stats[collection] += 1
            stats["processed"] += 1

    return stats


def list_notes(collection: object = "nuevas") -> list[dict[str, object]]:
    normalized_collection = normalize_collection_id(collection)
    notes: list[dict[str, object]] = []

    for note_dir in sorted(notes_dir_for(normalized_collection).glob("[0-9][0-9]")):
        if normalized_collection == "viejas":
            ensure_legacy_note_data(note_dir)
        note_json = note_dir / "note.json"
        if not note_json.exists():
            continue
        data = normalize_note_payload(load_note_json(note_dir))
        data["_dir"] = note_dir
        notes.append(data)

    notes.sort(key=lambda item: int(item.get("numero", 0)))
    return notes


def load_note_editor_payload(slug: str, collection: object = "nuevas") -> dict[str, object]:
    normalized_collection = normalize_collection_id(collection)
    note_dir = notes_dir_for(normalized_collection) / slug
    if normalized_collection == "viejas":
        ensure_legacy_note_data(note_dir)
    note_data = normalize_note_payload(load_note_json(note_dir))
    authors: list[dict[str, object]] = []
    configured_author_ids: set[str] = set()

    for author_config in note_data.get("authors", []):
        assert isinstance(author_config, dict)
        author_id = str(author_config.get("id") or "leo")
        configured_author_ids.add(author_id)
        authors.append(
            {
                "id": author_id,
                "file": str(author_config.get("file") or new_author_filename(author_id)),
                "enabled": author_config.get("visible", True) is not False,
                "document": load_author_document(note_dir, author_config),
            }
        )

    for author_id in AUTHOR_PRESETS:
        if author_id in configured_author_ids:
            continue

        fallback_config = {
            "id": author_id,
            "file": new_author_filename(author_id),
            "visible": False,
        }
        author_path = note_dir / new_author_filename(author_id)
        authors.append(
            {
                "id": author_id,
                "file": new_author_filename(author_id),
                "enabled": False,
                "document": load_author_document(note_dir, fallback_config) if author_path.exists() else default_author_document(author_id),
            }
        )

    authors.sort(key=lambda item: author_sort_key(str(item.get("id", ""))))

    return {
        "slug": slug,
        "collection": normalized_collection,
        "note": note_data,
        "authors": authors,
    }


def create_note_files(note_dir: Path, authors: list[str]) -> None:
    note_dir.mkdir(parents=True, exist_ok=False)
    ensure_generic_note_page(note_dir)

    for author_id in authors:
        (note_dir / new_author_filename(author_id)).write_text(
            json.dumps(default_author_document(author_id), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )


def update_manifest(number: int) -> None:
    content = DATA_FILE.read_text(encoding="utf-8")
    marker = "  // NUEVAS_NOTAS:END"
    new_line = f"  buildNewNoteEntry({number}),\n"

    if new_line in content:
        return

    if marker not in content:
        raise RuntimeError("No encontré el marcador // NUEVAS_NOTAS:END en hojas.js")

    DATA_FILE.write_text(content.replace(marker, f"{new_line}{marker}", 1), encoding="utf-8")


def prepare_cover_image(slug: str, collection: object = "nuevas") -> Path:
    target_dir = image_dir_for(collection)
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"{slug}.jpeg"
    if not target.exists():
        target.touch()
    return target


def create_note_from_editor_payload(payload: dict[str, object]) -> dict[str, object]:
    raw_note = payload.get("note", {})
    note = raw_note if isinstance(raw_note, dict) else {}
    normalized_collection = normalize_collection_id(note.get("collection"))
    if normalized_collection != "nuevas":
        raise ValueError("La creación guiada por ahora solo aplica a notas nuevas.")
    number = next_note_number()
    slug = pad(number)

    selected_author_ids = payload.get("authorIds", ["mica", "leo"])
    author_ids = [author_id for author_id in selected_author_ids if author_id in AUTHOR_PRESETS]
    if not author_ids:
        author_ids = ["mica", "leo"]

    title = str(note.get("titulo") or f"Nueva nota {slug}").strip() or f"Nueva nota {slug}"
    description = str(note.get("descripcion") or "Una hoja nueva lista para seguir escribiéndola juntos.").strip()
    date_raw = str(note.get("sortDate") or dt.date.today().isoformat()).strip()
    date_value = dt.date.fromisoformat(date_raw)
    theme = str(note.get("theme") or default_theme_for("nuevas"))

    note_dir = notes_dir_for("nuevas") / slug
    create_note_files(note_dir, author_ids)
    prepare_cover_image(slug, "nuevas")

    note_data = build_note_payload(number, title, description, date_value, author_ids, None, theme=theme, collection="nuevas")
    if note.get("collection"):
        note_data["collection"] = str(note.get("collection"))
    if note.get("cover") and isinstance(note.get("cover"), dict):
        cover = note["cover"]
        note_data["cover"]["alt"] = str(cover.get("alt") or note_data["cover"]["alt"])

    save_note_json(note_dir, note_data)
    update_manifest(number)

    return load_note_editor_payload(slug, "nuevas")


def save_note_from_editor_payload(slug: str, payload: dict[str, object], collection: object = "nuevas") -> dict[str, object]:
    normalized_collection = normalize_collection_id(collection)
    note_dir = notes_dir_for(normalized_collection) / slug
    if normalized_collection == "viejas":
        ensure_legacy_note_data(note_dir)
    note_data = normalize_note_payload(payload.get("note", {}))
    note_data["numero"] = int(slug)
    note_data["collection"] = normalized_collection
    note_data["cover"]["src"] = cover_src_for(normalized_collection, slug)

    authors_payload = payload.get("authors", [])
    if not isinstance(authors_payload, list):
        authors_payload = []

    normalized_authors_payload: dict[str, dict[str, object]] = {}
    enabled_author_ids: list[str] = []
    for raw_author in authors_payload:
        if not isinstance(raw_author, dict):
            continue
        author_id = str(raw_author.get("id") or "").strip().lower()
        if author_id not in AUTHOR_PRESETS:
            continue
        if author_id in normalized_authors_payload:
            continue
        normalized_authors_payload[author_id] = raw_author
        if raw_author.get("enabled", True) is False:
            continue
        enabled_author_ids.append(author_id)

    if not enabled_author_ids:
        fallback_author = normalized_authors_payload.get("leo", {"id": "leo", "document": default_author_document("leo")})
        normalized_authors_payload["leo"] = {
            **fallback_author,
            "id": "leo",
            "enabled": True,
        }
        enabled_author_ids = ["leo"]

    note_data["authors"] = []

    for author_id in sorted(normalized_authors_payload, key=author_sort_key):
        raw_author = normalized_authors_payload[author_id]
        author_entry = ensure_author_entry(note_data, author_id)
        author_entry["visible"] = raw_author.get("enabled", True) is not False
        save_author_document(note_dir, note_data, author_id, raw_author.get("document", {}))

    if len(enabled_author_ids) == 1:
        note_data["layout"] = "single"
    elif note_data.get("layout") == "single":
        note_data.pop("layout", None)

    prepare_cover_image(slug, normalized_collection)
    save_note_json(note_dir, note_data)
    if normalized_collection == "viejas":
        ensure_generic_note_page(note_dir)
    return load_note_editor_payload(slug, normalized_collection)


def decode_data_url(data_url: str) -> tuple[bytes, str]:
    if "," not in data_url:
        raise ValueError("La imagen llegó con un formato inválido.")

    header, encoded = data_url.split(",", 1)
    mime_match = re.match(r"^data:(.*?);base64$", header)
    mime_type = mime_match.group(1) if mime_match else "application/octet-stream"
    return base64.b64decode(encoded), mime_type


def save_cover_upload(slug: str, data_url: str, collection: object = "nuevas") -> str:
    normalized_collection = normalize_collection_id(collection)
    raw_bytes, _mime_type = decode_data_url(data_url)
    image = Image.open(io.BytesIO(raw_bytes)).convert("RGB")

    target = prepare_cover_image(slug, normalized_collection)
    image.save(target, format="JPEG", quality=92)
    return cover_src_for(normalized_collection, slug)


def save_inline_image_upload(slug: str, block_id: str, data_url: str, collection: object = "nuevas") -> str:
    normalized_collection = normalize_collection_id(collection)
    raw_bytes, mime_type = decode_data_url(data_url)
    image = Image.open(io.BytesIO(raw_bytes))
    ext = "png"

    if mime_type == "image/jpeg":
        ext = "jpg"
        image = image.convert("RGB")
    elif mime_type == "image/webp":
        ext = "webp"
    elif image.mode not in {"RGBA", "LA"}:
        image = image.convert("RGBA")

    safe_block_id = re.sub(r"[^a-zA-Z0-9_-]+", "-", block_id).strip("-") or uuid.uuid4().hex[:8]
    target_name = f"{slug}-block-{safe_block_id}.{ext}"
    target_dir = image_dir_for(normalized_collection)
    target = target_dir / target_name
    target_dir.mkdir(parents=True, exist_ok=True)

    if ext == "jpg":
        image.save(target, format="JPEG", quality=92)
    elif ext == "webp":
        image.save(target, format="WEBP", quality=92)
    else:
        image.save(target, format="PNG")

    return asset_src_for(normalized_collection, target_name)


def copy_cover_image(source: Path, target: Path) -> None:
    shutil.copyfile(source, target)


def bootstrap_payload() -> dict[str, object]:
    notes_by_collection: list[dict[str, object]] = []
    for collection_id in ("nuevas", "viejas"):
        notes_by_collection.append(
            {
                "id": collection_id,
                "label": "Notas nuevas" if collection_id == "nuevas" else "Notas viejas",
                "canCreate": collection_id == "nuevas",
                "notes": [
                    {
                        "slug": pad(int(note["numero"])),
                        "numero": int(note["numero"]),
                        "titulo": note.get("titulo", ""),
                        "fecha": note.get("fecha", ""),
                        "descripcion": note.get("descripcion", ""),
                        "theme": note.get("theme", default_theme_for(collection_id)),
                        "collection": collection_id,
                    }
                    for note in list_notes(collection_id)
                ],
            }
        )

    return {
        "collections": notes_by_collection,
        "defaultCollection": "nuevas",
        "authorPresets": AUTHOR_PRESETS,
        "blockTypes": list(BLOCK_TYPES),
        "fontSizes": list(BLOCK_FONT_SIZES),
        "fontFamilies": list(BLOCK_FONT_FAMILIES),
        "alignOptions": list(BLOCK_ALIGNS),
        "themes": [
            {"value": "theme-present-notes", "label": "Presente"},
            {"value": "theme-archive-notes", "label": "Archivo"},
            {"value": "theme-soft-romance", "label": "Romance suave"},
            {"value": "theme-sadness", "label": "Tristeza"},
            {"value": "theme-loneliness", "label": "Soledad"},
            {"value": "theme-joy", "label": "Alegría"},
        ],
    }
