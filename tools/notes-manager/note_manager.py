from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import shutil
from pathlib import Path
from textwrap import dedent


def configure_stdio() -> None:
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if stream and hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")


configure_stdio()


AUTHOR_PRESETS = {
    "mica": {
        "label": "Mica",
        "default_title": "Tu espacio",
        "default_helper": "Todavía no hay una nota tuya en esta hoja, pero el lugar ya está guardado para vos.",
        "default_placeholder": "Esta hoja queda abierta para cuando quieras escribir.",
        "file": "mica.note",
    },
    "leo": {
        "label": "Leo",
        "default_title": "Tu respuesta",
        "default_helper": "Este espacio queda listo para cuando quieras sumar tu nota.",
        "default_placeholder": "Este espacio queda abierto para cuando quieras sumar tu nota.",
        "file": "leo.note",
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

GUIDE_TEXT = dedent(
    """
    GUÍA RÁPIDA
    ===========

    1. Texto normal
       Separá párrafos con una línea en blanco.

       Ejemplo:
       Este es el primer párrafo.

       Este es el segundo.

    2. Cita
       Usá un bloque :::quote y terminá la última línea con el autor.

       :::quote
       *Lo besé, respirando el aroma de su piel...*
       - Louisa Clark x Me Before You
       :::

       Importante:
       La última línea que empiece con "-" o "—" se toma como autoría
       y aparece alineada a la derecha automáticamente.

    3. Canción o poema
       :::song
       No respiro, me quema el dolor
       Esta asfixia me quiebra el corazón

       Mi lindo amor no correspondido
       Mi chispa de fe

       - En la oscuridad - Leo, para vos mi amor.
       :::

       Dejá una línea en blanco entre estrofas.

    4. Diálogo
       :::dialogue
       Lucifer: Are you okay?
       Chloe: If I pushed this into your chest... it would kill you?
       Lucifer: Yes.

       - Lucifer
       :::

    5. Cita grande
       :::hero-quote
       ¿TE QUERÉS CASAR CONMIGO?
       :::

    6. Imagen dentro de un bloque
       :::image
       src=../../assets/img/timon.png
       alt=Timón para la hoja
       fit=contain
       height=240px
       padding=24px
       background=rgba(255,255,255,0.03)
       caption=Una imagen para acompañar la nota.
       :::

    7. Separador
       ---

    8. Formato inline disponible
       *cursiva*
       **negrita**
       ~~tachado~~
    """
).strip()

EXAMPLES_TEXT = dedent(
    """
    EJEMPLOS LISTOS PARA PEGAR
    ==========================

    Ejemplo de cita:
    :::quote
    *"Lo besé, respirando el aroma de su piel, sintiendo su suave pelo bajo los dedos..."*
    - Louisa Clark x Me Before You
    :::

    Ejemplo de canción:
    :::song
    No respiro, me quema el dolor
    Esta asfixia me quiebra el corazón

    El ruido se hizo niebla, se hizo cristal
    y tu voz se apagó en mi oscuridad

    - En la oscuridad - Leo
    :::

    Ejemplo de diálogo:
    :::dialogue
    Jackie: I can fit my whole world in the palm of my hands!
    Hyde: That's impos-
    Jackie: [Cups Hyde's face]
    Hyde: Jackie, I have a reputation.

    - That 70's Show
    :::

    Ejemplo de bloque con imagen:
    :::image
    src=../../assets/img/timon.png
    alt=Timón para la hoja
    fit=contain
    padding=24px
    background=rgba(255,255,255,0.03)
    caption=El detalle que acompaña esta respuesta.
    :::

    Ejemplo de bloque completo:
    Hay besos que parecen escritos antes de pasar.

    :::quote
    *Todo desapareció y quedamos únicamente vos y yo.*
    - Nuestro recuerdo
    :::

    Después de esa cita podés seguir con texto normal.
    """
).strip()

IMAGE_GUIDE_TEXT = dedent(
    """
    FOTO CENTRAL
    ============

    Cada hoja nueva crea siempre su imagen central en:
      assets/img/new-notes/XX.jpeg

    Tenés dos caminos:
    1. Elegir una foto ahora.
    2. Dejar creado el archivo vacío y reemplazarlo después manualmente.

    Si el archivo queda vacío, la página muestra el placeholder visual
    hasta que pongas una imagen real en ese mismo nombre.
    """
).strip()


def detect_root() -> Path:
    candidates = []
    cwd = Path.cwd().resolve()

    if getattr(sys, "frozen", False):
        executable_parent = Path(sys.executable).resolve().parent
        candidates.extend([executable_parent, *executable_parent.parents])

    script_dir = Path(__file__).resolve().parent
    candidates.extend([cwd, *cwd.parents, script_dir, *script_dir.parents])

    seen = set()

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
NEW_NOTES_DIR = ROOT / "new-notes"
IMAGE_DIR = ROOT / "assets" / "img" / "new-notes"
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


def pad(number: int) -> str:
    return f"{number:02d}"


def print_header(title: str) -> None:
    print()
    print("=" * len(title))
    print(title)
    print("=" * len(title))
    print()


def pause() -> None:
    input("Presioná Enter para continuar...")


def prompt_text(label: str, default: str = "", allow_blank: bool = False) -> str:
    suffix = f" [{default}]" if default else ""

    while True:
        value = input(f"{label}{suffix}: ").strip()

        if value:
            return value

        if default:
            return default

        if allow_blank:
            return ""

        print("Ese dato no puede quedar vacío.")


def prompt_yes_no(label: str, default: bool = True) -> bool:
    suffix = " [S/n]" if default else " [s/N]"

    while True:
        value = input(f"{label}{suffix}: ").strip().lower()

        if not value:
            return default

        if value in {"s", "si", "sí", "y", "yes"}:
            return True

        if value in {"n", "no"}:
            return False

        print("Respondé con s o n.")


def prompt_choice(label: str, options: list[tuple[str, str]], default: str | None = None) -> str:
    print(label)
    for key, description in options:
        print(f"  {key}. {description}")

    while True:
        suffix = f" [{default}]" if default else ""
        value = input(f"Elegí una opción{suffix}: ").strip()

        if not value and default:
            return default

        for key, _description in options:
            if value == key:
                return key

        print("Elegí una de las opciones mostradas.")


def prompt_int(label: str, default: int, minimum: int, maximum: int) -> int:
    while True:
        raw = prompt_text(label, default=str(default))
        if raw.isdigit():
            value = int(raw)
            if minimum <= value <= maximum:
                return value
        print(f"Ingresá un número entre {minimum} y {maximum}.")


def prompt_date(default_value: dt.date | None = None) -> dt.date:
    today = default_value or dt.date.today()

    while True:
        raw = prompt_text("Fecha", default=today.isoformat())
        try:
            return dt.date.fromisoformat(raw)
        except ValueError:
            print("Usá formato ISO: YYYY-MM-DD. Ejemplo: 2026-03-17")


def open_file_picker() -> Path | None:
    try:
        import tkinter as tk
        from tkinter import filedialog
    except Exception:
        return None

    root = tk.Tk()
    root.withdraw()
    root.update()

    try:
        selected = filedialog.askopenfilename(
            title="Elegí la foto central para la nota",
            filetypes=[
                ("Imágenes", "*.jpg *.jpeg *.png *.webp *.gif *.bmp"),
                ("JPEG", "*.jpg *.jpeg"),
                ("Todos los archivos", "*.*"),
            ],
        )
    finally:
        root.destroy()

    if not selected:
        return None

    return Path(selected)


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
    return value


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


def read_author_file(path: Path) -> tuple[dict[str, object], str]:
    if not path.exists():
        return {}, ""
    return parse_frontmatter(path.read_text(encoding="utf-8"))


def write_author_file(path: Path, meta: dict[str, object], body: str) -> None:
    frontmatter = serialize_frontmatter(meta)
    content = frontmatter + "\n"

    body = body.strip()
    if body:
        content += body + "\n"

    path.write_text(content, encoding="utf-8")


def next_note_number() -> int:
    max_number = 0

    for directory in NEW_NOTES_DIR.iterdir():
        if directory.is_dir() and re.fullmatch(r"\d{2}", directory.name):
            max_number = max(max_number, int(directory.name))

    return max_number + 1


def build_note_payload(
    number: int,
    title: str,
    description: str,
    date_value: dt.date,
    authors: list[str],
    music: dict[str, object] | None,
) -> dict[str, object]:
    slug = pad(number)
    short_year = str(date_value.year)[2:]

    payload: dict[str, object] = {
        "numero": number,
        "collection": "nuevas",
        "titulo": title,
        "descripcion": description,
        "subtitulo": "Abrir nota actual",
        "fecha": f"{date_value.day:02d}/{date_value.month:02d}/{short_year}",
        "sortDate": date_value.isoformat(),
        "theme": "theme-present-notes",
        "cover": {
            "src": f"../../assets/img/new-notes/{slug}.jpeg",
            "alt": f"Recuerdo de la hoja nueva {slug}",
        },
        "authors": [{"id": author_id, "file": AUTHOR_PRESETS[author_id]["file"]} for author_id in authors],
    }

    if len(authors) == 1:
        payload["layout"] = "single"

    if music:
        payload["music"] = music

    return payload


def update_manifest(number: int) -> None:
    content = DATA_FILE.read_text(encoding="utf-8")
    marker = "  // NUEVAS_NOTAS:END"
    new_line = f"  buildNewNoteEntry({number}),\n"

    if new_line in content:
        return

    if marker not in content:
        raise RuntimeError("No encontré el marcador // NUEVAS_NOTAS:END en hojas.js")

    content = content.replace(marker, f"{new_line}{marker}", 1)
    DATA_FILE.write_text(content, encoding="utf-8")


def load_note_json(note_dir: Path) -> dict[str, object]:
    return json.loads((note_dir / "note.json").read_text(encoding="utf-8"))


def save_note_json(note_dir: Path, payload: dict[str, object]) -> None:
    (note_dir / "note.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def list_notes() -> list[dict[str, object]]:
    notes = []

    for note_dir in sorted(NEW_NOTES_DIR.glob("[0-9][0-9]")):
        note_json = note_dir / "note.json"
        if not note_json.exists():
            continue
        data = load_note_json(note_dir)
        data["_dir"] = note_dir
        notes.append(data)

    notes.sort(key=lambda item: int(item.get("numero", 0)))
    return notes


def show_notes_catalog() -> None:
    notes = list_notes()
    print_header("Notas nuevas disponibles")

    if not notes:
        print("Todavía no hay notas nuevas cargadas.")
        print()
        return

    for note in notes:
        number = pad(int(note["numero"]))
        title = note.get("titulo", f"Nueva nota {number}")
        authors = ", ".join(author["id"].capitalize() for author in note.get("authors", []))
        print(f"{number} - {title} [{authors}]")

    print()


def choose_note_interactive() -> dict[str, object] | None:
    notes = list_notes()

    if not notes:
        print("Todavía no hay notas nuevas para editar.")
        return None

    show_notes_catalog()

    by_number = {pad(int(note["numero"])): note for note in notes}

    while True:
        raw = input("Ingresá el número de la nota que querés usar (o Enter para cancelar): ").strip()

        if not raw:
            return None

        slug = raw.zfill(2)
        if slug in by_number:
            return by_number[slug]

        print("No encontré esa nota.")


def select_authors_interactive() -> list[str]:
    choice = prompt_choice(
        "¿Quiénes van a tener bloque en esta hoja?",
        [
            ("1", "Mica y Leo"),
            ("2", "Solo Mica"),
            ("3", "Solo Leo"),
        ],
        default="1",
    )

    if choice == "2":
        return ["mica"]
    if choice == "3":
        return ["leo"]
    return ["mica", "leo"]


def configure_music_interactive(authors: list[str]) -> dict[str, object] | None:
    if not prompt_yes_no("¿Querés dejar preparada una canción de fondo?", default=False):
        return None

    youtube_id = prompt_text("YouTube video ID")
    volume = prompt_int("Volumen", default=40, minimum=0, maximum=100)

    if len(authors) == 1:
        attach_to_author = authors[0]
    else:
        author_choice = prompt_choice(
            "¿En qué bloque querés mostrar el botón de reproducción?",
            [
                ("1", "Mica"),
                ("2", "Leo"),
            ],
            default="2",
        )
        attach_to_author = "mica" if author_choice == "1" else "leo"

    return {
        "youtubeId": youtube_id,
        "volume": volume,
        "autoplay": True,
        "attachToAuthor": attach_to_author,
        "buttonLabel": "Reproducir canción",
        "loadingMessage": "Intentando reproducir la canción al abrir esta hoja.",
        "playingMessage": "Reproduciendo la canción de fondo.",
        "blockedMessage": "Tu navegador bloqueó el autoplay con sonido. Tocá el botón para iniciar la canción.",
    }


def create_author_note_template(author_id: str) -> tuple[dict[str, object], str]:
    preset = AUTHOR_PRESETS[author_id]
    meta: dict[str, object] = {
        "title": preset["default_title"],
        "helper": preset["default_helper"],
        "placeholder": True,
        "placeholderBody": preset["default_placeholder"],
    }
    return meta, ""


def create_note_files(note_dir: Path, authors: list[str]) -> None:
    note_dir.mkdir(parents=True, exist_ok=False)
    (note_dir / "index.html").write_text(INDEX_TEMPLATE, encoding="utf-8")

    for author_id in authors:
        meta, body = create_author_note_template(author_id)
        write_author_file(note_dir / AUTHOR_PRESETS[author_id]["file"], meta, body)


def prepare_cover_image(slug: str) -> Path:
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    target = IMAGE_DIR / f"{slug}.jpeg"

    if target.exists():
        return target

    target.touch()
    return target


def copy_cover_image(source: Path, target: Path) -> None:
    shutil.copyfile(source, target)


def choose_cover_image_interactive(slug: str) -> Path:
    target = prepare_cover_image(slug)

    print()
    print(IMAGE_GUIDE_TEXT)
    print()

    choice = prompt_choice(
        "¿Qué querés hacer con la foto central?",
        [
            ("1", "Elegir archivo ahora con selector"),
            ("2", "Ingresar ruta manualmente"),
            ("3", "Dejar creado el archivo vacío"),
        ],
        default="3",
    )

    if choice == "3":
        print(f"Quedó preparado: assets/img/new-notes/{slug}.jpeg")
        return target

    source_path: Path | None = None

    if choice == "1":
        source_path = open_file_picker()
        if source_path is None:
            print("No se eligió archivo. Dejo creado el JPEG vacío para que lo reemplaces después.")
            return target
    else:
        while True:
            raw_path = prompt_text("Ruta de la imagen")
            candidate = Path(raw_path.strip().strip('"'))
            if candidate.exists() and candidate.is_file():
                source_path = candidate
                break
            print("No encontré ese archivo. Probá de nuevo.")

    try:
        copy_cover_image(source_path, target)
        print(f"Foto copiada a assets/img/new-notes/{slug}.jpeg")
    except Exception as exc:
        target.touch(exist_ok=True)
        print("No pude copiar la foto seleccionada.")
        print(f"Motivo: {exc}")
        print("Igual dejé creado el JPEG vacío para que lo reemplaces después.")

    return target


def create_note_interactive() -> None:
    print_header("Crear hoja nueva")

    number = next_note_number()
    slug = pad(number)
    title = prompt_text("Título principal", default=f"Nueva nota {slug}")
    description = prompt_text(
        "Descripción corta",
        default="Una hoja nueva lista para seguir escribiéndola juntos.",
    )
    note_date = prompt_date()
    authors = select_authors_interactive()
    music = configure_music_interactive(authors)

    note_dir = NEW_NOTES_DIR / slug

    create_note_files(note_dir, authors)
    cover_target = choose_cover_image_interactive(slug)
    save_note_json(
        note_dir,
        build_note_payload(number, title, description, note_date, authors, music),
    )
    update_manifest(number)

    print()
    print(f"Hoja creada: new-notes/{slug}/")
    print(f"Metadata: new-notes/{slug}/note.json")
    print("Bloques listos para completar:")
    for author_id in authors:
        print(f"  - new-notes/{slug}/{AUTHOR_PRESETS[author_id]['file']}")
    print(f"Foto principal preparada en: {cover_target.relative_to(ROOT)}")
    print()
    print("Tip: podés usar la opción 'Completar o actualizar un bloque' para llenar")
    print("la parte de Mica o Leo sin tocar HTML.")
    print()


def author_sort_key(author_id: str) -> int:
    order = {"mica": 0, "leo": 1}
    return order.get(author_id, 99)


def ensure_author_entry(note_data: dict[str, object], author_id: str) -> dict[str, object]:
    authors = note_data.setdefault("authors", [])

    for author in authors:
        if author.get("id") == author_id:
            return author

    new_entry = {"id": author_id, "file": AUTHOR_PRESETS[author_id]["file"]}
    authors.append(new_entry)
    authors.sort(key=lambda item: author_sort_key(str(item.get("id", ""))))

    if len(authors) > 1 and note_data.get("layout") == "single":
        note_data.pop("layout", None)

    if len(authors) == 1:
        note_data["layout"] = "single"

    return new_entry


def choose_author_for_note_interactive(note_data: dict[str, object]) -> str | None:
    current_ids = {author["id"] for author in note_data.get("authors", [])}
    options = []

    options.append(("1", "Mica" + (" (ya existe)" if "mica" in current_ids else " (agregar bloque)")))
    options.append(("2", "Leo" + (" (ya existe)" if "leo" in current_ids else " (agregar bloque)")))
    options.append(("3", "Cancelar"))

    choice = prompt_choice("¿Qué bloque querés completar o actualizar?", options, default="1")

    if choice == "3":
        return None

    return "mica" if choice == "1" else "leo"


def preview_body(body: str) -> None:
    cleaned = body.strip()
    if not cleaned:
        print("Contenido actual: vacío.")
        return

    lines = cleaned.splitlines()
    preview = "\n".join(lines[:8])
    print("Contenido actual (vista previa):")
    print("-" * 30)
    print(preview)
    if len(lines) > 8:
        print("...")
    print("-" * 30)


def capture_multiline_body(current_body: str) -> str | None:
    print()
    print("Pegá el contenido. Comandos disponibles mientras escribís:")
    print("  :fin       guarda el contenido")
    print("  :ayuda     muestra la guía rápida")
    print("  :ejemplos  muestra ejemplos listos")
    print("  :cancelar  cancela la edición")
    print()

    lines: list[str] = []

    while True:
        line = input()
        command = line.strip().lower()

        if command == ":fin":
            return "\n".join(lines).strip()
        if command == ":ayuda":
            print()
            print(GUIDE_TEXT)
            print()
            continue
        if command == ":ejemplos":
            print()
            print(EXAMPLES_TEXT)
            print()
            continue
        if command == ":cancelar":
            return None

        lines.append(line)


def edit_block_interactive() -> None:
    print_header("Completar o actualizar un bloque")
    selected_note = choose_note_interactive()

    if not selected_note:
        return

    note_dir = Path(selected_note["_dir"])
    note_data = load_note_json(note_dir)
    author_id = choose_author_for_note_interactive(note_data)

    if not author_id:
        return

    ensure_author_entry(note_data, author_id)
    author_file = note_dir / AUTHOR_PRESETS[author_id]["file"]

    if not author_file.exists():
        default_meta, default_body = create_author_note_template(author_id)
        write_author_file(author_file, default_meta, default_body)

    meta, body = read_author_file(author_file)
    preset = AUTHOR_PRESETS[author_id]

    print()
    print(f"Editando: new-notes/{note_dir.name}/{author_file.name}")
    preview_body(body)
    print()

    meta["title"] = prompt_text("Título del bloque", default=str(meta.get("title") or preset["default_title"]))
    meta["helper"] = prompt_text("Helper / fecha / subtítulo", default=str(meta.get("helper") or ""))
    meta["spoiler"] = prompt_yes_no("¿Querés que este bloque quede con spoiler?", default=bool(meta.get("spoiler", False)))

    if len(note_data.get("authors", [])) == 1:
        variant_choice = prompt_choice(
            "Estilo del bloque",
            [
                ("1", "Normal"),
                ("2", "Solo / centrado"),
            ],
            default="2" if meta.get("variant") == "solo" else "1",
        )
        meta["variant"] = "solo" if variant_choice == "2" else ""
    else:
        meta["variant"] = ""

    meta["placeholder"] = prompt_yes_no(
        "¿Querés dejar este bloque como placeholder vacío?",
        default=bool(meta.get("placeholder", False)),
    )

    if meta["placeholder"]:
        meta["placeholderBody"] = prompt_text(
            "Texto del placeholder",
            default=str(meta.get("placeholderBody") or preset["default_placeholder"]),
        )
        body = ""
    else:
        meta["placeholderBody"] = ""

        if body.strip():
            action = prompt_choice(
                "¿Qué querés hacer con el contenido actual?",
                [
                    ("1", "Mantenerlo como está"),
                    ("2", "Reemplazarlo pegando contenido nuevo"),
                    ("3", "Vaciarlo y empezar de cero"),
                ],
                default="1",
            )

            if action == "2":
                new_body = capture_multiline_body(body)
                if new_body is None:
                    print("Edición cancelada.")
                    return
                body = new_body
            elif action == "3":
                new_body = capture_multiline_body("")
                if new_body is None:
                    print("Edición cancelada.")
                    return
                body = new_body
        else:
            print("El bloque no tiene contenido todavía.")
            new_body = capture_multiline_body("")
            if new_body is None:
                print("Edición cancelada.")
                return
            body = new_body

    save_note_json(note_dir, note_data)
    write_author_file(author_file, meta, body)

    print()
    print(f"Bloque guardado en new-notes/{note_dir.name}/{author_file.name}")
    print()


def show_guide() -> None:
    print_header("Guía rápida de formatos")
    print(GUIDE_TEXT)
    print()


def show_examples() -> None:
    print_header("Ejemplos listos")
    print(EXAMPLES_TEXT)
    print()


def build_executable() -> int:
    print_header("Construir ejecutable")
    print(f"Carpeta detectada del proyecto: {ROOT}")
    print()

    try:
        import PyInstaller.__main__ as pyinstaller_main
    except ImportError:
        print("No encontré PyInstaller instalado.")
        print("Instalalo con:")
        print("  python -m pip install pyinstaller")
        print()
        print("Después corré de nuevo:")
        print("  python tools/notes-manager/note_manager.py build")
        print()
        return 1

    dist_dir = TOOL_HOME / "dist"
    work_dir = TOOL_HOME / "build" / "pyinstaller"
    work_dir.mkdir(parents=True, exist_ok=True)
    pyinstaller_args = [
        "--noconfirm",
        "--clean",
        "--onefile",
        "--console",
        "--name",
        "nueva_hoja",
        "--distpath",
        str(dist_dir),
        "--workpath",
        str(work_dir / "work"),
        "--specpath",
        str(work_dir / "spec"),
    ]

    if FAVICON_FILE.exists():
        pyinstaller_args.extend(["--icon", str(FAVICON_FILE)])

    pyinstaller_args.append(str(TOOL_HOME / "note_manager.py"))
    pyinstaller_main.run(pyinstaller_args)

    executable_name = "nueva_hoja.exe" if sys.platform.startswith("win") else "nueva_hoja"

    print()
    print(f"Listo. Ejecutable generado en: {(dist_dir / executable_name).relative_to(ROOT)}")
    if FAVICON_FILE.exists():
        print(f"Icono aplicado desde: {FAVICON_FILE.relative_to(ROOT)}")
    print("En Mac M2 tenés que correr este mismo comando desde una Mac para obtener el binario nativo.")
    print()
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Herramienta amigable para crear y completar notas nuevas sin tocar HTML."
    )
    subparsers = parser.add_subparsers(dest="command")

    create_parser = subparsers.add_parser("create", help="Crea una hoja nueva con preguntas guiadas")
    create_parser.set_defaults(handler=lambda _args: create_note_interactive())

    edit_parser = subparsers.add_parser("edit-block", help="Completa o actualiza el bloque de Mica o Leo")
    edit_parser.set_defaults(handler=lambda _args: edit_block_interactive())

    guide_parser = subparsers.add_parser("show-guide", help="Muestra la guía rápida de formatos")
    guide_parser.set_defaults(handler=lambda _args: show_guide())

    examples_parser = subparsers.add_parser("show-examples", help="Muestra ejemplos listos para pegar")
    examples_parser.set_defaults(handler=lambda _args: show_examples())

    list_parser = subparsers.add_parser("list-notes", help="Lista las notas nuevas disponibles")
    list_parser.set_defaults(handler=lambda _args: show_notes_catalog())

    build_parser_cmd = subparsers.add_parser("build", help="Construye el ejecutable local con PyInstaller")
    build_parser_cmd.set_defaults(handler=lambda _args: build_executable())

    interactive_parser = subparsers.add_parser("interactive", help="Abre el menú interactivo")
    interactive_parser.set_defaults(handler=lambda _args: interactive_menu())

    return parser


def interactive_menu() -> int:
    while True:
        print_header("Gestor de notas nuevas")
        print(f"Proyecto detectado: {ROOT}")
        print()
        print("¿Qué querés hacer?")
        print("  1. Crear hoja nueva")
        print("  2. Completar o actualizar bloque de Mica/Leo")
        print("  3. Ver guía rápida de formatos")
        print("  4. Ver ejemplos listos para pegar")
        print("  5. Ver notas nuevas disponibles")
        print("  6. Construir ejecutable local")
        print("  7. Salir")
        print()

        choice = input("Elegí una opción: ").strip()

        if choice == "1":
            create_note_interactive()
            pause()
        elif choice == "2":
            edit_block_interactive()
            pause()
        elif choice == "3":
            show_guide()
            pause()
        elif choice == "4":
            show_examples()
            pause()
        elif choice == "5":
            show_notes_catalog()
            pause()
        elif choice == "6":
            build_executable()
            pause()
        elif choice == "7":
            print("Hasta después.")
            return 0
        else:
            print("Elegí una opción válida.")
            pause()


def main() -> int:
    parser = build_parser()

    if len(sys.argv) == 1:
        return interactive_menu()

    args = parser.parse_args()

    if not hasattr(args, "handler"):
        parser.print_help()
        return 1

    result = args.handler(args)
    return int(result) if isinstance(result, int) else 0


if __name__ == "__main__":
    raise SystemExit(main())
