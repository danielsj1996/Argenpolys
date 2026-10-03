(() => {
// ==========================================
// ESTADÍSTICAS DE LA PARTIDA
// ==========================================

const btnEstadisticas = document.getElementById('btnEstadisticas');
const modalEstadisticas = document.getElementById('modalEstadisticas');
const estadisticasContenido = document.getElementById('estadisticasContenido');
const btnCerrarEstadisticas = document.getElementById('btnCerrarEstadisticas');

let estadisticas = {
    propiedadesCompradas: 0,
    alquileresRecibidos: 0,
    alquileresPagados: 0,
    dineroGanado: 0,
    dineroGastado: 0,
    vueltasAlTablero: 0,
    vecesEnCarcel: 0,
    doblesConsecutivos: 0,
    cartasRobadas: 0
};

function actualizarEstadistica(clave, valor = 1) {
    if (estadisticas.hasOwnProperty(clave)) {
        estadisticas[clave] += valor;
    }
}

function renderizarEstadisticas() {
    if (!estadisticasContenido) return;

    const miJugador = jugadoresPartida.find(j => j.id === socket.id);
    const miDinero = miJugador ? miJugador.dinero : 0;
    const misPropiedades = miJugador && miJugador.propiedades ? miJugador.propiedades.length : 0;

    estadisticasContenido.innerHTML = `
        <div class="stat-card">
            <div class="stat-icono">💰</div>
            <div class="stat-valor">$${miDinero.toLocaleString('es-AR')}</div>
            <div class="stat-label">Dinero actual</div>
        </div>
        <div class="stat-card">
            <div class="stat-icono">🏠</div>
            <div class="stat-valor">${misPropiedades}</div>
            <div class="stat-label">Propiedades</div>
        </div>
        <div class="stat-card">
            <div class="stat-icono">🛒</div>
            <div class="stat-valor">${estadisticas.propiedadesCompradas}</div>
            <div class="stat-label">Compras realizadas</div>
        </div>
        <div class="stat-card">
            <div class="stat-icono">💸</div>
            <div class="stat-valor">$${estadisticas.dineroGastado.toLocaleString('es-AR')}</div>
            <div class="stat-label">Dinero gastado</div>
        </div>
        <div class="stat-card">
            <div class="stat-icono">📈</div>
            <div class="stat-valor">$${estadisticas.dineroGanado.toLocaleString('es-AR')}</div>
            <div class="stat-label">Dinero ganado</div>
        </div>
        <div class="stat-card">
            <div class="stat-icono">📥</div>
            <div class="stat-valor">${estadisticas.alquileresRecibidos}</div>
            <div class="stat-label">Alquileres cobrados</div>
        </div>
        <div class="stat-card">
            <div class="stat-icono">📤</div>
            <div class="stat-valor">${estadisticas.alquileresPagados}</div>
            <div class="stat-label">Alquileres pagados</div>
        </div>
        <div class="stat-card">
            <div class="stat-icono">🔄</div>
            <div class="stat-valor">${estadisticas.vueltasAlTablero}</div>
            <div class="stat-label">Vueltas al tablero</div>
        </div>
        <div class="stat-card">
            <div class="stat-icono">🚔</div>
            <div class="stat-valor">${estadisticas.vecesEnCarcel}</div>
            <div class="stat-label">Veces en cárcel</div>
        </div>
        <div class="stat-card">
            <div class="stat-icono">🎴</div>
            <div class="stat-valor">${estadisticas.cartasRobadas}</div>
            <div class="stat-label">Cartas sacadas</div>
        </div>
    `;
}

if (btnEstadisticas) {
    btnEstadisticas.addEventListener('click', () => {
        renderizarEstadisticas();
        if (modalEstadisticas) {
            modalEstadisticas.classList.remove('oculto');
        }
    });
}

if (btnCerrarEstadisticas) {
    btnCerrarEstadisticas.addEventListener('click', () => {
        if (modalEstadisticas) {
            modalEstadisticas.classList.add('oculto');
        }
    });
}

// ==========================================
// SISTEMA DE LOGROS
// ==========================================

const btnLogros = document.getElementById('btnLogros');
const modalLogros = document.getElementById('modalLogros');
const logrosContenido = document.getElementById('logrosContenido');
const btnCerrarLogros = document.getElementById('btnCerrarLogros');
const toastContainer = document.getElementById('toastContainer');

const DEFINICION_LOGROS = [
    {
        id: 'primera_propiedad',
        nombre: '🏠 Primer Hogar',
        descripcion: 'Comprá tu primera propiedad',
        condicion: () => estadisticas.propiedadesCompradas >= 1,
        nivel: 'bronce'
    },
    {
        id: 'magnate',
        nombre: '🏢 Magnate Inmobiliario',
        descripcion: 'Comprá 5 propiedades',
        condicion: () => estadisticas.propiedadesCompradas >= 5,
        nivel: 'oro'
    },
    {
        id: 'cobrador',
        nombre: '💰 Cobrador Profesional',
        descripcion: 'Cobrá 3 alquileres',
        condicion: () => estadisticas.alquileresRecibidos >= 3,
        nivel: 'plata'
    },
    {
        id: 'superviviente',
        nombre: '🔒 Superviviente',
        descripcion: 'Salí de la cárcel 2 veces',
        condicion: () => estadisticas.vecesEnCarcel >= 2,
        nivel: 'plata'
    },
    {
        id: 'viajero',
        nombre: '🌍 Viajero Argentino',
        descripcion: 'Completá 3 vueltas al tablero',
        condicion: () => estadisticas.vueltasAlTablero >= 3,
        nivel: 'oro'
    },
    {
        id: 'gastador',
        nombre: '💸 Gran Gastador',
        descripcion: 'Gastá más de $10.000',
        condicion: () => estadisticas.dineroGastado >= 10000,
        nivel: 'plata'
    },
    {
        id: 'millonario',
        nombre: '🤑 Millonario',
        descripcion: 'Tené más de $30.000',
        condicion: () => {
            const miJugador = jugadoresPartida.find(j => j.id === socket.id);
            return miJugador && miJugador.dinero >= 30000;
        },
        nivel: 'oro'
    },
    {
        id: 'suertudo',
        nombre: '🍀 Suertudo',
        descripcion: 'Sacá 5 cartas de suerte o arca',
        condicion: () => estadisticas.cartasRobadas >= 5,
        nivel: 'bronce'
    },
    {
        id: 'pagador',
        nombre: '💳 Buen Pagador',
        descripcion: 'Pagá 5 alquileres',
        condicion: () => estadisticas.alquileresPagados >= 5,
        nivel: 'bronce'
    },
    {
        id: 'inversor',
        nombre: '📊 Inversor Estrella',
        descripcion: 'Ganá más de $15.000',
        condicion: () => estadisticas.dineroGanado >= 15000,
        nivel: 'oro'
    }
];

const logrosDesbloqueados = new Set();

function verificarLogros() {
    DEFINICION_LOGROS.forEach(logro => {
        if (!logrosDesbloqueados.has(logro.id) && logro.condicion()) {
            logrosDesbloqueados.add(logro.id);
            mostrarToastLogro(logro);
        }
    });
}

function mostrarToastLogro(logro) {
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast-logro toast-${logro.nivel}`;
    toast.innerHTML = `
        <div class="toast-logro-icono">🏆</div>
        <div class="toast-logro-info">
            <strong>¡Logro desbloqueado!</strong>
            <span>${logro.nombre}</span>
            <small>${logro.descripcion}</small>
        </div>
    `;

    toastContainer.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('toast-visible');
    });

    setTimeout(() => {
        toast.classList.remove('toast-visible');
        toast.classList.add('toast-saliendo');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

function renderizarLogros() {
    if (!logrosContenido) return;

    logrosContenido.innerHTML = DEFINICION_LOGROS.map(logro => {
        const desbloqueado = logrosDesbloqueados.has(logro.id);
        return `
            <div class="logro-card ${desbloqueado ? 'logro-desbloqueado' : 'logro-bloqueado'} logro-${logro.nivel}">
                <div class="logro-icono">${desbloqueado ? '🏆' : '🔒'}</div>
                <div class="logro-info">
                    <strong>${logro.nombre}</strong>
                    <small>${logro.descripcion}</small>
                </div>
            </div>
        `;
    }).join('');
}

if (btnLogros) {
    btnLogros.addEventListener('click', () => {
        renderizarLogros();
        if (modalLogros) {
            modalLogros.classList.remove('oculto');
        }
    });
}

if (btnCerrarLogros) {
    btnCerrarLogros.addEventListener('click', () => {
        if (modalLogros) {
            modalLogros.classList.add('oculto');
        }
    });
}


window.actualizarEstadistica = actualizarEstadistica;
window.verificarLogros = verificarLogros;
})();
