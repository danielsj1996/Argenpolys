// ==========================================
// CASILLAS DEL TABLERO (40 CASILLAS)
// Paleta Oficial argenpolys & Temática Argentina
// ==========================================

const casillas = [

    // ==========================================
    // 1 - 10 (LADO INFERIOR)
    // ==========================================

    {
        numero: 1,
        nombre: "Salida",
        categoria: "especial",
        icono: "🇦🇷",
        imagen: "img/destinos/salida.svg"
    },
    {
        numero: 2,
        nombre: "Quebrada de Humahuaca",
        categoria: "turismo",
        grupo: "marron",
        precio: 1000,
        alquiler: 100,
        icono: "🏔️",
        imagen: "img/destinos/humahuaca.jpg"
    },
    {
        numero: 3,
        nombre: "Arca Comunal",
        categoria: "arca",
        icono: "📦",
        imagen: "img/destinos/arca.jpg"
    },
    {
        numero: 4,
        nombre: "Cerro de los Siete Colores",
        categoria: "turismo",
        grupo: "marron",
        precio: 1200,
        alquiler: 120,
        icono: "🌄",
        imagen: "img/destinos/siete-colores.jpg"
    },
    {
        numero: 5,
        nombre: "Impuesto Inmobiliario",
        categoria: "impuesto",
        impuesto: true,
        monto: 2000,
        icono: "🧾",
        imagen: "img/destinos/impuesto-inmobiliario.jpg"
    },
    {
        numero: 6,
        nombre: "Ferrocarril del Norte",
        categoria: "ferrocarril",
        precio: 2000,
        alquiler: 200,
        icono: "🚂",
        imagen: "img/destinos/tren.jpg"
    },
    {
        numero: 7,
        nombre: "Cataratas del Iguazú",
        categoria: "turismo",
        grupo: "celeste",
        precio: 1600,
        alquiler: 160,
        icono: "💦",
        imagen: "img/destinos/iguazu.jpg"
    },
    {
        numero: 8,
        nombre: "Ruinas de San Ignacio",
        categoria: "turismo",
        grupo: "celeste",
        precio: 1800,
        alquiler: 180,
        icono: "🏛️",
        imagen: "img/destinos/san-ignacio.jpg"
    },
    {
        numero: 9,
        nombre: "Suerte",
        categoria: "suerte",
        icono: "🎴",
        imagen: "img/destinos/suerte.jpg"
    },
    {
        numero: 10,
        nombre: "Monumento a la Bandera",
        categoria: "turismo",
        grupo: "celeste",
        precio: 2200,
        alquiler: 220,
        icono: "🇦🇷",
        imagen: "img/destinos/monumento-bandera.jpg"
    },

    // ==========================================
    // 11 - 20 (LADO DERECHO)
    // ==========================================

    {
        numero: 11,
        nombre: "Cárcel / Solo de visita",
        categoria: "especial",
        icono: "🚔",
        imagen: "img/destinos/carcel.jpg"
    },
    {
        numero: 12,
        nombre: "Talampaya",
        categoria: "turismo",
        grupo: "rosa",
        precio: 2400,
        alquiler: 240,
        icono: "🏜️",
        imagen: "img/destinos/talampaya.jpg"
    },
    {
        numero: 13,
        nombre: "Aconcagua",
        categoria: "turismo",
        grupo: "rosa",
        precio: 2600,
        alquiler: 260,
        icono: "🏔️",
        imagen: "img/destinos/aconcagua.jpg"
    },
    {
        numero: 14,
        nombre: "Energía Nacional",
        categoria: "servicio",
        servicio: true,
        precio: 1500,
        icono: "💡",
        imagen: "img/destinos/energia.jpg"
    },
    {
        numero: 15,
        nombre: "Ischigualasto",
        categoria: "turismo",
        grupo: "rosa",
        precio: 2800,
        alquiler: 280,
        icono: "🦖",
        imagen: "img/destinos/ischigualasto.jpg"
    },
    {
        numero: 16,
        nombre: "Ferrocarril de Cuyo",
        categoria: "ferrocarril",
        precio: 2000,
        alquiler: 200,
        icono: "🚂",
        imagen: "img/destinos/tren.jpg"
    },
    {
        numero: 17,
        nombre: "Camino de los Siete Lagos",
        categoria: "turismo",
        grupo: "naranja",
        precio: 3200,
        alquiler: 320,
        icono: "🏞️",
        imagen: "img/destinos/siete-lagos.jpg"
    },
    {
        numero: 18,
        nombre: "Bariloche",
        categoria: "turismo",
        grupo: "naranja",
        precio: 3400,
        alquiler: 340,
        icono: "🏔️",
        imagen: "img/destinos/bariloche.jpg"
    },
    {
        numero: 19,
        nombre: "Arca Comunal",
        categoria: "arca",
        icono: "📦",
        imagen: "img/destinos/arca.jpg"
    },
    {
        numero: 20,
        nombre: "Catedral de Bariloche",
        categoria: "turismo",
        grupo: "naranja",
        precio: 3600,
        alquiler: 360,
        icono: "⛪",
        imagen: "img/destinos/catedral-bariloche.jpg"
    },

    // ==========================================
    // 21 - 30 (LADO SUPERIOR)
    // ==========================================

    {
        numero: 21,
        nombre: "Descanso",
        categoria: "especial",
        icono: "🅿️",
        imagen: "img/destinos/descanso.svg"
    },
    {
        numero: 22,
        nombre: "Península Valdés",
        categoria: "turismo",
        grupo: "rojo",
        precio: 4000,
        alquiler: 400,
        icono: "🐋",
        imagen: "img/destinos/peninsula-valdes.jpg"
    },
    {
        numero: 23,
        nombre: "El Calafate",
        categoria: "turismo",
        grupo: "rojo",
        precio: 4200,
        alquiler: 420,
        icono: "🏔️",
        imagen: "img/destinos/calafate.jpg"
    },
    {
        numero: 24,
        nombre: "Glaciar Perito Moreno",
        categoria: "turismo",
        grupo: "rojo",
        precio: 4400,
        alquiler: 440,
        icono: "🧊",
        imagen: "img/destinos/perito-moreno.jpg"
    },
    {
        numero: 25,
        nombre: "Suerte",
        categoria: "suerte",
        icono: "🎴",
        imagen: "img/destinos/suerte.jpg"
    },
    {
        numero: 26,
        nombre: "Ferrocarril Patagónico",
        categoria: "ferrocarril",
        precio: 2000,
        alquiler: 200,
        icono: "🚂",
        imagen: "img/destinos/tren.jpg"
    },
    {
        numero: 27,
        nombre: "Ushuaia",
        categoria: "turismo",
        grupo: "amarillo",
        precio: 4800,
        alquiler: 480,
        icono: "🏔️",
        imagen: "img/destinos/ushuaia.jpg"
    },
    {
        numero: 28,
        nombre: "Parque Nacional Los Glaciares",
        categoria: "turismo",
        grupo: "amarillo",
        precio: 5000,
        alquiler: 500,
        icono: "🧊",
        imagen: "img/destinos/glaciares.jpg"
    },
    {
        numero: 29,
        nombre: "Agua Nacional",
        categoria: "servicio",
        servicio: true,
        precio: 1500,
        icono: "🚰",
        imagen: "img/destinos/agua.jpg"
    },
    {
        numero: 30,
        nombre: "Mar del Plata",
        categoria: "turismo",
        grupo: "amarillo",
        precio: 5200,
        alquiler: 520,
        icono: "🌊",
        imagen: "img/destinos/mar-del-plata.jpg"
    },

    // ==========================================
    // 31 - 40 (LADO IZQUIERDO)
    // ==========================================

    {
        numero: 31,
        nombre: "Comisaría - ¡Vas a la cárcel!",
        categoria: "especial",
        enviaCarcel: true,
        icono: "🚔",
        imagen: "img/destinos/policia.jpg"
    },
    {
        numero: 32,
        nombre: "Teatro Colón",
        categoria: "turismo",
        grupo: "verde",
        precio: 5400,
        alquiler: 540,
        icono: "🎭",
        imagen: "img/destinos/teatro-colon.jpg"
    },
    {
        numero: 33,
        nombre: "Obelisco",
        categoria: "turismo",
        grupo: "verde",
        precio: 5600,
        alquiler: 560,
        icono: "🗼",
        imagen: "img/destinos/obelisco.jpg"
    },
    {
        numero: 34,
        nombre: "Caminito",
        categoria: "turismo",
        grupo: "verde",
        precio: 5800,
        alquiler: 580,
        icono: "🎨",
        imagen: "img/destinos/caminito.jpg"
    },
    {
        numero: 35,
        nombre: "Arca Comunal",
        categoria: "arca",
        icono: "📦",
        imagen: "img/destinos/arca.jpg"
    },
    {
        numero: 36,
        nombre: "Ferrocarril del Plata",
        categoria: "ferrocarril",
        precio: 2000,
        alquiler: 200,
        icono: "🚂",
        imagen: "img/destinos/tren.jpg"
    },
    {
        numero: 37,
        nombre: "San Antonio de Areco",
        categoria: "turismo",
        grupo: "azul-oscuro",
        precio: 6200,
        alquiler: 620,
        icono: "🐎",
        imagen: "img/destinos/san-antonio-areco.jpg"
    },
    {
        numero: 38,
        nombre: "Impuesto Turístico",
        categoria: "impuesto",
        impuesto: true,
        monto: 1000,
        icono: "🧳",
        imagen: "img/destinos/impuesto-turistico.jpg"
    },
    {
        numero: 39,
        nombre: "Córdoba Capital",
        categoria: "turismo",
        grupo: "azul-oscuro",
        precio: 6400,
        alquiler: 640,
        icono: "🏛️",
        imagen: "img/destinos/cordoba.jpg"
    },
    {
        numero: 40,
        nombre: "Salta",
        categoria: "turismo",
        grupo: "azul-oscuro",
        precio: 6800,
        alquiler: 680,
        icono: "⛰️",
        imagen: "img/destinos/salta.jpg"
    }

];

