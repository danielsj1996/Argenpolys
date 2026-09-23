const socket = io();

// ==========================================
// ELEMENTOS DEL DOM
// ==========================================

// Pantallas
const pantallaInicio = document.getElementById('pantallaInicio');
const pantallaCrear = document.getElementById('pantallaCrear');
const pantallaUnirse = document.getElementById('pantallaUnirse');
const pantallaSala = document.getElementById('pantallaSala');
const pantallaPartida = document.getElementById('pantallaPartida');

// Pantalla Inicio
const btnMostrarCrear = document.getElementById('btnMostrarCrear');
const btnMostrarUnirse = document.getElementById('btnMostrarUnirse');
const btnVolverInicioCrear = document.getElementById('btnVolverInicioCrear');
const btnVolverInicioUnirse = document.getElementById('btnVolverInicioUnirse');

// Crear Partida
const nombreCrear = document.getElementById('nombreCrear');
const btnCrearSala = document.getElementById('btnCrearSala');
const mensajeCrear = document.getElementById('mensajeCrear');

// Unirse a Partida
const codigoSala = document.getElementById('codigoSala');
const nombreUnirse = document.getElementById('nombreUnirse');
const btnUnirseSala = document.getElementById('btnUnirseSala');
const mensajeUnirse = document.getElementById('mensajeUnirse');

// Sala de Espera
const mensajeSala = document.getElementById('mensajeSala');
const listaJugadores = document.getElementById('listaJugadores');
const codigoMostrar = document.getElementById('codigoMostrar');
const codigoCompartir = document.getElementById('codigoCompartir');
const btnCopiarCodigo = document.getElementById('btnCopiarCodigo');
const codigoPartida = document.getElementById('codigoPartida');
const estadoSala = document.getElementById('estadoSala');
const contadorJugadores = document.getElementById('contadorJugadores');
const zonaAnfitrion = document.getElementById('zonaAnfitrion');
const esperandoAnfitrion = document.getElementById('esperandoAnfitrion');
const btnIniciarPartida = document.getElementById('btnIniciarPartida');

// Partida
const btnTirarDados = document.getElementById('btnTirarDados');
const mensajeDados = document.getElementById('mensajeDados');
const dineroJugador = document.getElementById('dineroJugador');
const listaJugadoresPartida = document.getElementById('listaJugadoresPartida');
const nombreJugadorPartida = document.getElementById('nombreJugadorPartida');
const posicionJugadorPartida = document.getElementById('posicionJugadorPartida');
const btnComprarPropiedad = document.getElementById('btnComprarPropiedad');
const btnPasarTurno = document.getElementById('btnPasarTurno');
const btnPagarFianza = document.getElementById('btnPagarFianza');
const historialEventos = document.getElementById('historialEventos');
const btnSubastar = document.getElementById('btnSubastar');
const btnGestionarPropiedades = document.getElementById('btnGestionarPropiedades');
const btnIntercambiar = document.getElementById('btnIntercambiar');
const btnUsarTarjetaCarcel = document.getElementById('btnUsarTarjetaCarcel');
const btnPagarDeuda = document.getElementById('btnPagarDeuda');
const btnDeclararBancarrota = document.getElementById('btnDeclararBancarrota');
const modalGestion = document.getElementById('modalGestion');
const gestionTitulo = document.getElementById('gestionTitulo');
const gestionContenido = document.getElementById('gestionContenido');
const btnCerrarGestion = document.getElementById('btnCerrarGestion');

// NUEVO: botón para abandonar la partida
const btnSalirPartida = document.getElementById('btnSalirPartida');

// Temporizador de turno
const temporizadorTurno = document.getElementById('temporizadorTurno');
const temporizadorBarra = document.getElementById('temporizadorBarra');
const temporizadorTexto = document.getElementById('temporizadorTexto');

// Chat en vivo
const chatWidget = document.getElementById('chatWidget');
const btnChatToggle = document.getElementById('btnChatToggle');
const chatBadgeNuevo = document.getElementById('chatBadgeNuevo');
const chatMensajes = document.getElementById('chatMensajes');
const chatFormulario = document.getElementById('chatFormulario');
const chatInput = document.getElementById('chatInput');

// Modal de Carta
const modalCarta = document.getElementById('modalCarta');
const cartaIcono = document.getElementById('cartaIcono');
const cartaTitulo = document.getElementById('cartaTitulo');
const cartaTexto = document.getElementById('cartaTexto');
const btnCerrarCarta = document.getElementById('btnCerrarCarta');


// ==========================================
// VARIABLES DE ESTADO
// ==========================================

let salaActual = null;
let jugadoresPartida = [];
let indiceTurno = 0;
let jugadorTurnoId = null;
let haTiradoDadosEsteTurno = false;
let saliendoDePartida = false;


// ==========================================
// SESIÓN PERSISTENTE (para reconexión)
// ==========================================

const CLAVE_TOKEN = 'argenpoly_token';
const CLAVE_SESION = 'argenpoly_sesion';

function obtenerToken() {
    let token = localStorage.getItem(CLAVE_TOKEN);

    if (!token) {
        token = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem(CLAVE_TOKEN, token);
    }

    return token;
}

const miToken = obtenerToken();

function guardarSesion(codigo, nombre) {
    try {
        localStorage.setItem(
            CLAVE_SESION,
            JSON.stringify({
                codigo,
                nombre,
                guardadoEn: Date.now()
            })
        );
    } catch (e) {
        /* almacenamiento no disponible */
    }
}

function leerSesionGuardada() {
    try {
        const datos = localStorage.getItem(CLAVE_SESION);
        return datos ? JSON.parse(datos) : null;
    } catch (e) {
        return null;
    }
}

function borrarSesion() {
    try {
        localStorage.removeItem(CLAVE_SESION);
    } catch (e) {
        /* nada que hacer */
    }
}


// ==========================================
// NUEVO: BORRAR SESIÓN COMPLETA
// ==========================================
// Se utiliza solamente cuando el jugador decide
// abandonar voluntariamente la partida.
//
// NO se utiliza al perder conexión ni al recargar,
// porque en esos casos queremos conservar la sesión
// para permitir la reconexión.

function borrarSesionCompleta() {
    try {
        localStorage.removeItem(CLAVE_SESION);
        localStorage.removeItem(CLAVE_TOKEN);
    } catch (e) {
        /* nada que hacer */
    }
}


// ==========================================
// BANNER DE ESTADO DE CONEXIÓN
// ==========================================

let bannerConexion = null;
let bannerConexionTexto = null;

function inicializarBannerConexion() {
    if (bannerConexion) return;

    bannerConexion = document.getElementById('bannerConexion');
    bannerConexionTexto = document.getElementById('bannerConexionTexto');
}

function mostrarBannerConexion(texto, tipo = 'info') {
    inicializarBannerConexion();

    if (!bannerConexion) return;

    bannerConexion.classList.remove(
        'oculto',
        'banner-info',
        'banner-error',
        'banner-ok'
    );

    bannerConexion.classList.add(`banner-${tipo}`);

    if (bannerConexionTexto) {
        bannerConexionTexto.textContent = texto;
    }
}

function ocultarBannerConexion() {
    inicializarBannerConexion();

    if (bannerConexion) {
        bannerConexion.classList.add('oculto');
    }
}

let seHabiaDesconectado = false;

function intentarReconectar() {
    const sesion = leerSesionGuardada();

    if (!sesion?.codigo) return;

    mostrarBannerConexion(
        '🔄 Reconectando a tu partida...',
        'info'
    );

    socket.emit(
        'intentar_reconectar',
        {
            codigo: sesion.codigo,
            token: miToken
        },
        respuesta => {

            if (!respuesta?.ok) {
                borrarSesion();
                ocultarBannerConexion();
                return;
            }

            salaActual = respuesta.sala;

            guardarSesion(
                salaActual.codigo,
                sesion.nombre
            );

            if (salaActual.estado === 'jugando') {

                jugadoresPartida = salaActual.jugadores;
                jugadorTurnoId = salaActual.turno;
                haTiradoDadosEsteTurno =
                    !!salaActual.haTiradoDados;

                if (codigoPartida) {
                    codigoPartida.textContent =
                        salaActual.codigo;
                }

                mostrarPantalla(pantallaPartida);

                if (
                    typeof window.iniciarTablero === 'function'
                ) {
                    window.iniciarTablero();
                }

                if (
                    typeof window.actualizarFichas === 'function'
                ) {
                    window.actualizarFichas(
                        jugadoresPartida
                    );
                }

                if (
                    typeof window.actualizarPropietariosTablero === 'function'
                ) {
                    window.actualizarPropietariosTablero(
                        salaActual.propiedades || {},
                        jugadoresPartida
                    );
                }

                actualizarJugadoresPartida();
                actualizarDineroJugador();
                actualizarMisPropiedades();
                actualizarTurno();

            } else {

                actualizarSala(salaActual);
                mostrarPantalla(pantallaSala);
            }

            cargarChat(
                respuesta.chat ||
                salaActual.chat ||
                []
            );

            mostrarBannerConexion(
                '✅ ¡Reconectado!',
                'ok'
            );

            setTimeout(
                ocultarBannerConexion,
                2500
            );
        }
    );
}

socket.on('connect', () => {

    if (saliendoDePartida) {
        return;
    }

    console.log('Conectado al servidor Socket.IO:', socket.id);


    if (seHabiaDesconectado) {

        intentarReconectar();

    } else {

        // Primera carga de la página: puede que haya
        // una sesión guardada de una recarga anterior.
        const sesion = leerSesionGuardada();

        if (sesion?.codigo) {
            intentarReconectar();
        }
    }

    seHabiaDesconectado = false;
});

