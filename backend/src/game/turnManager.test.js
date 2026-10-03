const assert = require('node:assert/strict');
const test = require('node:test');

const { crearGestorTurnos } = require('./turnManager');

function crearContexto() {
    const eventos = [];
    const sala = {
        estado: 'jugando',
        turno: 'jugador-1',
        jugadores: [
            { id: 'jugador-1', nombre: 'Uno' },
            { id: 'jugador-2', nombre: 'Dos' }
        ]
    };
    const io = {
        to: codigo => ({
            emit: (evento, datos) => eventos.push({ codigo, evento, datos })
        })
    };
    const gestor = crearGestorTurnos({
        io,
        obtenerSala: () => sala,
        siguienteJugadorActivo: (_sala, indice) => indice,
        agregarMensajeSistema: () => {},
        duracionTurnoMs: 30
    });

    return { eventos, gestor, sala };
}

test('inicia y limpia un temporizador para la sala activa', () => {
    const { eventos, gestor } = crearContexto();

    gestor.iniciar('ABC123');
    assert.equal(gestor.obtener('ABC123').deadline > Date.now(), true);
    assert.equal(eventos[0].evento, 'temporizador_turno');
    assert.equal(eventos[0].datos.jugadorId, 'jugador-1');

    gestor.limpiar('ABC123');
    assert.equal(gestor.obtener('ABC123'), null);
});

test('pasa el turno vencido y programa el siguiente jugador', async () => {
    const { eventos, gestor, sala } = crearContexto();

    gestor.iniciar('ABC123', 10);

    await new Promise(resolve => setTimeout(resolve, 30));

    assert.equal(sala.turno, 'jugador-2');
    assert.equal(sala.haTiradoDados, false);
    assert.equal(sala.doblePendiente, false);
    assert.ok(eventos.some(evento => evento.evento === 'turno_agotado'));
    assert.ok(eventos.some(
        evento =>
            evento.evento === 'turno_actualizado' &&
            evento.datos.jugadorId === 'jugador-2'
    ));
    assert.ok(gestor.obtener('ABC123'));

    gestor.limpiar('ABC123');
});

test('no inicia temporizador para sala ausente o sin turno', () => {
    const eventos = [];
    const gestor = crearGestorTurnos({
        io: { to: () => ({ emit: (...args) => eventos.push(args) }) },
        obtenerSala: () => null,
        siguienteJugadorActivo: () => 0,
        agregarMensajeSistema: () => {},
        duracionTurnoMs: 30
    });

    gestor.iniciar('ABC123');

    assert.equal(gestor.obtener('ABC123'), null);
    assert.equal(eventos.length, 0);
});
