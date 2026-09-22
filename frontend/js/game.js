
// ==========================================
// COLORES DE LAS FICHAS
// ==========================================

const coloresJugadores = [

    '#e53935',
    '#1e88e5',
    '#43a047',
    '#f9a825',
    '#8e24aa',
    '#fb8c00',
    '#00acc1',
    '#6d4c41'

];


// ==========================================
// GENERAR TABLERO
// ==========================================

function generarTablero() {

    const tablero =
        document.getElementById('tablero');


    if (!tablero) {

        console.error(
            'No se encontró el elemento #tablero'
        );

        return;

    }


    tablero
        .querySelectorAll('.casilla')
        .forEach(casilla => {

            casilla.remove();

        });


    casillas.forEach(casilla => {

        const elemento =
            document.createElement('div');


        elemento.classList.add(
            'casilla',
            `casilla-${casilla.categoria}`
        );


        // ------------------------------------------
        // GRUPO DE PROPIEDAD
        // ------------------------------------------

        if (casilla.grupo) {

            elemento.classList.add(
                `grupo-${casilla.grupo}`
            );

        }


        elemento.dataset.numero =
            casilla.numero;


        // ------------------------------------------
        // CONTENIDO
        // ------------------------------------------

        elemento.innerHTML = `

            <div class="numero-casilla">
                ${casilla.numero}
            </div>

            <div class="color-casilla"></div>

            <div class="contenido-casilla">
                <div class="ilustracion-casilla">
                    ${
                        casilla.imagen
                            ? `<img src="${casilla.imagen}" alt="${casilla.nombre}" class="img-destino" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='inline';" /><span class="icono-casilla" style="display: none;">${casilla.icono}</span>`
                            : `<span class="icono-casilla">${casilla.icono}</span>`
                    }
                </div>
                <span class="nombre-casilla">
                    ${casilla.nombre}
                </span>
            </div>

            ${
                casilla.precio
                    ? `
                        <div class="precio-casilla">
                            $${casilla.precio.toLocaleString('es-AR')}
                        </div>
                    `
                    : ''
            }

            <div class="propietario-badge" style="display: none;"></div>

            <div class="fichas-casilla"></div>

        `;

        tablero.appendChild(
            elemento
        );

    });

    posicionarCasillas();

}


// ==========================================
// POSICIONAR CASILLAS
// ==========================================

function posicionarCasillas() {

    const elementos =
        document.querySelectorAll('.casilla');


    elementos.forEach(elemento => {

        const numero =
            Number(
                elemento.dataset.numero
            );


        // ------------------------------------------
        // LADO INFERIOR
        // ------------------------------------------

        if (
            numero >= 1 &&
            numero <= 11
        ) {

            elemento.style.gridColumn =
                numero;

            elemento.style.gridRow =
                11;

            elemento.classList.add(
                'lado-inferior'
            );

        }


        // ------------------------------------------
        // LADO DERECHO
        // ------------------------------------------

        else if (
            numero >= 12 &&
            numero <= 20
        ) {

            elemento.style.gridColumn =
                11;

            elemento.style.gridRow =
                22 - numero;

            elemento.classList.add(
                'lado-derecho'
            );

        }


        // ------------------------------------------
        // LADO SUPERIOR
        // ------------------------------------------

        else if (
            numero >= 21 &&
            numero <= 31
        ) {

            elemento.style.gridColumn =
                32 - numero;

            elemento.style.gridRow =
                1;

            elemento.classList.add(
                'lado-superior'
            );

        }


        // ------------------------------------------
        // LADO IZQUIERDO
        // ------------------------------------------

        else if (
            numero >= 32 &&
            numero <= 40
        ) {

            elemento.style.gridColumn =
                1;

            elemento.style.gridRow =
                numero - 30;

            elemento.classList.add(
                'lado-izquierdo'
            );

        }

    });

}


// ==========================================
// CREAR FICHAS DE JUGADORES
// ==========================================

function actualizarFichas(jugadores) {

    if (!jugadores) {
        return;
    }


    // ------------------------------------------
    // ELIMINAR FICHAS ANTERIORES
    // ------------------------------------------

    document
        .querySelectorAll('.ficha-jugador')
        .forEach(ficha => {

            ficha.remove();

        });


    // ------------------------------------------
    // CREAR NUEVAS FICHAS
    // ------------------------------------------

    jugadores.forEach(
        (jugador, indice) => {

            const posicion =
                jugador.posicion || 1;


            const casilla =
                document.querySelector(
                    `.casilla[data-numero="${posicion}"]`
                );


            if (!casilla) {

                console.error(
                    `No se encontró la casilla ${posicion}`
                );

                return;

            }


            const contenedor =
                casilla.querySelector(
                    '.fichas-casilla'
                );


            if (!contenedor) {
                return;
            }


            // ------------------------------------------
            // CREAR FICHA
            // ------------------------------------------

            const ficha =
                document.createElement('div');


            ficha.classList.add(
                'ficha-jugador'
            );


            ficha.style.backgroundColor =
                coloresJugadores[
                    indice %
                    coloresJugadores.length
                ];


            // ------------------------------------------
            // NÚMERO DE JUGADOR
            // ------------------------------------------

            ficha.textContent =
                indice + 1;


            // ------------------------------------------
            // NOMBRE
            // ------------------------------------------

            ficha.title =
                jugador.nombre;


            contenedor.appendChild(
                ficha
            );

        }
    );

}


// ==========================================
// ANIMAR MOVIMIENTO
// ==========================================

async function animarMovimiento(
    jugadorId,
    posicionFinal
) {

    const jugador =
        jugadoresPartida.find(
            jugador =>
                jugador.id === jugadorId
        );


    if (!jugador) {

        console.error(
            'No se encontró el jugador:',
            jugadorId
        );

        return;

    }


    const posicionInicial =
        jugador.posicion || 1;


    if (
        posicionInicial === posicionFinal
    ) {

        return;

    }


    let posicion =
        posicionInicial;


    // ------------------------------------------
    // AVANZAR CASILLA POR CASILLA
    // ------------------------------------------

    while (
        posicion !== posicionFinal
    ) {

        posicion++;


        if (
            posicion > 40
        ) {

            posicion = 1;

        }


        jugador.posicion =
            posicion;


        actualizarFichas(
            jugadoresPartida
        );


        await esperar(
            180
        );

    }

}


// ==========================================
// ACTUALIZAR PROPIETARIOS EN EL TABLERO
// ==========================================

function actualizarPropietariosTablero(propiedades, jugadores) {
    if (!propiedades || !jugadores) return;

    document.querySelectorAll('.casilla[data-numero]').forEach(casillaEl => {
        const numero = Number(casillaEl.dataset.numero);
        const propietarioId = propiedades[numero];
        const badge = casillaEl.querySelector('.propietario-badge');

        if (propietarioId) {
            const jugadorIndice = jugadores.findIndex(j => j.id === propietarioId);
            const jugador = jugadores[jugadorIndice];
            const color = jugadorIndice !== -1 ? coloresJugadores[jugadorIndice % coloresJugadores.length] : '#1976d2';

            if (badge) {
                badge.style.display = 'block';
                badge.style.backgroundColor = color;
                badge.textContent = jugador ? (jugador.nombre.length > 8 ? jugador.nombre.slice(0, 7) + '…' : jugador.nombre) : 'Dueño';
                badge.title = `Propietario: ${jugador?.nombre || 'Desconocido'}`;
            }

            casillaEl.style.outline = `3px solid ${color}`;
            casillaEl.style.outlineOffset = '-3px';
        } else {
            if (badge) {
                badge.style.display = 'none';
            }
            casillaEl.style.outline = 'none';
        }
    });
}


// ==========================================
// ESPERAR
// ==========================================

function esperar(
    milisegundos
) {

    return new Promise(
        resolver => {

            setTimeout(
                resolver,
                milisegundos
            );

        }
    );

}


// ==========================================
// INICIAR TABLERO
// ==========================================

function iniciarTablero() {

    // Reiniciar propietarios de las propiedades
    casillas.forEach(casilla => {

        if (casilla.precio) {
            casilla.propietarioId = null;
        }

    });

    generarTablero();

    console.log(
        'Tablero generado correctamente con 40 casillas.'
    );

}


// ==========================================
// ACTUALIZAR JUGADORES DE LA PARTIDA
// ==========================================

function actualizarJugadoresPartida(
    jugadores
) {

    actualizarFichas(
        jugadores
    );

}


// ==========================================
// DADOS
// ==========================================

const carasDados = [

    '⚀',
    '⚁',
    '⚂',
    '⚃',
    '⚄',
    '⚅'

];


function mostrarDados(
    dado1,
    dado2,
    suma
) {

    const elementoDado1 =
        document.getElementById(
            'dado1'
        );


    const elementoDado2 =
        document.getElementById(
            'dado2'
        );


    const elementoSuma =
        document.getElementById(
            'sumaDados'
        );


    if (
        !elementoDado1 ||
        !elementoDado2
    ) {

        console.error(
            'No se encontraron los elementos de los dados.'
        );

        return;

    }


    elementoDado1.textContent =
        carasDados[dado1 - 1];


    elementoDado2.textContent =
        carasDados[dado2 - 1];


    if (elementoSuma) {

        elementoSuma.textContent =
            suma;

    }

}


// ==========================================
// EXPORTAR FUNCIONES
// ==========================================

window.coloresJugadores =
    coloresJugadores;

window.iniciarTablero =
    iniciarTablero;


window.generarTablero =
    generarTablero;


window.actualizarFichas =
    actualizarFichas;


window.actualizarJugadoresPartida =
    actualizarJugadoresPartida;


window.actualizarPropietariosTablero =
    actualizarPropietariosTablero;


window.mostrarDados =
    mostrarDados;


window.animarMovimiento =
    animarMovimiento;