socket.on('disconnect', () => {

    if (saliendoDePartida) {
        return;
    }
    seHabiaDesconectado = true;

    if (leerSesionGuardada()) {

        mostrarBannerConexion(
            '⚠️ Se perdió la conexión. Intentando reconectar...',
            'error'
        );
    }
});


// ==========================================
// EFECTOS DE SONIDO (WEB AUDIO API)
// ==========================================

let audioCtx = null;

function getAudioContext() {

    if (!audioCtx) {
        audioCtx =
            new (
                window.AudioContext ||
                window.webkitAudioContext
            )();
    }

    return audioCtx;
}

function reproducirTono(
    frecuencia,
    tipo,
    duracion,
    ganancia = 0.1
) {

    try {

        const ctx = getAudioContext();

        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = tipo;

        osc.frequency.setValueAtTime(
            frecuencia,
            ctx.currentTime
        );

        gain.gain.setValueAtTime(
            ganancia,
            ctx.currentTime
        );

        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            ctx.currentTime + duracion
        );

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + duracion);

    } catch (e) {
        // Audio no soportado o bloqueado
    }
}

function sonarDados() {

    for (let i = 0; i < 4; i++) {

        setTimeout(
            () =>
                reproducirTono(
                    140 + Math.random() * 80,
                    'triangle',
                    0.08,
                    0.12
                ),
            i * 60
        );
    }
}

function sonarDinero() {

    reproducirTono(
        587,
        'sine',
        0.1,
        0.12
    );

    setTimeout(
        () =>
            reproducirTono(
                880,
                'sine',
                0.25,
                0.15
            ),
        100
    );
}

function sonarCompra() {

    reproducirTono(
        523,
        'triangle',
        0.1,
        0.15
    );

    setTimeout(
        () =>
            reproducirTono(
                659,
                'triangle',
                0.1,
                0.15
            ),
        100
    );

    setTimeout(
        () =>
            reproducirTono(
                784,
                'triangle',
                0.22,
                0.15
            ),
        200
    );
}

function sonarCarcel() {

    reproducirTono(
        220,
        'sawtooth',
        0.2,
        0.15
    );

    setTimeout(
        () =>
            reproducirTono(
                164,
                'sawtooth',
                0.35,
                0.18
            ),
        180
    );
}

function sonarTurno() {

    reproducirTono(
        440,
        'sine',
        0.12,
        0.12
    );

    setTimeout(
        () =>
            reproducirTono(
                554,
                'sine',
                0.12,
                0.12
            ),
        120
    );

    setTimeout(
        () =>
            reproducirTono(
                659,
                'sine',
                0.25,
                0.15
            ),
        240
    );
}


// ==========================================
// REGISTRO DE HISTORIAL
// ==========================================

function agregarHistorial(
    mensaje,
    icono = '📌'
) {

    if (!historialEventos) return;

    const item =
        document.createElement('div');

    item.className =
        'historial-item';

    const ahora =
        new Date();

    const hora =
        ahora.toLocaleTimeString(
            'es-AR',
            {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }
        );

    item.innerHTML = `
        <span class="historial-icono">${icono}</span>
        <span class="historial-texto">${mensaje}</span>
        <span class="historial-hora">${hora}</span>
    `;

    historialEventos.prepend(item);

    while (
        historialEventos.children.length > 35
    ) {
        historialEventos.removeChild(
            historialEventos.lastChild
        );
    }
}


// ==========================================
// CAMBIAR PANTALLA
// ==========================================

function mostrarPantalla(pantalla) {

    pantallaInicio.classList.add('oculto');
    pantallaCrear.classList.add('oculto');
    pantallaUnirse.classList.add('oculto');
    pantallaSala.classList.add('oculto');
    pantallaPartida.classList.add('oculto');

    pantalla.classList.remove('oculto');

    if (chatWidget) {

        const dentroDeSala =
            pantalla === pantallaSala ||
            pantalla === pantallaPartida;

        chatWidget.classList.toggle(
            'oculto',
            !dentroDeSala
        );
    }
}


// ==========================================
// NAVEGACIÓN INICIAL
// ==========================================

if (btnMostrarCrear) {

    btnMostrarCrear.addEventListener(
        'click',
        () => {

            if (mensajeCrear) {
                mensajeCrear.textContent = '';
            }

            if (nombreCrear) {
                nombreCrear.value = '';
            }

            mostrarPantalla(
                pantallaCrear
            );

            if (nombreCrear) {
                nombreCrear.focus();
            }
        }
    );
}

if (btnMostrarUnirse) {

    btnMostrarUnirse.addEventListener(
        'click',
        () => {

            if (mensajeUnirse) {
                mensajeUnirse.textContent = '';
            }

            if (codigoSala) {
                codigoSala.value = '';
            }

            if (nombreUnirse) {
                nombreUnirse.value = '';
            }

            mostrarPantalla(
                pantallaUnirse
            );

            if (codigoSala) {
                codigoSala.focus();
            }
        }
    );
}

if (btnVolverInicioCrear) {

    btnVolverInicioCrear.addEventListener(
        'click',
        () => {
            mostrarPantalla(
                pantallaInicio
            );
        }
    );
}

if (btnVolverInicioUnirse) {

    btnVolverInicioUnirse.addEventListener(
        'click',
        () => {
            mostrarPantalla(
                pantallaInicio
            );
        }
    );
}


// ==========================================
// NUEVO: SALIR DE PARTIDA
// ==========================================

if (btnSalirPartida) {

    btnSalirPartida.addEventListener(
        'click',
        () => {

            // Evitar múltiples clics mientras se procesa la salida
            if (btnSalirPartida.disabled) {
                return;
            }

            if (!salaActual) {
                return;
            }

            const confirmar = window.confirm(
                '¿Estás seguro de que querés salir de la partida?\n\n' +
                'Vas a abandonar esta partida y tendrás que volver a ingresar si querés jugar nuevamente.'
            );

            if (!confirmar) {
                return;
            }

            btnSalirPartida.disabled = true;
            btnSalirPartida.textContent = '🚪 Saliendo...';

            mostrarBannerConexion(
                '🚪 Saliendo de la partida...',
                'info'
            );
            saliendoDePartida = true;
            socket.emit(
                'salir-partida',
                respuesta => {

                    // Aunque el servidor responda con un error,
                    // no borramos la sesión automáticamente.
                    if (!respuesta?.ok) {

                        saliendoDePartida = false;

                        btnSalirPartida.disabled = false;
                        btnSalirPartida.textContent =
                            '🚪 Salir';

                        mostrarBannerConexion(
                            respuesta?.mensaje ||
                            'No se pudo abandonar la partida.',
                            'error'
                        );

                        setTimeout(
                            ocultarBannerConexion,
                            3000
                        );

                        return;
                    }
                    // ======================================
                    // SALIDA CONFIRMADA
                    // ======================================

                    borrarSesionCompleta();

                    salaActual = null;
                    jugadoresPartida = [];
                    jugadorTurnoId = null;
                    indiceTurno = 0;
                    haTiradoDadosEsteTurno = false;

                    // Cerrar cualquier modal abierto
                    if (modalGestion) {
                        modalGestion.classList.add(
                            'oculto'
                        );
                    }

                    if (modalCarta) {
                        modalCarta.classList.add(
                            'oculto'
                        );
                    }

                    detenerTemporizadorTurno();

                    // Recargamos la página para que:
                    // 1. se genere un token nuevo;
                    // 2. no exista reconexión automática;
                    // 3. se vuelva completamente al estado inicial.
                    window.location.href = '/';
                }
            );
        }
    );
}


// ==========================================
// COPIAR CÓDIGO DE SALA
// ==========================================

if (
    btnCopiarCodigo &&
    codigoCompartir
) {

    btnCopiarCodigo.addEventListener(
        'click',
        async () => {

            try {

                const codigo =
                    codigoCompartir.textContent.trim();

                await navigator.clipboard.writeText(
                    codigo
                );

                btnCopiarCodigo.textContent =
                    '✅ ¡Copiado!';

                setTimeout(
                    () => {
                        btnCopiarCodigo.textContent =
                            '📋 Copiar código';
                    },
                    2000
                );

            } catch (e) {

                btnCopiarCodigo.textContent =
                    'Código copiado';
            }
        }
    );
}


// ==========================================
// ACTUALIZAR SALA DE ESPERA
// ==========================================

function actualizarListaJugadores(jugadores) {

    if (!listaJugadores) return;

    listaJugadores.innerHTML = '';

    jugadores.forEach(
        (jugador, indice) => {

            const li =
                document.createElement('li');

            const color =
                window.coloresJugadores
                    ? window.coloresJugadores[
                    indice %
                    window.coloresJugadores.length
                    ]
                    : '#1976d2';

            const esHost =
                salaActual?.host === jugador.id;

            const esTuUsuario =
                jugador.id === socket.id;

            li.innerHTML = `
                <span
                    class="punto-color"
                    style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; display: inline-block; margin-right: 8px;"
                ></span>

                <strong>
                    ${indice + 1}. ${jugador.nombre}
                </strong>

                ${esTuUsuario
                    ? '<span class="badge-tu">(Vos)</span>'
                    : ''
                }

                ${esHost
                    ? '<span class="badge-host">👑 Anfitrión</span>'
                    : ''
                }
            `;

            listaJugadores.appendChild(li);
        }
    );

    if (contadorJugadores) {

        contadorJugadores.textContent =
            `${jugadores.length}/8`;
    }
}

