/**
 * Spanish (neutral Latin American) translations — rgb. English source text → translation.
 * Machine-drafted; NEEDS NATIVE REVIEW. Terminology: src/i18n/GLOSSARY.md.
 */

/** Per-group color settings ("Group 1 color" … "Group 32 color") are generated, like rgb/settings.js. */
const groupColors = {};
for (let i = 1; i <= 32; i++) { // RGB_MAX_GROUPS
  groupColors[`Group ${i} color`] = `Color del grupo ${i}`;
  groupColors[`Color of LED group ${i} as listed on the RGB page (group names and count depend on the controller, e.g. "D-Pad" or "A").`] =
    `Color del grupo de LED ${i} tal como aparece en la página RGB (los nombres y la cantidad de grupos dependen del control, p. ej., "D-Pad" o "A").`;
}

export default {
  ...groupColors,

  // Lighting
  'Lighting': 'Iluminación',
  'Pick an effect — the preview shows roughly how it looks.': 'Elige un efecto; la vista previa muestra aproximadamente cómo se ve.',
  'Preview of the selected lighting effect': 'Vista previa del efecto de iluminación seleccionado',
  'Effect': 'Efecto',
  'Lighting effect: Authentic (classic face-button colors for the output mode; called Chroma in older apps), Static (your colors), Rainbow, React (flash on press) or Fairy (blend between your first six colors).': 'Efecto de iluminación: Auténtico (colores clásicos de los botones frontales según el modo de salida; se llamaba Chroma en apps anteriores), Estático (tus colores), Arcoíris, Reactivo (destello al presionar) o Hadas (mezcla entre tus primeros seis colores).',
  'Authentic': 'Auténtico',
  'Static': 'Estático',
  'Rainbow': 'Arcoíris',
  'React': 'Reactivo',
  'Fairy': 'Hadas',
  'Face buttons light up in the classic colors of the current output mode (Switch/SNES: A red, B yellow, X blue, Y green) and follow your remaps; other LEDs glow soft white. Your colors are only used for the player LEDs.': 'Los botones frontales se iluminan con los colores clásicos del modo de salida actual (Switch/SNES: A rojo, B amarillo, X azul, Y verde) y siguen tus reasignaciones; los demás LED brillan en blanco suave. Tus colores solo se usan para los LED de jugador.',
  'Each group glows steadily in the color you pick below.': 'Cada grupo brilla de forma constante con el color que elijas abajo.',
  'All LEDs (except the player LEDs) fade together through the colors of the rainbow. Animation time sets how long each color step takes.': 'Todos los LED (excepto los de jugador) pasan juntos por los colores del arcoíris. El tiempo de animación define cuánto dura cada paso de color.',
  'Lights flash on in your colors when you press an input, then fade out over the animation time. The player LEDs stay lit in their color.': 'Las luces se encienden con tus colores al presionar una entrada y luego se desvanecen durante el tiempo de animación. Los LED de jugador se mantienen encendidos con su color.',
  'Every LED (except the player LEDs) slowly blends between the first six colors below, like fairy lights.': 'Cada LED (excepto los de jugador) se mezcla lentamente entre los primeros seis colores de abajo, como luces de hadas.',
  'This controller is using an effect this app doesn’t know about.': 'Este control usa un efecto que esta app no reconoce.',

  // Brightness & timing
  'Brightness & timing': 'Brillo y tiempo',
  'Changes apply instantly — press Save to keep them.': 'Los cambios se aplican al instante; presiona Guardar para conservarlos.',
  'Brightness': 'Brillo',
  'How bright the LEDs are, from off to full.': 'Qué tan brillantes son los LED, desde apagados hasta el máximo.',
  'To save battery, the controller limits brightness to about a third while connected wirelessly.': 'Para ahorrar batería, el control limita el brillo a aproximadamente un tercio mientras está conectado de forma inalámbrica.',
  'Animation time': 'Tiempo de animación',
  'How long one animation step or fade takes, in milliseconds. Lower is faster.': 'Cuánto dura un paso de animación o un desvanecimiento, en milisegundos. Menos es más rápido.',
  'ms': 'ms',
  'Idle glow': 'Brillo en reposo',
  'After a while without input the lights go dark and a single LED glows to show battery status. Turn off to keep it dark too.': 'Tras un rato sin entradas, las luces se apagan y un solo LED brilla para mostrar el estado de la batería. Desactívalo para que ese LED también quede apagado.',
  'Cyan = on battery, orange = charging, green = fully charged.': 'Cian = con batería, naranja = cargando, verde = carga completa.',

  // Colors
  'Colors': 'Colores',
  'One color per LED group. Tap a swatch to pick, or type a hex code.': 'Un color por grupo de LED. Toca una muestra para elegir o escribe un código hexadecimal.',
  'Group {n}': 'Grupo {n}',
  '{name} color': 'Color de {name}',
  'Player': 'Jugador',
  'These LEDs also show your player number when connected and chase while pairing, using this color.': 'Estos LED también muestran tu número de jugador al conectarse y hacen un efecto de persecución durante el emparejamiento, con este color.',
  'Always shows this color, in every mode.': 'Siempre muestra este color, en todos los modos.',
  'Unused': 'Sin usar',
  'Fairy {n}': 'Hada {n}',
  'Authentic mode picks its own colors, so your colors are ignored, except the Player LED.': 'El modo Auténtico elige sus propios colores, así que se ignoran los tuyos, excepto el del LED de jugador.',
  'Your colors are ignored in Rainbow mode, except the Player LED.': 'En el modo Arcoíris se ignoran tus colores, excepto el del LED de jugador.',
  'Fairy mode blends between the first six colors below. The Player LED always keeps its own color.': 'El modo Hadas mezcla los primeros seis colores de abajo. El LED de jugador siempre mantiene su propio color.',
  'Quick palettes': 'Paletas rápidas',
  'Color presets': 'Colores predefinidos',
  'Ocean': 'Océano',
  'Sunset': 'Atardecer',
  'Lavender': 'Lavanda',
  'Snow': 'Nieve',
  'Apply the {name} palette': 'Aplicar la paleta {name}',
  '{name} colors applied': 'Colores {name} aplicados',
  'Undo': 'Deshacer',
  'Paste to all': 'Pegar en todos',
  'Pasting…': 'Pegando…',
  'Pasted': 'Pegado',
  'No color': 'Sin color',
  'Set every group to a hex color from your clipboard': 'Aplica a todos los grupos un color hexadecimal de tu portapapeles',
  'Clipboard access was blocked. Copy a hex color like #FF8800 and try again.': 'Se bloqueó el acceso al portapapeles. Copia un color hexadecimal como #FF8800 e inténtalo de nuevo.',
  'The clipboard doesn’t contain a hex color like #FF8800.': 'El portapapeles no contiene un color hexadecimal como #FF8800.',
  'All group colors': 'Colores de todos los grupos',
  'Set every LED group to the same color at once (like hoja2’s “Paste All”).': 'Pone todos los grupos de LED en el mismo color a la vez (como “Paste All” en hoja2).',
};
