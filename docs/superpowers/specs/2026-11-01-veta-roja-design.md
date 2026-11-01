# Veta Roja — Diseño

Fecha: 2026-11-01

## Intención y por qué

Veta Roja es un sitio de educación marxista-leninista con enfoque en Zacatecas. Su forma de llegar a la gente es la calle: se pegan códigos QR, uno por tema. Cada QR lleva a una **landing page**, que funciona como una presentación breve: un análisis materialista del tema, visualmente atractivo, que termina invitando a la persona a unirse a la organización de la clase obrera.

La variedad visual es parte del objetivo. El dueño quiere que las landings no aburran, por eso el sistema ofrece muchos themes.

Contenido de referencia (texto de estudio que el dueño ya tiene): condiciones materiales, contradicción, socialización de la fuerza productiva, relaciones de producción, ejemplos históricos (Lyon 1831 y 1834, cartismo 1835–1848, Silesia 1844), y la crítica de Marx a Feuerbach. Está incompleto y servirá como contenido de ejemplo y de prueba, no como contenido final.

## Objetivos

1. Que el admin pueda crear un número ilimitado de landings desde un panel, llenándolas campo por campo.
2. Que cada landing se lea como una presentación breve, fluida en celular (la gente llega escaneando un QR).
3. Que cada landing use uno de 22 themes elegidos por el admin.
4. Que cada landing tenga una dirección propia y estable, pensada para imprimirse en un QR.
5. Que la invitación a unirse a la organización lleve a la persona, con un botón, a un canal de WhatsApp de la organización.

## No objetivos (por ahora)

- Más usuarios además del admin. El modelo de datos debe permitir agregar roles y usuarios después, pero no se construye ahora.
- Analítica detallada (escaneos por QR, mapas de calor). No se incluye.
- Comentarios, foros o cuentas para visitantes.
- Un CMS general o blog. Solo landings en forma de presentación.
- Otros idiomas. Todo en español.

## Anti-objetivos (fracaso aunque funcione)

- **Depender de cualquier servicio externo.** Nada de Google Fonts, CDN de terceros, Supabase, Firebase, correo o analítica de terceros. Fuentes, imágenes y código se alojan por nosotros.
- Que las landings se vean todas iguales o como plantilla genérica.
- Fuentes tipo Comic Sans o cursivas informales en cualquier theme.
- Que una landing sea lenta o difícil de leer en un celular barato con datos limitados.

## Decisiones del dueño

- Proyecto: **veta-roja**. Frontend en **React + Vite**.
- Base de datos: **Postgres**.
- Landings con aspecto de presentación breve, siguiendo el enfoque de la habilidad `/frontend-slides`.
- Usuario inicial: solo **admin**.
- El panel permite crear **n landings** y elegir el theme de cada una.
- El contenido se llena **campo por campo en un formulario**, con opciones para recuadros, animaciones, imágenes y todo lo necesario.
- Sin servicios externos.
- **Llamado a la acción:** el sitio **no recoge datos personales**. Al final de la landing hay un botón con un enlace a un **canal de WhatsApp** de la organización (el tipo de canal donde solo quien administra publica y las personas solo leen). Así se evitan formularios, números guardados y avisos de privacidad por datos recogidos.
- **Dominio y servidor:** el dominio será `vetaroja.mx`; el dueño aún no lo compra pero queda decidido y es permanente. El sitio se aloja en un **servidor propio** del dueño.
- Al menos 20 themes. Quedaron 22 (lista abajo).
- Sin Comic Sans ni letras parecidas.
- La propuesta de tipos de diapositiva (tabla abajo) está aprobada "por el momento".

### Los 22 themes

Mockups de referencia en `docs/superpowers/mockups/` (son bocetos de dirección, no el diseño final).

| # | Nombre | Idea |
|---|---|---|
| 1 | Cantera y tinta | Rosa de cantera, serif editorial, acento rojo |
| 2 | Cartel constructivista | Rojo, negro, crema, diagonales, tipografía pesada |
| 3 | Socavón | Fondo oscuro de mina, veta roja, detalles en plata |
| 4 | Índice Blanco | Basado en chinesemarxism.org: blanco, negro, rojo, azul |
| 5 | Índice Negro | Mismo sistema, en negro |
| 6 | Índice Papel | Fondo crema, azul y rojo |
| 7 | Índice Azul Pálido | Fondo azul suave, acentos fuertes |
| 8 | Villista sepia | Foto antigua, bordes quemados, 1914 |
| 9 | Rayos rojos | Rayos desde abajo, cartel soviético |
| 10 | Periódico obrero | Portada de periódico con columnas |
| 11 | Cianotipo | Plano técnico azul con cuadrícula |
| 12 | Xilografía | Blanco y negro tosco, estilo Gráfica Popular |
| 13 | Mural | Terracota, ocre, verde azulado, formas grandes |
| 14 | Industrial | Amarillo y negro con rayas de advertencia |
| 15 | Manifiesto | Mucho blanco, una frase grande |
| 16 | Neón | Morado oscuro con rosa y cian |
| 17 | Estarcido | Verde oliva, letra de plantilla, textura de pared |
| 18 | Oro y carmesí | Rojo profundo con dorado, solemne |
| 19 | Concreto | Gris crudo, letras pesadas |
| 20 | Lotería | Cada diapositiva como carta de lotería |
| 21 | Pop-art | Puntos de trama, amarillo y rosa, globos de cómic |
| 22 | Fanzine | Collage de fotocopia, recortes, cinta |