function actualizarSala(datos) {

    const sala =
        datos?.sala || datos;

    if (
        !sala ||
        !sala.jugadores
    ) {
        return;
    }

    salaActual = sala;

    if (codigoMostrar) {
        codigoMostrar.textContent =
            sala.codigo;
    }

    if (codigoCompartir) {
        codigoCompartir.textContent =
            sala.codigo;
    }

    if (estadoSala) {

        estadoSala.textContent =
            sala.estado === 'jugando'
                ? 'Partida iniciada'
                : 'Esperando jugadores';
    }

    actualizarListaJugadores(
        sala.jugadores
    );

    const esHost =
        sala.host === socket.id;

    if (zonaAnfitrion) {

        if (
            esHost &&
            sala.estado === 'esperando'
        ) {

            zonaAnfitrion.classList.remove(
                'oculto'
            );

        } else {

            zonaAnfitrion.classList.add(
                'oculto'
            );
        }
    }

    if (esperandoAnfitrion) {

        if (
            !esHost &&
            sala.estado === 'esperando'
        ) {

            esperandoAnfitrion.classList.remove(
                'oculto'
            );

        } else {

            esperandoAnfitrion.classList.add(
                'oculto'
            );
        }
    }

    if (sala.estado === 'jugando') {

        jugadoresPartida =
            sala.jugadores;

        mostrarPantalla(
            pantallaPartida
        );

        if (
            typeof window.actualizarFichas ===
            'function'
        ) {
            window.actualizarFichas(
                jugadoresPartida
            );
        }

        if (
            typeof window.actualizarPropietariosTablero ===
            'function'
        ) {
            window.actualizarPropietariosTablero(
                sala.propiedades,
                jugadoresPartida
            );
        }

        actualizarJugadoresPartida();
        actualizarDineroJugador();
        actualizarMisPropiedades();
        actualizarTurno();
    }
}


// ==========================================
// CREAR PARTIDA
// ==========================================

if (btnCrearSala) {

    btnCrearSala.addEventListener(
        'click',
        () => {

            const nombre =
                nombreCrear.value.trim();

            if (!nombre) {

                mensajeCrear.textContent =
                    'Debes ingresar tu nombre.';

                nombreCrear.focus();

                return;
            }

            mensajeCrear.textContent =
                'Creando partida...';

            socket.emit(
                'crear_sala',
                {
                    nombre,
                    token: miToken
                },
                respuesta => {

                    if (
                        !respuesta ||
                        !respuesta.ok
                    ) {

                        mensajeCrear.textContent =
                            respuesta?.mensaje ||
                            'No se pudo crear la partida.';

                        return;
                    }

                    actualizarSala(
                        respuesta.sala
                    );

                    guardarSesion(
                        respuesta.sala.codigo,
                        nombre
                    );

                    cargarChat(
                        respuesta.sala.chat || []
                    );

                    mostrarPantalla(
                        pantallaSala
                    );

                    mensajeCrear.textContent = '';
                }
            );
        }
    );
}


// ==========================================
// UNIRSE A PARTIDA
// ==========================================

if (btnUnirseSala) {

    btnUnirseSala.addEventListener(
        'click',
        () => {

            const nombre =
                nombreUnirse.value.trim();

            const codigo =
                codigoSala.value
                    .trim()
                    .toUpperCase();

            if (!codigo) {

                mensajeUnirse.textContent =
                    'Debes ingresar el código de la partida.';

                codigoSala.focus();

                return;
            }

            if (!nombre) {

                mensajeUnirse.textContent =
                    'Debes ingresar tu nombre.';

                nombreUnirse.focus();

                return;
            }

            mensajeUnirse.textContent =
                'Uniéndote a la partida...';

            socket.emit(
                'unirse_sala',
                {
                    codigo,
                    nombre,
                    token: miToken
                },
                respuesta => {

                    if (
                        !respuesta ||
                        !respuesta.ok
                    ) {

                        mensajeUnirse.textContent =
                            respuesta?.mensaje ||
                            'No se pudo unir a la partida.';

                        return;
                    }

                    actualizarSala(
                        respuesta.sala
                    );

                    guardarSesion(
                        respuesta.sala.codigo,
                        nombre
                    );

                    cargarChat(
                        respuesta.sala.chat || []
                    );

                    mostrarPantalla(
                        pantallaSala
                    );

                    mensajeUnirse.textContent = '';
                }
            );
        }
    );
}


// ==========================================
// INICIAR PARTIDA
// ==========================================

if (btnIniciarPartida) {

    btnIniciarPartida.addEventListener(
        'click',
        () => {

            if (!salaActual) return;

            socket.emit(
                'iniciar_partida',
                {
                    codigo: salaActual.codigo
                },
                respuesta => {

                    if (
                        !respuesta ||
                        !respuesta.ok
                    ) {

                        if (mensajeSala) {

                            mensajeSala.textContent =
                                respuesta?.mensaje ||
                                'No se pudo iniciar la partida.';
                        }
                    }
                }
            );
        }
    );
}


// ==========================================
// EVENTOS DE SALA Y PARTIDA
// ==========================================

socket.on(
    'sala_actualizada',
    sala => {

        if (!sala) return;

        actualizarSala(sala);
        cargarChat(sala.chat || []);
    }
);

socket.on(
    'estado_sala',
    sala => {

        if (!sala) return;

        actualizarSala(sala);
        cargarChat(sala.chat || []);
    }
);

socket.on(
    'partida_iniciada',
    sala => {

        if (!sala) return;

        salaActual = sala;
        jugadoresPartida =
            sala.jugadores;

        jugadorTurnoId =
            sala.turno;

        haTiradoDadosEsteTurno =
            false;

        if (codigoPartida) {
            codigoPartida.textContent =
                sala.codigo;
        }

        mostrarPantalla(
            pantallaPartida
        );

        if (
            typeof window.iniciarTablero ===
            'function'
        ) {
            window.iniciarTablero();
        }

        if (
            typeof window.actualizarFichas ===
            'function'
        ) {
            window.actualizarFichas(
                jugadoresPartida
            );
        }

        if (
            typeof window.actualizarPropietariosTablero ===
            'function'
        ) {
            window.actualizarPropietariosTablero(
                sala.propiedades || {},
                jugadoresPartida
            );
        }

        actualizarJugadoresPartida();
        actualizarDineroJugador();
        actualizarMisPropiedades();
        actualizarTurno();

        cargarChat(
            sala.chat || []
        );

        agregarHistorial(
            '¡La partida ha comenzado! Buena suerte a todos.',
            '🎲'
        );
    }
);


// ==========================================
// ACTUALIZAR INFORMACIÓN DEL JUGADOR ACTUAL
// ==========================================

function actualizarDineroJugador() {

    const jugador =
        jugadoresPartida.find(
            j => j.id === socket.id
        );

    if (!jugador) return;

    if (nombreJugadorPartida) {

        nombreJugadorPartida.textContent =
            `👤 ${jugador.nombre}`;
    }

    if (posicionJugadorPartida) {

        const posicion =
            jugador.posicion || 1;

        const casillaActual =
            casillas.find(
                c => c.numero === posicion
            );

        posicionJugadorPartida.textContent =
            casillaActual
                ? `📍 ${casillaActual.nombre}`
                : `📍 Casilla ${posicion}`;
    }

    if (dineroJugador) {

        const dinero =
            jugador.dinero ?? 15000;

        dineroJugador.textContent =
            `$${dinero.toLocaleString('es-AR')}`;
    }
}


// ==========================================
// ACTUALIZAR LISTA DE JUGADORES EN PARTIDA
// ==========================================

function actualizarJugadoresPartida() {

    if (!listaJugadoresPartida) return;

    listaJugadoresPartida.innerHTML = '';

    jugadoresPartida.forEach(
        (jugador, indice) => {

            const item =
                document.createElement('div');

            item.classList.add(
                'jugador-fila'
            );

            const esTurno =
                jugador.id ===
                jugadorTurnoId;

            const esYo =
                jugador.id === socket.id;

            const color =
                window.coloresJugadores
                    ? window.coloresJugadores[
                    indice %
                    window.coloresJugadores.length
                    ]
                    : '#1976d2';

            if (esTurno) {
                item.classList.add(
                    'turno-activo'
                );
            }

            if (jugador.enBancarrota) {
                item.classList.add(
                    'bancarrota'
                );
            }

            if (jugador.desconectado) {
                item.classList.add(
                    'desconectado'
                );
            }

            const casillaActual =
                casillas.find(
                    c =>
                        c.numero ===
                        (jugador.posicion || 1)
                );

            const nombreCasilla =
                casillaActual
                    ? casillaActual.nombre
                    : `Casilla ${jugador.posicion || 1}`;

            item.innerHTML = `
                <div class="jugador-fila-cabecera">

                    <span
                        class="ficha-indicador"
                        style="background-color: ${color};"
                    >
                        ${indice + 1}
                    </span>

                    <span class="jugador-fila-nombre">
                        ${jugador.nombre}
                        ${esYo ? '<strong>(Vos)</strong>' : ''}
                    </span>

                    ${esTurno
                    ? '<span class="badge-turno">Turno</span>'
                    : ''
                }

                    ${jugador.enCarcel
                    ? '<span class="badge-carcel">🚔 Cárcel</span>'
                    : ''
                }

                    ${jugador.enBancarrota
                    ? '<span class="badge-bancarrota">💀 Bancarrota</span>'
                    : ''
                }

                    ${jugador.desconectado && !jugador.enBancarrota
                    ? '<span class="badge-desconectado">📴 Desconectado</span>'
                    : ''
                }

                </div>

                <div class="jugador-fila-detalles">

                    <span class="jugador-fila-dinero">
                        💰 $${(jugador.dinero ?? 0).toLocaleString('es-AR')}
                    </span>

                    <span class="jugador-fila-props">
                        🏠 ${jugador.propiedades?.length || 0}
                    </span>

                    <span class="jugador-fila-pos">
                        📍 ${nombreCasilla}
                    </span>

                </div>
            `;

            listaJugadoresPartida.appendChild(
                item
            );
        }
    );
}


// ==========================================
// ACTUALIZAR MIS PROPIEDADES
// ==========================================

