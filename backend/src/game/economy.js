const casillas = require('../../../frontend/data/casillas');

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

    const duenoId = sala.propiedades[casilla.numero];

    if (casilla.categoria === 'ferrocarril') {
        const cantidad = [6, 16, 26, 36]
            .filter(
                numero =>
                    sala.propiedades[numero] === duenoId &&
                    !sala.hipotecas?.[numero]
            )
            .length;

        return [0, 500, 1000, 1500, 2000][cantidad] || 0;
    }

    if (casilla.servicio) {
        const cantidad = [14, 29]
            .filter(
                numero =>
                    sala.propiedades[numero] === duenoId &&
                    !sala.hipotecas?.[numero]
            )
            .length;

        return dado * (cantidad === 2 ? 100 : 40);
    }

    const nivel = nivelEdificio(sala, casilla.numero);

    if (nivel > 0) {
        return (
            (casilla.alquiler || 100) *
            [1, 5, 15, 45, 80, 125][nivel]
        );
    }

    return (
        (casilla.alquiler || 100) *
        (
            tieneGrupoCompleto(sala, duenoId, casilla.grupo)
                ? 2
                : 1
        )
    );
}

function cobrarDeuda(jugador, monto, acreedor = null) {
    const pagado = Math.min(jugador.dinero, monto);
    jugador.dinero -= pagado;

    if (acreedor) {
        acreedor.dinero += pagado;
    }

    const pendiente = monto - pagado;

    if (pendiente > 0) {
        jugador.deudaPendiente = (jugador.deudaPendiente || 0) + pendiente;
        jugador.acreedorId = acreedor?.id || null;
    }

    return { pagado, pendiente };
}

module.exports = {
    propiedad,
    propiedadesDelGrupo,
    tieneGrupoCompleto,
    costoEdificio,
    nivelEdificio,
    rentaDePropiedad,
    cobrarDeuda
};
