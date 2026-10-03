const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL || '';
const anonKey = process.env.SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const authClient = url && anonKey
    ? createClient(url, anonKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
    : null;
const adminClient = url && serviceRoleKey
    ? createClient(url, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
    : null;

async function autenticar(accessToken) {
    if (!accessToken) return { user: null };
    if (!authClient) {
        return {
            error: 'La autenticación no está configurada en el servidor.',
            status: 503
        };
    }
    if (typeof accessToken !== 'string' || accessToken.length > 4096) {
        return { error: 'La sesión no es válida.', status: 401 };
    }

    const { data, error } = await authClient.auth.getUser(accessToken);
    if (error || !data.user) {
        return {
            error: 'La sesión venció o no es válida. Iniciá sesión nuevamente.',
            status: 401
        };
    }
    return { user: data.user };
}

async function guardarHistorialPartida(partida) {
    if (!authClient || !adminClient) return false;

    const filas = partida.participantes.map(jugador => ({
        match_id: partida.id,
        user_id: jugador.userId,
        room_code: partida.codigo,
        player_name: jugador.nombre,
        winner_name: partida.ganador,
        won: jugador.id === partida.ganadorId,
        reason: partida.motivo,
        player_count: partida.participantes.length,
        duration_seconds: partida.duracionSegundos,
        finished_at: new Date(partida.finalizadaEn).toISOString()
    }));

    try {
        const { error } = await adminClient
            .from('match_history')
            .insert(filas);

        if (error) {
            console.error('No se pudo guardar el historial de la partida:', error.message);
            return false;
        }
        return true;
    } catch (error) {
        console.error('Falló el guardado del historial de la partida:', error);
        return false;
    }
}

async function obtenerHistorial(accessToken) {
    const autenticacion = await autenticar(accessToken);
    if (autenticacion.error) return autenticacion;
    if (!autenticacion.user) {
        return {
            error: 'Iniciá sesión para consultar tu historial.',
            status: 401
        };
    }
    if (!adminClient) {
        return {
            error: 'El historial no está configurado en el servidor.',
            status: 503
        };
    }

    const { data, error } = await adminClient
        .from('match_history')
        .select('match_id, room_code, player_name, winner_name, won, reason, player_count, duration_seconds, finished_at')
        .eq('user_id', autenticacion.user.id)
        .order('finished_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error('No se pudo consultar el historial de partidas:', error.message);
        return { error: 'No se pudo cargar el historial.', status: 503 };
    }
    return { partidas: data };
}

function obtenerConfiguracionPublica() {
    return {
        supabaseUrl: url || null,
        supabaseAnonKey: anonKey || null,
        authDisponible: Boolean(authClient),
        historialDisponible: Boolean(authClient && adminClient)
    };
}

module.exports = {
    autenticar,
    guardarHistorialPartida,
    obtenerHistorial,
    obtenerConfiguracionPublica
};