Un theme define colores, tipografías, bordes, texturas y estilo de animación. El contenido de una landing no depende de su theme: cambiar de theme no debe obligar a reescribir nada.

### Tipos de diapositiva (aprobados por ahora)

| Tipo | Campos principales |
|---|---|
| Portada | Título, subtítulo, imagen de fondo |
| Texto con énfasis | Párrafo con palabras resaltadas |
| Cita destacada | Frase, autor, fecha |
| Recuadro de concepto | Término y definición |
| Dato o cifra grande | Número, explicación |
| Línea de tiempo | Hechos con fecha, en orden |
| Comparación | Dos columnas con título y puntos |
| Imagen o galería | Imágenes con pie de foto |
| Llamado a la acción | Texto de invitación, texto del botón y enlace al canal de WhatsApp |

Toda diapositiva tiene una animación de entrada a elegir y se puede reordenar, ocultar y duplicar. Una landing tiene título interno, dirección propia (slug), theme y estado (borrador o publicada).

## Mis decisiones (marcadas como mías, no acordadas)

- **Backend:** Node con Fastify, Drizzle ORM y Postgres. Sesiones por cookie `httpOnly` con contraseñas hasheadas con argon2. Elegido por ser JavaScript de punta a punta y simple de mantener por una sola persona.
- **Contenido de una landing:** se guarda como lista de diapositivas estructurada (JSON) en Postgres, y React la renderiza según el theme.
- **Dirección pública:** `/l/<slug>`.
- **Código QR:** el QR se genera en el mismo lugar donde se crea la landing. Al guardarla, la pantalla del editor muestra de inmediato el QR de su dirección pública con botones para descargarlo (SVG y PNG) e imprimirlo, y sigue disponible al editarla después. Se genera en nuestro servidor, sin servicio externo. **Decisión del dueño.**
- **Enlace del canal:** hay un enlace de canal por defecto para todo el sitio, configurable en el panel, que cada landing puede reemplazar por otro (por ejemplo, un canal por tema). El enlace de un canal es un servicio de WhatsApp, pero es solo un enlace de salida: el sitio no depende de él para funcionar.
- **Imágenes subidas:** se guardan en disco del propio servidor y se optimizan al subirlas.
- **Themes:** se implementan como variables de diseño y estilos propios por theme, con fuentes de licencia abierta alojadas por nosotros.
- **Primera carga y vista previa de enlaces:** el servidor entrega cada landing con su título, descripción e imagen en el HTML (para que la vista previa en WhatsApp funcione) y con el contenido ya visible, y React toma el control después. Meta: que la primera pantalla sea legible rápido en un celular modesto con datos limitados. Cada landing carga solo las fuentes y estilos de su theme.
- **Los 22 themes por fases:** el sistema de themes se construye completo desde el principio; los themes se entregan por tandas, empezando por los cuatro de la familia Índice y dos de los primeros, y el resto después. Las fuentes de todos son de licencia abierta y se alojan por nosotros.
- **Cuenta admin:** se crea con un comando de instalación. Si se pierde la contraseña, se restablece con otro comando en el servidor (no hay correo). Un solo admin, sin 2FA por ahora.
- **Landing no publicada o borrada:** quien escanee un QR viejo ve una página "Este tema ya no está disponible" con enlace a la portada. La ruta `/` es una portada sencilla de Veta Roja con su presentación y el botón al canal de WhatsApp, sin lista pública de landings.
- **Límites de contenido:** máximo 30 diapositivas por landing, imágenes de hasta 5 MB (se reducen al subirse). En el texto con énfasis se marcan palabras resaltadas y negritas dentro del propio campo. El panel muestra una vista previa en vivo de la landing con el theme elegido mientras se edita.
- **Accesibilidad y rendimiento:** diseño pensado primero para celular, contraste suficiente, respeto de la preferencia de reducir movimiento, y animaciones que no estorban la lectura.

## Restricciones

- Sin servicios externos de ningún tipo.
- Dirección de la landing estable una vez impresa: cambiar el slug no debe romper un QR ya pegado (por ejemplo, se conserva una redirección).
- Sitio público con contenido político: el panel admin debe estar protegido (límite de intentos, sesión segura).
- El proyecto vive en la carpeta `veta-roja` dentro de la carpeta de GitHub del dueño, junto a otros proyectos que no se tocan.

## Lo que queda al constructor

- Estructura exacta del proyecto, esquema de la base de datos y API.
- Cómo se navega una landing (deslizar, teclado, scroll) en celular y escritorio.
- Catálogo concreto de animaciones y cómo se previsualizan en el panel.
- Hosting y despliegue, mientras no use servicios externos de terceros.
- Detalles de diseño de cada theme dentro de la dirección mostrada en los mockups.
