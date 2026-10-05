/**
 * Spanish (neutral Latin American) translations — input. English source text → translation.
 * Machine-drafted; NEEDS NATIVE REVIEW. Terminology: src/i18n/GLOSSARY.md.
 */
export default {
  // ---- Page, tabs, mode card (view.js) ----
  'Remap': 'Reasignar',
  'Analog calibration': 'Calibración analógica',
  'Output mode': 'Modo de salida',
  '{mode} mode': 'Modo {mode}',
  '{mode}:': '{mode}:',
  'Each mode has its own layout. Pick the one you play in, then tap a button below to change it.':
    'Cada modo tiene su propia distribución. Elige el modo en el que juegas y luego toca un botón abajo para cambiarlo.',
  'Reset this mode': 'Restablecer este modo',
  'Reset {mode}': 'Restablecer {mode}',
  'Reset all modes': 'Restablecer todos los modos',
  'Quickly reset this mode to its default layout.': 'Restablece rápidamente este modo a su distribución predeterminada.',
  'Reset every mode?': '¿Restablecer todos los modos?',
  'Reset {mode} mode?': '¿Restablecer el modo {mode}?',
  'All six layouts go back to this controller\'s defaults. Your changes in every mode are lost.':
    'Las seis distribuciones vuelven a los valores predeterminados de este control. Se perderán tus cambios en todos los modos.',
  'Every input in {mode} mode goes back to this controller\'s default layout and settings. Other modes are not affected.':
    'Todas las entradas del modo {mode} vuelven a la distribución y los ajustes predeterminados de este control. Los demás modos no cambian.',
  'All modes reset to defaults — press Save to keep it.': 'Todos los modos se restablecieron. Presiona Guardar para conservar el cambio.',
  '{mode} mode reset to defaults — press Save to keep it.': 'El modo {mode} se restableció. Presiona Guardar para conservar el cambio.',
  'The controller did not confirm the reset. Try again.': 'El control no confirmó el restablecimiento. Inténtalo de nuevo.',
  'Reset': 'Restablecer',
  'Done': 'Listo',
  'Save': 'Guardar',
  'Cancel': 'Cancelar',
  'This controller doesn\'t have a {mode} connection, so this layout is only kept for completeness.':
    'Este control no tiene conexión {mode}, así que esta distribución solo se conserva para que el perfil esté completo.',

  // ---- Mode descriptions (mapping.js) ----
  'Nintendo Switch, and Switch Pro mode on PC.': 'Nintendo Switch y modo Switch Pro en PC.',
  'Windows PCs and Xbox-style games.': 'PC con Windows y juegos estilo Xbox.',
  'SNES / NES consoles through the controller port.': 'Consolas SNES / NES a través del puerto de control.',
  'Nintendo 64 through the controller port.': 'Nintendo 64 a través del puerto de control.',
  'GameCube / Wii through the controller port, and GameCube adapter (Slippi) mode over USB.':
    'GameCube / Wii a través del puerto de control, y modo adaptador de GameCube (Slippi) por USB.',
  'Steam mode for Steam and SDL games on PC (supports paddles and extra buttons).':
    'Modo Steam para juegos de Steam y SDL en PC (admite paletas y botones adicionales).',

  // ---- Input grid ----
  'Buttons & inputs': 'Botones y entradas',
  'What each input sends.': 'Lo que envía cada entrada.',
  'What each input sends in {mode} mode. Pressed inputs light up.': 'Lo que envía cada entrada en el modo {mode}. Las entradas presionadas se iluminan.',
  'Buttons': 'Botones',
  'Analog inputs': 'Entradas analógicas',
  'Stick directions': 'Direcciones del joystick',
  'Hall-effect inputs that measure how far they are pressed, such as analog triggers. They can act as a button with an adjustable activation point, as rapid trigger, or as a full analog output.':
    'Entradas de efecto Hall que miden qué tanto se presionan, como los gatillos analógicos. Pueden funcionar como un botón con punto de activación ajustable, como rapid trigger o como salida analógica completa.',
  'Each stick direction can be sent somewhere else too — for example to the d-pad or a button.':
    'Cada dirección del joystick también se puede enviar a otro lugar, por ejemplo a la cruceta o a un botón.',
  'This controller did not report any remappable inputs.': 'Este control no informó ninguna entrada que se pueda reasignar.',
  '{input} sends {output} in {mode} mode.': '{input} envía {output} en el modo {mode}.',
  '{input} is off in {mode} mode.': '{input} está desactivado en el modo {mode}.',
  'Threshold mode, activation point {value}.': 'Modo umbral, punto de activación {value}.',
  'Rapid trigger mode.': 'Modo rapid trigger.',
  'Full analog mode.': 'Modo analógico completo.',
  'Threshold {value}': 'Umbral {value}',
  'Rapid': 'Rapid',
  'Analog inputs need calibration.': 'Las entradas analógicas necesitan calibración.',
  'Calibrate them so presses register across their full travel.': 'Calíbralas para que las pulsaciones se detecten en todo su recorrido.',
  'Calibrate now': 'Calibrar ahora',
  'Needs calibration': 'Necesita calibración',
  'Close editor': 'Cerrar editor',
  'Pick an input': 'Elige una entrada',
  'Choose a button on the left to see what it does and change it.': 'Elige un botón a la izquierda para ver qué hace y cambiarlo.',

  // ---- Editor (editor.js) ----
  '{input} in {mode} mode': '{input} en el modo {mode}',
  'sends in {mode} mode': 'envía en el modo {mode}',
  'Change': 'Cambiar',
  'Nothing': 'Nada',
  'Input disabled in this mode': 'Entrada desactivada en este modo',
  'Send in {mode} mode': 'Enviar en el modo {mode}',
  'Outputs in {mode} mode': 'Salidas del modo {mode}',
  'None': 'Ninguna',
  'Disable this input in this mode': 'Desactivar esta entrada en este modo',
  'used by {inputs}': 'usado por {inputs}',
  'D-pad': 'Cruceta',
  'Analog triggers': 'Gatillos analógicos',
  'Live': 'En vivo',
  'What the controller reports for this input with the current settings. Press it to test.':
    'Lo que el control informa para esta entrada con los ajustes actuales. Presiónala para probar.',
  '{input} live value': 'Valor en vivo de {input}',
  'Pressed': 'Presionado',
  'Released': 'Suelto',
  'Mode': 'Modo',
  'Analog mode': 'Modo analógico',
  'Presses as soon as it moves down, and releases as soon as it starts coming back up — great for fast repeated presses.':
    'Se activa en cuanto empieza a bajar y se suelta en cuanto empieza a subir. Ideal para pulsaciones rápidas y repetidas.',
  'Counts as pressed once it passes the activation point, like a normal button with an adjustable trigger point.':
    'Cuenta como presionado al pasar el punto de activación, como un botón normal con un punto de activación ajustable.',
  'Sends the full analog travel, so games see exactly how far it is pressed.':
    'Envía todo el recorrido analógico, así los juegos ven exactamente qué tanto está presionado.',
  'Pick an output to set how this analog input behaves.': 'Elige una salida para configurar cómo se comporta esta entrada analógica.',
  'Rapid trigger sensitivity': 'Sensibilidad del rapid trigger',
  'Activation point': 'Punto de activación',
  'How far it has to travel to change state: down this much to press, back up this much to release. Smaller = quicker re-presses, but more sensitive to light touches.':
    'Cuánto tiene que moverse para cambiar de estado: bajar esta distancia para presionar y subir esta distancia para soltar. Menor = repeticiones más rápidas, pero más sensible a toques leves.',
  'How far you press before it counts. {half} is halfway down.': 'Qué tanto debes presionar para que cuente. {half} es la mitad del recorrido.',
  'Travel needed to press or release.': 'Recorrido necesario para presionar o soltar.',
  'How far down it must go to count as pressed.': 'Qué tan abajo debe llegar para contar como presionado.',
  'Output when pressed': 'Salida al presionar',
  'How far {output} is pushed when this input fires.': 'Qué tanto se acciona {output} cuando se activa esta entrada.',
  'In GameCube mode, analog triggers driven this way always output at least {min} (the console\'s resting minimum).':
    'En el modo GameCube, los gatillos analógicos controlados así siempre envían al menos {min} (el mínimo en reposo de la consola).',
  'Copy settings': 'Copiar ajustes',
  'Paste settings': 'Pegar ajustes',
  'Copy this input\'s mode and values, then paste them onto another analog input.':
    'Copia el modo y los valores de esta entrada y luego pégalos en otra entrada analógica.',
  'Settings copied — open another analog input and press Paste.': 'Ajustes copiados. Abre otra entrada analógica y presiona Pegar ajustes.',
  'Settings copied inside the app (clipboard access was blocked).': 'Ajustes copiados dentro de la app (se bloqueó el acceso al portapapeles).',
  'Nothing to paste — copy an analog input\'s settings first.': 'No hay nada que pegar. Primero copia los ajustes de una entrada analógica.',
  'Settings pasted.': 'Ajustes pegados.',
  'Calibration': 'Calibración',
  'Calibrate': 'Calibrar',
  'Finish': 'Finalizar',
  'Calibrating all…': 'Calibrando todo…',
  'Press Calibrate, push it all the way down and release 3–4 times, then press Finish.':
    'Presiona Calibrar, presiona la entrada hasta el fondo y suéltala 3–4 veces, y luego presiona Finalizar.',

  // ---- Input / output kinds and analog modes (mapping.js) ----
  'Button': 'Botón',
  'Analog': 'Analógico',
  'Stick direction': 'Dirección del joystick',
  'Off': 'Desactivado',
  'Disabled': 'Desactivado',
  'Analog trigger': 'Gatillo analógico',
  'Rapid trigger': 'Rapid trigger',
  'Threshold': 'Umbral',
  'Full analog': 'Analógico completo',

  // ---- Output names (descriptive ones; printed button names stay as-is) ----
  'D Up': 'Cruceta arriba',
  'D Down': 'Cruceta abajo',
  'D Left': 'Cruceta izquierda',
  'D Right': 'Cruceta derecha',
  'Plus': 'Botón +',
  'Minus': 'Botón −',
  'Capture': 'Captura',
  'Back': 'Atrás',
  'Guide': 'Guía',
  'Share': 'Compartir',
  'South': 'Sur',
  'East': 'Este',
  'West': 'Oeste',
  'North': 'Norte',
  'C Up': 'C arriba',
  'C Down': 'C abajo',
  'C Left': 'C izquierda',
  'C Right': 'C derecha',
  'S Guide': 'Guía S',

  // ---- Output hints ----
  'Left trigger (analog)': 'Gatillo izquierdo (analógico)',
  'Right trigger (analog)': 'Gatillo derecho (analógico)',
  'L trigger (analog)': 'Gatillo L (analógico)',
  'R trigger (analog)': 'Gatillo R (analógico)',
  'L trigger click (digital)': 'Clic del gatillo L (digital)',
  'R trigger click (digital)': 'Clic del gatillo R (digital)',
  'Left trigger (digital)': 'Gatillo izquierdo (digital)',
  'Right trigger (digital)': 'Gatillo derecho (digital)',
  'Left paddle 1': 'Paleta izquierda 1',
  'Right paddle 1': 'Paleta derecha 1',
  'Left paddle 2': 'Paleta izquierda 2',
  'Right paddle 2': 'Paleta derecha 2',
  'Misc 3 (power)': 'Varios 3 (encendido)',
  'Misc 4': 'Varios 4',
  'Misc 5': 'Varios 5',
  'Misc 6': 'Varios 6',
  'Touchpad 1': 'Panel táctil 1',
  'Touchpad 2': 'Panel táctil 2',
  'Stick left': 'Joystick izquierdo',
  'Stick right': 'Joystick derecho',

  // ---- Calibration tab (calibration.js) ----
  'Teach the controller the full travel of its analog (hall-effect) inputs, such as triggers.':
    'Enséñale al control el recorrido completo de sus entradas analógicas (de efecto Hall), como los gatillos.',
  'Start calibration': 'Iniciar calibración',
  'Finish calibration': 'Finalizar calibración',
  'Press {button}.': 'Presiona {button}.',
  'Fully press and release every analog input below 3–4 times.': 'Presiona a fondo y suelta cada entrada analógica de abajo 3–4 veces.',
  'Check each bar now reaches both ends, then press {button}.': 'Comprueba que cada barra llegue ahora a ambos extremos y luego presiona {button}.',
  'Calibrating.': 'Calibrando.',
  'Fully press and release every analog input 3–4 times, then press Finish.':
    'Presiona a fondo y suelta cada entrada analógica 3–4 veces, y luego presiona Finalizar calibración.',
  'Calibrating…': 'Calibrando…',
  'Calibrated': 'Calibrado',
  'Range {min}–{max}': 'Rango {min}–{max}',
  'Not calibrated': 'Sin calibrar',
  'This controller has no analog inputs to calibrate.': 'Este control no tiene entradas analógicas que calibrar.',
  'The controller did not start calibrating. Try again.': 'El control no inició la calibración. Inténtalo de nuevo.',
  'Calibration finished — press Save to keep it.': 'Calibración finalizada. Presiona Guardar para conservarla.',
  'The controller did not confirm the calibration.': 'El control no confirmó la calibración.',
};
