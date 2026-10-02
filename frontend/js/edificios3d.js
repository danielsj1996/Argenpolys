import * as THREE from 'three';

import {
    GLTFLoader
} from 'three/addons/loaders/GLTFLoader.js';


/* =========================================================
   EDIFICIOS 3D — ARGENPOLYS
   ========================================================= */


/* =========================================================
   RUTAS DE LOS MODELOS
   ========================================================= */

const MODELO_CASA =
    '/models/edificios/casa.glb';

const MODELO_HOTEL =
    '/models/edificios/hotel.glb';


/* =========================================================
   CONFIGURACIÓN VISUAL
   ========================================================= */

/*
   Altura aproximada que queremos que tenga
   el edificio dentro del pequeño escenario 3D.

   Si después queremos edificios más grandes
   o más pequeños, modificamos estos valores.
*/

const ALTURA_CASA = 1.45;

const ALTURA_HOTEL = 1.70;


/*
   Distancia de la cámara.

   Cuanto menor sea el valor:
   → más cerca
   → edificio más grande

   Cuanto mayor:
   → más lejos
   → edificio más pequeño
*/

const DISTANCIA_CAMARA = 5.2;


/*
   Inclinación de la cámara.

   La cámara está elevada y mirando
   hacia el edificio en diagonal.
*/

const POSICION_CAMARA = {
    x: 4,
    y: 3.6,
    z: 5.2
};


/* =========================================================
   THREE
   ========================================================= */

const loader =
    new GLTFLoader();


/* =========================================================
   MODELOS CARGADOS
   ========================================================= */

const modelosCargados = {

    casa: null,

    hotel: null

};


/* =========================================================
   ESCENARIOS ACTIVOS
   ========================================================= */

const edificios3D =
    new Map();


/* =========================================================
   CARGAR CASA
   ========================================================= */

function cargarCasa() {

    return new Promise(
        (resolve, reject) => {

            loader.load(

                MODELO_CASA,

                gltf => {

                    modelosCargados.casa =
                        gltf.scene;

                    console.log(
                        '🏠 Casa 3D cargada correctamente'
                    );

                    resolve(
                        gltf.scene
                    );

                },

                undefined,

                error => {

                    console.error(
                        '❌ Error cargando casa.glb:',
                        error
                    );

                    reject(error);

                }

            );

        }
    );

}


/* =========================================================
   CARGAR HOTEL
   ========================================================= */

function cargarHotel() {

    return new Promise(
        (resolve, reject) => {

            loader.load(

                MODELO_HOTEL,

                gltf => {

                    modelosCargados.hotel =
                        gltf.scene;

                    console.log(
                        '🏨 Hotel 3D cargado correctamente'
                    );

                    resolve(
                        gltf.scene
                    );

                },

                undefined,

                error => {

                    console.error(
                        '❌ Error cargando hotel.glb:',
                        error
                    );

                    reject(error);

                }

            );

        }
    );

}


/* =========================================================
   CARGAR MODELOS
   ========================================================= */

async function cargarModelosEdificios() {

    if (
        modelosCargados.casa &&
        modelosCargados.hotel
    ) {

        return;

    }


    try {

        await Promise.all([

            cargarCasa(),

            cargarHotel()

        ]);

        console.log(
            '✅ Modelos 3D de edificios listos'
        );

    } catch (error) {

        console.error(
            '❌ No se pudieron cargar los modelos 3D:',
            error
        );

    }

}


/* =========================================================
   CLONAR MODELO
   ========================================================= */

function clonarModelo(
    modelo
) {

    return modelo.clone(true);

}


/* =========================================================
   AJUSTAR ESCALA DEL MODELO
   ========================================================= */

function escalarModelo(
    modelo,
    alturaDeseada
) {

    const caja =
        new THREE.Box3()
            .setFromObject(
                modelo
            );


    const tamaño =
        new THREE.Vector3();


    caja.getSize(
        tamaño
    );


    if (
        tamaño.y <= 0
    ) {

        return;

    }


    const escala =
        alturaDeseada /
        tamaño.y;


    modelo.scale.setScalar(
        escala
    );

}


/* =========================================================
   APOYAR MODELO SOBRE EL PISO
   ========================================================= */

function apoyarModelo(
    modelo
) {

    const caja =
        new THREE.Box3()
            .setFromObject(
                modelo
            );


    /*
       Movemos el modelo para que
       su parte inferior quede en Y = 0.
    */

    modelo.position.y -=
        caja.min.y;

}


/* =========================================================
   CENTRAR MODELO
   ========================================================= */

