const crypto = require('crypto');

const rooms = {};
const FICHAS_3D = new Set(['caballo', 'computador', 'churros']);

// Cuántos mensajes de chat (incluyendo los del sistema) se conservan por sala.
const MAX_MENSAJES_CHAT = 200;


// ==========================================
// VALIDAR NOMBRE DE JUGADOR
// ==========================================

function validarNombreJugador(nombre) {
    if (typeof nombre !== 'string') {
        return { valido: false, error: 'El nombre debe ser un texto.' };
    }

    if (/[\p{Cc}\p{Cf}]/u.test(nombre)) {
        return { valido: false, error: 'El nombre no puede contener caracteres de control.' };
    }

    const limpio = nombre.normalize('NFC').trim().replace(/\s+/g, ' ');
    const largo = [...limpio].length;

    if (largo < 2) {
        return { valido: false, error: 'El nombre debe tener al menos 2 caracteres.' };
    }

    if (largo > 20) {
        return { valido: false, error: 'El nombre no puede tener más de 20 caracteres.' };
    }

    // Permitir letras unicode (con acentos, diéresis, ñ), números, espacios y guiones
    const regexValido = /^[\p{L}\p{N} -]+$/u;
    if (!regexValido.test(limpio)) {
        return { valido: false, error: 'El nombre solo puede contener letras, números, espacios y guiones.' };
    }

    return { valido: true, nombre: limpio };
}


// ==========================================
// GENERAR TOKEN SEGURO
// ==========================================

function generarTokenSeguro() {
    return crypto.randomBytes(24).toString('hex');
}

function esTokenSeguro(token) {
    return typeof token === 'string' &&
        (/^[a-f0-9]{48}$/i.test(token) ||
            /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(token));
}

function normalizarCodigoSala(codigo) {
    if (typeof codigo !== 'string') return null;

    const normalizado = codigo.trim().toUpperCase();
    return /^[A-Z0-9]{6}$/.test(normalizado)
        ? normalizado
        : null;
}


// ==========================================
// GENERAR CÓDIGO DE SALA
// ==========================================

function generarCodigo() {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let codigo;

    do {
        codigo = '';
        const bytes = crypto.randomBytes(6);
        for (let i = 0; i < 6; i++) {
            codigo += caracteres.charAt(bytes[i] % caracteres.length);
        }
    } while (rooms[codigo]);

    return codigo;
}


// ==========================================
// SANITIZAR JUGADOR Y SALA (ocultar tokens)
// ==========================================

function sanitizarJugador(jugador) {
    if (!jugador) return null;
    const { token, authUserId, ...jugadorSeguro } = jugador;
    return jugadorSeguro;
}

function sanitizarSala(sala) {
    if (!sala) return null;
    const {
        partidaId,
        iniciadaEn,
        participantesIniciales,
        ...salaPublica
    } = sala;
    return {
        ...salaPublica,
        jugadores: Array.isArray(sala.jugadores)
            ? sala.jugadores.map(sanitizarJugador)
            : []
    };
}


// ==========================================
// CREAR SALA
// ==========================================

function crearSala(socketId, nombre, token, fichaId = 'caballo', authUserId = null) {
    const validacion = validarNombreJugador(nombre);
    if (!validacion.valido) {
        return { error: validacion.error };
    }
    if (!FICHAS_3D.has(fichaId)) {
        return { error: 'La ficha seleccionada no está disponible.' };
    }

    const tokenFinal = esTokenSeguro(token)
        ? token
        : generarTokenSeguro();

    const codigo = generarCodigo();

    rooms[codigo] = {
        codigo,
        host: socketId,
        estado: 'esperando',
        haTiradoDados: false,
        propiedades: {},
        edificios: {},
        hipotecas: {},
        subasta: null,
        intercambios: {},
        historial: [],
        chat: [],

        jugadores: [
            {
                id: socketId,
                token: tokenFinal,
                authUserId,
                fichaId,
                nombre: validacion.nombre,
                posicion: 1,
                dinero: 15000,
                propiedades: [],
                enCarcel: false,
                turnosEnCarcel: 0,
                doblesConsecutivos: 0,
                cartasSalidaCarcel: 0,
                deudaPendiente: 0,
                acreedorId: null,
                enBancarrota: false,
                desconectado: false
            }
        ]
    };

    return {
        sala: rooms[codigo],
        token: tokenFinal
    };
}