function actualizarMisPropiedades() {

    const listaPropiedades =
        document.getElementById(
            'listaPropiedades'
        );

    if (!listaPropiedades) return;

    const jugador =
        jugadoresPartida.find(
            j => j.id === socket.id
        );

    if (!jugador) return;

    const propiedades =
        jugador.propiedades || [];

    if (propiedades.length === 0) {

        listaPropiedades.innerHTML = `
            <p class="sin-propiedades">
                No tenés propiedades todavía.
            </p>
        `;

        return;
    }

    listaPropiedades.innerHTML = '';

    propiedades.forEach(
        numeroCasilla => {

            const propiedad =
                casillas.find(
                    c => c.numero === numeroCasilla
                );

            if (!propiedad) return;

            const tarjeta =
                document.createElement('div');

            tarjeta.classList.add(
                'propiedad-card'
            );

            const grupoClass =
                propiedad.grupo
                    ? `grupo-${propiedad.grupo}`
                    : '';

            const categoriaClass =
                !propiedad.grupo
                    ? `cat-${propiedad.categoria}`
                    : '';

            tarjeta.innerHTML = `
                <div class="propiedad-color ${grupoClass} ${categoriaClass}"></div>

                <div class="propiedad-info">

                    <strong>
                        ${propiedad.icono || '🏠'}
                        ${propiedad.nombre}
                    </strong>

                    <span>
                        💰 Valor:
                        $${propiedad.precio?.toLocaleString('es-AR') || 0}
                    </span>

                    ${propiedad.alquiler
                    ? `<span>
                                🏠 Alquiler:
                                $${propiedad.alquiler.toLocaleString('es-AR')}
                               </span>`
                    : ''
                }

                    <span>
                        ${salaActual?.hipotecas?.[numeroCasilla]
                    ? '🏦 Hipotecada'
                    : `🏗️ Nivel:
                                   ${salaActual?.edificios?.[numeroCasilla] || 0}
                                   ${(salaActual?.edificios?.[numeroCasilla] || 0) === 5
                        ? ' (hotel)'
                        : ''
                    }`
                }
                    </span>

                </div>
            `;

            listaPropiedades.appendChild(
                tarjeta
            );
        }
    );
}


// ==========================================
// ACTUALIZAR ESTADO DEL TURNO
// ==========================================

function actualizarTurno() {

    if (!jugadorTurnoId) return;

    const jugadorActual =
        jugadoresPartida.find(
            j => j.id === jugadorTurnoId
        );

    if (!jugadorActual) return;

    const esMiTurno =
        jugadorTurnoId === socket.id;

    if (mensajeDados) {

        if (esMiTurno) {

            if (jugadorActual.enCarcel) {

                mensajeDados.textContent =
                    '🚔 ¡Estás en la cárcel! Tirar dados para intentar sacar dobles o pagar fianza.';

            } else if (
                haTiradoDadosEsteTurno
            ) {

                mensajeDados.textContent =
                    '✅ Ya tiraste los dados. Podés comprar o terminar tu turno.';

            } else {

                mensajeDados.textContent =
                    '🎮 ¡Es tu turno! Tirar los dados';
            }

        } else {

            mensajeDados.textContent =
                `🎮 Turno de ${jugadorActual.nombre}`;
        }
    }

    if (btnTirarDados) {

        if (
            esMiTurno &&
            !haTiradoDadosEsteTurno
        ) {

            btnTirarDados.disabled = false;

            btnTirarDados.textContent =
                jugadorActual.enCarcel
                    ? '🎲 Tirar para dobles'
                    : '🎲 Tirar dados';

        } else {

            btnTirarDados.disabled = true;
        }
    }

    if (btnPagarFianza) {

        if (
            esMiTurno &&
            jugadorActual.enCarcel &&
            !haTiradoDadosEsteTurno &&
            jugadorActual.dinero >= 500
        ) {

            btnPagarFianza.style.display =
                'block';

            btnPagarFianza.disabled =
                false;

        } else {

            btnPagarFianza.style.display =
                'none';
        }
    }

    if (btnUsarTarjetaCarcel) {

        const tieneTarjeta =
            (jugadorActual.cartasSalidaCarcel || 0) > 0;

        btnUsarTarjetaCarcel.style.display =
            esMiTurno &&
                jugadorActual.enCarcel &&
                !haTiradoDadosEsteTurno &&
                tieneTarjeta
                ? 'block'
                : 'none';
    }

    if (btnPagarDeuda) {

        btnPagarDeuda.style.display =
            jugadorActual.id === socket.id &&
                jugadorActual.deudaPendiente > 0 &&
                jugadorActual.dinero > 0
                ? 'block'
                : 'none';
    }

    if (btnDeclararBancarrota) {

        btnDeclararBancarrota.style.display =
            jugadorActual.id === socket.id &&
                jugadorActual.deudaPendiente > 0
                ? 'block'
                : 'none';
    }

    if (btnPasarTurno) {

        if (
            esMiTurno &&
            haTiradoDadosEsteTurno
        ) {

            btnPasarTurno.style.display =
                'block';

            btnPasarTurno.disabled =
                false;

        } else {

            btnPasarTurno.style.display =
                'none';
        }
    }

    if (
        !esMiTurno &&
        btnComprarPropiedad
    ) {

        btnComprarPropiedad.style.display =
            'none';
    }

    actualizarJugadoresPartida();
}


// ==========================================
// TIRAR DADOS
// ==========================================

if (btnTirarDados) {

    btnTirarDados.addEventListener(
        'click',
        () => {

            if (!salaActual) return;

            if (jugadorTurnoId !== socket.id) {
                return;
            }

            if (haTiradoDadosEsteTurno) {
                return;
            }

            btnTirarDados.disabled = true;

            sonarDados();

            socket.emit(
                'tirar_dados',
                {
                    codigo: salaActual.codigo
                },
                respuesta => {

                    if (
                        !respuesta ||
                        !respuesta.ok
                    ) {

                        if (mensajeDados) {

                            mensajeDados.textContent =
                                respuesta?.mensaje ||
                                'No se pudieron tirar los dados.';
                        }

                        btnTirarDados.disabled =
                            false;
                    }
                }
            );
        }
    );
}


// ==========================================
// TERMINAR TURNO
// ==========================================

if (btnPasarTurno) {

    btnPasarTurno.addEventListener(
        'click',
        () => {

            if (!salaActual) return;

            if (jugadorTurnoId !== socket.id) {
                return;
            }

            btnPasarTurno.disabled = true;

            if (btnComprarPropiedad) {
                btnComprarPropiedad.style.display =
                    'none';
            }

            socket.emit(
                'terminar_turno',
                {
                    codigo: salaActual.codigo
                },
                respuesta => {

                    if (
                        !respuesta ||
                        !respuesta.ok
                    ) {
                        btnPasarTurno.disabled =
                            false;
                    }
                }
            );
        }
    );
}


// ==========================================
// PAGAR FIANZA DE CÁRCEL
// ==========================================

if (btnPagarFianza) {

    btnPagarFianza.addEventListener(
        'click',
        () => {

            if (!salaActual) return;

            if (jugadorTurnoId !== socket.id) {
                return;
            }

            btnPagarFianza.disabled =
                true;

            socket.emit(
                'pagar_fianza',
                {
                    codigo: salaActual.codigo
                },
                respuesta => {

                    if (
                        !respuesta ||
                        !respuesta.ok
                    ) {
                        btnPagarFianza.disabled =
                            false;
                    }
                }
            );
        }
    );
}


// ==========================================
// COMPRAR PROPIEDAD
// ==========================================

if (btnComprarPropiedad) {

    btnComprarPropiedad.addEventListener(
        'click',
        () => {

            const jugador =
                jugadoresPartida.find(
                    j => j.id === socket.id
                );

            if (!jugador) return;

            const posicion =
                jugador.posicion || 1;

            btnComprarPropiedad.disabled =
                true;

            socket.emit(
                'comprar_propiedad',
                {
                    codigo: salaActual.codigo,
                    numeroCasilla: posicion
                },
                respuesta => {

                    if (
                        !respuesta ||
                        !respuesta.ok
                    ) {

                        btnComprarPropiedad.disabled =
                            false;

                        return;
                    }

                    btnComprarPropiedad.style.display =
                        'none';
                }
            );
        }
    );
}


// ==========================================
// CERRAR MODAL DE CARTA
// ==========================================

if (
    btnCerrarCarta &&
    modalCarta
) {

    btnCerrarCarta.addEventListener(
        'click',
        () => {
            modalCarta.classList.add(
                'oculto'
            );
        }
    );
}


// ==========================================
// MOSTRAR INFORMACIÓN DE CASILLA
// ==========================================

function mostrarInformacionCasilla(
    posicion
) {

    const nombreCasillaActual =
        document.getElementById(
            'nombreCasillaActual'
        );

    const tipoCasillaActual =
        document.getElementById(
            'tipoCasillaActual'
        );

    const precioCasillaActual =
        document.getElementById(
            'precioCasillaActual'
        );

    if (
        !nombreCasillaActual ||
        !tipoCasillaActual ||
        !precioCasillaActual
    ) {
        return;
    }

    const casillaActual =
        casillas.find(
            c => c.numero === posicion
        );

    if (!casillaActual) return;

    nombreCasillaActual.textContent =
        `📍 ${casillaActual.nombre}`;

    tipoCasillaActual.textContent =
        `Categoría: ${casillaActual.categoria}`;

    if (casillaActual.precio) {

        const duenoId =
            salaActual?.propiedades?.[posicion];

        if (duenoId) {

            const dueno =
                jugadoresPartida.find(
                    j => j.id === duenoId
                );

            precioCasillaActual.textContent =
                `Propiedad de ${dueno
                    ? dueno.nombre
                    : 'otro jugador'
                } (Alquiler: $${casillaActual.alquiler?.toLocaleString('es-AR') || 0})`;

        } else {

            precioCasillaActual.textContent =
                `💰 Precio: $${casillaActual.precio.toLocaleString('es-AR')} | Alquiler: $${casillaActual.alquiler?.toLocaleString('es-AR') || 0}`;
        }

    } else if (casillaActual.impuesto) {

        precioCasillaActual.textContent =
            `🧾 Impuesto: $${casillaActual.monto?.toLocaleString('es-AR') || 1000}`;

    } else {

        precioCasillaActual.textContent = '';
    }
}


