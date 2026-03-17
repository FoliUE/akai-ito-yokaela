#!/usr/bin/env bash
set -euo pipefail
shopt -s nullglob

ROOT="."
NOTES_DIR="$ROOT/new-notes"
IMAGE_DIR="$ROOT/assets/img/new-notes"
DATA_FILE="$ROOT/hojas.js"

mkdir -p "$NOTES_DIR"
mkdir -p "$IMAGE_DIR"
touch "$NOTES_DIR/.gitkeep"
touch "$IMAGE_DIR/.gitkeep"

max=0
for dir in "$NOTES_DIR"/[0-9][0-9]; do
  [[ -d "$dir" ]] || continue
  base="$(basename "$dir")"
  num=$((10#$base))
  (( num > max )) && max=$num
done

next=$((max + 1))
folder="$(printf "%02d" "$next")"

mkdir -p "$NOTES_DIR/$folder"
touch "$IMAGE_DIR/$folder.jpeg"

cat > "$NOTES_DIR/$folder/index.html" <<EOF
<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nota nueva $folder -- L&amp;M</title>
  <link rel="icon" type="image/png" href="../../favicon.png">
  <link rel="stylesheet" href="../../styles.css">
</head>
<body class="theme-present-notes">
  <main class="page-shell">
    <div class="page-topbar">
      <a class="back-link" href="../../index.html?tab=nuevas">&larr; Volver a notas nuevas</a>
    </div>

    <header class="page-header">
      <p class="page-number">Nota nueva $folder</p>
      <h1>Un capitulo de nuestro presente</h1>
      <p class="page-description">
        Esta hoja est&aacute; pensada para las notas de ahora, las que pertenecen a esta etapa feliz que siguen construyendo juntos.
      </p>
    </header>

    <section class="page-media">
      <figure class="note-photo-card">
        <img
          src="../../assets/img/new-notes/$folder.jpeg"
          alt="Recuerdo de la nota nueva $folder"
          onerror="this.style.display='none'; this.parentElement.classList.add('is-empty');"
        >
        <div class="note-photo-placeholder">
          Agreg&aacute; una foto en <strong>assets/img/new-notes/$folder.jpeg</strong>
        </div>
        <figcaption>
          Una imagen para acompa&ntilde;ar esta nueva nota.
        </figcaption>
      </figure>
    </section>

    <section class="notes-layout">
      <article class="note-card note-card--mica">
        <span class="note-label">Mica</span>
        <h2>Su nota</h2>
        <p class="note-helper">Ac&aacute; va la transcripci&oacute;n de la nota actual.</p>

        <div class="note-content">
          <p class="note-placeholder">
            [PEG&Aacute; AC&Aacute; LA NOTA ACTUAL]
          </p>

          <p>
            Pod&eacute;s separarla en p&aacute;rrafos para que respire mejor.
          </p>
        </div>
      </article>

      <article class="note-card note-card--leo">
        <span class="note-label">Leo</span>
        <h2>Tu respuesta</h2>
        <p class="note-helper">Ac&aacute; va tu respuesta a esta nueva nota.</p>

        <div class="note-content">
          <p class="note-placeholder">
            [PEG&Aacute; AC&Aacute; TU RESPUESTA]
          </p>

          <p>
            Tambi&eacute;n pod&eacute;s escribirla en varios p&aacute;rrafos o destacar una frase.
          </p>
        </div>
      </article>
    </section>

    <footer class="page-footer">
      Hecho con amor, nota por nota.
    </footer>
  </main>
</body>
</html>
EOF

if ! grep -q "// NUEVAS_NOTAS:END" "$DATA_FILE"; then
  echo "No encontre el marcador de nuevas notas en $DATA_FILE" >&2
  exit 1
fi

tmp_file="$(mktemp)"
awk -v next="$next" -v folder="$folder" '
  /\/\/ NUEVAS_NOTAS:END/ {
    print "  {"
    print "    numero: " next ","
    print "    href: \"./new-notes/" folder "/\","
    print "    titulo: \"Nueva nota " folder "\","
    print "    subtitulo: \"Abrir nota actual\""
    print "  },"
  }
  { print }
' "$DATA_FILE" > "$tmp_file"

mv "$tmp_file" "$DATA_FILE"

echo "----------------------------------------"
echo "Nueva nota creada: new-notes/$folder/"
echo "Archivo: new-notes/$folder/index.html"
echo "Imagen esperada: assets/img/new-notes/$folder.jpeg"
echo "Registrada en: hojas.js"
echo "----------------------------------------"
