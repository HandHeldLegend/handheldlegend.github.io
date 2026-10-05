/**
 * Spanish (neutral Latin American) translations — snapback. English source text → translation.
 * Machine-drafted; NEEDS NATIVE REVIEW. Terminology: src/i18n/GLOSSARY.md.
 */
export default {
  // ---- Shared / generic (duplicated here so this area is complete on its own) ----
  'Left': 'Izquierdo',
  'Right': 'Derecho',
  'Stick': 'Joystick',
  'Left stick': 'Joystick izquierdo',
  'Right stick': 'Joystick derecho',
  'Off': 'Desactivado',
  'View': 'Ver',

  // ---- View ----
  'Auto watches for the moment you let go and holds back only the rebound — there is no cutoff to tune.': 'Auto detecta el momento en que sueltas el joystick y frena solo el rebote; no hay frecuencia de corte que ajustar.',
  'Filter off: the stick reports its raw output. Use this to see your stick’s natural snapback.': 'Filtro desactivado: el joystick envía su salida sin procesar. Úsalo para ver el snapback natural de tu joystick.',
  'Snapback filter': 'Filtro de snapback',
  'Changes apply instantly — press Save to keep them.': 'Los cambios se aplican al instante; presiona Guardar para conservarlos.',
  '{stick}: snapback waveform': '{stick}: forma de onda del snapback',
  'Flick the right stick…': 'Suelta de golpe el joystick derecho…',
  'Flick the left stick…': 'Suelta de golpe el joystick izquierdo…',
  'No capture yet': 'Aún no hay capturas',
  'Recent right stick captures': 'Capturas recientes del joystick derecho',
  'Recent left stick captures': 'Capturas recientes del joystick izquierdo',
  'Waiting for the right stick to be flicked and released.': 'Esperando a que empujes y sueltes el joystick derecho.',
  'Waiting for the left stick to be flicked and released.': 'Esperando a que empujes y sueltes el joystick izquierdo.',
  'Listening': 'Escuchando',
  'Overshoot': 'Sobreimpulso',
  'How far the stick swung past center to the other side after release. Lower is better.': 'Cuánto pasó el joystick del centro hacia el otro lado al soltarlo. Menos es mejor.',
  'Settled': 'Estable en',
  'Time until the stick stays within ±5 % of center.': 'Tiempo hasta que el joystick se mantiene dentro de ±5 % del centro.',
  'Peak +': 'Pico +',
  'Highest value recorded.': 'Valor más alto registrado.',
  'Peak −': 'Pico −',
  'Lowest value recorded.': 'Valor más bajo registrado.',
  '{axis} at {time}': '{axis} a las {time}',
  'Analyzer': 'Analizador',
  'What the right stick does in the 31 ms after you let go.': 'Lo que hace el joystick derecho en los 31 ms después de soltarlo.',
  'What the left stick does in the 31 ms after you let go.': 'Lo que hace el joystick izquierdo en los 31 ms después de soltarlo.',
  'Captured': 'Capturado',
  'Flick again to compare — the last few captures stay below the plot.': 'Vuelve a soltarlo para comparar; las últimas capturas quedan debajo de la gráfica.',
  'New right stick capture': 'Nueva captura del joystick derecho',
  'New left stick capture': 'Nueva captura del joystick izquierdo',
  'How to test:': 'Cómo probarlo:',
  'Push a stick all the way to one side and let it snap back. The controller records the moment it returns and shows it under that stick. Try each filter mode to compare.': 'Empuja un joystick hasta un lado y suéltalo para que regrese solo. El control registra el momento en que vuelve y lo muestra debajo de ese joystick. Prueba cada modo de filtro para comparar.',

  // ---- Waveform ----
  'Left stick X': 'Joystick izquierdo X',
  'Left stick Y': 'Joystick izquierdo Y',
  'Right stick X': 'Joystick derecho X',
  'Right stick Y': 'Joystick derecho Y',
  'Snapback waveform': 'Forma de onda del snapback',
  'Waiting for a flick…': 'Esperando a que sueltes el joystick…',

  // ---- Settings (settings.js) ----
  'Filter mode': 'Modo de filtro',
  'How the left stick suppresses the rebound past center after you let go.': 'Cómo el joystick izquierdo suprime el rebote más allá del centro al soltarlo.',
  'How the right stick suppresses the rebound past center after you let go.': 'Cómo el joystick derecho suprime el rebote más allá del centro al soltarlo.',
  'Low-pass: smooths fast movement near the center (adjust with the cutoff). Auto: detects a release and holds back the rebound only when it happens. Off: raw stick output — use this to see your stick’s natural snapback.': 'Pasa bajos: suaviza el movimiento rápido cerca del centro (se ajusta con la frecuencia de corte). Auto: detecta cuando sueltas y frena el rebote solo cuando ocurre. Desactivado: salida sin procesar del joystick; úsalo para ver el snapback natural de tu joystick.',
  'Low-pass': 'Pasa bajos',
  'Auto': 'Auto',
  'Filter cutoff': 'Frecuencia de corte',
  'Low-pass cutoff frequency for the left stick. Lower = stronger smoothing.': 'Frecuencia de corte del filtro pasa bajos del joystick izquierdo. Más baja = suavizado más fuerte.',
  'Low-pass cutoff frequency for the right stick. Lower = stronger smoothing.': 'Frecuencia de corte del filtro pasa bajos del joystick derecho. Más baja = suavizado más fuerte.',
  'Lower values remove more bounce but add a touch of delay to fast flicks near the center; higher values feel snappier but let more rebound through. Default 60 Hz. Only used in Low-pass mode.': 'Los valores bajos eliminan más rebote, pero agregan un poco de retraso a los movimientos rápidos cerca del centro; los valores altos se sienten más ágiles, pero dejan pasar más rebote. Predeterminado: 60 Hz. Solo se usa en el modo Pasa bajos.',
  'Hz': 'Hz',
};
