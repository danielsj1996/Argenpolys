function registrarManejadorChat(socket, {
    io,
    obtenerSala,
    normalizarCodigoSala,
    agregarMensajeChat,
    maxLargoMensaje
}) {
    socket.on('chat_enviar', (datos, callback) => {
        try {
            const codigo = normalizarCodigoSala(datos?.codigo);
            const sala = codigo && obtenerSala(codigo);

            if (!sala) {
                return callback?.({
                    ok: false,
                    mensaje: 'La sala no existe.'
                });
            }

            const jugador = sala.jugadores.find(j => j.id === socket.id);
            if (!jugador) {
                return callback?.({
                    ok: false,
                    mensaje: 'No pertenecés a esta sala.'
                });
            }

            const texto = String(datos?.texto || '')
                .trim()
                .slice(0, maxLargoMensaje);

            if (!texto) {
                return callback?.({
                    ok: false,
                    mensaje: 'Escribí algo para enviar.'
                });
            }

            const mensaje = {
                id: `${Date.now()}-${socket.id}`,
                jugadorId: jugador.id,
                jugadorNombre: jugador.nombre,
                texto,
                hora: Date.now()
            };

            agregarMensajeChat(codigo, mensaje);
            io.to(codigo).emit('chat_mensaje', mensaje);
            callback?.({ ok: true });
        } catch (error) {
            console.error('Error al enviar mensaje de chat:', error);
            callback?.({
                ok: false,
                mensaje: 'No se pudo enviar el mensaje.'
            });
        }
    });
}

module.exports = { registrarManejadorChat };
