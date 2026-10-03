import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const modelos = {
    caballo: '/models/fichas3d/caballo.glb',
    computador: '/models/fichas3d/computador.glb',
    churros: '/models/fichas3d/Churros.glb'
};

const loader = new GLTFLoader();
const cacheModelos = new Map();
const modelosDisponibles = new Set();
const fichasActivas = new Map();
const tablero = document.getElementById('tablero');
const escena = new THREE.Scene();
const camara = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 3000);
const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'low-power'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setClearColor(0x000000, 0);
renderer.domElement.className = 'fichas3d-canvas';
renderer.domElement.setAttribute('aria-hidden', 'true');

escena.add(new THREE.HemisphereLight(0xffffff, 0x64748b, 2.2));
const luz = new THREE.DirectionalLight(0xffffff, 2.4);
luz.position.set(-100, 180, 100);
escena.add(luz);

const plataformaGeometria = new THREE.CylinderGeometry(11, 11, 3, 24);
const colores = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#64748b'];
let rendererWidth = 0;
let rendererHeight = 0;

function cargarModelo(fichaId) {
    if (!modelos[fichaId]) {
        return Promise.reject(new Error(`Ficha 3D desconocida: ${fichaId}`));
    }

    if (!cacheModelos.has(fichaId)) {
        cacheModelos.set(fichaId, new Promise((resolve, reject) => {
            loader.load(modelos[fichaId], gltf => {
                modelosDisponibles.add(fichaId);
                resolve(gltf.scene);
            }, undefined, reject);
        }));
    }

    return cacheModelos.get(fichaId);
}

function crearFicha(jugador, indice, elemento) {
    const grupo = new THREE.Group();
    const color = new THREE.MeshStandardMaterial({
        color: colores[indice % colores.length],
        roughness: 0.45,
        metalness: 0.1
    });
    const plataforma = new THREE.Mesh(plataformaGeometria, color);
    plataforma.position.y = 1.5;
    grupo.add(plataforma);

    cargarModelo(jugador.fichaId || 'caballo').then(modelo => {
        if (!fichasActivas.has(jugador.id) || fichasActivas.get(jugador.id).grupo !== grupo) return;

        const modeloClonado = modelo.clone(true);
        const bounds = new THREE.Box3().setFromObject(modeloClonado);
        const dimensiones = bounds.getSize(new THREE.Vector3());
        const alto = Math.max(dimensiones.y, dimensiones.x, dimensiones.z, 0.01);
        modeloClonado.scale.setScalar(25 / alto);
        const boundsEscalados = new THREE.Box3().setFromObject(modeloClonado);
        modeloClonado.position.y = 3 - boundsEscalados.min.y;
        grupo.add(modeloClonado);
        elemento.classList.add('ficha-3d-activa');
        renderizar();
    }).catch(error => {
        console.error(`No se pudo cargar el modelo 3D "${jugador.fichaId}":`, error);
    });

    escena.add(grupo);
    return grupo;
}

function ajustarRenderer() {
    if (!tablero || !tablero.clientWidth || !tablero.clientHeight) return false;

    const ancho = tablero.clientWidth;
    const alto = tablero.clientHeight;
    if (ancho !== rendererWidth || alto !== rendererHeight) {
        renderer.setSize(ancho, alto, false);
        rendererWidth = ancho;
        rendererHeight = alto;
    }
    camara.left = -ancho / 2;
    camara.right = ancho / 2;
    camara.top = alto / 2;
    camara.bottom = -alto / 2;
    camara.position.set(0, 1100, 650);
    camara.up.set(0, 0, -1);
    camara.lookAt(0, 0, 0);
    camara.updateProjectionMatrix();

    if (!renderer.domElement.isConnected) tablero.appendChild(renderer.domElement);
    return true;
}

function renderizar() {
    if (ajustarRenderer()) renderer.render(escena, camara);
}

function actualizarFichas3D(jugadores) {
    if (!tablero || !Array.isArray(jugadores)) return;

    const actuales = new Set();
    const tableroRect = tablero.getBoundingClientRect();

    jugadores.forEach((jugador, indice) => {
        const elemento = [...tablero.querySelectorAll('.ficha-jugador')]
            .find(ficha => ficha.dataset.jugadorId === jugador.id);
        if (!elemento) return;

        actuales.add(jugador.id);
        let ficha = fichasActivas.get(jugador.id);
        const fichaId = modelos[jugador.fichaId] ? jugador.fichaId : 'caballo';

        if (!ficha || ficha.fichaId !== fichaId) {
            if (ficha) escena.remove(ficha.grupo);
            ficha = {
                fichaId,
                grupo: crearFicha({ ...jugador, fichaId }, indice, elemento)
            };
            fichasActivas.set(jugador.id, ficha);
        }

        const rect = elemento.getBoundingClientRect();
        ficha.grupo.position.x = rect.left + rect.width / 2 - tableroRect.left - tablero.clientLeft - tablero.clientWidth / 2;
        ficha.grupo.position.z = (
            rect.top + rect.height / 2 - tableroRect.top - tablero.clientTop - tablero.clientHeight / 2
        ) / Math.sin(Math.atan2(1100, 650));
        elemento.classList.toggle('ficha-3d-activa', modelosDisponibles.has(fichaId));
    });

    for (const [jugadorId, ficha] of fichasActivas) {
        if (actuales.has(jugadorId)) continue;
        escena.remove(ficha.grupo);
        fichasActivas.delete(jugadorId);
    }

    renderizar();
}

window.actualizarFichas3D = actualizarFichas3D;
window.addEventListener('resize', renderizar);
