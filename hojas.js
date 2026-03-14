const TOTAL_HOJAS = 52;

const TITULOS = {
  1: "La música también abraza",
  2: "Otra vez",
  3: "Lo que solo existe al dormir",
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
  52: "Ser uno mismo"
};

const HOJAS = Array.from({ length: TOTAL_HOJAS }, (_, i) => {
  const numero = i + 1;

  return {
    numero,
    titulo: TITULOS[numero] || `Hoja ${String(numero).padStart(2, "0")}`,
    subtitulo: "Abrir página"
  };
});