// ==========================================
// ACTUALIZAR BOTÓN DE COMPRA
// ==========================================

function actualizarBotonCompra(
    jugadorId,
    posicion
) {

    if (!btnComprarPropiedad) return;

    btnComprarPropiedad.style.display =
        'none';

    if (btnSubastar) {
        btnSubastar.style.display =
            'none';
    }

    btnComprarPropiedad.disabled =
        false;

    if (jugadorId !== socket.id) {
        return;
    }

    const casillaActual =
        casillas.find(
            c => c.numero === posicion
        );

    if (
        !casillaActual ||
        !casillaActual.precio
    ) {
        return;
    }

    const propietario =
        salaActual?.propiedades?.[posicion];

    if (propietario) return;

    const jugador =
        jugadoresPartida.find(
            j => j.id === socket.id
        );

    if (
        !jugador ||
        jugador.dinero < casillaActual.precio
    ) {
        return;
    }

    btnComprarPropiedad.textContent =
        `🏠 Comprar por $${casillaActual.precio.toLocaleString('es-AR')}`;

    btnComprarPropiedad.style.display =
        'block';

    btnComprarPropiedad.disabled =
        false;

    if (btnSubastar) {
        btnSubastar.style.display =
            'block';
    }
}


// ==========================================
// SOCKET: EVENTOS DEL JUEGO
// ==========================================

// Dados lanzados
socket.on(
    'dados_lanzados',
    ({
        jugadorId,
        jugadorNombre,
        dado1,
        dado2,
        suma
    }) => {

        sonarDados();

        if (
            typeof window.mostrarDados ===
            'function'
        ) {

            window.mostrarDados(
                dado1,
                dado2,
                suma
            );
        }

        if (mensajeDados) {

            mensajeDados.textContent =
                `🎲 ${jugadorNombre} sacó ${suma}`;
        }

        agregarHistorial(
            `<strong>${jugadorNombre}</strong> sacó <strong>${dado1}</strong> y <strong>${dado2}</strong> (Total: <strong>${suma}</strong>)`,
            '🎲'
        );
    }
);


// Movimiento del jugador
socket.on(
    'jugador_movido',
    async ({
        jugadorId,
        jugadorNombre,
        posicion,
        dinero,
        pasoPorSalida,
        encarcelado
    }) => {

        const jugador =
            jugadoresPartida.find(
                j => j.id === jugadorId
            );

        if (!jugador) return;

        if (dinero !== undefined) {
            jugador.dinero = dinero;
        }

        if (pasoPorSalida) {

            agregarHistorial(
                `<strong>${jugadorNombre}</strong> pasó por la Salida y cobró <strong>$2.000</strong>.`,
                '🇦🇷'
            );

            sonarDinero();
        }

        if (
            !encarcelado &&
            typeof window.animarMovimiento ===
            'function'
        ) {

            await window.animarMovimiento(
                jugadorId,
                posicion
            );
        }

        jugador.posicion =
            posicion;

        if (
            typeof window.actualizarFichas ===
            'function'
        ) {

            window.actualizarFichas(
                jugadoresPartida
            );
        }

        actualizarJugadoresPartida();
        actualizarDineroJugador();
        mostrarInformacionCasilla(
            posicion
        );

        if (jugadorId === socket.id) {

            haTiradoDadosEsteTurno =
                true;

            actualizarBotonCompra(
                jugadorId,
                posicion
            );

            if (btnPasarTurno) {

                btnPasarTurno.style.display =
                    'block';

                btnPasarTurno.disabled =
                    false;
            }

            if (btnTirarDados) {
                btnTirarDados.disabled =
                    true;
            }
        }
    }
);


// Propiedad comprada
socket.on(
    'propiedad_comprada',
    ({
        jugadorId,
        jugadorNombre,
        numeroCasilla,
        nombrePropiedad,
        precio,
        dineroRestante
    }) => {

        sonarCompra();

        const jugador =
            jugadoresPartida.find(
                j => j.id === jugadorId
            );

        if (jugador) {

            jugador.dinero =
                dineroRestante;

            if (!jugador.propiedades) {
                jugador.propiedades = [];
            }

            if (
                !jugador.propiedades.includes(
                    numeroCasilla
                )
            ) {

                jugador.propiedades.push(
                    numeroCasilla
                );
            }
        }

        if (!salaActual.propiedades) {
            salaActual.propiedades = {};
        }

        salaActual.propiedades[
            numeroCasilla
        ] = jugadorId;

        if (
            typeof window.actualizarPropietariosTablero ===
            'function'
        ) {

            window.actualizarPropietariosTablero(
                salaActual.propiedades,
                jugadoresPartida
            );
        }

        actualizarDineroJugador();
        actualizarMisPropiedades();
        actualizarJugadoresPartida();

        mostrarInformacionCasilla(
            numeroCasilla
        );

        if (
            jugadorId === socket.id &&
            btnComprarPropiedad
        ) {

            btnComprarPropiedad.style.display =
                'none';
        }

        if (
            jugadorId === socket.id &&
            btnSubastar
        ) {

            btnSubastar.style.display =
                'none';
        }

        agregarHistorial(
            `<strong>${jugadorNombre}</strong> compró <strong>${nombrePropiedad}</strong> por <strong>$${precio.toLocaleString('es-AR')}</strong>.`,
            '🏠'
        );
    }
);


// Alquiler pagado
socket.on(
    'alquiler_pagado',
    ({
        deId,
        deNombre,
        paraId,
        paraNombre,
        monto,
        propiedadNombre,
        dineroDe,
        dineroPara
    }) => {

        sonarDinero();

        const deJugador =
            jugadoresPartida.find(
                j => j.id === deId
            );

        const paraJugador =
            jugadoresPartida.find(
                j => j.id === paraId
            );

        if (deJugador) {
            deJugador.dinero =
                dineroDe;
        }

        if (paraJugador) {
            paraJugador.dinero =
                dineroPara;
        }

        actualizarDineroJugador();
        actualizarJugadoresPartida();

        agregarHistorial(
            `<strong>${deNombre}</strong> pagó <strong>$${monto.toLocaleString('es-AR')}</strong> de alquiler a <strong>${paraNombre}</strong> por <em>${propiedadNombre}</em>.`,
            '💸'
        );
    }
);


// Impuesto pagado
socket.on(
    'impuesto_pagado',
    ({
        jugadorId,
        jugadorNombre,
        monto,
        nombre,
        dinero
    }) => {

        const jugador =
            jugadoresPartida.find(
                j => j.id === jugadorId
            );

        if (jugador) {
            jugador.dinero =
                dinero;
        }

        actualizarDineroJugador();
        actualizarJugadoresPartida();

        agregarHistorial(
            `<strong>${jugadorNombre}</strong> pagó <strong>$${monto.toLocaleString('es-AR')}</strong> de <em>${nombre}</em>.`,
            '🧾'
        );
    }
);


// Carta de Suerte / Arca Comunal
socket.on(
    'carta_robada',
    ({
        jugadorId,
        jugadorNombre,
        categoria,
        carta,
        dinero,
        cartasSalidaCarcel
    }) => {

        const jugador =
            jugadoresPartida.find(
                j => j.id === jugadorId
            );

        if (jugador) {

            jugador.dinero =
                dinero;

            if (
                cartasSalidaCarcel !==
                undefined
            ) {

                jugador.cartasSalidaCarcel =
                    cartasSalidaCarcel;
            }
        }

        actualizarDineroJugador();
        actualizarJugadoresPartida();

        if (
            modalCarta &&
            cartaTitulo &&
            cartaTexto &&
            cartaIcono
        ) {

            cartaIcono.textContent =
                categoria === 'suerte'
                    ? '🎴'
                    : '📦';

            cartaTitulo.textContent =
                categoria === 'suerte'
                    ? 'Tarjeta de Suerte'
                    : 'Arca Comunal';

            cartaTexto.textContent =
                `${jugadorNombre}: "${carta.texto}"`;

            modalCarta.classList.remove(
                'oculto'
            );
        }

        agregarHistorial(
            `<strong>${jugadorNombre}</strong> sacó una tarjeta de ${categoria}: <em>"${carta.texto}"</em>`,
            categoria === 'suerte'
                ? '🎴'
                : '📦'
        );
    }
);


// Jugador encarcelado
socket.on(
    'jugador_encarcelado',
    ({
        jugadorId,
        jugadorNombre
    }) => {

        sonarCarcel();

        const jugador =
            jugadoresPartida.find(
                j => j.id === jugadorId
            );

        if (jugador) {

            jugador.enCarcel = true;
            jugador.turnosEnCarcel = 3;
        }

        actualizarJugadoresPartida();

        agregarHistorial(
            `🚔 ¡<strong>${jugadorNombre}</strong> cayó en la Comisaría y fue enviado a la Cárcel!`,
            '🚔'
        );
    }
);


// Salió de la cárcel
socket.on(
    'salio_carcel',
    ({
        jugadorId,
        jugadorNombre,
        motivo,
        dinero
    }) => {

        const jugador =
            jugadoresPartida.find(
                j => j.id === jugadorId
            );

        if (jugador) {

            jugador.enCarcel = false;
            jugador.turnosEnCarcel = 0;

            if (dinero !== undefined) {
                jugador.dinero = dinero;
            }
        }

        actualizarJugadoresPartida();
        actualizarDineroJugador();

        agregarHistorial(
            `🔓 <strong>${jugadorNombre}</strong> salió de la cárcel: ${motivo}`,
            '🔓'
        );
    }
);


