const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');

const {
    crearSala,
    obtenerSala,
    agregarJugador,
    iniciarSala,
    eliminarJugador,
    encontrarSalaPorSocket,
    marcarDesconectado,
    reconectarJugador,
    eliminarJugadorPorToken,
    siguienteJugadorActivo,
    agregarMensajeChat
} = require('./src/rooms/roomManager');

const casillas = require('../frontend/data/casillas');

const DURACION_SUBASTA_MS = 30000;

// Tiempo de gracia para que un jugador desconectado (mal internet, celular
// que se traba, pestaña recargada) pueda volver a la partida sin perder su lugar.
const GRACIA_RECONEXION_MS = 2 * 60 * 1000;

// Si el que se desconecta es justo el que tiene el turno, no hacemos esperar
// al resto tanto tiempo: le damos una ventana más corta para volver.
const GRACIA_RECONEXION_EN_TURNO_MS = 30 * 1000;

// Duración del temporizador de turno. Al agotarse, se pasa el turno solo.
const DURACION_TURNO_MS = 60 * 1000;

// codigo de sala -> { deadline, timeout }
const temporizadoresTurno = {};

// token de jugador -> timeout de eliminación por falta de reconexión
const temporizadoresDesconexion = {};

const MAX_LARGO_MENSAJE_CHAT = 300;


// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

function propiedad(numero) {
    return casillas.find(
        casilla => casilla.numero === Number(numero)
    );
}

function propiedadesDelGrupo(grupo) {
    return grupo
        ? casillas.filter(casilla => casilla.grupo === grupo)
        : [];
}

function tieneGrupoCompleto(sala, jugadorId, grupo) {
    const grupoCompleto = propiedadesDelGrupo(grupo);

    return (
        grupoCompleto.length > 0 &&
        grupoCompleto.every(
            casilla =>
                sala.propiedades[casilla.numero] === jugadorId
        )
    );
}

function costoEdificio(casilla) {
    return Math.round(casilla.precio / 2);
}

function nivelEdificio(sala, numero) {
    return sala.edificios?.[numero] || 0;
}

function rentaDePropiedad(sala, casilla, dado) {

    if (sala.hipotecas?.[casilla.numero]) {
        return 0;
    }

    const duenoId =
        sala.propiedades[casilla.numero];

    if (casilla.categoria === 'ferrocarril') {

        const cantidad =
            [6, 16, 26, 36]
                .filter(
                    numero =>
                        sala.propiedades[numero] === duenoId &&
                        !sala.hipotecas?.[numero]
                )
                .length;

        return [0, 500, 1000, 1500, 2000][cantidad] || 0;
    }

    if (casilla.servicio) {

        const cantidad =
            [14, 29]
                .filter(
                    numero =>
                        sala.propiedades[numero] === duenoId &&
                        !sala.hipotecas?.[numero]
                )
                .length;

        return dado * (cantidad === 2 ? 100 : 40);
    }

    const nivel =
        nivelEdificio(sala, casilla.numero);

    if (nivel > 0) {
        return (
            (casilla.alquiler || 100) *
            [1, 5, 15, 45, 80, 125][nivel]
        );
    }

    return (
        (casilla.alquiler || 100) *
        (
            tieneGrupoCompleto(
                sala,
                duenoId,
                casilla.grupo
            )
                ? 2
                : 1
        )
    );
}


function emitirEstadoEconomico(io, codigo, sala) {

    io.to(codigo).emit(
        'estado_economico_actualizado',
        {
            propiedades: sala.propiedades,
            edificios: sala.edificios,
            hipotecas: sala.hipotecas,
            jugadores: sala.jugadores
        }
    );
}


function enviarACarcel(
    io,
    codigo,
    jugador,
    motivo
) {

    jugador.posicion = 11;
    jugador.enCarcel = true;
    jugador.turnosEnCarcel = 3;
    jugador.doblesConsecutivos = 0;

    io.to(codigo).emit(
        'jugador_encarcelado',
        {
            jugadorId: jugador.id,
            jugadorNombre: jugador.nombre,
            casilla: 11,
            motivo
        }
    );

    io.to(codigo).emit(
        'jugador_movido',
        {
            jugadorId: jugador.id,
            jugadorNombre: jugador.nombre,
            posicion: 11,
            dinero: jugador.dinero,
            encarcelado: true
        }
    );
}


// ==========================================
// TEMPORIZADOR DE TURNO
// ==========================================

function limpiarTemporizadorTurno(codigo) {

    const actual =
        temporizadoresTurno[codigo];

    if (actual) {

        clearTimeout(actual.timeout);

        delete temporizadoresTurno[codigo];
    }
}


function iniciarTemporizadorTurno(
    codigo,
    duracionMs = DURACION_TURNO_MS
) {

    limpiarTemporizadorTurno(codigo);

    const sala =
        obtenerSala(codigo);

    if (
        !sala ||
        sala.estado !== 'jugando' ||
        !sala.turno
    ) {
        return;
    }

    const jugadorIdEsperado =
        sala.turno;

    const deadline =
        Date.now() + duracionMs;

    temporizadoresTurno[codigo] = {
        deadline,

        timeout: setTimeout(
            () =>
                manejarTiempoAgotado(
                    codigo,
                    jugadorIdEsperado
                ),
            duracionMs
        )
    };

    io.to(codigo).emit(
        'temporizador_turno',
        {
            jugadorId: jugadorIdEsperado,
            deadline,
            duracionMs
        }
    );
}


function manejarTiempoAgotado(
    codigo,
    jugadorIdEsperado
) {

    const sala =
        obtenerSala(codigo);

    if (
        !sala ||
        sala.estado !== 'jugando'
    ) {
        return;
    }

    // El turno ya cambió por otra vía.
    if (
        sala.turno !== jugadorIdEsperado
    ) {
        return;
    }

    // No forzamos el pase de turno en medio
    // de una subasta.
    if (sala.subasta) {

        temporizadoresTurno[codigo] = {
            deadline: Date.now() + 3000,

            timeout: setTimeout(
                () =>
                    manejarTiempoAgotado(
                        codigo,
                        jugadorIdEsperado
                    ),
                3000
            )
        };

        return;
    }

    const jugador =
        sala.jugadores.find(
            j => j.id === jugadorIdEsperado
        );

    if (!jugador) {
        return;
    }

    io.to(codigo).emit(
        'turno_agotado',
        {
            jugadorId: jugador.id,
            jugadorNombre: jugador.nombre
        }
    );

    agregarMensajeSistema(
        codigo,
        `⏱️ Se agotó el tiempo de ${jugador.nombre} y pasó el turno.`
    );

    const indiceActual =
        sala.jugadores.findIndex(
            j => j.id === jugadorIdEsperado
        );

    const siguienteIndice =
        siguienteJugadorActivo(
            sala,
            (indiceActual + 1) %
            sala.jugadores.length
        );

    if (siguienteIndice === -1) {
        return;
    }

    const siguienteJugador =
        sala.jugadores[siguienteIndice];

    sala.turno =
        siguienteJugador.id;

    sala.haTiradoDados = false;
    sala.doblePendiente = false;

    io.to(codigo).emit(
        'turno_actualizado',
        {
            jugadorId: siguienteJugador.id,
            jugadorNombre: siguienteJugador.nombre,
            turno: siguienteIndice,
            porTiempoAgotado: true
        }
    );

    iniciarTemporizadorTurno(codigo);
}


// ==========================================
// CHAT
// ==========================================

