const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');

const { nivelEdificio } = require('../game/economy');
const { registrarManejadoresDeuda } = require('./debtHandlers');

function crearFixture({
    efectivoDeudor = 300,
    deuda = 500,
    propiedadesDeudor = [],
    acreedorId = 'acreedor'
} = {}) {
    const deudor = {
        id: 'deudor',
        nombre: 'Deudor',
        dinero: efectivoDeudor,
        deudaPendiente: deuda,
        acreedorId,
        propiedades: propiedadesDeudor,
        enBancarrota: false
    };
    const acreedor = {
        id: 'acreedor',
        nombre: 'Acreedor',
        dinero: 1000,
        propiedades: [],
        enBancarrota: false
    };
    const sala = {
        estado: 'jugando',
        jugadores: [deudor, acreedor],
        propiedades: Object.fromEntries(
            propiedadesDeudor.map(numero => [numero, deudor.id])
        ),
        edificios: {},
        hipotecas: {}
    };
    const emisiones = [];
    let actualizacionesEconomicas = 0;
    const io = {
        to(codigo) {
            return {
                emit(evento, datos) {
                    emisiones.push({ codigo, evento, datos });
                }
            };
        }
    };
    const socket = new EventEmitter();
    socket.id = deudor.id;

    registrarManejadoresDeuda(socket, {
        io,
        obtenerSala: codigo => codigo === 'ABC123' ? sala : null,
        normalizarCodigoSala: codigo => codigo === 'ABC123' ? codigo : null,
        jugadorActivo: (salaActual, id) => (
            salaActual?.estado === 'jugando'
                ? salaActual.jugadores.find(j => j.id === id && !j.enBancarrota)
                : null
        ),
        nivelEdificio,
        emitirEstadoEconomico: () => actualizacionesEconomicas++
    });

    function emitir(evento) {
        return new Promise(resolve => {
            socket.emit(evento, { codigo: 'ABC123' }, resolve);
        });
    }

    return {
        deudor,
        acreedor,
        sala,
        emisiones,
        emitir,
        get actualizacionesEconomicas() {
            return actualizacionesEconomicas;
        }
    };
}

test('paga parcialmente la deuda y transfiere el efectivo al acreedor', async () => {
    const fixture = crearFixture({
        efectivoDeudor: 300,
        deuda: 500
    });

    assert.deepEqual(await fixture.emitir('pagar_deuda'), {
        ok: true,
        monto: 300,
        restante: 200
    });
    assert.equal(fixture.deudor.dinero, 0);
    assert.equal(fixture.deudor.deudaPendiente, 200);
    assert.equal(fixture.acreedor.dinero, 1300);
    assert.equal(fixture.deudor.acreedorId, 'acreedor');
    assert.equal(fixture.actualizacionesEconomicas, 1);
});

test('paga la deuda completa y borra el acreedor', async () => {
    const fixture = crearFixture({
        efectivoDeudor: 700,
        deuda: 500
    });

    assert.deepEqual(await fixture.emitir('pagar_deuda'), {
        ok: true,
        monto: 500,
        restante: 0
    });
    assert.equal(fixture.deudor.dinero, 200);
    assert.equal(fixture.deudor.acreedorId, null);
    assert.equal(fixture.acreedor.dinero, 1500);
});

test('rechaza bancarrota si quedan edificios y no modifica la sala', async () => {
    const fixture = crearFixture({ propiedadesDeudor: [2] });
    fixture.sala.edificios[2] = 1;

    const response = await fixture.emitir('declarar_bancarrota');

    assert.equal(response.ok, false);
    assert.deepEqual(fixture.deudor.propiedades, [2]);
    assert.equal(fixture.deudor.enBancarrota, false);
    assert.equal(fixture.sala.propiedades[2], 'deudor');
    assert.equal(fixture.emisiones.length, 0);
});

test('declara bancarrota y transfiere propiedades y edificios al acreedor', async () => {
    const fixture = crearFixture({ propiedadesDeudor: [2] });
    fixture.sala.hipotecas[2] = true;

    assert.deepEqual(await fixture.emitir('declarar_bancarrota'), { ok: true });
    assert.equal(fixture.deudor.enBancarrota, true);
    assert.equal(fixture.deudor.dinero, 0);
    assert.equal(fixture.deudor.deudaPendiente, 0);
    assert.deepEqual(fixture.deudor.propiedades, []);
    assert.deepEqual(fixture.acreedor.propiedades, [2]);
    assert.equal(fixture.sala.propiedades[2], 'acreedor');
    assert.equal(fixture.sala.hipotecas[2], true);
    assert.equal(fixture.emisiones[0].evento, 'jugador_bancarrota');
    assert.equal(fixture.emisiones[0].datos.propiedadesTransferidas, 1);
    assert.equal(fixture.actualizacionesEconomicas, 1);
});

test('devuelve al banco las propiedades hipotecadas cuando no hay acreedor activo', async () => {
    const fixture = crearFixture({
        propiedadesDeudor: [2],
        acreedorId: 'ausente'
    });
    fixture.sala.hipotecas[2] = true;

    assert.deepEqual(await fixture.emitir('declarar_bancarrota'), { ok: true });
    assert.equal(fixture.sala.propiedades[2], undefined);
    assert.equal(fixture.sala.hipotecas[2], undefined);
});

test('no permite pagar una deuda sin efectivo', async () => {
    const fixture = crearFixture({
        efectivoDeudor: 0,
        deuda: 500
    });

    const response = await fixture.emitir('pagar_deuda');

    assert.equal(response.ok, false);
    assert.equal(fixture.deudor.deudaPendiente, 500);
    assert.equal(fixture.acreedor.dinero, 1000);
    assert.equal(fixture.actualizacionesEconomicas, 0);
});

test('rechaza pagar o declararse en bancarrota sin deuda pendiente', async () => {
    const fixture = crearFixture({ deuda: 0 });

    const payment = await fixture.emitir('pagar_deuda');
    const bankruptcy = await fixture.emitir('declarar_bancarrota');

    assert.equal(payment.ok, false);
    assert.equal(bankruptcy.ok, false);
    assert.equal(fixture.deudor.enBancarrota, false);
    assert.equal(fixture.acreedor.dinero, 1000);
    assert.equal(fixture.actualizacionesEconomicas, 0);
});