// ==========================================
// OBTENER SALA
// ==========================================

function obtenerSala(codigo) {

    return rooms[codigo];

}


// ==========================================
// AGREGAR JUGADOR
// ==========================================

function agregarJugador(
    codigo,
    socketId,
    nombre,
    token,
    fichaId = 'caballo',
    authUserId = null
) {

    const sala = rooms[codigo];

    // --------------------------------------
    // SALA INEXISTENTE
    // --------------------------------------

    if (!sala) {

        return {
            error: 'La sala no existe.'
        };

    }

    if (!FICHAS_3D.has(fichaId)) {
        return { error: 'La ficha seleccionada no está disponible.' };
    }


    // --------------------------------------
    // PARTIDA YA INICIADA
    // --------------------------------------

    if (sala.estado !== 'esperando') {

        return {
            error: 'La partida ya comenzó.'
        };

    }


    // --------------------------------------
    // SALA LLENA
    // --------------------------------------

    if (sala.jugadores.length >= 8) {

        return {
            error:
                'La sala está completa. Máximo 8 jugadores.'
        };

    }


    // --------------------------------------
    // EVITAR JUGADOR DUPLICADO
    // --------------------------------------

    const jugadorExistente =
        sala.jugadores.find(
            jugador => jugador.id === socketId
        );

    if (jugadorExistente) {

        return {
            error: 'Ya estás en esta sala.'
        };

    }


    // --------------------------------------
    // VALIDAR NOMBRE
    // --------------------------------------

    const validacion = validarNombreJugador(nombre);
    if (!validacion.valido) {
        return {
            error: validacion.error
        };
    }

    const nombreRepetido = sala.jugadores.some(
        j => !j.enBancarrota &&
            j.nombre.normalize('NFC').toLowerCase() === validacion.nombre.toLowerCase()
    );

    if (nombreRepetido) {
        return {
            error: 'Ya hay un jugador con ese nombre en la sala.'
        };
    }


    // --------------------------------------
    // ASIGNAR TOKEN SEGURO
    // --------------------------------------

    let tokenFinal = esTokenSeguro(token)
        ? token
        : generarTokenSeguro();

    // Si ya existe otro jugador con el mismo token en la sala, regenerar
    if (sala.jugadores.some(j => j.id !== socketId && j.token === tokenFinal)) {
        tokenFinal = generarTokenSeguro();
    }


    // --------------------------------------
    // AGREGAR JUGADOR
    // --------------------------------------

    sala.jugadores.push({
        id: socketId,
        token: tokenFinal,
        authUserId,
        fichaId,
        nombre: validacion.nombre,
        posicion: 1,
        dinero: 15000,
        propiedades: [],
        enCarcel: false,
        turnosEnCarcel: 0,
        doblesConsecutivos: 0,
        cartasSalidaCarcel: 0,
        deudaPendiente: 0,
        acreedorId: null,
        enBancarrota: false,
        desconectado: false
    });


    return {
        sala,
        token: tokenFinal
    };

}


// ==========================================
// INICIAR SALA
// ==========================================