// ==========================================
// CARTAS DE SUERTE Y ARCA COMUNAL
// ==========================================

const cartasSuerte = [
    { id: 1, texto: "¡Ganaste el Gordo de Navidad de la Lotería! Cobrás $2.000.", tipo: "dinero", valor: 2000 },
    { id: 2, texto: "Multa por exceso de velocidad en la Ruta 2 hacia la costa. Pagás $800.", tipo: "dinero", valor: -800 },
    { id: 3, texto: "¡Escapada express a Bariloche! Avanzá hasta Bariloche (Casilla 18).", tipo: "mover", destino: 18 },
    { id: 4, texto: "Reintegro del Impuesto a las Ganancias. Cobrás $1.200.", tipo: "dinero", valor: 1200 },
    { id: 5, texto: "Rompiste una cubierta en la Panamericana. Pagás $1.000 por el auxilio mecánico.", tipo: "dinero", valor: -1000 },
    { id: 6, texto: "Avanzá hasta la Salida y cobrá tus $2.000.", tipo: "mover", destino: 1 },
    { id: 7, texto: "Inspección de AFIP: pagás $1.500 de ajuste.", tipo: "dinero", valor: -1500 },
    { id: 8, texto: "¡Cobraste el aguinaldo! Recibís $2.500.", tipo: "dinero", valor: 2500 },
    { id: 9, texto: "Tarjeta de salida gratuita de la cárcel. Guardala hasta necesitarla.", tipo: "salida_carcel" }
];

