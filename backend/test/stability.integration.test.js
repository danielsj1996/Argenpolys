const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { io } = require('socket.io-client');

const backendPath = path.resolve(__dirname, '..');
let serverProcess;
let serverPort;
let serverOutput = '';

function reservePort() {
    return new Promise((resolve, reject) => {
        const listener = net.createServer();
        listener.once('error', reject);
        listener.listen(0, '127.0.0.1', () => {
            const { port } = listener.address();
            listener.close(error => error ? reject(error) : resolve(port));
        });
    });
}

function waitForServer() {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error(`Server did not start. Output: ${serverOutput}`));
        }, 8000);

        const checkOutput = chunk => {
            serverOutput += chunk.toString();
            if (serverOutput.includes('Servidor Argenpolys iniciado')) {
                clearTimeout(timeout);
                resolve();
            }
        };

        serverProcess.stdout.on('data', checkOutput);
        serverProcess.stderr.on('data', chunk => {
            serverOutput += chunk.toString();
        });
        serverProcess.once('error', error => {
            clearTimeout(timeout);
            reject(error);
        });
        serverProcess.once('exit', code => {
            clearTimeout(timeout);
            reject(new Error(`Server exited with code ${code}. Output: ${serverOutput}`));
        });
    });
}

function connectClient() {
    return new Promise((resolve, reject) => {
        const client = io(`http://127.0.0.1:${serverPort}`, {
            transports: ['websocket'],
            reconnection: false,
            timeout: 4000
        });
        const timeout = setTimeout(() => {
            client.disconnect();
            reject(new Error('Timed out connecting Socket.IO client.'));
        }, 5000);

        client.once('connect', () => {
            clearTimeout(timeout);
            resolve(client);
        });
        client.once('connect_error', error => {
            clearTimeout(timeout);
            client.disconnect();
            reject(error);
        });
    });
}

function emitWithAck(client, event, payload) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(
            () => reject(new Error(`Timed out waiting for ${event} acknowledgement.`)),
            5000
        );
        const acknowledge = response => {
            clearTimeout(timeout);
            resolve(response);
        };
        if (payload === undefined) {
            client.emit(event, acknowledge);
        } else {
            client.emit(event, payload, acknowledge);
        }
    });
}

function waitForEvent(client, event) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            client.off(event, onEvent);
            reject(new Error(`Timed out waiting for ${event}.`));
        }, 5000);
        const onEvent = payload => {
            clearTimeout(timeout);
            resolve(payload);
        };
        client.once(event, onEvent);
    });
}

function assertNoPublicTokens(sala) {
    assert.ok(Array.isArray(sala?.jugadores));
    for (const jugador of sala.jugadores) {
        assert.equal(Object.hasOwn(jugador, 'token'), false);
    }
}