function iniciarSala(
    codigo,
    socketId
) {

    const sala = rooms[codigo];

    // --------------------------------------
    // SALA INEXISTENTE
    // --------------------------------------

    if (!sala) {
        return {
            error: 'La sala no existe.'
        };
    }


    // --------------------------------------
    // VERIFICAR ANFITRIÓN
    // --------------------------------------

    if (sala.host !== socketId) {
        return {
            error:
                'Solo el anfitrión puede iniciar la partida.'
        };
    }


    // --------------------------------------
    // MÍNIMO DE JUGADORES
    // --------------------------------------

    if (sala.jugadores.length < 2) {
        return {
            error:
                'Se necesitan al menos 2 jugadores para comenzar.'
        };
    }


    // --------------------------------------
    // EVITAR INICIAR DOS VECES
    // --------------------------------------

    if (sala.estado !== 'esperando') {
        return {
            error:
                'La partida ya comenzó.'
        };
    }


    // --------------------------------------
    // INICIAR PARTIDA
    // --------------------------------------

    sala.estado = 'jugando';
    sala.haTiradoDados = false;
    sala.historial = [];


    // --------------------------------------
    // REINICIAR ESTADO DE JUGADORES
    // --------------------------------------

    sala.jugadores.forEach(jugador => {
        jugador.posicion = 1;
        jugador.dinero = 15000;
        jugador.propiedades = [];
        jugador.enCarcel = false;
        jugador.turnosEnCarcel = 0;
        jugador.doblesConsecutivos = 0;
        jugador.cartasSalidaCarcel = 0;
        jugador.deudaPendiente = 0;
        jugador.acreedorId = null;
        jugador.enBancarrota = false;
    });

    sala.propiedades = {};
    sala.edificios = {};
    sala.hipotecas = {};
    sala.subasta = null;
    sala.intercambios = {};
    sala.turno = sala.jugadores[0].id;


    return {
        sala
    };

}


// ==========================================
// BUSCAR SALA POR SOCKET
// ==========================================

function encontrarSalaPorSocket(socketId) {

    for (const codigo in rooms) {
        const sala = rooms[codigo];
        if (sala.jugadores.some(jugador => jugador.id === socketId)) {
            return sala;
        }
    }

    return null;

}


// ==========================================
// REASIGNAR UN ID (SOCKET.ID VIEJO -> NUEVO)
// ==========================================
// Cuando un jugador se reconecta, Socket.IO le asigna un socket.id nuevo.
// Como el resto del estado de la sala usa ese id como identificador estable
// del jugador (dueño de una propiedad, turno actual, anfitrión, deudas,
// intercambios, subastas...), hay que "reescribirlo" en todos esos lugares.

function remapIdEnSala(sala, idViejo, idNuevo) {

    if (!sala || !idViejo || idViejo === idNuevo) return;

    if (sala.host === idViejo) sala.host = idNuevo;
    if (sala.turno === idViejo) sala.turno = idNuevo;
    if (sala.ganador?.id === idViejo) sala.ganador.id = idNuevo;

    Object.keys(sala.propiedades || {}).forEach(numero => {
        if (sala.propiedades[numero] === idViejo) {
            sala.propiedades[numero] = idNuevo;
        }
    });

    if (sala.subasta && sala.subasta.mejorPostorId === idViejo) {
        sala.subasta.mejorPostorId = idNuevo;
    }

    Object.values(sala.intercambios || {}).forEach(trato => {
        if (trato.deId === idViejo) trato.deId = idNuevo;
        if (trato.paraId === idViejo) trato.paraId = idNuevo;
    });

    sala.jugadores.forEach(jugador => {
        if (jugador.acreedorId === idViejo) jugador.acreedorId = idNuevo;
    });

}


// ==========================================
// MARCAR JUGADOR COMO DESCONECTADO
// ==========================================
// No lo saca de la partida: le da tiempo a volver a conectarse
// (mala señal de wifi, pestaña recargada, celular que se quedó sin datos, etc.)

function marcarDesconectado(codigo, socketId) {

    const sala = rooms[codigo];
    if (!sala) return null;

    const jugador = sala.jugadores.find(j => j.id === socketId);
    if (!jugador) return null;

    jugador.desconectado = true;
    jugador.desconectadoEn = Date.now();

    return { sala, jugador };

}


// ==========================================
// RECONECTAR JUGADOR
// ==========================================

