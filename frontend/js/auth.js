(() => {
    const emailInput = document.getElementById('cuentaEmail');
    const passwordInput = document.getElementById('cuentaPassword');
    const guestPanel = document.getElementById('cuentaInvitado');
    const signedInPanel = document.getElementById('cuentaConectada');
    const userLabel = document.getElementById('cuentaUsuario');
    const message = document.getElementById('mensajeCuenta');
    const historyList = document.getElementById('listaHistorial');
    let supabaseClient = null;
    let session = null;
    let user = null;
    let historyAvailable = false;
    let ready = Promise.resolve();

    function setMessage(text) {
        if (message) message.textContent = text;
    }

    function renderSession() {
        guestPanel?.classList.toggle('oculto', Boolean(session));
        signedInPanel?.classList.toggle('oculto', !session);
        if (userLabel) {
            userLabel.textContent = user?.email
                ? `Sesión iniciada como ${user.email}`
                : 'Sesión iniciada';
        }
        const historyButton = document.getElementById('btnVerHistorial');
        if (historyButton) historyButton.disabled = !historyAvailable;
    }

    async function obtenerAccessToken() {
        await ready;
        if (!supabaseClient) return null;
        const { data, error } = await supabaseClient.auth.getSession();
        if (error) throw error;
        session = data.session;
        user = session?.user || null;
        renderSession();
        return session?.access_token || null;
    }

    async function withConfiguredClient(action) {
        await ready;
        if (!supabaseClient) {
            setMessage('El servicio de cuentas todavía no está configurado.');
            return;
        }
        try {
            const { error } = await action();
            if (error) {
                setMessage(error.message || 'No se pudo completar la operación.');
                return;
            }
            setMessage('Listo. Si registraste una cuenta, revisá tu correo para confirmarla.');
        } catch (error) {
            console.error('Falló la operación de cuenta:', error);
            setMessage(error.message || 'No se pudo completar la operación.');
        }
    }

    ready = (async () => {
        const controls = [
            'btnRegistrar',
            'btnIniciarSesion',
            'btnGoogle',
            'btnFacebook'
        ].map(id => document.getElementById(id));

        try {
            const response = await fetch('/api/config');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const config = await response.json();
            historyAvailable = config.historialDisponible;
            if (!config.authDisponible || !window.supabase?.createClient) {
                controls.forEach(control => {
                    if (control) control.disabled = true;
                });
                setMessage('Modo invitado disponible. Configurá Supabase para habilitar cuentas.');
                return;
            }

            supabaseClient = window.supabase.createClient(
                config.supabaseUrl,
                config.supabaseAnonKey
            );
            const { data, error } = await supabaseClient.auth.getSession();
            if (error) throw error;
            session = data.session;
            user = session?.user || null;
            renderSession();
            if (!historyAvailable) {
                setMessage('Cuenta disponible; configurá la clave privada de Supabase para guardar el historial.');
            }
            supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
                session = nextSession;
                user = nextSession?.user || null;
                renderSession();
                if (!session && historyList) historyList.replaceChildren();
            });
        } catch (error) {
            console.error('No se pudo inicializar el servicio de cuentas:', error);
            setMessage('No se pudo conectar al servicio de cuentas.');
        }
    })();

    document.getElementById('btnRegistrar')?.addEventListener('click', () => {
        void withConfiguredClient(() => supabaseClient.auth.signUp({
            email: emailInput.value.trim(),
            password: passwordInput.value,
            options: { emailRedirectTo: window.location.origin }
        }));
    });

    document.getElementById('btnIniciarSesion')?.addEventListener('click', () => {
        void withConfiguredClient(() => supabaseClient.auth.signInWithPassword({
            email: emailInput.value.trim(),
            password: passwordInput.value
        }));
    });

    document.getElementById('btnGoogle')?.addEventListener('click', () => {
        void withConfiguredClient(() => supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin }
        }));
    });

    document.getElementById('btnFacebook')?.addEventListener('click', () => {
        void withConfiguredClient(() => supabaseClient.auth.signInWithOAuth({
            provider: 'facebook',
            options: { redirectTo: window.location.origin }
        }));
    });

    document.getElementById('btnCerrarSesion')?.addEventListener('click', () => {
        void withConfiguredClient(() => supabaseClient.auth.signOut());
    });

    document.getElementById('btnVerHistorial')?.addEventListener('click', async () => {
        try {
            const accessToken = await obtenerAccessToken();
            if (!accessToken) {
                setMessage('Iniciá sesión para consultar el historial.');
                return;
            }
            const response = await fetch('/api/historial', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'No se pudo cargar el historial.');

            historyList.replaceChildren();
            if (!result.partidas.length) {
                const empty = document.createElement('li');
                empty.textContent = 'Todavía no hay partidas guardadas para esta cuenta.';
                historyList.appendChild(empty);
                return;
            }
            result.partidas.forEach(partida => {
                const item = document.createElement('li');
                const fecha = new Date(partida.finished_at).toLocaleDateString();
                item.textContent = `${fecha}: ${partida.won ? 'Victoria' : `Ganó ${partida.winner_name}`} · ${partida.player_count} jugadores · ${partida.duration_seconds} s`;
                historyList.appendChild(item);
            });
        } catch (error) {
            setMessage(error.message || 'No se pudo cargar el historial.');
        }
    });

    window.argenAuth = {
        ready,
        getAccessToken: obtenerAccessToken
    };
})();