const cartasArca = [
    { id: 1, texto: "Venta de garage en el barrio: vendiste todo y cobrás $1.000.", tipo: "dinero", valor: 1000 },
    { id: 2, texto: "Factura de luz bimestral con aumento. Pagás $600.", tipo: "dinero", valor: -600 },
    { id: 3, texto: "Ganaste el concurso de asados del club de barrio. Cobrás $1.500.", tipo: "dinero", valor: 1500 },
    { id: 4, texto: "Reparación de cañerías en el consorcio. Pagás $1.000.", tipo: "dinero", valor: -1000 },
    { id: 5, texto: "Tu tía te regaló plata para tu cumpleaños. Cobrás $1.200.", tipo: "dinero", valor: 1200 },
    { id: 6, texto: "Día de pesca en Mar del Plata. Avanzá directo a Mar del Plata (Casilla 30).", tipo: "mover", destino: 30 },
    { id: 7, texto: "Gastos médicos inesperados en la farmacia. Pagás $700.", tipo: "dinero", valor: -700 },
    { id: 8, texto: "Cobrás dividendos de acciones nacionales. Recibís $1.800.", tipo: "dinero", valor: 1800 },
    { id: 9, texto: "Tarjeta de salida gratuita de la cárcel. Guardala hasta necesitarla.", tipo: "salida_carcel" }
];

// ==========================================
// EXPORTAR
// ==========================================

casillas.cartasSuerte = cartasSuerte;
casillas.cartasArca = cartasArca;

if (typeof window !== 'undefined') {
    window.casillas = casillas;
    window.cartasSuerte = cartasSuerte;
    window.cartasArca = cartasArca;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = casillas;
}