function agregarMensajeSistema(
    codigo,
    texto
) {

    const mensaje = {
        id:
            `sys-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,

        sistema: true,
        texto,
        hora: Date.now()
    };

    agregarMensajeChat(
        codigo,
        mensaje
    );

    io.to(codigo).emit(
        'chat_mensaje',
        mensaje
    );

    return mensaje;
}


function cobrarDeuda(
    jugador,
    monto,
    acreedor = null
) {

    const pagado =
        Math.min(
            jugador.dinero,
            monto
        );

    jugador.dinero -= pagado;

    if (acreedor) {
        acreedor.dinero += pagado;
    }

    const pendiente =
        monto - pagado;

    if (pendiente > 0) {

        jugador.deudaPendiente =
            (jugador.deudaPendiente || 0) +
            pendiente;

        jugador.acreedorId =
            acreedor?.id || null;
    }

    return {
        pagado,
        pendiente
    };
}


// ==========================================
// CONFIGURACIÓN DEL SERVIDOR
// ==========================================

const app = express();

const server =
    http.createServer(app);

const io =
    new Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });


// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors());

app.use(express.json());


// ==========================================
// SERVIR FRONTEND
// ==========================================

const frontendPath =
    path.join(
        __dirname,
        '..',
        'frontend'
    );

app.use(
    express.static(frontendPath)
);


// ==========================================
// RUTA PRINCIPAL
// ==========================================

app.get('/', (req, res) => {

    res.sendFile(
        path.join(
            frontendPath,
            'index.html'
        )
    );

});


// ==========================================
// SOCKET.IO
// ==========================================

io.on('connection', (socket) => {

    console.log(
        'Jugador conectado:',
        socket.id
    );


    // ======================================
    // CREAR SALA
    // ======================================

    socket.on(
        'crear_sala',
        (datos, callback) => {

            try {

                const nombre =
                    datos?.nombre?.trim();

                const token =
                    typeof datos?.token === 'string' &&
                        datos.token
                        ? datos.token
                        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

                if (!nombre) {

                    const respuesta = {
                        ok: false,
                        mensaje:
                            'Debes ingresar un nombre.'
                    };

                    if (
                        typeof callback ===
                        'function'
                    ) {
                        callback(respuesta);
                    } else {
                        socket.emit(
                            'error_sala',
                            respuesta
                        );
                    }

                    return;
                }

                const sala =
                    crearSala(
                        socket.id,
                        nombre,
                        token
                    );

                socket.join(
                    sala.codigo
                );

                console.log(
                    'Sala creada:',
                    sala.codigo
                );

                const respuesta = {
                    ok: true,
                    sala,
                    token
                };

                if (
                    typeof callback ===
                    'function'
                ) {
                    callback(respuesta);
                }

                io.to(
                    sala.codigo
                ).emit(
                    'estado_sala',
                    sala
                );

            } catch (error) {

                console.error(
                    'Error al crear sala:',
                    error
                );

                const respuesta = {
                    ok: false,
                    mensaje:
                        'Ocurrió un error al crear la sala.'
                };

                if (
                    typeof callback ===
                    'function'
                ) {
                    callback(respuesta);
                } else {
                    socket.emit(
                        'error_sala',
                        respuesta
                    );
                }
            }
        }
    );


    // ======================================
    // UNIRSE A SALA
    // ======================================

    socket.on(
        'unirse_sala',
        (datos, callback) => {

            try {

                const codigo =
                    datos?.codigo
                        ?.trim()
                        .toUpperCase();

                const nombre =
                    datos?.nombre?.trim();

                if (!codigo) {

                    const respuesta = {
                        ok: false,
                        mensaje:
                            'Debes ingresar el código de la sala.'
                    };

                    if (
                        typeof callback ===
                        'function'
                    ) {
                        callback(respuesta);
                    } else {
                        socket.emit(
                            'error_sala',
                            respuesta
                        );
                    }

                    return;
                }

                if (!nombre) {

                    const respuesta = {
                        ok: false,
                        mensaje:
                            'Debes ingresar un nombre.'
                    };

                    if (
                        typeof callback ===
                        'function'
                    ) {
                        callback(respuesta);
                    } else {
                        socket.emit(
                            'error_sala',
                            respuesta
                        );
                    }

                    return;
                }

                const token =
                    typeof datos?.token === 'string' &&
                        datos.token
                        ? datos.token
                        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

                const resultado =
                    agregarJugador(
                        codigo,
                        socket.id,
                        nombre,
                        token
                    );

                if (resultado.error) {

                    const respuesta = {
                        ok: false,
                        mensaje:
                            resultado.error
                    };

                    if (
                        typeof callback ===
                        'function'
                    ) {
                        callback(respuesta);
                    } else {
                        socket.emit(
                            'error_sala',
                            respuesta
                        );
                    }

                    return;
                }

                const sala =
                    resultado.sala;

                socket.join(codigo);

                console.log(
                    `Jugador ${nombre} se unió a sala ${codigo}`
                );

                const respuesta = {
                    ok: true,
                    sala,
                    token
                };

                if (
                    typeof callback ===
                    'function'
                ) {
                    callback(respuesta);
                }

                io.to(
                    codigo
                ).emit(
                    'estado_sala',
                    sala
                );

                io.to(
                    codigo
                ).emit(
                    'sala_actualizada',
                    sala
                );

                agregarMensajeSistema(
                    codigo,
                    `👋 ${nombre} se unió a la partida.`
                );

            } catch (error) {

                console.error(
                    'Error al unirse a sala:',
                    error
                );

                const respuesta = {
                    ok: false,
                    mensaje:
                        'Ocurrió un error al unirse a la sala.'
                };

                if (
                    typeof callback ===
                    'function'
                ) {
                    callback(respuesta);
                } else {
                    socket.emit(
                        'error_sala',
                        respuesta
                    );
                }
            }
        }
    );


    // ======================================
    // INICIAR PARTIDA
    // ======================================

    socket.on(
        'iniciar_partida',
        (datos, callback) => {

            try {

                const codigo =
                    datos?.codigo
                        ?.trim()
                        .toUpperCase();

                if (!codigo) {

                    const respuesta = {
                        ok: false,
                        mensaje:
                            'Código de sala inválido.'
                    };

                    if (
                        typeof callback ===
                        'function'
                    ) {
                        callback(respuesta);
                    }

                    return;
                }

                const resultado =
                    iniciarSala(
                        codigo,
                        socket.id
                    );

                if (resultado.error) {

                    const respuesta = {
                        ok: false,
                        mensaje:
                            resultado.error
                    };

                    if (
                        typeof callback ===
                        'function'
                    ) {
                        callback(respuesta);
                    } else {
                        socket.emit(
                            'error_sala',
                            respuesta
                        );
                    }

                    return;
                }

                const sala =
                    resultado.sala;

                console.log(
                    'Partida iniciada:',
                    codigo
                );

                if (
                    typeof callback ===
                    'function'
                ) {

                    callback({
                        ok: true,
                        sala
                    });
                }

                io.to(
                    codigo
                ).emit(
                    'partida_iniciada',
                    sala
                );

                io.to(
                    codigo
                ).emit(
                    'sala_actualizada',
                    sala
                );

                agregarMensajeSistema(
                    codigo,
                    '🎲 ¡La partida comenzó!'
                );

                iniciarTemporizadorTurno(
                    codigo
                );

            } catch (error) {

                console.error(
                    'Error al iniciar partida:',
                    error
                );

                const respuesta = {
                    ok: false,
                    mensaje:
                        'Ocurrió un error al iniciar la partida.'
                };

                if (
                    typeof callback ===
                    'function'
                ) {

                    callback(respuesta);

                } else {

                    socket.emit(
                        'error_sala',
                        respuesta
                    );
                }
            }
        }
    );


    // ======================================
    // SALIR DE PARTIDA
    // ======================================

    socket.on('salir-partida', (callback) => {

        const sala = encontrarSalaPorSocket(socket.id);

        // --------------------------------------
        // NO ESTÁ EN NINGUNA SALA
        // --------------------------------------

        if (!sala) {

            callback?.({
                ok: false,
                mensaje: 'No estás en una partida.'
            });

            return;
        }


        const codigo = sala.codigo;


        // --------------------------------------
        // OBTENER JUGADOR
        // --------------------------------------

        const jugador = sala.jugadores.find(
            jugador => jugador.id === socket.id
        );

        const nombreJugador = jugador
            ? jugador.nombre
            : 'Un jugador';


        // --------------------------------------
        // ELIMINAR JUGADOR
        // --------------------------------------

        const salaActualizada =
            eliminarJugador(socket.id);


        // El jugador ya salió de la sala del servidor.
        socket.leave(codigo);


        // --------------------------------------
        // LA SALA QUEDÓ VACÍA
        // --------------------------------------

        if (!salaActualizada) {

            console.log(
                `🚪 ${nombreJugador} salió de la sala ${codigo}. Sala eliminada.`
            );

            callback?.({
                ok: true
            });

            return;
        }


        // --------------------------------------
        // SI LA PARTIDA ESTABA EN CURSO
        // Y QUEDA UN SOLO JUGADOR
        // --------------------------------------

        if (
            salaActualizada.estado === 'jugando' &&
            salaActualizada.jugadores.length === 1
        ) {

            const finalizada =
                finalizarPartidaSiQuedaUnJugador(
                    codigo,
                    salaActualizada,
                    'ultimo_jugador'
                );

            if (finalizada) {

                console.log(
                    `🚪 ${nombreJugador} abandonó la partida ${codigo}.`
                );

                // Confirmamos al jugador que salió.
                callback?.({
                    ok: true
                });

                return;
            }
        }


        // --------------------------------------
        // PARTIDA DE ESPERA
        // O PARTIDA CON 2+ JUGADORES
        // --------------------------------------

        console.log(
            `🚪 ${nombreJugador} salió voluntariamente de la sala ${codigo}.`
        );


        // --------------------------------------
        // AVISAR A LOS JUGADORES RESTANTES
        // --------------------------------------

        io.to(codigo).emit(
            'jugador-salio',
            {
                jugadorId: socket.id,
                nombre: nombreJugador,
                jugadores: salaActualizada.jugadores,
                host: salaActualizada.host,
                turno: salaActualizada.turno
            }
        );


        // --------------------------------------
        // ACTUALIZAR ESTADO DE LA SALA
        // --------------------------------------

        io.to(codigo).emit(
            'sala_actualizada',
            salaActualizada
        );


        // --------------------------------------
        // ACTUALIZAR ESTADO ECONÓMICO
        // --------------------------------------

        io.to(codigo).emit(
            'estado_economico_actualizado',
            {
                propiedades: salaActualizada.propiedades,
                edificios: salaActualizada.edificios,
                hipotecas: salaActualizada.hipotecas,
                jugadores: salaActualizada.jugadores
            }
        );


        // --------------------------------------
        // MENSAJE DEL SISTEMA EN EL CHAT
        // --------------------------------------

        agregarMensajeSistema(
            codigo,
            `🚪 ${nombreJugador} salió de la partida.`
        );


        // --------------------------------------
        // CONFIRMAR AL JUGADOR QUE SALIÓ
        // --------------------------------------

        callback?.({
            ok: true
        });

    });

function finalizarPartidaSiQuedaUnJugador(
    codigo,
    sala,
    motivo = 'ultimo_jugador'
) {

    if (
        !sala ||
        sala.estado !== 'jugando' ||
        sala.jugadores.length !== 1
    ) {
        return false;
    }

    // Detener el temporizador del turno.
    limpiarTemporizadorTurno(codigo);

    // Cancelar cualquier subasta pendiente.
    if (sala.subasta?.timer) {
        clearTimeout(sala.subasta.timer);
    }

    sala.subasta = null;

    const ganador = sala.jugadores[0];

    sala.estado = 'finalizada';

    sala.ganador = {
        id: ganador.id,
        nombre: ganador.nombre
    };

    console.log(
        `🏆 ${ganador.nombre} ganó la partida ${codigo}. Motivo: ${motivo}`
    );

    // Actualizar el estado de la sala para los jugadores restantes.
    io.to(codigo).emit(
        'sala_actualizada',
        sala
    );

    // Actualizar estado económico.
    emitirEstadoEconomico(
        io,
        codigo,
        sala
    );

    // Avisar que la partida terminó.
    io.to(codigo).emit(
        'partida_finalizada',
        {
            motivo,
            ganador: {
                id: ganador.id,
                nombre: ganador.nombre
            },
            sala
        }
    );

    return true;
}
    // ======================================
    // TIRAR DADOS
    // ======================================

    socket.on(
        'tirar_dados',
        (datos, callback) => {

            try {

                const codigo =
                    datos?.codigo
                        ?.trim()
                        .toUpperCase();

                if (!codigo) return;

                const sala =
                    obtenerSala(codigo);

                if (!sala) {

                    const respuesta = {
                        ok: false,
                        mensaje:
                            'La sala no existe.'
                    };

                    if (
                        typeof callback ===
                        'function'
                    ) {
                        callback(respuesta);
                    }

                    return;
                }

                if (
                    sala.estado !== 'jugando'
                ) {

                    const respuesta = {
                        ok: false,
                        mensaje:
                            'La partida todavía no comenzó.'
                    };

                    if (
                        typeof callback ===
                        'function'
                    ) {
                        callback(respuesta);
                    }

                    return;
                }

                if (
                    sala.turno !== socket.id
                ) {

                    const respuesta = {
                        ok: false,
                        mensaje:
                            'No es tu turno.'
                    };

                    if (
                        typeof callback ===
                        'function'
                    ) {
                        callback(respuesta);
                    } else {
                        socket.emit(
                            'error_sala',
                            respuesta
                        );
                    }

                    return;
                }

                if (sala.haTiradoDados) {

                    const respuesta = {
                        ok: false,
                        mensaje:
                            'Ya tiraste los dados en este turno.'
                    };

                    if (
                        typeof callback ===
                        'function'
                    ) {
                        callback(respuesta);
                    } else {
                        socket.emit(
                            'error_sala',
                            respuesta
                        );
                    }

                    return;
                }

                const jugador =
                    sala.jugadores.find(
                        j => j.id === socket.id
                    );

                if (!jugador) return;

                // Tirada de dados
                const dado1 =
                    Math.floor(
                        Math.random() * 6
                    ) + 1;

                const dado2 =
                    Math.floor(
                        Math.random() * 6
                    ) + 1;

                const suma =
                    dado1 + dado2;

                const sonDobles =
                    dado1 === dado2;

                // Tres dobles consecutivos
                if (
                    !jugador.enCarcel &&
                    sonDobles
                ) {

                    jugador.doblesConsecutivos =
                        (jugador.doblesConsecutivos || 0) + 1;

                    if (
                        jugador.doblesConsecutivos === 3
                    ) {

                        sala.haTiradoDados = true;

                        io.to(codigo).emit(
                            'dados_lanzados',
                            {
                                jugadorId: jugador.id,
                                jugadorNombre: jugador.nombre,
                                dado1,
                                dado2,
                                suma
                            }
                        );

                        enviarACarcel(
                            io,
                            codigo,
                            jugador,
                            'Sacó tres dobles consecutivos.'
                        );

                        if (
                            typeof callback ===
                            'function'
                        ) {
                            callback({
                                ok: true,
                                dado1,
                                dado2,
                                suma,
                                encarcelado: true
                            });
                        }

                        return;
                    }

                } else if (
                    !jugador.enCarcel
                ) {

                    jugador.doblesConsecutivos = 0;
                }


                // ==================================
                // ESTÁ EN LA CÁRCEL
                // ==================================

                if (jugador.enCarcel) {

                    io.to(codigo).emit(
                        'dados_lanzados',
                        {
                            jugadorId: socket.id,
                            jugadorNombre: jugador.nombre,
                            dado1,
                            dado2,
                            suma
                        }
                    );

                    if (sonDobles) {

                        jugador.enCarcel = false;
                        jugador.turnosEnCarcel = 0;

                        io.to(codigo).emit(
                            'salio_carcel',
                            {
                                jugadorId: jugador.id,
                                jugadorNombre: jugador.nombre,
                                motivo:
                                    '¡Sacó dobles en los dados!'
                            }
                        );

                    } else {

                        jugador.turnosEnCarcel--;

                        if (
                            jugador.turnosEnCarcel <= 0
                        ) {

                            const fianza =
                                Math.min(
                                    jugador.dinero,
                                    500
                                );

                            jugador.dinero -=
                                fianza;

                            jugador.enCarcel = false;
                            jugador.turnosEnCarcel = 0;

                            io.to(codigo).emit(
                                'salio_carcel',
                                {
                                    jugadorId: jugador.id,
                                    jugadorNombre: jugador.nombre,
                                    motivo:
                                        `Cumplió condena y pagó $${fianza} de fianza.`,
                                    dinero:
                                        jugador.dinero
                                }
                            );

                        } else {

                            sala.haTiradoDados = true;

                            io.to(codigo).emit(
                                'permanece_carcel',
                                {
                                    jugadorId: jugador.id,
                                    jugadorNombre: jugador.nombre,
                                    turnosRestantes:
                                        jugador.turnosEnCarcel
                                }
                            );

                            if (
                                typeof callback ===
                                'function'
                            ) {

                                callback({
                                    ok: true,
                                    dado1,
                                    dado2,
                                    suma,
                                    enCarcel: true,
                                    turnosRestantes:
                                        jugador.turnosEnCarcel
                                });
                            }

                            return;
                        }
                    }

                } else {

                    io.to(codigo).emit(
                        'dados_lanzados',
                        {
                            jugadorId: socket.id,
                            jugadorNombre: jugador.nombre,
                            dado1,
                            dado2,
                            suma
                        }
                    );
                }


                // ==================================
                // MOVIMIENTO
                // ==================================

                const posicionAnterior =
                    jugador.posicion;

                let nuevaPosicion =
                    jugador.posicion + suma;

                let pasoPorSalida = false;

                if (
                    nuevaPosicion > 40
                ) {

                    nuevaPosicion -= 40;

                    jugador.dinero += 2000;

                    pasoPorSalida = true;

                    io.to(codigo).emit(
                        'dinero_actualizado',
                        {
                            jugadorId: jugador.id,
                            dinero: jugador.dinero,
                            motivo:
                                'Paso por Salida (+$2.000)'
                        }
                    );
                }

                jugador.posicion =
                    nuevaPosicion;

                io.to(codigo).emit(
                    'jugador_movido',
                    {
                        jugadorId: jugador.id,
                        jugadorNombre: jugador.nombre,
                        posicionAnterior,
                        posicion: nuevaPosicion,
                        dinero: jugador.dinero,
                        pasoPorSalida
                    }
                );


                // ==================================
                // CASILLA DE DESTINO
                // ==================================

                const casillaActual =
                    casillas.find(
                        c =>
                            c.numero ===
                            nuevaPosicion
                    );

                let accion = null;

                if (casillaActual) {

                    // Enviar a la cárcel
                    if (
                        casillaActual.enviaCarcel
                    ) {

                        jugador.posicion = 11;
                        jugador.enCarcel = true;
                        jugador.turnosEnCarcel = 3;

                        accion = 'carcel';

                        io.to(codigo).emit(
                            'jugador_encarcelado',
                            {
                                jugadorId: jugador.id,
                                jugadorNombre: jugador.nombre,
                                casilla: 11
                            }
                        );

                        io.to(codigo).emit(
                            'jugador_movido',
                            {
                                jugadorId: jugador.id,
                                jugadorNombre: jugador.nombre,
                                posicionAnterior:
                                    nuevaPosicion,
                                posicion: 11,
                                dinero:
                                    jugador.dinero,
                                encarcelado: true
                            }
                        );
                    }

                    // Impuestos
                    else if (
                        casillaActual.impuesto
                    ) {

                        const montoImpuesto =
                            casillaActual.monto ||
                            (
                                casillaActual.numero === 5
                                    ? 2000
                                    : 1000
                            );

                        const pago =
                            cobrarDeuda(
                                jugador,
                                montoImpuesto
                            );

                        accion = 'impuesto';

                        io.to(codigo).emit(
                            'impuesto_pagado',
                            {
                                jugadorId: jugador.id,
                                jugadorNombre: jugador.nombre,
                                monto: pago.pagado,
                                deudaPendiente:
                                    pago.pendiente,
                                nombre:
                                    casillaActual.nombre,
                                dinero:
                                    jugador.dinero
                            }
                        );
                    }

                    // Suerte / Arca
                    else if (
                        casillaActual.categoria === 'suerte' ||
                        casillaActual.categoria === 'arca'
                    ) {

                        const baraja =
                            casillaActual.categoria === 'suerte'
                                ? casillas.cartasSuerte
                                : casillas.cartasArca;

                        if (
                            baraja &&
                            baraja.length > 0
                        ) {

                            const carta =
                                baraja[
                                Math.floor(
                                    Math.random() *
                                    baraja.length
                                )
                                ];

                            accion = 'carta';

                            if (
                                carta.tipo === 'dinero'
                            ) {

                                if (
                                    carta.valor < 0
                                ) {

                                    cobrarDeuda(
                                        jugador,
                                        -carta.valor
                                    );

                                } else {

                                    jugador.dinero +=
                                        carta.valor;
                                }

                            } else if (
                                carta.tipo ===
                                'salida_carcel'
                            ) {

                                jugador.cartasSalidaCarcel =
                                    (
                                        jugador.cartasSalidaCarcel ||
                                        0
                                    ) + 1;

                            } else if (
                                carta.tipo === 'mover'
                            ) {

                                const posPrev =
                                    jugador.posicion;

                                jugador.posicion =
                                    carta.destino;

                                io.to(codigo).emit(
                                    'jugador_movido',
                                    {
                                        jugadorId:
                                            jugador.id,
                                        jugadorNombre:
                                            jugador.nombre,
                                        posicionAnterior:
                                            posPrev,
                                        posicion:
                                            carta.destino,
                                        dinero:
                                            jugador.dinero
                                    }
                                );
                            }

                            io.to(codigo).emit(
                                'carta_robada',
                                {
                                    jugadorId:
                                        jugador.id,
                                    jugadorNombre:
                                        jugador.nombre,
                                    categoria:
                                        casillaActual.categoria,
                                    carta,
                                    dinero:
                                        jugador.dinero,
                                    cartasSalidaCarcel:
                                        jugador.cartasSalidaCarcel ||
                                        0
                                }
                            );
                        }
                    }

                    // Propiedad ajena
                    else if (
                        sala.propiedades[nuevaPosicion] &&
                        sala.propiedades[nuevaPosicion] !==
                        socket.id
                    ) {

                        const duenoId =
                            sala.propiedades[
                            nuevaPosicion
                            ];

                        const dueno =
                            sala.jugadores.find(
                                j =>
                                    j.id ===
                                    duenoId
                            );

                        if (
                            dueno &&
                            !dueno.enBancarrota
                        ) {

                            const renta =
                                rentaDePropiedad(
                                    sala,
                                    casillaActual,
                                    suma
                                );

                            const pago =
                                cobrarDeuda(
                                    jugador,
                                    renta,
                                    dueno
                                );

                            accion = 'alquiler';

                            io.to(codigo).emit(
                                'alquiler_pagado',
                                {
                                    deId:
                                        jugador.id,
                                    deNombre:
                                        jugador.nombre,
                                    paraId:
                                        dueno.id,
                                    paraNombre:
                                        dueno.nombre,
                                    monto:
                                        pago.pagado,
                                    deudaPendiente:
                                        pago.pendiente,
                                    propiedadNombre:
                                        casillaActual.nombre,
                                    dineroDe:
                                        jugador.dinero,
                                    dineroPara:
                                        dueno.dinero
                                }
                            );
                        }
                    }
                }


                // ==================================
                // FINAL DEL TURNO
                // ==================================

                sala.haTiradoDados = true;

                sala.doblePendiente =
                    sonDobles &&
                    !jugador.enCarcel;

                if (
                    jugador.deudaPendiente > 0
                ) {

                    io.to(codigo).emit(
                        'jugador_en_deuda',
                        {
                            jugadorId:
                                jugador.id,
                            jugadorNombre:
                                jugador.nombre,
                            monto:
                                jugador.deudaPendiente
                        }
                    );
                }

                if (
                    typeof callback ===
                    'function'
                ) {

                    callback({
                        ok: true,
                        dado1,
                        dado2,
                        suma,
                        posicion:
                            jugador.posicion,
                        dinero:
                            jugador.dinero,
                        accion
                    });
                }

            } catch (error) {

                console.error(
                    'Error al tirar dados:',
                    error
                );

                if (
                    typeof callback ===
                    'function'
                ) {

                    callback({
                        ok: false,
                        mensaje:
                            'Ocurrió un error al tirar los dados.'
                    });
                }
            }
        }
    );


    // ======================================
    // SUBASTAS, EDIFICIOS, HIPOTECAS
    // E INTERCAMBIOS
    // ======================================

    function jugadorActivo(
        sala,
        id
    ) {

        return (
            sala?.estado === 'jugando' &&
            sala.jugadores.find(
                j =>
                    j.id === id &&
                    !j.enBancarrota
            )
        );
    }


    function finalizarSubasta(codigo) {

        const sala =
            obtenerSala(codigo);

        if (!sala?.subasta) {
            return;
        }

        const subasta =
            sala.subasta;

        sala.subasta = null;

        if (
            subasta.mejorPostorId &&
            subasta.mejorOferta > 0
        ) {

            const ganador =
                sala.jugadores.find(
                    j =>
                        j.id ===
                        subasta.mejorPostorId
                );

            if (
                ganador &&
                ganador.dinero >=
                subasta.mejorOferta
            ) {

                ganador.dinero -=
                    subasta.mejorOferta;

                ganador.propiedades.push(
                    subasta.numeroCasilla
                );

                sala.propiedades[
                    subasta.numeroCasilla
                ] = ganador.id;

                io.to(codigo).emit(
                    'subasta_finalizada',
                    {
                        numeroCasilla:
                            subasta.numeroCasilla,
                        ganadorId:
                            ganador.id,
                        ganadorNombre:
                            ganador.nombre,
                        monto:
                            subasta.mejorOferta
                    }
                );

                emitirEstadoEconomico(
                    io,
                    codigo,
                    sala
                );

                return;
            }
        }

        io.to(codigo).emit(
            'subasta_finalizada',
            {
                numeroCasilla:
                    subasta.numeroCasilla,
                sinGanador: true
            }
        );
    }


    socket.on(
        'iniciar_subasta',
        (datos, callback) => {

            const codigo =
                datos?.codigo
                    ?.trim()
                    .toUpperCase();

            const sala =
                obtenerSala(codigo);

            const numero =
                Number(
                    datos?.numeroCasilla
                );

            const casilla =
                propiedad(numero);

            const jugador =
                jugadorActivo(
                    sala,
                    socket.id
                );

            if (
                !jugador ||
                sala.turno !== socket.id ||
                !sala.haTiradoDados ||
                jugador.posicion !== numero ||
                !casilla?.precio ||
                sala.propiedades[numero] ||
                sala.subasta
            ) {

                return callback?.({
                    ok: false,
                    mensaje:
                        'No se puede iniciar esta subasta.'
                });
            }

            const terminaEn =
                Date.now() +
                DURACION_SUBASTA_MS;

            sala.subasta = {
                numeroCasilla: numero,
                terminaEn,
                mejorOferta: 0,
                mejorPostorId: null
            };

            Object.defineProperty(
                sala.subasta,
                'timer',
                {
                    value:
                        setTimeout(
                            () =>
                                finalizarSubasta(
                                    codigo
                                ),
                            DURACION_SUBASTA_MS
                        ),
                    enumerable: false
                }
            );

            io.to(codigo).emit(
                'subasta_iniciada',
                {
                    numeroCasilla:
                        numero,
                    nombrePropiedad:
                        casilla.nombre,
                    terminaEn
                }
            );

            callback?.({
                ok: true
            });
        }
    );


    socket.on(
        'pujar_subasta',
        (datos, callback) => {

            const codigo =
                datos?.codigo
                    ?.trim()
                    .toUpperCase();

            const sala =
                obtenerSala(codigo);

            const jugador =
                jugadorActivo(
                    sala,
                    socket.id
                );

            const monto =
                Math.floor(
                    Number(
                        datos?.monto
                    )
                );

            if (
                !jugador ||
                !sala.subasta ||
                !Number.isFinite(monto) ||
                monto <=
                sala.subasta.mejorOferta ||
                monto > jugador.dinero
            ) {

                return callback?.({
                    ok: false,
                    mensaje:
                        'La puja debe superar la actual y estar cubierta por tu dinero.'
                });
            }

            sala.subasta.mejorOferta =
                monto;

            sala.subasta.mejorPostorId =
                jugador.id;

            io.to(
                codigo
            ).emit(
                'puja_realizada',
                {
                    jugadorId:
                        jugador.id,
                    jugadorNombre:
                        jugador.nombre,
                    monto,
                    numeroCasilla:
                        sala.subasta.numeroCasilla
                }
            );

            callback?.({
                ok: true
            });
        }
    );


    socket.on(
        'gestionar_edificio',
        (datos, callback) => {

            const sala =
                obtenerSala(
                    datos?.codigo
                        ?.trim()
                        .toUpperCase()
                );

            const jugador =
                jugadorActivo(
                    sala,
                    socket.id
                );

            const numero =
                Number(
                    datos?.numeroCasilla
                );

            const casilla =
                propiedad(numero);

            const accion =
                datos?.accion;

            if (
                !jugador ||
                !casilla?.grupo ||
                sala.propiedades[numero] !==
                jugador.id ||
                !tieneGrupoCompleto(
                    sala,
                    jugador.id,
                    casilla.grupo
                ) ||
                sala.hipotecas[numero]
            ) {

                return callback?.({
                    ok: false,
                    mensaje:
                        'Necesitás el grupo completo sin hipotecas.'
                });
            }

            const grupo =
                propiedadesDelGrupo(
                    casilla.grupo
                );

            const nivel =
                nivelEdificio(
                    sala,
                    numero
                );

            const niveles =
                grupo.map(
                    c =>
                        nivelEdificio(
                            sala,
                            c.numero
                        )
                );

            const costo =
                costoEdificio(casilla);

            if (accion === 'construir') {

                if (
                    nivel >= 5 ||
                    nivel !==
                    Math.min(...niveles) ||
                    jugador.dinero < costo
                ) {

                    return callback?.({
                        ok: false,
                        mensaje:
                            'Construcción inválida: edificá parejo y verificá tu dinero.'
                    });
                }

                sala.edificios[numero] =
                    nivel + 1;

                jugador.dinero -= costo;

            } else if (
                accion === 'vender'
            ) {

                if (
                    nivel <= 0 ||
                    nivel !==
                    Math.max(...niveles)
                ) {

                    return callback?.({
                        ok: false,
                        mensaje:
                            'Primero vendé los edificios más altos del grupo.'
                    });
                }

                sala.edificios[numero] =
                    nivel - 1;

                jugador.dinero +=
                    Math.floor(
                        costo / 2
                    );

            } else {

                return callback?.({
                    ok: false,
                    mensaje:
                        'Acción inválida.'
                });
            }

            emitirEstadoEconomico(
                io,
                datos.codigo.trim().toUpperCase(),
                sala
            );

            callback?.({
                ok: true
            });
        }
    );


    socket.on(
        'gestionar_hipoteca',
        (datos, callback) => {

            const codigo =
                datos?.codigo
                    ?.trim()
                    .toUpperCase();

            const sala =
                obtenerSala(codigo);

            const jugador =
                jugadorActivo(
                    sala,
                    socket.id
                );

            const numero =
                Number(
                    datos?.numeroCasilla
                );

            const casilla =
                propiedad(numero);

            const valor =
                Math.floor(
                    (casilla?.precio || 0) / 2
                );

            if (
                !jugador ||
                !casilla?.precio ||
                sala.propiedades[numero] !==
                jugador.id ||
                propiedadesDelGrupo(
                    casilla.grupo
                ).some(
                    c =>
                        nivelEdificio(
                            sala,
                            c.numero
                        ) > 0
                )
            ) {

                return callback?.({
                    ok: false,
                    mensaje:
                        'Primero vendé todos los edificios del grupo.'
                });
            }

            if (
                datos?.accion === 'hipotecar' &&
                !sala.hipotecas[numero]
            ) {

                sala.hipotecas[numero] = true;

                jugador.dinero += valor;

            } else if (
                datos?.accion === 'levantar' &&
                sala.hipotecas[numero] &&
                jugador.dinero >=
                Math.ceil(valor * 1.1)
            ) {

                delete sala.hipotecas[numero];

                jugador.dinero -=
                    Math.ceil(valor * 1.1);

            } else {

                return callback?.({
                    ok: false,
                    mensaje:
                        'No se puede realizar esa operación.'
                });
            }

            emitirEstadoEconomico(
                io,
                codigo,
                sala
            );

            callback?.({
                ok: true
            });
        }
    );


    socket.on(
        'proponer_intercambio',
        (datos, callback) => {

            const codigo =
                datos?.codigo
                    ?.trim()
                    .toUpperCase();

            const sala =
                obtenerSala(codigo);

            const de =
                jugadorActivo(
                    sala,
                    socket.id
                );

            const para =
                sala?.jugadores.find(
                    j =>
                        j.id === datos?.paraId &&
                        !j.enBancarrota
                );

            const misProps =
                [
                    ...new Set(
                        (
                            datos?.misPropiedades ||
                            []
                        ).map(Number)
                    )
                ];

            const susProps =
                [
                    ...new Set(
                        (
                            datos?.susPropiedades ||
                            []
                        ).map(Number)
                    )
                ];

            const miDinero =
                Math.max(
                    0,
                    Math.floor(
                        Number(
                            datos?.miDinero
                        ) || 0
                    )
                );

            const suDinero =
                Math.max(
                    0,
                    Math.floor(
                        Number(
                            datos?.suDinero
                        ) || 0
                    )
                );

            const sinEdificios =
                numeros =>
                    numeros.every(
                        n =>
                            nivelEdificio(
                                sala,
                                n
                            ) === 0 &&
                            !sala.hipotecas[n]
                    );

            if (
                !de ||
                !para ||
                de.id === para.id ||
                miDinero > de.dinero ||
                suDinero > para.dinero ||
                !misProps.every(
                    n =>
                        sala.propiedades[n] ===
                        de.id
                ) ||
                !susProps.every(
                    n =>
                        sala.propiedades[n] ===
                        para.id
                ) ||
                !sinEdificios(
                    [
                        ...misProps,
                        ...susProps
                    ]
                )
            ) {

                return callback?.({
                    ok: false,
                    mensaje:
                        'La propuesta no es válida.'
                });
            }

            const id =
                `${Date.now()}-${socket.id}`;

            sala.intercambios[id] = {
                id,
                deId: de.id,
                paraId: para.id,
                misProps,
                susProps,
                miDinero,
                suDinero
            };

            io.to(para.id).emit(
                'intercambio_recibido',
                {
                    id,
                    deNombre: de.nombre,
                    misProps,
                    susProps,
                    miDinero,
                    suDinero
                }
            );

            callback?.({
                ok: true
            });
        }
    );


    socket.on(
        'responder_intercambio',
        (datos, callback) => {

            const codigo =
                datos?.codigo
                    ?.trim()
                    .toUpperCase();

            const sala =
                obtenerSala(codigo);

            const trato =
                sala?.intercambios?.[
                datos?.id
                ];

            if (
                !trato ||
                trato.paraId !== socket.id
            ) {

                return callback?.({
                    ok: false,
                    mensaje:
                        'El intercambio ya no está disponible.'
                });
            }

            delete sala.intercambios[
                trato.id
            ];

            if (!datos?.aceptar) {

                io.to(
                    trato.deId
                ).emit(
                    'intercambio_resuelto',
                    {
                        aceptado: false
                    }
                );

                return callback?.({
                    ok: true
                });
            }

            const de =
                sala.jugadores.find(
                    j =>
                        j.id ===
                        trato.deId
                );

            const para =
                sala.jugadores.find(
                    j =>
                        j.id ===
                        trato.paraId
                );

            if (
                !de ||
                !para ||
                de.dinero <
                trato.miDinero ||
                para.dinero <
                trato.suDinero ||
                !trato.misProps.every(
                    n =>
                        sala.propiedades[n] ===
                        de.id &&
                        nivelEdificio(
                            sala,
                            n
                        ) === 0 &&
                        !sala.hipotecas[n]
                ) ||
                !trato.susProps.every(
                    n =>
                        sala.propiedades[n] ===
                        para.id &&
                        nivelEdificio(
                            sala,
                            n
                        ) === 0 &&
                        !sala.hipotecas[n]
                )
            ) {

                return callback?.({
                    ok: false,
                    mensaje:
                        'La situación cambió; no se puede aceptar.'
                });
            }

            trato.misProps.forEach(
                numero => {

                    sala.propiedades[
                        numero
                    ] = para.id;

                    de.propiedades =
                        de.propiedades.filter(
                            p =>
                                p !== numero
                        );

                    para.propiedades.push(
                        numero
                    );
                }
            );

            trato.susProps.forEach(
                numero => {

                    sala.propiedades[
                        numero
                    ] = de.id;

                    para.propiedades =
                        para.propiedades.filter(
                            p =>
                                p !== numero
                        );

                    de.propiedades.push(
                        numero
                    );
                }
            );

            de.dinero +=
                trato.suDinero -
                trato.miDinero;

            para.dinero +=
                trato.miDinero -
                trato.suDinero;

            emitirEstadoEconomico(
                io,
                codigo,
                sala
            );

            io.to(codigo).emit(
                'intercambio_resuelto',
                {
                    aceptado: true,
                    deNombre: de.nombre,
                    paraNombre: para.nombre
                }
            );

            callback?.({
                ok: true
            });
        }
    );


    socket.on(
        'usar_tarjeta_carcel',
        (datos, callback) => {

            const codigo =
                datos?.codigo
                    ?.trim()
                    .toUpperCase();

            const sala =
                obtenerSala(codigo);

            const jugador =
                jugadorActivo(
                    sala,
                    socket.id
                );

            if (
                !jugador ||
                sala.turno !== socket.id ||
                !jugador.enCarcel ||
                !jugador.cartasSalidaCarcel ||
                sala.haTiradoDados
            ) {

                return callback?.({
                    ok: false,
                    mensaje:
                        'No podés usar la tarjeta ahora.'
                });
            }

            jugador.cartasSalidaCarcel--;

            jugador.enCarcel = false;

            jugador.turnosEnCarcel = 0;

            io.to(codigo).emit(
                'salio_carcel',
                {
                    jugadorId:
                        jugador.id,
                    jugadorNombre:
                        jugador.nombre,
                    motivo:
                        'Usó una tarjeta de salida gratuita.',
                    dinero:
                        jugador.dinero,
                    cartasSalidaCarcel:
                        jugador.cartasSalidaCarcel
                }
            );

            emitirEstadoEconomico(
                io,
                codigo,
                sala
            );

            callback?.({
                ok: true
            });
        }
    );


    socket.on(
        'pagar_deuda',
        (datos, callback) => {

            const codigo =
                datos?.codigo
                    ?.trim()
                    .toUpperCase();

            const sala =
                obtenerSala(codigo);

            const jugador =
                jugadorActivo(
                    sala,
                    socket.id
                );

            if (
                !jugador ||
                !jugador.deudaPendiente
            ) {

                return callback?.({
                    ok: false,
                    mensaje:
                        'No tenés una deuda pendiente.'
                });
            }

            const monto =
                Math.min(
                    jugador.dinero,
                    jugador.deudaPendiente
                );

            if (!monto) {

                return callback?.({
                    ok: false,
                    mensaje:
                        'No tenés efectivo para pagar la deuda.'
                });
            }

            const acreedor =
                sala.jugadores.find(
                    j =>
                        j.id ===
                        jugador.acreedorId &&
                        !j.enBancarrota
                );

            jugador.dinero -= monto;

            if (acreedor) {
                acreedor.dinero += monto;
            }

            jugador.deudaPendiente -=
                monto;

            if (
                !jugador.deudaPendiente
            ) {
                jugador.acreedorId = null;
            }

            emitirEstadoEconomico(
                io,
                codigo,
                sala
            );

            callback?.({
                ok: true,
                monto,
                restante:
                    jugador.deudaPendiente
            });
        }
    );


    socket.on(
        'declarar_bancarrota',
        (datos, callback) => {

            const codigo =
                datos?.codigo
                    ?.trim()
                    .toUpperCase();

            const sala =
                obtenerSala(codigo);

            const jugador =
                jugadorActivo(
                    sala,
                    socket.id
                );

            if (
                !jugador ||
                !jugador.deudaPendiente
            ) {

                return callback?.({
                    ok: false,
                    mensaje:
                        'Solo podés declararte en bancarrota con una deuda pendiente.'
                });
            }

            if (
                jugador.propiedades.some(
                    numero =>
                        nivelEdificio(
                            sala,
                            numero
                        ) > 0
                )
            ) {

                return callback?.({
                    ok: false,
                    mensaje:
                        'Primero vendé todos tus edificios antes de declararte en bancarrota.'
                });
            }

            const acreedor =
                sala.jugadores.find(
                    j =>
                        j.id ===
                        jugador.acreedorId &&
                        !j.enBancarrota
                );

            const transferidas =
                [...jugador.propiedades];

            transferidas.forEach(
                numero => {

                    if (acreedor) {

                        sala.propiedades[
                            numero
                        ] = acreedor.id;

                        acreedor.propiedades.push(
                            numero
                        );

                    } else {

                        delete sala.propiedades[
                            numero
                        ];

                        delete sala.hipotecas[
                            numero
                        ];
                    }
                }
            );

            jugador.propiedades = [];
            jugador.dinero = 0;
            jugador.enBancarrota = true;
            jugador.deudaPendiente = 0;
            jugador.acreedorId = null;

            io.to(codigo).emit(
                'jugador_bancarrota',
                {
                    jugadorId:
                        jugador.id,
                    jugadorNombre:
                        jugador.nombre,
                    acreedorNombre:
                        acreedor?.nombre,
                    propiedadesTransferidas:
                        transferidas.length
                }
            );

            emitirEstadoEconomico(
                io,
                codigo,
                sala
            );

            callback?.({
                ok: true
            });
        }
    );


    // ======================================
    // COMPRAR PROPIEDAD
    // ======================================

    socket.on(
        'comprar_propiedad',
        (datos, callback) => {

            try {

                const codigo =
                    datos?.codigo
                        ?.trim()
                        .toUpperCase();

                const numeroCasilla =
                    Number(
                        datos?.numeroCasilla
                    );

                if (
                    !codigo ||
                    !numeroCasilla
                ) {

                    if (
                        typeof callback ===
                        'function'
                    ) {
                        callback({
                            ok: false,
                            mensaje:
                                'Datos de compra inválidos.'
                        });
                    }

                    return;
                }

                const sala =
                    obtenerSala(codigo);

                if (
                    !sala ||
                    sala.estado !== 'jugando'
                ) {

                    if (
                        typeof callback ===
                        'function'
                    ) {
                        callback({
                            ok: false,
                            mensaje:
                                'La partida no está activa.'
                        });
                    }

                    return;
                }

                if (
                    sala.turno !== socket.id
                ) {

                    if (
                        typeof callback ===
                        'function'
                    ) {
                        callback({
                            ok: false,
                            mensaje:
                                'No es tu turno.'
                        });
                    }

                    return;
                }

                const jugador =
                    sala.jugadores.find(
                        j =>
                            j.id === socket.id
                    );

                if (!jugador) {
                    return;
                }

                const propiedadActual =
                    casillas.find(
                        c =>
                            c.numero ===
                            numeroCasilla
                    );

                if (
                    !propiedadActual ||
                    !propiedadActual.precio
                ) {

                    if (
                        typeof callback ===
                        'function'
                    ) {
                        callback({
                            ok: false,
                            mensaje:
                                'Esta casilla no se puede comprar.'
                        });
                    }

                    return;
                }

                if (
                    jugador.posicion !==
                    numeroCasilla
                ) {

                    if (
                        typeof callback ===
                        'function'
                    ) {
                        callback({
                            ok: false,
                            mensaje:
                                'No estás en esta propiedad.'
                        });
                    }

                    return;
                }

                if (
                    sala.propiedades[
                    numeroCasilla
                    ]
                ) {

                    if (
                        typeof callback ===
                        'function'
                    ) {
                        callback({
                            ok: false,
                            mensaje:
                                'Esta propiedad ya tiene propietario.'
                        });
                    }

                    return;
                }

                if (sala.subasta) {

                    if (
                        typeof callback ===
                        'function'
                    ) {
                        callback({
                            ok: false,
                            mensaje:
                                'Hay una subasta en curso.'
                        });
                    }

                    return;
                }

                if (
                    jugador.dinero <
                    propiedadActual.precio
                ) {

                    if (
                        typeof callback ===
                        'function'
                    ) {
                        callback({
                            ok: false,
                            mensaje:
                                'No tenés suficiente dinero.'
                        });
                    }

                    return;
                }

                jugador.dinero -=
                    propiedadActual.precio;

                jugador.propiedades.push(
                    numeroCasilla
                );

                sala.propiedades[
                    numeroCasilla
                ] = jugador.id;

                console.log(
                    `🏠 ${jugador.nombre} compró ${propiedadActual.nombre} por $${propiedadActual.precio}`
                );

                io.to(codigo).emit(
                    'propiedad_comprada',
                    {
                        jugadorId:
                            jugador.id,
                        jugadorNombre:
                            jugador.nombre,
                        numeroCasilla,
                        nombrePropiedad:
                            propiedadActual.nombre,
                        precio:
                            propiedadActual.precio,
                        dineroRestante:
                            jugador.dinero
                    }
                );

                if (
                    typeof callback ===
                    'function'
                ) {

                    callback({
                        ok: true,
                        mensaje:
                            'Propiedad comprada correctamente.',
                        numeroCasilla,
                        dinero:
                            jugador.dinero
                    });
                }

            } catch (error) {

                console.error(
                    'Error al comprar propiedad:',
                    error
                );

                if (
                    typeof callback ===
                    'function'
                ) {

                    callback({
                        ok: false,
                        mensaje:
                            'Ocurrió un error al comprar.'
                    });
                }
            }
        }
    );


    // ======================================
    // TERMINAR TURNO
    // ======================================

    socket.on(
        'terminar_turno',
        (datos, callback) => {

            try {

                const codigo =
                    datos?.codigo
                        ?.trim()
                        .toUpperCase();

                if (!codigo) return;

                const sala =
                    obtenerSala(codigo);

                if (
                    !sala ||
                    sala.estado !== 'jugando'
                ) {
                    return;
                }

                if (
                    sala.turno !== socket.id
                ) {

                    if (
                        typeof callback ===
                        'function'
                    ) {
                        callback({
                            ok: false,
                            mensaje:
                                'No es tu turno.'
                        });
                    }

                    return;
                }

                if (
                    !sala.haTiradoDados
                ) {

                    if (
                        typeof callback ===
                        'function'
                    ) {
                        callback({
                            ok: false,
                            mensaje:
                                'Tenés que tirar los dados antes de terminar el turno.'
                        });
                    }

                    return;
                }

                if (sala.subasta) {

                    if (
                        typeof callback ===
                        'function'
                    ) {
                        callback({
                            ok: false,
                            mensaje:
                                'Esperá a que termine la subasta.'
                        });
                    }

                    return;
                }

                if (
                    sala.doblePendiente
                ) {

                    sala.haTiradoDados =
                        false;

                    sala.doblePendiente =
                        false;

                    const jugador =
                        sala.jugadores.find(
                            j =>
                                j.id ===
                                socket.id
                        );

                    io.to(codigo).emit(
                        'turno_actualizado',
                        {
                            jugadorId:
                                socket.id,
                            jugadorNombre:
                                jugador?.nombre,
                            turno:
                                sala.jugadores.findIndex(
                                    j =>
                                        j.id ===
                                        socket.id
                                ),
                            doble: true
                        }
                    );

                    iniciarTemporizadorTurno(
                        codigo
                    );

                    if (
                        typeof callback ===
                        'function'
                    ) {
                        callback({
                            ok: true,
                            doble: true
                        });
                    }

                    return;
                }

                const indiceActual =
                    sala.jugadores.findIndex(
                        j =>
                            j.id === socket.id
                    );

                const siguienteIndice =
                    siguienteJugadorActivo(
                        sala,
                        (
                            indiceActual + 1
                        ) %
                        sala.jugadores.length
                    );

                const siguienteJugador =
                    sala.jugadores[
                    siguienteIndice
                    ];

                sala.turno =
                    siguienteJugador.id;

                sala.haTiradoDados =
                    false;

                sala.doblePendiente =
                    false;

                console.log(
                    `Pase de turno en sala ${codigo}: Ahora es turno de ${siguienteJugador.nombre}`
                );

                io.to(codigo).emit(
                    'turno_actualizado',
                    {
                        jugadorId:
                            siguienteJugador.id,
                        jugadorNombre:
                            siguienteJugador.nombre,
                        turno:
                            siguienteIndice
                    }
                );

                iniciarTemporizadorTurno(
                    codigo
                );

                if (
                    typeof callback ===
                    'function'
                ) {

                    callback({
                        ok: true,
                        turno:
                            siguienteIndice
                    });
                }

            } catch (error) {

                console.error(
                    'Error al terminar turno:',
                    error
                );

                if (
                    typeof callback ===
                    'function'
                ) {

                    callback({
                        ok: false,
                        mensaje:
                            'Error al pasar de turno.'
                    });
                }
            }
        }
    );


    // ======================================
    // PAGAR FIANZA DE CÁRCEL
    // ======================================

    socket.on(
        'pagar_fianza',
        (datos, callback) => {

            try {

                const codigo =
                    datos?.codigo
                        ?.trim()
                        .toUpperCase();

                if (!codigo) return;

                const sala =
                    obtenerSala(codigo);

                if (
                    !sala ||
                    sala.estado !== 'jugando'
                ) {
                    return;
                }

                if (
                    sala.turno !== socket.id
                ) {

                    if (
                        typeof callback ===
                        'function'
                    ) {
                        callback({
                            ok: false,
                            mensaje:
                                'No es tu turno.'
                        });
                    }

                    return;
                }

                const jugador =
                    sala.jugadores.find(
                        j =>
                            j.id === socket.id
                    );

                if (
                    !jugador ||
                    !jugador.enCarcel
                ) {

                    if (
                        typeof callback ===
                        'function'
                    ) {
                        callback({
                            ok: false,
                            mensaje:
                                'No estás en la cárcel.'
                        });
                    }

                    return;
                }

                if (
                    jugador.dinero < 500
                ) {

                    if (
                        typeof callback ===
                        'function'
                    ) {
                        callback({
                            ok: false,
                            mensaje:
                                'No tenés $500 para pagar la fianza.'
                        });
                    }

                    return;
                }

                jugador.dinero -= 500;

                jugador.enCarcel = false;

                jugador.turnosEnCarcel = 0;

                io.to(codigo).emit(
                    'salio_carcel',
                    {
                        jugadorId:
                            jugador.id,
                        jugadorNombre:
                            jugador.nombre,
                        motivo:
                            'Pagó voluntariamente la fianza de $500.',
                        dinero:
                            jugador.dinero
                    }
                );

                io.to(codigo).emit(
                    'dinero_actualizado',
                    {
                        jugadorId:
                            jugador.id,
                        dinero:
                            jugador.dinero
                    }
                );

                if (
                    typeof callback ===
                    'function'
                ) {

                    callback({
                        ok: true,
                        dinero:
                            jugador.dinero
                    });
                }

            } catch (error) {

                console.error(
                    'Error al pagar fianza:',
                    error
                );

                if (
                    typeof callback ===
                    'function'
                ) {

                    callback({
                        ok: false,
                        mensaje:
                            'Error al pagar fianza.'
                    });
                }
            }
        }
    );


    // ======================================
    // CHAT EN VIVO
    // ======================================

    socket.on(
        'chat_enviar',
        (datos, callback) => {

            try {

                const codigo =
                    datos?.codigo
                        ?.trim()
                        .toUpperCase();

                const sala =
                    codigo &&
                    obtenerSala(codigo);

                if (!sala) {

                    return callback?.({
                        ok: false,
                        mensaje:
                            'La sala no existe.'
                    });
                }

                const jugador =
                    sala.jugadores.find(
                        j =>
                            j.id === socket.id
                    );

                if (!jugador) {

                    return callback?.({
                        ok: false,
                        mensaje:
                            'No pertenecés a esta sala.'
                    });
                }

                const texto =
                    String(
                        datos?.texto || ''
                    )
                        .trim()
                        .slice(
                            0,
                            MAX_LARGO_MENSAJE_CHAT
                        );

                if (!texto) {

                    return callback?.({
                        ok: false,
                        mensaje:
                            'Escribí algo para enviar.'
                    });
                }

                const mensaje = {
                    id:
                        `${Date.now()}-${socket.id}`,

                    jugadorId:
                        jugador.id,

                    jugadorNombre:
                        jugador.nombre,

                    texto,

                    hora:
                        Date.now()
                };

                agregarMensajeChat(
                    codigo,
                    mensaje
                );

                io.to(codigo).emit(
                    'chat_mensaje',
                    mensaje
                );

                callback?.({
                    ok: true
                });

            } catch (error) {

                console.error(
                    'Error al enviar mensaje de chat:',
                    error
                );

                callback?.({
                    ok: false,
                    mensaje:
                        'No se pudo enviar el mensaje.'
                });
            }
        }
    );


    // ======================================
    // RECONEXIÓN
    // ======================================

    socket.on(
        'intentar_reconectar',
        (datos, callback) => {

            try {

                const codigo =
                    datos?.codigo
                        ?.trim()
                        .toUpperCase();

                const token =
                    datos?.token;

                if (
                    !codigo ||
                    !token
                ) {

                    return callback?.({
                        ok: false,
                        mensaje:
                            'Faltan datos para reconectar.'
                    });
                }

                const resultado =
                    reconectarJugador(
                        codigo,
                        token,
                        socket.id
                    );

                if (resultado.error) {

                    return callback?.({
                        ok: false,
                        mensaje:
                            resultado.error
                    });
                }

                const {
                    sala,
                    jugador,
                    idViejo
                } = resultado;

                const timerPendiente =
                    temporizadoresDesconexion[
                    token
                    ];

                if (timerPendiente) {

                    clearTimeout(
                        timerPendiente
                    );

                    delete temporizadoresDesconexion[
                        token
                    ];
                }

                socket.join(codigo);

                console.log(
                    `♻️ ${jugador.nombre} se reconectó a la sala ${codigo} (${idViejo} → ${socket.id})`
                );

                callback?.({
                    ok: true,
                    sala,
                    jugadorId:
                        jugador.id,
                    token,
                    chat:
                        sala.chat || []
                });

                const temporizadorActivo =
                    temporizadoresTurno[
                    codigo
                    ];

                if (temporizadorActivo) {

                    socket.emit(
                        'temporizador_turno',
                        {
                            jugadorId:
                                sala.turno,
                            deadline:
                                temporizadorActivo.deadline
                        }
                    );
                }

                io.to(codigo).emit(
                    'jugador_reconectado',
                    {
                        jugadorId:
                            jugador.id,
                        jugadorNombre:
                            jugador.nombre
                    }
                );

                io.to(codigo).emit(
                    'sala_actualizada',
                    sala
                );

                io.to(codigo).emit(
                    'estado_economico_actualizado',
                    {
                        propiedades:
                            sala.propiedades,
                        edificios:
                            sala.edificios,
                        hipotecas:
                            sala.hipotecas,
                        jugadores:
                            sala.jugadores
                    }
                );

                agregarMensajeSistema(
                    codigo,
                    `📶 ${jugador.nombre} volvió a conectarse.`
                );

            } catch (error) {

                console.error(
                    'Error al reconectar:',
                    error
                );

                callback?.({
                    ok: false,
                    mensaje:
                        'Ocurrió un error al reconectar.'
                });
            }
        }
    );


    // ======================================
    // DESCONEXIÓN
    // ======================================

    socket.on(
        'disconnect',
        () => {

            console.log(
                'Jugador desconectado:',
                socket.id
            );

            const salaOrigen =
                encontrarSalaPorSocket(
                    socket.id
                );

            if (!salaOrigen) {
                return;
            }

            const codigo =
                salaOrigen.codigo;

            // Antes de empezar la partida,
            // simplemente sacamos al jugador.
            if (
                salaOrigen.estado !==
                'jugando'
            ) {

                const sala =
                    eliminarJugador(
                        socket.id
                    );

                if (!sala) {
                    return;
                }

                io.to(
                    sala.codigo
                ).emit(
                    'sala_actualizada',
                    sala
                );

                io.to(
                    sala.codigo
                ).emit(
                    'estado_sala',
                    sala
                );

                return;
            }

            // Partida en curso:
            // damos tiempo de gracia.
            const resultado =
                marcarDesconectado(
                    codigo,
                    socket.id
                );

            if (!resultado) {
                return;
            }

            const { jugador } =
                resultado;

            const eraSuTurno =
                salaOrigen.turno ===
                socket.id;

            const graciaMs =
                eraSuTurno
                    ? GRACIA_RECONEXION_EN_TURNO_MS
                    : GRACIA_RECONEXION_MS;

            console.log(
                `⏳ ${jugador.nombre} se desconectó de sala ${codigo}. Tiene ${Math.round(graciaMs / 1000)}s para volver.`
            );

            io.to(codigo).emit(
                'jugador_desconectado',
                {
                    jugadorId:
                        jugador.id,
                    jugadorNombre:
                        jugador.nombre,
                    segundosGracia:
                        Math.round(
                            graciaMs / 1000
                        )
                }
            );

            io.to(codigo).emit(
                'sala_actualizada',
                salaOrigen
            );

            agregarMensajeSistema(
                codigo,
                `📴 ${jugador.nombre} se desconectó. Tiene ${Math.round(graciaMs / 1000)}s para volver antes de perder su lugar.`
            );

            if (eraSuTurno) {

                iniciarTemporizadorTurno(
                    codigo,
                    graciaMs
                );
            }

            const token =
                jugador.token;

            if (!token) {
                return;
            }

            temporizadoresDesconexion[
                token
            ] = setTimeout(
                () => {

                    delete temporizadoresDesconexion[
                        token
                    ];

                    const nombreJugador =
                        jugador.nombre;

                    const salaAntes =
                        obtenerSala(codigo);

                    const turnoAntesDeSacarlo =
                        salaAntes?.turno;

                    const salaFinal =
                        eliminarJugadorPorToken(
                            codigo,
                            token
                        );

                    if (!salaFinal) {

                        limpiarTemporizadorTurno(
                            codigo
                        );

                        return;
                    }


                    console.log(
                        `🚪 ${nombreJugador} fue removido de sala ${codigo} por no reconectarse a tiempo.`
                    );


                    // --------------------------------------
                    // SI QUEDA UN SOLO JUGADOR,
                    // FINALIZAR LA PARTIDA
                    // --------------------------------------

                    if (
                        salaFinal.estado === 'jugando' &&
                        salaFinal.jugadores.length === 1
                    ) {

                        const finalizada =
                            finalizarPartidaSiQuedaUnJugador(
                                codigo,
                                salaFinal,
                                'jugador_no_reconectado'
                            );

                        if (finalizada) {
                            return;
                        }
                    }


                    // --------------------------------------
                    // PARTIDA/SALA CON 2+ JUGADORES
                    // --------------------------------------

                    io.to(
                        salaFinal.codigo
                    ).emit(
                        'jugador_removido',
                        {
                            jugadorNombre:
                                nombreJugador,
                            motivo:
                                'No se reconectó a tiempo.'
                        }
                    );


                    io.to(
                        salaFinal.codigo
                    ).emit(
                        'sala_actualizada',
                        salaFinal
                    );


                    io.to(
                        salaFinal.codigo
                    ).emit(
                        'estado_sala',
                        salaFinal
                    );


                    agregarMensajeSistema(
                        salaFinal.codigo,
                        `🚪 ${nombreJugador} fue removido de la partida por no reconectarse a tiempo.`
                    );


                    // Solo re-anunciamos el turno si realmente
                    // cambió de dueño al sacar al jugador.
                    if (
                        salaFinal.estado ===
                        'jugando' &&
                        salaFinal.turno &&
                        salaFinal.turno !==
                        turnoAntesDeSacarlo
                    ) {

                        const turnoIndice =
                            salaFinal.jugadores.findIndex(
                                jugador =>
                                    jugador.id ===
                                    salaFinal.turno
                            );

                        io.to(
                            salaFinal.codigo
                        ).emit(
                            'turno_actualizado',
                            {
                                jugadorId:
                                    salaFinal.turno,
                                jugadorNombre:
                                    salaFinal
                                        .jugadores[
                                        turnoIndice
                                    ]?.nombre,
                                turno:
                                    turnoIndice
                            }
                        );

                        iniciarTemporizadorTurno(
                            salaFinal.codigo
                        );
                    }
                },
                graciaMs
            );
        }
    );

});


// ==========================================
// INICIAR SERVIDOR
// ==========================================

const PORT =
    process.env.PORT || 3000;

server.listen(
    PORT,
    () => {

        console.log(
            '===================================='
        );

        console.log(
            'Servidor Argenpolys iniciado'
        );

        console.log(
            `Puerto: ${PORT}`
        );

        console.log(
            '===================================='
        );
    }
);