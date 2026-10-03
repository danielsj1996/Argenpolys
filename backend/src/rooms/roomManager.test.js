const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const {
    agregarJugador,
    crearSala,
    eliminarJugador,
    eliminarJugadorPorToken,
    esTokenSeguro,
    encontrarSalaPorSocket,
    marcarDesconectado,
    normalizarCodigoSala,
    reconectarJugador,
    sanitizarSala,
    validarNombreJugador
} = require('./roomManager');

test('valida y normaliza nombres de jugadores', () => {
    assert.deepEqual(
        validarNombreJugador('  José   Pérez  '),
        { valido: true, nombre: 'José Pérez' }
    );
    assert.equal(validarNombreJugador('A').valido, false);
    assert.equal(validarNombreJugador('A'.repeat(21)).valido, false);
    assert.equal(validarNombreJugador('Ana\tMaría').valido, false);
    assert.equal(validarNombreJugador('<script>').valido, false);
});

test('normaliza únicamente códigos de sala válidos', () => {
    assert.equal(normalizarCodigoSala('  ab12z9 '), 'AB12Z9');
    assert.equal(normalizarCodigoSala('ABC-12'), null);
    assert.equal(normalizarCodigoSala('abc1234'), null);
    assert.equal(normalizarCodigoSala(123456), null);
});

test('rechaza nombres repetidos entre jugadores activos', () => {
    const anfitrion = crearSala('host-test', 'Ana', crypto.randomUUID());
    const { sala } = anfitrion;

    try {
        const resultado = agregarJugador(
            sala.codigo,
            'jugador-test',
            'ana',
            crypto.randomUUID()
        );

        assert.match(resultado.error, /ese nombre/);
    } finally {
        eliminarJugador('host-test');
    }
});

test('genera y valida tokens seguros y los omite de salas públicas', () => {
    const resultado = crearSala(
        'token-test',
        'Jugador',
        'token-inseguro',
        'churros',
        'auth-user-secret'
    );
    const { sala, token } = resultado;

    try {
        assert.equal(esTokenSeguro(token), true);
        assert.equal(token.length, 48);

        const salaPublica = sanitizarSala(sala);
        assert.equal(Object.hasOwn(salaPublica.jugadores[0], 'token'), false);
        assert.equal(Object.hasOwn(salaPublica.jugadores[0], 'authUserId'), false);
        assert.equal(Object.hasOwn(salaPublica.jugadores[0], 'fichaId'), true);
        sala.partidaId = 'private-match-id';
        sala.iniciadaEn = Date.now();
        sala.participantesIniciales = [{ userId: 'private-user-id' }];
        const salaIniciadaPublica = sanitizarSala(sala);
        assert.equal(Object.hasOwn(salaIniciadaPublica, 'participantesIniciales'), false);
        assert.equal(Object.hasOwn(salaIniciadaPublica, 'partidaId'), false);
        assert.equal(sala.jugadores[0].token, token);
    } finally {
        eliminarJugador('token-test');
    }
});

test('rechaza identificadores de ficha no permitidos', () => {
    assert.match(
        crearSala('invalid-token', 'Jugador', crypto.randomUUID(), '../secreto').error,
        /ficha seleccionada/
    );
});

test('sustituye tokens inválidos al agregar un jugador', () => {
    const anfitrion = crearSala('host-token-test', 'Anfitrión', crypto.randomUUID());
    const sala = anfitrion.sala;

    try {
        const resultado = agregarJugador(
            sala.codigo,
            'jugador-token-test',
            'Otro jugador',
            'token-inseguro'
        );

        assert.equal(resultado.error, undefined);
        assert.equal(esTokenSeguro(resultado.token), true);
    } finally {
        eliminarJugador('host-token-test');
        eliminarJugador('jugador-token-test');
    }
});

test('reconecta a un jugador desconectado y remapea la sala completa', () => {
    const token = crypto.randomUUID();
    const creado = crearSala('old-host-id', 'Anfitrión', token);
    const sala = creado.sala;
    sala.estado = 'jugando';
    sala.turno = 'old-host-id';
    sala.ganador = { id: 'old-host-id', nombre: 'Anfitrión' };
    sala.propiedades[3] = 'old-host-id';
    sala.jugadores[0].acreedorId = 'old-host-id';

    try {
        assert.ok(marcarDesconectado(sala.codigo, 'old-host-id'));

        const resultado = reconectarJugador(
            sala.codigo,
            token,
            'new-host-id'
        );

        assert.equal(resultado.error, undefined);
        assert.equal(resultado.jugador.id, 'new-host-id');
        assert.equal(resultado.jugador.desconectado, false);
        assert.equal(sala.host, 'new-host-id');
        assert.equal(sala.turno, 'new-host-id');
        assert.equal(sala.ganador.id, 'new-host-id');
        assert.equal(sala.propiedades[3], 'new-host-id');
        assert.equal(sala.jugadores[0].acreedorId, 'new-host-id');
    } finally {
        eliminarJugador('new-host-id');
    }
});

test('rechaza tokens inválidos o vencidos durante la reconexión', () => {
    const creado = crearSala('reconnect-test', 'Jugador', crypto.randomUUID());
    const sala = creado.sala;

    try {
        assert.match(
            reconectarJugador(sala.codigo, 'token-invalido', 'otro-id').error,
            /no es válido/
        );
        assert.match(
            reconectarJugador(sala.codigo, crypto.randomUUID(), 'otro-id').error,
            /No encontramos/
        );
    } finally {
        eliminarJugador('reconnect-test');
    }
});

test('reemplaza sesiones activas sin dejar el socket anterior asociado al jugador', () => {
    const token = crypto.randomUUID();
    const creado = crearSala('active-socket', 'Jugador', token);
    const sala = creado.sala;

    try {
        const resultado = reconectarJugador(
            sala.codigo,
            token,
            'replacement-socket'
        );

        assert.equal(resultado.error, undefined);
        assert.equal(resultado.idViejo, 'active-socket');
        assert.equal(encontrarSalaPorSocket('active-socket'), null);
        assert.equal(encontrarSalaPorSocket('replacement-socket'), sala);
    } finally {
        eliminarJugador('replacement-socket');
    }
});

test('un token de jugador eliminado deja de permitir la reconexión', () => {
    const host = crearSala('expiration-host', 'Anfitrión', crypto.randomUUID());
    const token = crypto.randomUUID();
    agregarJugador(
        host.sala.codigo,
        'expired-player',
        'Jugador',
        token
    );

    try {
        const remainingRoom = eliminarJugadorPorToken(host.sala.codigo, token);

        assert.equal(remainingRoom.jugadores.length, 1);
        assert.match(
            reconectarJugador(host.sala.codigo, token, 'replacement-player').error,
            /No encontramos/
        );
    } finally {
        eliminarJugador('expiration-host');
    }
});
