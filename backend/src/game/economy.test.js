const assert = require('node:assert/strict');
const test = require('node:test');

const {
    cobrarDeuda,
    costoEdificio,
    nivelEdificio,
    propiedad,
    propiedadesDelGrupo,
    rentaDePropiedad,
    tieneGrupoCompleto
} = require('./economy');

function crearSalaEconomica() {
    return {
        propiedades: {},
        edificios: {},
        hipotecas: {}
    };
}

test('calcula renta base y bonificación por grupo completo', () => {
    const sala = crearSalaEconomica();
    const propiedad = require('../../../frontend/data/casillas').find(
        casilla => casilla.numero === 2
    );

    sala.propiedades[2] = 'jugador-1';
    assert.equal(rentaDePropiedad(sala, propiedad, 7), 100);

    sala.propiedades[4] = 'jugador-1';
    assert.equal(tieneGrupoCompleto(sala, 'jugador-1', 'marron'), true);
    assert.equal(rentaDePropiedad(sala, propiedad, 7), 200);
});

test('calcula rentas de ferrocarriles y servicios', () => {
    const sala = crearSalaEconomica();
    const casillas = require('../../../frontend/data/casillas');
    const tren = casillas.find(casilla => casilla.numero === 6);
    const servicio = casillas.find(casilla => casilla.numero === 14);

    sala.propiedades[6] = 'dueno';
    assert.equal(rentaDePropiedad(sala, tren, 8), 500);
    sala.propiedades[16] = 'dueno';
    assert.equal(rentaDePropiedad(sala, tren, 8), 1000);

    sala.propiedades[14] = 'dueno';
    assert.equal(rentaDePropiedad(sala, servicio, 8), 320);
    sala.propiedades[29] = 'dueno';
    assert.equal(rentaDePropiedad(sala, servicio, 8), 800);
});

test('hipoteca elimina renta y edificios modifican su valor', () => {
    const sala = crearSalaEconomica();
    const casilla = propiedad(2);
    sala.propiedades[2] = 'jugador-1';

    assert.equal(costoEdificio(casilla), 500);
    sala.edificios[2] = 1;
    assert.equal(nivelEdificio(sala, 2), 1);
    assert.equal(rentaDePropiedad(sala, casilla, 5), 500);

    sala.hipotecas[2] = true;
    assert.equal(rentaDePropiedad(sala, casilla, 5), 0);
    assert.equal(propiedadesDelGrupo('marron').length, 2);
});

test('cobra lo posible, conserva deuda pendiente y transfiere pago al acreedor', () => {
    const jugador = { dinero: 350, deudaPendiente: 0, acreedorId: null };
    const acreedor = { id: 'acreedor', dinero: 900 };

    assert.deepEqual(cobrarDeuda(jugador, 700, acreedor), {
        pagado: 350,
        pendiente: 350
    });
    assert.equal(jugador.dinero, 0);
    assert.equal(jugador.deudaPendiente, 350);
    assert.equal(jugador.acreedorId, 'acreedor');
    assert.equal(acreedor.dinero, 1250);
});
