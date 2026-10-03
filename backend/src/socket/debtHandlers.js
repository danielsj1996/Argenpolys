function registrarManejadoresDeuda(socket, {
    io,
    obtenerSala,
    normalizarCodigoSala,
    jugadorActivo,
    nivelEdificio,
    emitirEstadoEconomico
}) {
    socket.on('pagar_deuda', (datos, callback) => {
        const codigo = normalizarCodigoSala(datos?.codigo);
        const sala = obtenerSala(codigo);
        const jugador = jugadorActivo(sala, socket.id);

        if (!jugador || !jugador.deudaPendiente) {
            return callback?.({
                ok: false,
                mensaje: 'No tenés una deuda pendiente.'
            });
        }

        const monto = Math.min(jugador.dinero, jugador.deudaPendiente);
        if (!monto) {
            return callback?.({
                ok: false,
                mensaje: 'No tenés efectivo para pagar la deuda.'
            });
        }

        const acreedor = sala.jugadores.find(
            j => j.id === jugador.acreedorId && !j.enBancarrota
        );

        jugador.dinero -= monto;
        if (acreedor) acreedor.dinero += monto;

        jugador.deudaPendiente -= monto;
        if (!jugador.deudaPendiente) jugador.acreedorId = null;

        emitirEstadoEconomico(io, codigo, sala);
        callback?.({
            ok: true,
            monto,
            restante: jugador.deudaPendiente
        });
    });

    socket.on('declarar_bancarrota', (datos, callback) => {
        const codigo = normalizarCodigoSala(datos?.codigo);
        const sala = obtenerSala(codigo);
        const jugador = jugadorActivo(sala, socket.id);

        if (!jugador || !jugador.deudaPendiente) {
            return callback?.({
                ok: false,
                mensaje: 'Solo podés declararte en bancarrota con una deuda pendiente.'
            });
        }

        if (jugador.propiedades.some(numero => nivelEdificio(sala, numero) > 0)) {
            return callback?.({
                ok: false,
                mensaje: 'Primero vendé todos tus edificios antes de declararte en bancarrota.'
            });
        }

        const acreedor = sala.jugadores.find(
            j => j.id === jugador.acreedorId && !j.enBancarrota
        );
        const transferidas = [...jugador.propiedades];

        transferidas.forEach(numero => {
            delete sala.edificios[numero];

            if (acreedor) {
                sala.propiedades[numero] = acreedor.id;
                acreedor.propiedades.push(numero);
            } else {
                delete sala.propiedades[numero];
                delete sala.hipotecas[numero];
            }
        });

        jugador.propiedades = [];
        jugador.dinero = 0;
        jugador.enBancarrota = true;
        jugador.deudaPendiente = 0;
        jugador.acreedorId = null;

        io.to(codigo).emit('jugador_bancarrota', {
            jugadorId: jugador.id,
            jugadorNombre: jugador.nombre,
            acreedorNombre: acreedor?.nombre,
            propiedadesTransferidas: transferidas.length
        });
        emitirEstadoEconomico(io, codigo, sala);
        callback?.({ ok: true });
    });
}

module.exports = { registrarManejadoresDeuda };
