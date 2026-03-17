const TOTAL_HOJAS_ARCHIVO = 80;

const TITULOS_ARCHIVO = {
  1: "La música también abraza",
  2: "Otra vez",
  3: "Lo que sólo existe al dormir",
  4: "En ese limbo tortuoso",
  5: "La manta y el vino",
  6: "Finales que no terminan",
  7: "Cuando viene de quien querés",
  8: "Más duele recordar",
  9: "Una pausa del mundo",
  10: "La voz en la noche",
  11: "Drogados de amor",
  12: "Querer completo",
  13: "Simplemente magia",
  14: "Las que siguen estando",
  15: "Canciones que dicen lo que sentimos",
  16: "Que el mundo conspire a su favor",
  17: "Lo próximo que se encenderá",
  18: "Una página antes de coincidir",
  19: "Conocernos de a poco",
  20: "Respuestas que nunca querré saber",
  21: "Lo que no se borra",
  22: "La lluvia y el vidrio",
  23: "Ya no estás sola",
  24: "Que el alma respire",
  25: "Sentirse querida",
  26: "Acá estoy",
  27: "No te va a vencer el miedo",
  28: "Apenas me animo a susurrarlo",
  29: "Ahí lo noto",
  30: "Es imposible salir",
  31: "Solo cuando sos vos",
  32: "Es arte y amor",
  33: "Lo que hay detrás del muro",
  34: "Comenzar de nuevo",
  35: "La gente que suma música",
  36: "Where do broken hearts go?",
  37: "Dejar de pensar",
  38: "Ver lo mismo, sentir distinto",
  39: "La ciencia de las tormentas",
  40: "Diálogos que se quedan",
  41: "Descubrirte por completo",
  42: "Ser lo que necesite",
  43: "Tomar tus propios consejos",
  44: "El cemento que no se quiebra",
  45: "Hacia el infinito",
  46: "En mis sueños",
  47: "Jugar con el cariño",
  48: "Nuestras canciones",
  49: "Lo que todavía florece",
  50: "Yo sigo acá",
  51: "Estudiar tu voz",
  52: "Ser uno mismo",
  53: "Ser tesoro, no reemplazo",
  54: "Sin GPS, pero acá",
  55: "Gracias por el piano",
  56: "Elegir quién se queda",
  57: "Un timón para vos",
  58: "El frío de la soledad",
  59: "Hecha para ser amada",
  60: "El borde del abismo",
  61: "Hasta que algo lo detenga",
  62: "No apagues la nuestra",
  63: "Donde por fin descansa el alma",
  64: "Volver a coincidir",
  65: "La chispa que no se olvida",
  66: "You are more...",
  67: "Tu lugar seguro",
  68: "Lo que alguna vez esperaste",
  69: "La pequeña magia",
  70: "Donde no alcanza la luz",
  71: "Esperando el ruido",
  72: "Lo que el olvido no alcanza",
  73: "Nunca dejes de aplaudir",
  74: "Vivirlo como si fuera poco",
  75: "La mano extra",
  76: "En la oscuridad",
  77: "Hasta el último nivel",
  78: "Que el tiempo se note",
  79: "La paz de la madrugada",
  80: "No estás sola"
};

const NOTAS_NUEVAS = [
  // Agregá acá las próximas notas nuevas.
  // En `new-notes`, la numeración sigue el orden cronológico de la etapa nueva.
  // Si alguna vez agregás una hoja entre medio, conviene renumerar carpetas y metadata.
  // Usá rutas como `./new-notes/01/`.
  // NUEVAS_NOTAS:START
  {
    numero: 1,
    href: "./new-notes/01/",
    titulo: "Sos mi familia",
    subtitulo: "Abrir nota actual"
  },
  {
    numero: 2,
    href: "./new-notes/02/",
    titulo: "No había marcha atrás",
    subtitulo: "Abrir nota actual"
  },
  {
    numero: 3,
    href: "./new-notes/03/",
    titulo: "El amor de mi vida",
    subtitulo: "Abrir nota actual"
  },
  {
    numero: 4,
    href: "./new-notes/04/",
    titulo: "Una isla bajo miles de estrellas",
    subtitulo: "Abrir nota actual"
  },
  {
    numero: 5,
    href: "./new-notes/05/",
    titulo: "Para siempre",
    subtitulo: "Abrir nota actual"
  },
  // NUEVAS_NOTAS:END
];

function pad(numero) {
  return String(numero).padStart(2, "0");
}

const NOTAS_VIEJAS = Array.from({ length: TOTAL_HOJAS_ARCHIVO }, (_, indice) => {
  const numero = indice + 1;
  const slug = pad(numero);

  return {
    numero,
    href: `./old-notes/${slug}/`,
    titulo: TITULOS_ARCHIVO[numero] || `Hoja ${slug}`,
    subtitulo: "Abrir hoja del archivo"
  };
});

const COLECCIONES_NOTAS = [
  {
    id: "nuevas",
    label: "Notas nuevas",
    badge: "Presente",
    kicker: "Presente",
    titulo: "Notas nuevas",
    descripcion:
      "Este espacio queda como entrada principal para las notas de ahora, de esta etapa feliz que siguen construyendo juntos.",
    ayuda: "Las hojas nuevas se muestran por la primera fecha que aparece dentro de cada hoja.",
    searchPlaceholder: "Buscar en notas nuevas...",
    emptyTitle: "Todavía no hay notas nuevas publicadas",
    emptyText:
      "Cuando sumes una nueva hoja, este va a ser su lugar natural y va a abrir primero desde la portada.",
    order: "asc",
    cardCta: "Abrir nota actual",
    defaultTab: true,
    notes: NOTAS_NUEVAS
  },
  {
    id: "viejas",
    label: "Notas viejas",
    badge: "Archivo",
    kicker: "Archivo",
    titulo: "Notas viejas",
    descripcion:
      "Acá quedan resguardadas las hojas 01 a 80, separadas del presente para que lo nuevo tenga su propio lugar.",
    ayuda: "Estas hojas forman parte del archivo anterior y se consultan aparte.",
    searchPlaceholder: "Buscar en notas viejas...",
    emptyTitle: "No hay notas viejas cargadas",
    emptyText: "Cuando exista material archivado, se listará acá.",
    order: "asc",
    cardCta: "Abrir hoja del archivo",
    notes: NOTAS_VIEJAS
  }
];