// Permanece en la cárcel
socket.on(
    'permanece_carcel',
    ({
        jugadorId,
        jugadorNombre,
        turnosRestantes
    }) => {

        agregarHistorial(
            `🔒 <strong>${jugadorNombre}</strong> sigue en la cárcel (intentos restantes: ${turnosRestantes}).`,
            '🔒'
        );

        if (jugadorId === socket.id) {

            haTiradoDadosEsteTurno =
                true;

            if (btnPasarTurno) {

                btnPasarTurno.style.display =
                    'block';

                btnPasarTurno.disabled =
                    false;
            }

            if (btnTirarDados) {
                btnTirarDados.disabled =
                    true;
            }
        }
    }
);


// Jugador en bancarrota
socket.on(
    'jugador_bancarrota',
    ({
        jugadorId,
        jugadorNombre
    }) => {

        sonarCarcel();

        const jugador =
            jugadoresPartida.find(
                j => j.id === jugadorId
            );

        if (jugador) {

            jugador.enBancarrota = true;
            jugador.dinero = 0;
            jugador.propiedades = [];
        }

        if (
            typeof window.actualizarPropietariosTablero ===
            'function'
        ) {

            window.actualizarPropietariosTablero(
                salaActual.propiedades,
                jugadoresPartida
            );
        }

        actualizarJugadoresPartida();

        agregarHistorial(
            `💀 <strong>${jugadorNombre}</strong> se declaró en BANCARROTA y queda eliminado.`,
            '💀'
        );
    }
);


// Actualización de dinero
socket.on(
    'dinero_actualizado',
    ({
        jugadorId,
        dinero,
        motivo
    }) => {

        const jugador =
            jugadoresPartida.find(
                j => j.id === jugadorId
            );

        if (jugador) {
            jugador.dinero = dinero;
        }

        actualizarDineroJugador();
        actualizarJugadoresPartida();
    }
);


// Turno actualizado
socket.on(
    'turno_actualizado',
    ({
        jugadorId,
        jugadorNombre,
        turno
    }) => {

        jugadorTurnoId =
            jugadorId;

        indiceTurno =
            turno;

        haTiradoDadosEsteTurno =
            false;

        if (
            jugadorTurnoId === socket.id
        ) {
            sonarTurno();
        }

        actualizarTurno();
        actualizarJugadoresPartida();

        agregarHistorial(
            `Es el turno de <strong>${jugadorNombre}</strong>.`,
            '👉'
        );
    }
);


// ==========================================
// NUEVO: JUGADOR SALIÓ DE LA PARTIDA
// ==========================================

socket.on(
    'jugador-salio',
    ({
        jugadorId,
        nombre,
        jugadores,
        host,
        turno
    }) => {

        // Actualizar la información de la sala
        if (salaActual) {

            salaActual.jugadores =
                jugadores || [];

            salaActual.host =
                host;

            if (turno !== undefined) {
                salaActual.turno =
                    turno;
            }
        }

        jugadoresPartida =
            jugadores || [];

        if (turno !== undefined) {
            jugadorTurnoId =
                turno;
        }

        actualizarJugadoresPartida();
        actualizarDineroJugador();
        actualizarMisPropiedades();
        actualizarTurno();

        if (
            typeof window.actualizarFichas ===
            'function'
        ) {

            window.actualizarFichas(
                jugadoresPartida
            );
        }

        if (
            typeof window.actualizarPropietariosTablero ===
            'function'
        ) {

            window.actualizarPropietariosTablero(
                salaActual?.propiedades || {},
                jugadoresPartida
            );
        }

        agregarHistorial(
            `🚪 <strong>${nombre}</strong> salió de la partida.`,
            '🚪'
        );
    }
);


// Error de sala
socket.on(
    'error_sala',
    ({ mensaje }) => {

        if (
            pantallaCrear &&
            !pantallaCrear.classList.contains(
                'oculto'
            )
        ) {

            if (mensajeCrear) {
                mensajeCrear.textContent =
                    `⚠️ ${mensaje}`;
            }

            return;
        }

        if (
            pantallaUnirse &&
            !pantallaUnirse.classList.contains(
                'oculto'
            )
        ) {

            if (mensajeUnirse) {
                mensajeUnirse.textContent =
                    `⚠️ ${mensaje}`;
            }

            return;
        }

        if (mensajeDados) {

            mensajeDados.textContent =
                `⚠️ ${mensaje}`;

            return;
        }

        if (mensajeSala) {
            mensajeSala.textContent =
                mensaje;
        }
    }
);


// ==========================================
// GESTIÓN ECONÓMICA
// ==========================================

function abrirGestion(
    titulo,
    contenido
) {

    if (
        !modalGestion ||
        !gestionContenido
    ) {
        return;
    }

    gestionTitulo.textContent =
        titulo;

    gestionContenido.innerHTML =
        contenido;

    modalGestion.classList.remove(
        'oculto'
    );
}

function opcionesPropiedades(
    jugador
) {

    return (
        jugador?.propiedades || []
    )
        .map(numero => {

            const casilla =
                casillas.find(
                    c => c.numero === numero
                );

            return casilla
                ? `<option value="${numero}">${casilla.nombre}</option>`
                : '';

        })
        .join('');
}

if (btnCerrarGestion) {

    btnCerrarGestion.addEventListener(
        'click',
        () =>
            modalGestion.classList.add(
                'oculto'
            )
    );
}

if (btnSubastar) {

    btnSubastar.addEventListener(
        'click',
        () => {

            const yo =
                jugadoresPartida.find(
                    j => j.id === socket.id
                );

            socket.emit(
                'iniciar_subasta',
                {
                    codigo:
                        salaActual?.codigo,
                    numeroCasilla:
                        yo?.posicion
                },
                respuesta => {

                    if (!respuesta?.ok) {

                        mensajeDados.textContent =
                            `⚠️ ${respuesta?.mensaje ||
                            'No se pudo iniciar la subasta.'
                            }`;
                    }
                }
            );
        }
    );
}

if (btnGestionarPropiedades) {

    btnGestionarPropiedades.addEventListener(
        'click',
        () => {

            const yo =
                jugadoresPartida.find(
                    j => j.id === socket.id
                );

            if (
                !yo?.propiedades?.length
            ) {

                return abrirGestion(
                    'Gestionar propiedades',
                    '<p>Todavía no tenés propiedades.</p>'
                );
            }

            abrirGestion(
                'Gestionar propiedades',
                `
                    <p>
                        Elegí una propiedad.
                        Construir requiere grupo completo
                        y niveles parejos; el nivel 5 es hotel.
                    </p>

                    <select id="gestionPropiedad">
                        ${opcionesPropiedades(yo)}
                    </select>

                    <div class="gestion-botones">

                        <button
                            id="construirEdificio"
                            class="btn principal"
                        >
                            🏠 Construir
                        </button>

                        <button
                            id="venderEdificio"
                            class="btn secundario"
                        >
                            ↩️ Vender edificio
                        </button>

                        <button
                            id="hipotecarPropiedad"
                            class="btn secundario"
                        >
                            🏦 Hipotecar
                        </button>

                        <button
                            id="levantarHipoteca"
                            class="btn secundario"
                        >
                            💳 Levantar hipoteca
                        </button>

                    </div>
                `
            );

            const enviar =
                (
                    evento,
                    datos
                ) =>
                    socket.emit(
                        evento,
                        {
                            codigo:
                                salaActual.codigo,
                            numeroCasilla:
                                Number(
                                    document.getElementById(
                                        'gestionPropiedad'
                                    ).value
                                ),
                            ...datos
                        },
                        respuesta => {

                            if (!respuesta?.ok) {

                                mensajeDados.textContent =
                                    `⚠️ ${respuesta?.mensaje ||
                                    'Operación no disponible.'
                                    }`;
                            }
                        }
                    );

            document.getElementById(
                'construirEdificio'
            ).onclick =
                () =>
                    enviar(
                        'gestionar_edificio',
                        {
                            accion:
                                'construir'
                        }
                    );

            document.getElementById(
                'venderEdificio'
            ).onclick =
                () =>
                    enviar(
                        'gestionar_edificio',
                        {
                            accion:
                                'vender'
                        }
                    );

            document.getElementById(
                'hipotecarPropiedad'
            ).onclick =
                () =>
                    enviar(
                        'gestionar_hipoteca',
                        {
                            accion:
                                'hipotecar'
                        }
                    );

            document.getElementById(
                'levantarHipoteca'
            ).onclick =
                () =>
                    enviar(
                        'gestionar_hipoteca',
                        {
                            accion:
                                'levantar'
                        }
                    );
        }
    );
}