function centrarModelo(
    modelo
) {

    const caja =
        new THREE.Box3()
            .setFromObject(
                modelo
            );


    const centro =
        new THREE.Vector3();


    caja.getCenter(
        centro
    );


    /*
       Centramos solamente X y Z.

       NO tocamos Y porque queremos
       mantener el edificio apoyado
       sobre el piso.
    */

    modelo.position.x -=
        centro.x;

    modelo.position.z -=
        centro.z;

}


/* =========================================================
   CREAR UNA CASA
   ========================================================= */

function crearCasa(
    posicionX
) {

    const casa =
        clonarModelo(
            modelosCargados.casa
        );


    escalarModelo(
        casa,
        ALTURA_CASA
    );


    centrarModelo(
        casa
    );


    apoyarModelo(
        casa
    );


    casa.position.x =
        posicionX;


    return casa;

}


/* =========================================================
   CREAR HOTEL
   ========================================================= */

function crearHotel() {

    const hotel =
        clonarModelo(
            modelosCargados.hotel
        );


    escalarModelo(
        hotel,
        ALTURA_HOTEL
    );


    centrarModelo(
        hotel
    );


    apoyarModelo(
        hotel
    );


    /*
       Pequeña rotación para que
       se vea mejor la profundidad
       del modelo.
    */

    hotel.rotation.y =
        THREE.MathUtils.degToRad(
            -10
        );


    return hotel;

}


/* =========================================================
   POSICIONES DE LAS CASAS
   ========================================================= */

/*
   Las casas se colocan en fila.

   Nivel 1:
          🏠

   Nivel 2:
        🏠 🏠

   Nivel 3:
      🏠 🏠 🏠

   Nivel 4:
    🏠 🏠 🏠 🏠
*/

function posicionesCasas(
    cantidad
) {

    const separacion =
        0.72;


    if (cantidad === 1) {

        return [0];

    }


    const posiciones = [];


    const inicio =
        -(
            (cantidad - 1) *
            separacion
        ) / 2;


    for (
        let i = 0;
        i < cantidad;
        i++
    ) {

        posiciones.push(
            inicio +
            i * separacion
        );

    }


    return posiciones;

}


/* =========================================================
   CREAR EDIFICIOS DEL NIVEL
   ========================================================= */

function agregarEdificiosNivel(
    escena,
    nivel
) {

    /*
       HOTEL
       --------------------------------
    */

    if (
        nivel >= 5
    ) {

        const hotel =
            crearHotel();


        escena.add(
            hotel
        );


        return;

    }


    /*
       CASAS
       --------------------------------
    */

    const cantidad =
        Math.min(
            Math.max(
                nivel,
                1
            ),
            4
        );


    const posiciones =
        posicionesCasas(
            cantidad
        );


    posiciones.forEach(
        posicionX => {

            const casa =
                crearCasa(
                    posicionX
                );


            escena.add(
                casa
            );

        }
    );

}


/* =========================================================
   CONFIGURAR CÁMARA
   ========================================================= */

function configurarCamara(
    camara
) {

    /*
       Cámara en diagonal desde arriba.

       X → desplazamiento lateral
       Y → altura
       Z → profundidad
    */

    camara.position.set(

        POSICION_CAMARA.x,

        POSICION_CAMARA.y,

        POSICION_CAMARA.z

    );


    /*
       Miramos un poco por encima
       del piso para que se vea
       la fachada de los edificios.
    */

    camara.lookAt(
        0,
        0.65,
        0
    );

}


/* =========================================================
   CREAR RENDERER
   ========================================================= */

function crearRenderer(
    contenedor
) {

    const renderer =
        new THREE.WebGLRenderer({

            alpha: true,

            antialias: true

        });


    renderer.setPixelRatio(

        Math.min(
            window.devicePixelRatio,
            2
        )

    );


    renderer.setClearColor(
        0x000000,
        0
    );


    renderer.outputColorSpace =
        THREE.SRGBColorSpace;


    /*
       El canvas ocupa todo
       el contenedor.
    */

    const ancho =
        contenedor.clientWidth ||
        100;


    const alto =
        contenedor.clientHeight ||
        100;


    renderer.setSize(
        ancho,
        alto,
        false
    );


    return renderer;

}


/* =========================================================
   LUCES
   ========================================================= */

function agregarLuces(
    escena
) {

    /*
       Luz ambiente.

       Evita que las partes oscuras
       del modelo queden completamente negras.
    */

    const ambiente =
        new THREE.HemisphereLight(

            0xffffff,

            0x777777,

            2.4

        );


    escena.add(
        ambiente
    );


    /*
       Luz principal.

       Viene desde arriba y adelante.
    */

    const principal =
        new THREE.DirectionalLight(

            0xffffff,

            3.2

        );


    principal.position.set(

        4,

        7,

        5

    );


    escena.add(
        principal
    );


    /*
       Segunda luz suave.

       Ayuda a distinguir las fachadas
       laterales de los edificios.
    */

    const relleno =
        new THREE.DirectionalLight(

            0xffffff,

            1.2

        );


    relleno.position.set(

        -4,

        4,

        -2

    );


    escena.add(
        relleno
    );

}