async function exerciseRoom(playerCount, verifyReconnect = false) {
    const clients = [];
    const tokens = [];
    let invalidClient = null;
    let code;

    try {
        const host = await connectClient();
        clients.push(host);
        const hostToken = crypto.randomBytes(24).toString('hex');
        tokens.push(hostToken);

        const created = await emitWithAck(host, 'crear_sala', {
            nombre: `Sala${playerCount}Host`,
            token: hostToken,
            fichaId: 'computador',
            authUserId: 'untrusted-client-user-id'
        });
        assert.equal(created.ok, true, created.mensaje);
        assert.equal(created.token, hostToken);
        assertNoPublicTokens(created.sala);
        assert.equal(created.sala.jugadores[0].fichaId, 'computador');
        assert.equal(Object.hasOwn(created.sala.jugadores[0], 'authUserId'), false);
        code = created.sala.codigo;

        const eventPayloads = [];
        const observePublicEvents = client => {
            client.on('sala_actualizada', sala => {
                assertNoPublicTokens(sala);
                eventPayloads.push(sala);
            });
            client.on('estado_economico_actualizado', estado => {
                assert.ok(Array.isArray(estado.jugadores));
                for (const jugador of estado.jugadores) {
                    assert.equal(Object.hasOwn(jugador, 'token'), false);
                }
            });
        };
        observePublicEvents(host);

        for (let index = 1; index < playerCount; index++) {
            const client = await connectClient();
            clients.push(client);
            observePublicEvents(client);

            if (index === 1) {
                const invalidCode = await emitWithAck(client, 'unirse_sala', {
                    codigo: {},
                    nombre: 'Invitado',
                    token: crypto.randomUUID()
                });
                assert.equal(invalidCode.ok, false);

                const duplicateName = await emitWithAck(client, 'unirse_sala', {
                    codigo: code,
                    nombre: `sala${playerCount}host`,
                    token: crypto.randomUUID()
                });
                assert.equal(duplicateName.ok, false);

                const invalidName = await emitWithAck(client, 'unirse_sala', {
                    codigo: code,
                    nombre: '<script>',
                    token: crypto.randomUUID()
                });
                assert.equal(invalidName.ok, false);
            }

            const token = crypto.randomBytes(24).toString('hex');
            tokens.push(token);
            const joined = await emitWithAck(client, 'unirse_sala', {
                codigo: code,
                nombre: `Sala${playerCount}P${index + 1}`,
                token,
                fichaId: index % 2 ? 'churros' : 'caballo',
                authUserId: 'untrusted-client-user-id'
            });

            assert.equal(joined.ok, true, joined.mensaje);
            assert.equal(joined.token, token);
            assertNoPublicTokens(joined.sala);
            assert.equal(joined.sala.jugadores.length, index + 1);
            assert.equal(
                joined.sala.jugadores.at(-1).fichaId,
                index % 2 ? 'churros' : 'caballo'
            );
            assert.equal(Object.hasOwn(joined.sala.jugadores.at(-1), 'authUserId'), false);
        }

        const startedEvents = clients.map(client =>
            waitForEvent(client, 'partida_iniciada')
        );
        const started = await emitWithAck(host, 'iniciar_partida', { codigo: code });
        assert.equal(started.ok, true, started.mensaje);
        assertNoPublicTokens(started.sala);
        const publicRooms = await Promise.all(startedEvents);
        publicRooms.forEach(assertNoPublicTokens);

        if (verifyReconnect) {
            const oldClient = clients[1];
            const reconnectToken = tokens[1];
            const disconnectedEvent = waitForEvent(host, 'jugador_desconectado');
            const disconnectedRoomUpdate = waitForEvent(host, 'sala_actualizada');
            oldClient.disconnect();
            await disconnectedEvent;
            assertNoPublicTokens(await disconnectedRoomUpdate);

            const replacement = await connectClient();
            clients[1] = replacement;
            const updatedRoomEvent = waitForEvent(host, 'sala_actualizada');
            const reconnected = await emitWithAck(
                replacement,
                'intentar_reconectar',
                { codigo: code, token: reconnectToken }
            );

            assert.equal(reconnected.ok, true, reconnected.mensaje);
            assert.equal(reconnected.token, reconnectToken);
            assertNoPublicTokens(reconnected.sala);
            assert.equal(
                reconnected.sala.jugadores.find(jugador => jugador.nombre === 'Sala2P2').id,
                replacement.id
            );
            assertNoPublicTokens(await updatedRoomEvent);

            invalidClient = await connectClient();
            clients.push(invalidClient);
            const invalidReconnect = await emitWithAck(
                invalidClient,
                'intentar_reconectar',
                { codigo: code, token: 'invalid-token' }
            );
            assert.equal(invalidReconnect.ok, false);

            const malformedReconnect = await emitWithAck(
                invalidClient,
                'intentar_reconectar',
                { codigo: {}, token: reconnectToken }
            );
            assert.equal(malformedReconnect.ok, false);
        }

        assert.ok(eventPayloads.length >= playerCount - 1);

        const exitResponses = await Promise.all(
            clients
                .filter(client => client.connected)
                .map(client => emitWithAck(client, 'salir-partida'))
        );
        exitResponses.forEach((response, index) => {
            assert.equal(response.ok, clients[index] !== invalidClient);
        });
    } finally {
        for (const client of clients) {
            client.disconnect();
        }
    }
}