if (btnIntercambiar) {

    btnIntercambiar.addEventListener(
        'click',
        () => {

            const yo =
                jugadoresPartida.find(
                    j => j.id === socket.id
                );

            const otros =
                jugadoresPartida.filter(
                    j =>
                        j.id !== socket.id &&
                        !j.enBancarrota
                );

            if (!otros.length) return;

            abrirGestion(
                'Proponer intercambio',
                `
                    <label>
                        Jugador

                        <select id="tratoJugador">
                            ${otros.map(
                    j =>
                        `<option value="${j.id}">${j.nombre}</option>`
                ).join('')
                }
                        </select>
                    </label>

                    <label>
                        Tu propiedad

                        <select id="tratoMia">
                            <option value="">
                                Ninguna
                            </option>

                            ${opcionesPropiedades(yo)}
                        </select>
                    </label>

                    <label>
                        Propiedad que pedís

                        <select id="tratoSuya">
                            <option value="">
                                Ninguna
                            </option>
                        </select>
                    </label>

                    <label>
                        Dinero que ofrecés

                        <input
                            id="tratoMiDinero"
                            type="number"
                            min="0"
                            value="0"
                        >
                    </label>

                    <label>
                        Dinero que pedís

                        <input
                            id="tratoSuDinero"
                            type="number"
                            min="0"
                            value="0"
                        >
                    </label>

                    <button
                        id="enviarTrato"
                        class="btn principal"
                    >
                        Enviar propuesta
                    </button>
                `
            );

            const actualizarPropiedadesOtro =
                () => {

                    const otro =
                        jugadoresPartida.find(
                            j =>
                                j.id ===
                                document.getElementById(
                                    'tratoJugador'
                                ).value
                        );

                    document.getElementById(
                        'tratoSuya'
                    ).innerHTML =
                        `
                            <option value="">
                                Ninguna
                            </option>

                            ${opcionesPropiedades(otro)}
                        `;
                };

            document.getElementById(
                'tratoJugador'
            ).onchange =
                actualizarPropiedadesOtro;

            actualizarPropiedadesOtro();

            document.getElementById(
                'enviarTrato'
            ).onclick =
                () => {

                    const valor =
                        id =>
                            document.getElementById(
                                id
                            ).value;

                    socket.emit(
                        'proponer_intercambio',
                        {
                            codigo:
                                salaActual.codigo,

                            paraId:
                                valor(
                                    'tratoJugador'
                                ),

                            misPropiedades:
                                valor(
                                    'tratoMia'
                                )
                                    ? [
                                        valor(
                                            'tratoMia'
                                        )
                                    ]
                                    : [],

                            susPropiedades:
                                valor(
                                    'tratoSuya'
                                )
                                    ? [
                                        valor(
                                            'tratoSuya'
                                        )
                                    ]
                                    : [],

                            miDinero:
                                valor(
                                    'tratoMiDinero'
                                ),

                            suDinero:
                                valor(
                                    'tratoSuDinero'
                                )
                        },
                        respuesta => {

                            if (respuesta?.ok) {

                                modalGestion.classList.add(
                                    'oculto'
                                );

                            } else {

                                mensajeDados.textContent =
                                    `⚠️ ${respuesta?.mensaje ||
                                    'No se pudo enviar.'
                                    }`;
                            }
                        }
                    );
                };
        }
    );
}

if (btnUsarTarjetaCarcel) {

    btnUsarTarjetaCarcel.addEventListener(
        'click',
        () => {

            socket.emit(
                'usar_tarjeta_carcel',
                {
                    codigo:
                        salaActual?.codigo
                },
                respuesta => {

                    if (!respuesta?.ok) {

                        mensajeDados.textContent =
                            `⚠️ ${respuesta?.mensaje ||
                            'No se pudo usar la tarjeta.'
                            }`;
                    }
                }
            );
        }
    );
}

socket.on(
    'estado_economico_actualizado',
    estado => {

        if (!salaActual) return;

        salaActual.propiedades =
            estado.propiedades;

        salaActual.edificios =
            estado.edificios;

        salaActual.hipotecas =
            estado.hipotecas;

        jugadoresPartida =
            estado.jugadores;

        salaActual.jugadores =
            estado.jugadores;

        window.actualizarPropietariosTablero?.(
            salaActual.propiedades,
            jugadoresPartida
        );

        actualizarMisPropiedades();
        actualizarDineroJugador();
        actualizarJugadoresPartida();
    }
);

socket.on(
    'subasta_iniciada',
    ({
        nombrePropiedad,
        terminaEn
    }) => {

        const segundos =
            Math.max(
                0,
                Math.ceil(
                    (terminaEn - Date.now()) /
                    1000
                )
            );

        abrirGestion(
            '🔨 Subasta en curso',
            `
                <p>
                    <strong>
                        ${nombrePropiedad}
                    </strong>
                </p>

                <p id="subastaEstado">
                    Cierra en ${segundos}
                    segundos.
                    Oferta actual: $0.
                </p>

                <input
                    id="pujaMonto"
                    type="number"
                    min="1"
                    placeholder="Tu puja"
                >

                <button
                    id="enviarPuja"
                    class="btn principal"
                >
                    Pujar
                </button>
            `
        );

        document.getElementById(
            'enviarPuja'
        ).onclick =
            () =>
                socket.emit(
                    'pujar_subasta',
                    {
                        codigo:
                            salaActual.codigo,
                        monto:
                            document.getElementById(
                                'pujaMonto'
                            ).value
                    },
                    respuesta => {

                        if (!respuesta?.ok) {

                            mensajeDados.textContent =
                                `⚠️ ${respuesta?.mensaje}`;
                        }
                    }
                );
    }
);

socket.on(
    'puja_realizada',
    ({
        jugadorNombre,
        monto
    }) => {

        const estado =
            document.getElementById(
                'subastaEstado'
            );

        if (estado) {

            estado.textContent =
                `${jugadorNombre} lidera con $${monto.toLocaleString('es-AR')}.`;
        }

        agregarHistorial(
            `🔨 <strong>${jugadorNombre}</strong> ofertó <strong>$${monto.toLocaleString('es-AR')}</strong>.`,
            '🔨'
        );
    }
);

socket.on(
    'subasta_finalizada',
    ({
        ganadorNombre,
        monto,
        sinGanador
    }) => {

        if (modalGestion) {
            modalGestion.classList.add(
                'oculto'
            );
        }

        agregarHistorial(
            sinGanador
                ? '🔨 La subasta terminó sin ofertas.'
                : `🔨 <strong>${ganadorNombre}</strong> ganó la subasta por <strong>$${monto.toLocaleString('es-AR')}</strong>.`,
            '🔨'
        );
    }
);

socket.on(
    'intercambio_recibido',
    trato => {

        const nombres =
            numeros =>
                numeros
                    .map(
                        n =>
                            casillas.find(
                                c => c.numero === n
                            )?.nombre
                    )
                    .filter(Boolean)
                    .join(', ') ||
                'ninguna';

        abrirGestion(
            '🤝 Intercambio recibido',
            `
                <p>
                    <strong>
                        ${trato.deNombre}
                    </strong>
                    ofrece:
                    ${nombres(trato.misProps)}
                    y
                    $${trato.miDinero.toLocaleString('es-AR')}.
                </p>

                <p>
                    Solicita:
                    ${nombres(trato.susProps)}
                    y
                    $${trato.suDinero.toLocaleString('es-AR')}.
                </p>

                <button
                    id="aceptarTrato"
                    class="btn principal"
                >
                    Aceptar
                </button>

                <button
                    id="rechazarTrato"
                    class="btn secundario"
                >
                    Rechazar
                </button>
            `
        );

        document.getElementById(
            'aceptarTrato'
        ).onclick =
            () =>
                socket.emit(
                    'responder_intercambio',
                    {
                        codigo:
                            salaActual.codigo,
                        id:
                            trato.id,
                        aceptar:
                            true
                    },
                    () =>
                        modalGestion.classList.add(
                            'oculto'
                        )
                );

        document.getElementById(
            'rechazarTrato'
        ).onclick =
            () =>
                socket.emit(
                    'responder_intercambio',
                    {
                        codigo:
                            salaActual.codigo,
                        id:
                            trato.id,
                        aceptar:
                            false
                    },
                    () =>
                        modalGestion.classList.add(
                            'oculto'
                        )
                );
    }
);

socket.on(
    'intercambio_resuelto',
    ({
        aceptado,
        deNombre,
        paraNombre
    }) =>
        agregarHistorial(
            aceptado
                ? `🤝 Intercambio completado entre <strong>${deNombre}</strong> y <strong>${paraNombre}</strong>.`
                : '🤝 Intercambio rechazado.',
            '🤝'
        )
);


// ==========================================
// RECONEXIÓN DE OTROS JUGADORES
// ==========================================

socket.on(
    'jugador_desconectado',
    ({
        jugadorNombre,
        segundosGracia
    }) => {

        agregarHistorial(
            `📴 <strong>${jugadorNombre}</strong> se desconectó. Tiene ${segundosGracia}s para volver.`,
            '📴'
        );
    }
);

socket.on(
    'jugador_reconectado',
    ({
        jugadorNombre
    }) => {

        agregarHistorial(
            `📶 <strong>${jugadorNombre}</strong> volvió a conectarse.`,
            '📶'
        );
    }
);

socket.on(
    'jugador_removido',
    ({
        jugadorNombre,
        motivo
    }) => {

        agregarHistorial(
            `🚪 <strong>${jugadorNombre}</strong> fue removido de la partida (${motivo})`,
            '🚪'
        );
    }
);


// ==========================================
// TEMPORIZADOR DE TURNO
// ==========================================

let temporizadorIntervalo = null;

function detenerTemporizadorTurno() {

    if (temporizadorIntervalo) {

        clearInterval(
            temporizadorIntervalo
        );

        temporizadorIntervalo = null;
    }

    if (temporizadorTurno) {
        temporizadorTurno.classList.add(
            'oculto'
        );
    }
}

function actualizarBarraTemporizador(
    deadline,
    duracionMs
) {

    const restanteMs =
        Math.max(
            0,
            deadline - Date.now()
        );

    const segundos =
        Math.ceil(
            restanteMs / 1000
        );

    const porcentaje =
        duracionMs
            ? Math.max(
                0,
                Math.min(
                    100,
                    (restanteMs / duracionMs) * 100
                )
            )
            : 0;

    if (temporizadorTexto) {
        temporizadorTexto.textContent =
            `${segundos}s`;
    }

    if (temporizadorBarra) {
        temporizadorBarra.style.width =
            `${porcentaje}%`;
    }

    if (temporizadorTurno) {

        temporizadorTurno.classList.toggle(
            'temporizador-urgente',
            segundos <= 10
        );
    }

    if (restanteMs <= 0) {
        detenerTemporizadorTurno();
    }
}