/* =========================================================
   CREAR ESCENARIO 3D
   ========================================================= */

function crearEdificio3D(
    contenedor,
    nivel
) {

    if (
        !contenedor ||
        nivel <= 0
    ) {

        return null;

    }


    /* -----------------------------------------
       ESCENA
       ----------------------------------------- */

    const escena =
        new THREE.Scene();


    /* -----------------------------------------
       CÁMARA
       ----------------------------------------- */

    const ancho =
        contenedor.clientWidth ||
        100;


    const alto =
        contenedor.clientHeight ||
        100;


    const camara =
        new THREE.PerspectiveCamera(

            28,

            ancho / alto,

            0.1,

            100

        );


    configurarCamara(
        camara
    );


    /* -----------------------------------------
       RENDERER
       ----------------------------------------- */

    const renderer =
        crearRenderer(
            contenedor
        );


    /* -----------------------------------------
       LUCES
       ----------------------------------------- */

    agregarLuces(
        escena
    );


    /* -----------------------------------------
       EDIFICIOS
       ----------------------------------------- */

    agregarEdificiosNivel(
        escena,
        nivel
    );


    /* -----------------------------------------
       RENDER
       ----------------------------------------- */

    renderer.render(
        escena,
        camara
    );


    /* -----------------------------------------
       INSERTAR CANVAS
       ----------------------------------------- */

    contenedor.innerHTML =
        '';

    contenedor.appendChild(
        renderer.domElement
    );


    return {

        escena,

        camara,

        renderer

    };

}


/* =========================================================
   ELIMINAR ESCENARIO ANTERIOR
   ========================================================= */

function eliminarEdificio3D(
    numero
) {

    const anterior =
        edificios3D.get(
            numero
        );


    if (!anterior) {

        return;

    }


    /*
       Eliminamos el canvas.
    */

    if (
        anterior.renderer &&
        anterior.renderer.domElement
    ) {

        anterior.renderer
            .domElement
            .remove();

    }


    /*
       Liberamos recursos del renderer.
    */

    if (
        anterior.renderer
    ) {

        anterior.renderer.dispose();

    }


    edificios3D.delete(
        numero
    );

}


/* =========================================================
   ACTUALIZAR EDIFICIOS
   ========================================================= */

async function actualizarEdificios3D(
    edificios
) {

    if (!edificios) {

        return;

    }


    /*
       Esperar a que los modelos
       estén disponibles.
    */

    if (
        !modelosCargados.casa ||
        !modelosCargados.hotel
    ) {

        await cargarModelosEdificios();

    }


    /*
       Buscar todas las casillas
       que pueden tener edificios.
    */

    document
        .querySelectorAll(
            '.edificios-casilla'
        )
        .forEach(
            contenedor => {

                const numero =
                    Number(
                        contenedor.dataset.edificios
                    );


                const nivel =
                    Number(
                        edificios[numero] || 0
                    );


                /*
                   Eliminar lo que había antes.
                */

                eliminarEdificio3D(
                    numero
                );


                /*
                   Si no hay edificios,
                   dejamos la casilla vacía.
                */

                if (
                    nivel <= 0
                ) {

                    contenedor.innerHTML =
                        '';

                    return;

                }


                /*
                   Crear nuevo escenario.
                */

                const escenario =
                    crearEdificio3D(
                        contenedor,
                        nivel
                    );


                if (
                    escenario
                ) {

                    edificios3D.set(
                        numero,
                        escenario
                    );

                }

            }
        );

}


/* =========================================================
   REDIMENSIONAR CANVAS
   ========================================================= */

function redimensionarEdificios3D() {

    edificios3D.forEach(
        escenario => {

            const renderer =
                escenario.renderer;

            const camara =
                escenario.camara;


            const contenedor =
                renderer.domElement
                    .parentElement;


            if (!contenedor) {

                return;

            }


            const ancho =
                contenedor.clientWidth ||
                100;


            const alto =
                contenedor.clientHeight ||
                100;


            renderer.setSize(
                ancho,
                alto,
                false
            );


            camara.aspect =
                ancho / alto;


            camara.updateProjectionMatrix();


            renderer.render(
                escenario.escena,
                camara
            );

        }
    );

}


/* =========================================================
   WINDOW RESIZE
   ========================================================= */

window.addEventListener(
    'resize',
    redimensionarEdificios3D
);


/* =========================================================
   EXPORTAR
   ========================================================= */

window.actualizarEdificios3D =
    actualizarEdificios3D;


/* =========================================================
   INICIAR CARGA
   ========================================================= */

cargarModelosEdificios();