function reconectarJugador(codigo, token, nuevoSocketId) {

    const sala = rooms[codigo];

    if (!sala) {
        return { error: 'La sala ya no existe.' };
    }

    if (!esTokenSeguro(token)) {
        return { error: 'El token de sesión no es válido.' };
    }

    const jugador = sala.jugadores.find(j => j.token && j.token === token);

    if (!jugador) {
        return { error: 'No encontramos tu sesión en esta sala.' };
    }

    if (!jugador.desconectado) {
        // Ya está conectado (por ejemplo, otra pestaña). Igual actualizamos
        // el id al socket más reciente para no dejar la sesión vieja colgada.
        const idViejo = jugador.id;
        jugador.id = nuevoSocketId;
        remapIdEnSala(sala, idViejo, nuevoSocketId);
        return { sala, jugador, idViejo };
    }

    const idViejo = jugador.id;
    jugador.id = nuevoSocketId;
    jugador.desconectado = false;
    delete jugador.desconectadoEn;

    remapIdEnSala(sala, idViejo, nuevoSocketId);

    return { sala, jugador, idViejo };

}


// ==========================================
// SIGUIENTE JUGADOR ACTIVO (salta bancarrota/desconectados)
// ==========================================

function siguienteJugadorActivo(sala, indiceDesde) {

    if (!sala.jugadores.length) return -1;

    let indice = indiceDesde % sala.jugadores.length;
    let vueltas = 0;

    while (
        (sala.jugadores[indice].enBancarrota || sala.jugadores[indice].desconectado) &&
        vueltas < sala.jugadores.length
    ) {
        indice = (indice + 1) % sala.jugadores.length;
        vueltas++;
    }

    return indice;

}


// ==========================================
// ELIMINAR JUGADOR DEFINITIVAMENTE POR TOKEN
// ==========================================
// Se usa cuando se agota el tiempo de gracia de reconexión.

function eliminarJugadorPorToken(codigo, token) {

    const sala = rooms[codigo];
    if (!sala) return null;

    const indice = sala.jugadores.findIndex(j => j.token && j.token === token);
    if (indice === -1) return null;

    const [jugadorEliminado] = sala.jugadores.splice(indice, 1);

    if (sala.jugadores.length === 0) {
        delete rooms[codigo];
        return null;
    }

    if (sala.host === jugadorEliminado.id) {
        sala.host = sala.jugadores[0].id;
    }

    if (sala.turno === jugadorEliminado.id) {
        const siguienteIndice = siguienteJugadorActivo(sala, indice % sala.jugadores.length);
        if (siguienteIndice !== -1) {
            sala.turno = sala.jugadores[siguienteIndice].id;
        }
    }

    return sala;

}


// ==========================================
// CHAT
// ==========================================

function agregarMensajeChat(codigo, mensaje) {

    const sala = rooms[codigo];
    if (!sala) return null;

    if (!Array.isArray(sala.chat)) sala.chat = [];

    sala.chat.push(mensaje);

    while (sala.chat.length > MAX_MENSAJES_CHAT) {
        sala.chat.shift();
    }

    return mensaje;

}


// ==========================================
// ELIMINAR JUGADOR
// ==========================================

function eliminarJugador(socketId) {

    for (const codigo in rooms) {

        const sala = rooms[codigo];

        const indice =
            sala.jugadores.findIndex(
                jugador => jugador.id === socketId
            );


        // ----------------------------------
        // JUGADOR ENCONTRADO
        // ----------------------------------

        if (indice !== -1) {

            sala.jugadores.splice(
                indice,
                1
            );


            // ------------------------------
            // SALA VACÍA
            // ------------------------------

            if (sala.jugadores.length === 0) {

                delete rooms[codigo];

                return null;

            }


            // ------------------------------
            // SI ERA EL HOST
            // ------------------------------

            if (sala.host === socketId) {

                sala.host =
                    sala.jugadores[0].id;

            }


            // ------------------------------
            // SI ERA SU TURNO
            // ------------------------------

            if (sala.turno === socketId) {

                const siguienteIndice =
                    siguienteJugadorActivo(sala, indice % sala.jugadores.length);

                if (siguienteIndice !== -1) {
                    sala.turno = sala.jugadores[siguienteIndice].id;
                }

            }


            return sala;

        }

    }


    return null;

}


// ==========================================
// EXPORTAR FUNCIONES
// ==========================================

module.exports = {

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
    agregarMensajeChat,
    validarNombreJugador,
    generarTokenSeguro,
    esTokenSeguro,
    normalizarCodigoSala,
    sanitizarJugador,
    sanitizarSala

};