before(async () => {
    serverPort = await reservePort();
    serverProcess = spawn(process.execPath, ['server.js'], {
        cwd: backendPath,
        env: { ...process.env, PORT: String(serverPort) },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    await waitForServer();
});

after(async () => {
    if (!serverProcess || serverProcess.exitCode !== null) return;

    await new Promise(resolve => {
        serverProcess.once('exit', resolve);
        serverProcess.kill();
    });
});

test('supports concurrent 2, 3, 4 and 8-player rooms and active reconnection', {
    timeout: 45000
}, async () => {
    await Promise.all([
        exerciseRoom(2, true),
        exerciseRoom(3),
        exerciseRoom(4),
        exerciseRoom(8)
    ]);
});

test('removes lobby disconnects and rejects their old session tokens', async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const returningGuest = await connectClient();

    try {
        const hostToken = crypto.randomUUID();
        const created = await emitWithAck(host, 'crear_sala', {
            nombre: 'LobbyHost',
            token: hostToken
        });
        assert.equal(created.ok, true);

        const joinedRoomUpdate = waitForEvent(host, 'sala_actualizada');
        const guestToken = crypto.randomUUID();
        const joined = await emitWithAck(guest, 'unirse_sala', {
            codigo: created.sala.codigo,
            nombre: 'LobbyGuest',
            token: guestToken
        });
        assert.equal(joined.ok, true);
        assert.equal((await joinedRoomUpdate).jugadores.length, 2);

        const chatMessage = new Promise(resolve => {
            const onChatMessage = message => {
                if (message.jugadorNombre !== 'LobbyGuest') return;
                host.off('chat_mensaje', onChatMessage);
                resolve(message);
            };
            host.on('chat_mensaje', onChatMessage);
        });
        const chatAck = await emitWithAck(guest, 'chat_enviar', {
            codigo: created.sala.codigo,
            texto: `  ${'mensaje '.repeat(50)}  `
        });
        assert.equal(chatAck.ok, true);
        const receivedMessage = await chatMessage;
        assert.equal(receivedMessage.jugadorNombre, 'LobbyGuest');
        assert.equal(receivedMessage.texto.length, 300);

        const roomUpdate = waitForEvent(host, 'sala_actualizada');
        guest.disconnect();
        const updatedRoom = await roomUpdate;
        assertNoPublicTokens(updatedRoom);
        assert.equal(updatedRoom.jugadores.length, 1);

        const reconnect = await emitWithAck(
            returningGuest,
            'intentar_reconectar',
            { codigo: created.sala.codigo, token: guestToken }
        );
        assert.equal(reconnect.ok, false);

        const left = await emitWithAck(host, 'salir-partida');
        assert.equal(left.ok, true);
    } finally {
        host.disconnect();
        guest.disconnect();
        returningGuest.disconnect();
    }
});

test('public configuration endpoint never exposes private persistence credentials', async () => {
    const response = await fetch(`http://127.0.0.1:${serverPort}/api/config`);
    assert.equal(response.status, 200);
    const config = await response.json();
    assert.equal(typeof config.authDisponible, 'boolean');
    assert.equal(typeof config.historialDisponible, 'boolean');
    assert.equal(Object.hasOwn(config, 'serviceRoleKey'), false);
    assert.equal(Object.hasOwn(config, 'supabaseServiceRoleKey'), false);
});

test('match history endpoint requires an authenticated account', async () => {
    const response = await fetch(`http://127.0.0.1:${serverPort}/api/historial`);
    assert.equal(response.status, 401);
    assert.match((await response.json()).error, /Iniciá sesión/);
});
