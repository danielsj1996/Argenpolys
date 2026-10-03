function crearGestorTurnos({
    io,
    obtenerSala,
    siguienteJugadorActivo,
    agregarMensajeSistema,
    duracionTurnoMs
}) {
    const temporizadores = new Map();

    function limpiar(codigo) {
        const actual = temporizadores.get(codigo);
        if (!actual) return;

        clearTimeout(actual.timeout);
        temporizadores.delete(codigo);
    }

    function iniciar(codigo, duracionMs = duracionTurnoMs) {
        limpiar(codigo);

        const sala = obtenerSala(codigo);
        if (!sala || sala.estado !== 'jugando' || !sala.turno) return;

        const jugadorIdEsperado = sala.turno;
        const deadline = Date.now() + duracionMs;

        temporizadores.set(codigo, {
            deadline,
            timeout: setTimeout(
                () => manejarTiempoAgotado(codigo, jugadorIdEsperado),
                duracionMs
            )
        });

        io.to(codigo).emit('temporizador_turno', {
            jugadorId: jugadorIdEsperado,
            deadline,
            duracionMs
        });
    }

    function manejarTiempoAgotado(codigo, jugadorIdEsperado) {
        const sala = obtenerSala(codigo);
        if (!sala || sala.estado !== 'jugando') return;
        if (sala.turno !== jugadorIdEsperado) return;

        if (sala.subasta) {
            temporizadores.set(codigo, {
                deadline: Date.now() + 3000,
                timeout: setTimeout(
                    () => manejarTiempoAgotado(codigo, jugadorIdEsperado),
                    3000
                )
            });
            return;
        }

        const jugador = sala.jugadores.find(
            actual => actual.id === jugadorIdEsperado
        );
        if (!jugador) return;

        io.to(codigo).emit('turno_agotado', {
            jugadorId: jugador.id,
            jugadorNombre: jugador.nombre
        });

        agregarMensajeSistema(
            codigo,
            `⏱️ Se agotó el tiempo de ${jugador.nombre} y pasó el turno.`
        );

        const indiceActual = sala.jugadores.findIndex(
            actual => actual.id === jugadorIdEsperado
        );
        const siguienteIndice = siguienteJugadorActivo(
            sala,
            (indiceActual + 1) % sala.jugadores.length
        );
        if (siguienteIndice === -1) return;

        const siguienteJugador = sala.jugadores[siguienteIndice];
        sala.turno = siguienteJugador.id;
        sala.haTiradoDados = false;
        sala.doblePendiente = false;

        io.to(codigo).emit('turno_actualizado', {
            jugadorId: siguienteJugador.id,
            jugadorNombre: siguienteJugador.nombre,
            turno: siguienteIndice,
            porTiempoAgotado: true
        });

        iniciar(codigo);
    }

    return {
        iniciar,
        limpiar,
        obtener: codigo => temporizadores.get(codigo) || null
    };
}

module.exports = { crearGestorTurnos };