socket.on(
    'temporizador_turno',
    ({
        jugadorId,
        deadline,
        duracionMs
    }) => {

        if (!temporizadorTurno) return;

        detenerTemporizadorTurno();

        temporizadorTurno.classList.remove(
            'oculto'
        );

        const duracionEfectiva =
            duracionMs ||
            Math.max(
                1000,
                deadline - Date.now()
            );

        const jugador =
            jugadoresPartida.find(
                j => j.id === jugadorId
            );

        if (temporizadorTurno) {

            temporizadorTurno.title =
                jugador
                    ? `Tiempo de turno de ${jugador.nombre}`
                    : 'Tiempo de turno';
        }

        actualizarBarraTemporizador(
            deadline,
            duracionEfectiva
        );

        temporizadorIntervalo =
            setInterval(
                () =>
                    actualizarBarraTemporizador(
                        deadline,
                        duracionEfectiva
                    ),
                250
            );
    }
);

socket.on(
    'turno_agotado',
    ({
        jugadorNombre
    }) => {

        agregarHistorial(
            `⏱️ Se agotó el tiempo de <strong>${jugadorNombre}</strong> y se pasó el turno.`,
            '⏱️'
        );
    }
);


// ==========================================
// CHAT EN VIVO
// ==========================================

const chatIdsRenderados =
    new Set();

let chatAbierto = false;
let mensajesSinLeer = 0;

function formatearHoraChat(
    timestamp
) {

    return new Date(
        timestamp || Date.now()
    ).toLocaleTimeString(
        'es-AR',
        {
            hour: '2-digit',
            minute: '2-digit'
        }
    );
}

function renderizarMensajeChat(
    mensaje
) {

    if (
        !chatMensajes ||
        chatIdsRenderados.has(
            mensaje.id
        )
    ) {
        return;
    }

    chatIdsRenderados.add(
        mensaje.id
    );

    const item =
        document.createElement('div');

    const esMio =
        mensaje.jugadorId ===
        socket.id;

    if (mensaje.sistema) {

        item.className =
            'chat-mensaje chat-sistema';

        item.innerHTML =
            `<span class="chat-texto">${mensaje.texto}</span>`;

    } else {

        item.className =
            `chat-mensaje ${esMio
                ? 'chat-mio'
                : ''
            }`;

        item.innerHTML = `
            <div class="chat-mensaje-cabecera">

                <strong>
                    ${esMio
                ? 'Vos'
                : mensaje.jugadorNombre
            }
                </strong>

                <span class="chat-hora">
                    ${formatearHoraChat(mensaje.hora)}
                </span>

            </div>

            <div class="chat-texto"></div>
        `;

        item.querySelector(
            '.chat-texto'
        ).textContent =
            mensaje.texto;
    }

    chatMensajes.appendChild(
        item
    );

    chatMensajes.scrollTop =
        chatMensajes.scrollHeight;

    if (
        !esMio &&
        !chatAbierto
    ) {

        mensajesSinLeer++;

        if (chatBadgeNuevo) {

            chatBadgeNuevo.textContent =
                mensajesSinLeer > 9
                    ? '9+'
                    : String(
                        mensajesSinLeer
                    );

            chatBadgeNuevo.classList.remove(
                'oculto'
            );
        }
    }
}

function cargarChat(
    mensajes
) {

    if (!chatMensajes) return;

    chatMensajes.innerHTML =
        '';

    chatIdsRenderados.clear();

    (
        mensajes || []
    ).forEach(
        renderizarMensajeChat
    );
}

function abrirChat() {

    chatAbierto = true;

    if (chatWidget) {
        chatWidget.classList.add(
            'chat-abierto'
        );
    }

    mensajesSinLeer = 0;

    if (chatBadgeNuevo) {
        chatBadgeNuevo.classList.add(
            'oculto'
        );
    }

    if (chatInput) {
        chatInput.focus();
    }
}

function cerrarChat() {

    chatAbierto = false;

    if (chatWidget) {
        chatWidget.classList.remove(
            'chat-abierto'
        );
    }
}

if (btnChatToggle) {

    btnChatToggle.addEventListener(
        'click',
        () => {

            if (chatAbierto) {
                cerrarChat();
            } else {
                abrirChat();
            }
        }
    );
}

if (chatFormulario) {

    chatFormulario.addEventListener(
        'submit',
        evento => {

            evento.preventDefault();

            if (
                !chatInput ||
                !salaActual
            ) {
                return;
            }

            const texto =
                chatInput.value.trim();

            if (!texto) return;

            chatInput.value =
                '';

            socket.emit(
                'chat_enviar',
                {
                    codigo:
                        salaActual.codigo,
                    texto
                },
                respuesta => {

                    if (!respuesta?.ok) {
                        chatInput.value =
                            texto;
                    }
                }
            );
        }
    );
}

socket.on(
    'chat_mensaje',
    mensaje =>
        renderizarMensajeChat(
            mensaje
        )
);
// ==========================================
// PARTIDA FINALIZADA
// ==========================================

socket.on(
    'partida_finalizada',
    ({
        ganador,
        sala
    }) => {

        if (!ganador) {
            console.warn(
                'Se recibió partida_finalizada sin ganador.'
            );
            return;
        }

        console.log(
            '🏆 Partida finalizada. Ganador:',
            ganador.nombre
        );

        detenerTemporizadorTurno();

        if (sala) {
            salaActual = sala;

            jugadoresPartida =
                sala.jugadores || [];

            jugadorTurnoId =
                sala.turno || null;
        }

        /*
         * El jugador que quedó en la sala es el ganador.
         * El jugador que abandonó voluntariamente ya no
         * pertenece al room y por eso no recibe este evento.
         */
        const soyGanador =
            ganador.id === socket.id;

        /*
         * Ya no debemos intentar reconectarnos a esta
         * partida si se recarga la página.
         */
        borrarSesionCompleta();

        mostrarResultadoFinal(
            soyGanador,
            ganador.nombre
        );
    }
);

function mostrarResultadoFinal(
    soyGanador,
    nombreGanador
) {

    const existente =
        document.getElementById(
            'resultadoPartida'
        );

    if (existente) {
        existente.remove();
    }

    detenerTemporizadorTurno();

    if (modalGestion) {
        modalGestion.classList.add('oculto');
    }

    if (modalCarta) {
        modalCarta.classList.add('oculto');
    }

    const overlay =
        document.createElement('div');

    overlay.id =
        'resultadoPartida';

    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '99999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.background =
        'rgba(0, 0, 0, 0.82)';
    overlay.style.padding = '20px';

    const tarjeta =
        document.createElement('div');

    tarjeta.style.background =
        '#ffffff';

    tarjeta.style.borderRadius =
        '20px';

    tarjeta.style.padding =
        '40px';

    tarjeta.style.maxWidth =
        '500px';

    tarjeta.style.width =
        '100%';

    tarjeta.style.textAlign =
        'center';

    tarjeta.style.boxShadow =
        '0 20px 60px rgba(0,0,0,.4)';

    if (soyGanador) {

        tarjeta.innerHTML = `
            <div style="font-size: 70px; margin-bottom: 15px;">
                🏆
            </div>

            <h2 style="margin: 0 0 10px;">
                ¡Ganaste!
            </h2>

            <p style="font-size: 18px; margin-bottom: 25px;">
                Sos el último jugador que quedó
                en la partida.
            </p>

            <p style="font-size: 16px; margin-bottom: 30px;">
                <strong>${nombreGanador}</strong>
                es el ganador de la partida.
            </p>

            <button
                id="btnResultadoInicio"
                class="btn principal"
                style="width: 100%;"
            >
                🏠 Volver al inicio
            </button>
        `;

    } else {

        tarjeta.innerHTML = `
            <div style="font-size: 70px; margin-bottom: 15px;">
                🏁
            </div>

            <h2 style="margin: 0 0 10px;">
                Partida finalizada
            </h2>

            <p style="font-size: 18px; margin-bottom: 25px;">
                <strong>${nombreGanador}</strong>
                ganó la partida.
            </p>

            <button
                id="btnResultadoInicio"
                class="btn principal"
                style="width: 100%;"
            >
                🏠 Volver al inicio
            </button>
        `;
    }

    overlay.appendChild(tarjeta);

    document.body.appendChild(overlay);

    const btnInicio =
        document.getElementById(
            'btnResultadoInicio'
        );

    if (!btnInicio) {
        return;
    }

    btnInicio.addEventListener(
        'click',
        () => {

            saliendoDePartida = true;

            btnInicio.disabled = true;
            btnInicio.textContent =
                '🏠 Volviendo...';

            /*
             * El servidor ya marcó la partida como
             * finalizada. Al emitir salir-partida,
             * eliminarJugador() quitará al ganador.
             *
             * Como era el último jugador:
             *
             * jugadores.length === 0
             *
             * y roomManager eliminará definitivamente
             * la sala de memoria.
             */
            socket.emit(
                'salir-partida',
                respuesta => {

                    console.log(
                        '🧹 Sala finalizada limpiada:',
                        respuesta
                    );

                    borrarSesionCompleta();

                    salaActual = null;
                    jugadoresPartida = [];
                    jugadorTurnoId = null;
                    indiceTurno = 0;
                    haTiradoDadosEsteTurno = false;

                    detenerTemporizadorTurno();

                    if (modalGestion) {
                        modalGestion.classList.add(
                            'oculto'
                        );
                    }

                    if (modalCarta) {
                        modalCarta.classList.add(
                            'oculto'
                        );
                    }

                    window.location.href = '/';
                }
            );
        }
    );
}