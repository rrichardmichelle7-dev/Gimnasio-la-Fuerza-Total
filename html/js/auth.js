// Kilvio FIT - Supabase Auth helpers.
// TODO SECURITY: permisos de UI son conveniencia visual; RLS en Supabase es la seguridad real.

const DEFAULT_PERMISSIONS = [
    "dashboard",
    "miembros",
    "asistencia",
    "ingresos_diarios",
    "pagos",
    "registrar_pago",
    "inventario",
    "pos",
    "ventas_pos",
    "cuadre_caja",
    "proveedores",
    "facturas",
    "reportes",
    "mensualidad",
    "configuracion",
    "soporte_michel_soft"
];

const SAAS_PERMISSIONS = [
    "panel_michel_soft"
];

const ALL_PERMISSIONS = [
    ...DEFAULT_PERMISSIONS,
    ...SAAS_PERMISSIONS
];

const ROLE_PERMISSIONS = {
    administrador: DEFAULT_PERMISSIONS,
    recepcion: [
        "dashboard",
        "miembros",
        "asistencia",
        "ingresos_diarios",
        "pagos",
        "registrar_pago",
        "inventario",
        "pos",
        "ventas_pos",
        "cuadre_caja",
        "facturas"
    ],
    super_admin_saas: SAAS_PERMISSIONS
};

const UNAUTHORIZED_ACCESS_MESSAGE = "Usuario no autorizado";
const INACTIVE_ACCESS_MESSAGE = "Usuario inactivo. Contacte al administrador.";
const ACCESS_REQUEST_SENT_MESSAGE = "Tu solicitud de acceso fue enviada. Espera aprobación del administrador.";
const ACCESS_REQUEST_PENDING_MESSAGE = "Tu solicitud de acceso está pendiente de aprobación.";
const EMAIL_NOT_VERIFIED_MESSAGE = "Debes verificar tu correo electronico antes de acceder.";
const SESSION_EXPIRED_MESSAGE = "Tu sesion expiro. Inicia sesion nuevamente.";
const SESSION_INVALID_MESSAGE = "Sesion invalida. Inicia sesion nuevamente.";
const SUSPENDED_ACCOUNT_MESSAGE = "Cuenta suspendida. Contacte a Michel Soft.";
const INACTIVITY_TIMEOUT_MINUTES = Number(window.KILVIO_INACTIVITY_TIMEOUT_MINUTES || 30);

const auth = {
    sessionKey: "kilvio_usuario_activo",
    loginErrorKey: "kilvio_login_error",
    profile: null,
    user: null,
    inactivityTimer: null,
    sessionWatchTimer: null,
    estadoUsuarioVerificacionPromise: null,
    perfilRealtimeChannel: null,
    perfilRealtimeUserId: null,
    expulsionEnCurso: false,

    get client() {
        return window.kilvioSupabase || window.supabaseClient || null;
    },

    isSupabaseReady() {
        return Boolean(this.client);
    },

    loginPath() {
        return "login.html";
    },

    appPath(profile = this.profile) {
        return this.isSuperAdminSaas(profile) ? "michel-soft.html" : "index.html";
    },

    googleRedirectUrl() {
        const origin = window.location.origin;
        return `${origin}/index.html`;
    },

    hasOAuthCallbackParams() {
        return new URLSearchParams(window.location.search || "").has("code");
    },

    cleanOAuthCallbackUrl() {
        const cleanUrl = `${window.location.origin}${window.location.pathname}`;
        window.history.replaceState({}, document.title, cleanUrl);
    },

    async handleOAuthCallback() {
        if (!this.client) {
            return { handled: false, session: null };
        }

        const search = new URLSearchParams(window.location.search || "");
        const code = search.get("code");

        if (!code) {
            return { handled: false, session: null };
        }

        let result = null;

        try {
            result = await this.client.auth.exchangeCodeForSession(code);
        } catch (exchangeError) {
            const error = this.createAuthError("No se pudo completar el inicio de sesión con Google.", "validation");
            error.originalError = exchangeError;
            throw error;
        }

        if (result?.error) {
            const error = this.createAuthError("No se pudo completar el inicio de sesión con Google.", "validation");
            error.originalError = result.error;
            throw error;
        }

        this.cleanOAuthCallbackUrl();

        const { data, error } = await this.client.auth.getSession();
        if (error) throw error;

        return { handled: true, session: data?.session || result?.data?.session || null };
    },

    resetPasswordRedirectUrl() {
        return `${window.location.origin}/login.html?modo=restablecer`;
    },

    bindLogoutButtons() {
        document.querySelectorAll('[data-page="logout"], [data-auth-logout]').forEach(button => {
            if (button.dataset.logoutBound === "true") return;

            button.dataset.logoutBound = "true";
            button.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                this.logout();
            }, true);
        });
    },

    normalizePermission(value) {
        return String(value || "").toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
    },

    normalizeRole(value) {
        const rol = String(value || "recepcion").toLowerCase().trim();
        return ["administrador", "recepcion", "super_admin_saas"].includes(rol) ? rol : "recepcion";
    },

    normalizePermissions(permisos, rol = "recepcion") {
        if (Array.isArray(permisos) && permisos.length > 0) {
            return permisos.map(permission => this.normalizePermission(permission)).filter(permission => ALL_PERMISSIONS.includes(permission));
        }

        if (typeof permisos === "string" && permisos.trim()) {
            try {
                const parsed = JSON.parse(permisos);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed.map(permission => this.normalizePermission(permission)).filter(permission => ALL_PERMISSIONS.includes(permission));
                }
            } catch (error) {
                return permisos
                    .split(",")
                    .map(permission => this.normalizePermission(permission))
                    .filter(permission => ALL_PERMISSIONS.includes(permission));
            }
        }

        return ROLE_PERMISSIONS[this.normalizeRole(rol)] || ROLE_PERMISSIONS.recepcion;
    },

    normalizeProfile(profile, user) {
        const rol = this.normalizeRole(profile?.rol);
        return {
            id: profile?.id || user?.id || null,
            user_id: profile?.user_id || user?.id || null,
            gimnasio_id: profile?.gimnasio_id || null,
            nombre: profile?.nombre || user?.email || "Usuario Kilvio FIT",
            telefono: profile?.telefono || "",
            rol,
            estado: String(profile?.estado || "activo").toLowerCase(),
            permisos: this.normalizePermissions(profile?.permisos, rol)
        };
    },

    isSuperAdminSaas(profile = this.profile) {
        return this.normalizeRole(profile?.rol) === "super_admin_saas";
    },

    userHasVerifiedEmail(user = this.user) {
        const providers = user?.app_metadata?.providers || [];
        return Boolean(
            user?.email_confirmed_at ||
            user?.confirmed_at ||
            user?.app_metadata?.provider === "google" ||
            providers.includes("google")
        );
    },

    buildFallbackProfile(user) {
        const metadata = user?.user_metadata || {};
        const rol = "recepcion";

        // TODO SECURITY: fallback temporal solo para desarrollo. En producción debe existir public.perfiles protegido con RLS.
        return this.normalizeProfile({
            id: user?.id || null,
            user_id: user?.id || null,
            gimnasio_id: null,
            nombre: metadata.nombre || user?.email || "Usuario Kilvio FIT",
            telefono: metadata.telefono || "",
            rol,
            estado: "activo",
            permisos: ROLE_PERMISSIONS[rol] || ROLE_PERMISSIONS.recepcion
        }, user);
    },

    async login(email, password) {
        if (!this.client) {
            throw new Error("Supabase no esta configurado. Revisa SUPABASE_URL y SUPABASE_ANON_KEY.");
        }

        const { data, error } = await this.client.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        if (!data?.session) {
            throw new Error("Supabase no devolvio una sesion valida. Confirma el email del usuario o revisa las credenciales.");
        }

        if (!this.userHasVerifiedEmail(data.user)) {
            await this.logoutSeguro({ redirect: false });
            throw new Error(EMAIL_NOT_VERIFIED_MESSAGE);
        }

        try {
            this.user = data.user || null;
            this.profile = await this.getCurrentProfile({ force: true });
            this.storeActiveUser();
        } catch (profileError) {
            console.error("LOGIN PERFIL ERROR:", profileError);
            const message = profileError.authReason === "inactive"
                ? INACTIVE_ACCESS_MESSAGE
                : profileError.authReason === "suspended"
                    ? SUSPENDED_ACCOUNT_MESSAGE
                    : UNAUTHORIZED_ACCESS_MESSAGE;
            await this.logoutSeguro({ redirect: false });
            throw new Error(message);
        }

        return { user: this.user, profile: this.profile, session: data.session };
    },

    async loginConGoogle() {
        if (!this.client) {
            throw new Error("Supabase no esta configurado. Revisa SUPABASE_URL y SUPABASE_ANON_KEY.");
        }

        const redirectTo = this.googleRedirectUrl();

        const { error } = await this.client.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo
            }
        });

        if (error) throw error;
    },

    async recuperarPassword(email) {
        if (!this.client) {
            throw new Error("Supabase no esta configurado. Revisa SUPABASE_URL y SUPABASE_ANON_KEY.");
        }

        const cleanEmail = String(email || "").trim().toLowerCase();
        if (!cleanEmail) {
            throw new Error("Ingresa tu correo para enviar el enlace de recuperacion.");
        }

        const { error } = await this.client.auth.resetPasswordForEmail(cleanEmail, {
            redirectTo: this.resetPasswordRedirectUrl()
        });

        if (error) throw error;
    },

    async actualizarPassword(password) {
        if (!this.client) {
            throw new Error("Supabase no esta configurado. Revisa SUPABASE_URL y SUPABASE_ANON_KEY.");
        }

        if (!password || String(password).length < 8) {
            throw new Error("La nueva contrasena debe tener al menos 8 caracteres.");
        }

        const { error } = await this.client.auth.updateUser({ password });
        if (error) throw error;
    },

    async logout() {
        await this.logoutSeguro({ redirect: true });
    },

    async clearAuthState(options = {}) {
        const { redirect = false, signOut = false } = options;

        try {
            if (signOut && this.client) {
                await this.client.auth.signOut();
            }
        } catch (error) {
            console.error("SUPABASE LOGOUT ERROR:", error);
        } finally {
            this.user = null;
            this.profile = null;
            this.clearLocalAuthStorage();
            if (redirect) {
                window.location.href = this.loginPath();
            }
        }
    },

    clearLocalAuthStorage() {
        const authKeys = [
            this.sessionKey,
            "usuarioActivo",
            "perfilActivo",
            "perfil_activo",
            "gimnasioActivo",
            "gimnasio_activo",
            "gimnasio_id",
            "kilvio_perfil_activo",
            "kilvio_gimnasio_activo",
            "kilvio_usuario_activo",
            "rol"
        ];

        authKeys.forEach(key => {
            sessionStorage.removeItem(key);
            localStorage.removeItem(key);
        });
    },

    async logoutSeguro(options = {}) {
        const { redirect = false, message = "" } = options;

        try {
            if (this.client) {
                await this.client.auth.signOut();
            }
        } catch (error) {
            console.error("SUPABASE LOGOUT SEGURO ERROR:", error);
        } finally {
            this.user = null;
            this.profile = null;
            this.clearLocalAuthStorage();
            this.stopSessionSecurity();
            sessionStorage.removeItem(this.loginErrorKey);

            if (message) {
                sessionStorage.setItem(this.loginErrorKey, message);
            }

            if (redirect) {
                window.location.href = this.loginPath();
            }
        }
    },

    async expulsarUsuario(errorCode) {
        if (this.expulsionEnCurso) return false;

        this.expulsionEnCurso = true;

        try {
            this.stopSessionSecurity();

            if (this.client) {
                await this.client.auth.signOut();
            }
        } catch (error) {
            console.warn("No se pudo cerrar completamente la sesión remota", error);
        } finally {
            this.user = null;
            this.profile = null;
            localStorage.clear();
            sessionStorage.clear();
            this.redirectToLogin(errorCode);
        }

        return false;
    },

    async verificarEstadoUsuarioActivo() {
        if (this.expulsionEnCurso) return false;
        if (this.estadoUsuarioVerificacionPromise) return this.estadoUsuarioVerificacionPromise;

        this.estadoUsuarioVerificacionPromise = (async () => {
            const supabase = this.client;

            if (!supabase) {
                console.error("No se puede verificar el estado del usuario: Supabase no está disponible.");
                return false;
            }

            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            const session = sessionData?.session || null;

            if (sessionError || !session?.user?.id) {
                if (sessionError) {
                    console.warn("No se pudo obtener la sesión al verificar el estado del usuario", sessionError);
                }
                return await this.expulsarUsuario("sesion_expirada");
            }

            const { data: perfil, error: perfilError } = await supabase
                .from("perfiles")
                .select("id,user_id,estado")
                .eq("user_id", session.user.id)
                .maybeSingle();

            if (perfilError) {
                console.error("No se pudo verificar el estado en public.perfiles", perfilError);
                return false;
            }

            if (String(perfil?.estado || "").trim().toLowerCase() !== "activo") {
                return await this.expulsarUsuario("usuario_inactivo");
            }

            this.user = session.user;
            return true;
        })();

        try {
            return await this.estadoUsuarioVerificacionPromise;
        } catch (error) {
            console.error("Error inesperado verificando el estado del usuario", error);
            return false;
        } finally {
            this.estadoUsuarioVerificacionPromise = null;
        }
    },

    async iniciarRealtimeEstadoUsuario() {
        const supabase = this.client;
        const userId = this.user?.id;

        if (!supabase?.channel || !userId || this.expulsionEnCurso) return;
        if (this.perfilRealtimeChannel && this.perfilRealtimeUserId === userId) return;

        if (this.perfilRealtimeChannel) {
            await supabase.removeChannel(this.perfilRealtimeChannel);
        }

        this.perfilRealtimeUserId = userId;
        this.perfilRealtimeChannel = supabase
            .channel(`estado-perfil-${userId}`)
            .on("postgres_changes", {
                event: "UPDATE",
                schema: "public",
                table: "perfiles",
                filter: `user_id=eq.${userId}`
            }, payload => {
                const estado = String(payload?.new?.estado || "").trim().toLowerCase();

                if (estado !== "activo") {
                    this.expulsarUsuario("usuario_inactivo");
                }
            })
            .subscribe(status => {
                if (["CHANNEL_ERROR", "TIMED_OUT"].includes(status)) {
                    console.warn("Realtime de estado de usuario no disponible; continúa el sondeo cada 30 segundos.", status);
                }
            });
    },

    async getCurrentUser() {
        if (!this.client) return null;

        const { data: sessionData, error: sessionError } = await this.client.auth.getSession();
        const session = sessionData?.session || null;

        if (sessionError) {
            console.warn("No se pudo obtener la sesion actual", sessionError);
            await this.logoutSeguro({ redirect: true, message: SESSION_INVALID_MESSAGE });
            return null;
        }

        if (!session) {
            this.user = null;
            return null;
        }

        const { data, error } = await this.client.auth.getUser();

        if (error) {
            console.warn("No se pudo obtener el usuario actual", error);
            await this.logoutSeguro({ redirect: true, message: SESSION_INVALID_MESSAGE });
            return null;
        }

        this.user = data.user || null;

        return this.user;
    },

    async getCurrentProfile(options = {}) {
        const { force = false } = options;

        if (this.profile && !force) return this.profile;

        const user = this.user || await this.getCurrentUser();

        if (!this.client || !user) return null;

        const profile = await this.fetchProfileByUser(user);

        if (!profile) {
            console.error("PERFIL SUPABASE NO ENCONTRADO:", {
                user_id: user.id,
                email: user.email,
                query: 'window.kilvioSupabase.from("perfiles").select("*").eq("user_id", user.id).maybeSingle()'
            });
            throw this.createAuthError(UNAUTHORIZED_ACCESS_MESSAGE, "unauthorized");
        }

        this.profile = this.normalizeProfile(profile, user);

        if (String(this.profile.estado || "").trim().toLowerCase() !== "activo") {
            console.warn("PERFIL NO ACTIVO:", {
                user_id: user.id,
                estado: this.profile.estado || null
            });
            throw this.createAuthError(INACTIVE_ACCESS_MESSAGE, "inactive");
        }

        if (!this.isSuperAdminSaas(this.profile) && !this.profile.gimnasio_id) {
            console.error("PERFIL SIN GIMNASIO_ID:", this.profile);
            throw this.createAuthError(UNAUTHORIZED_ACCESS_MESSAGE, "unauthorized");
        }

        const estadoCliente = await this.validarEstadoClienteSaas(this.profile);
        if (!estadoCliente.allowed) {
            throw this.createAuthError(SUSPENDED_ACCOUNT_MESSAGE, "suspended");
        }

        this.storeActiveUser();
        return this.profile;
    },

    createAuthError(message, reason = "unauthorized") {
        const error = new Error(message);
        error.authReason = reason;
        return error;
    },

    isGoogleUser(user) {
        const providers = user?.app_metadata?.providers || [];
        const identities = user?.identities || [];

        return providers.includes("google") || identities.some(identity => identity?.provider === "google");
    },

    getGoogleDisplayName(user) {
        const metadata = user?.user_metadata || {};

        return metadata.full_name || metadata.name || metadata.nombre || user?.email || "Usuario Google";
    },

    async registrarSolicitudAcceso(user) {
        if (!this.client || !user?.id) {
            throw this.createAuthError(UNAUTHORIZED_ACCESS_MESSAGE, "unauthorized");
        }

        const { data: solicitudExistente, error: consultaError } = await this.client
            .from("solicitudes_acceso")
            .select("id,estado")
            .eq("user_id", user.id)
            .maybeSingle();

        if (consultaError) {
            console.error("ERROR CONSULTANDO SOLICITUD DE ACCESO:", consultaError);
            throw this.createAuthError(consultaError.message || "No se pudo consultar la solicitud de acceso.", "validation");
        }

        if (String(solicitudExistente?.estado || "").toLowerCase() === "pendiente") {
            return { status: "pending" };
        }

        const payload = {
            user_id: user.id,
            email: user.email || "",
            nombre_google: this.getGoogleDisplayName(user),
            estado: "pendiente"
        };

        const query = solicitudExistente?.id
            ? this.client.from("solicitudes_acceso").update(payload).eq("id", solicitudExistente.id)
            : this.client.from("solicitudes_acceso").insert([payload]);

        const { error } = await query;

        if (error) {
            console.error("ERROR REGISTRANDO SOLICITUD DE ACCESO:", error);
            throw this.createAuthError(error.message || "No se pudo enviar la solicitud de acceso.", "validation");
        }

        return { status: "created" };
    },

    async rechazarGoogleSinPerfil(user) {
        if (!this.isGoogleUser(user)) {
            return await this.rejectAuth("usuario_no_autorizado");
        }

        try {
            const solicitud = await this.registrarSolicitudAcceso(user);
            const message = solicitud.status === "pending"
                ? ACCESS_REQUEST_PENDING_MESSAGE
                : ACCESS_REQUEST_SENT_MESSAGE;

            await this.logoutSeguro({ redirect: false, message });
            this.redirectToLogin();
            return null;
        } catch (error) {
            console.error("NO SE PUDO REGISTRAR SOLICITUD DE ACCESO:", error);
            await this.logoutSeguro({
                redirect: false,
                message: error.message || UNAUTHORIZED_ACCESS_MESSAGE
            });
            this.redirectToLogin();
            return null;
        }
    },

    async fetchProfileByUser(userOrId) {
        const userId = typeof userOrId === "string" ? userOrId : userOrId?.id;
        const queryDescription = 'window.kilvioSupabase.from("perfiles").select("*").eq("user_id", session.user.id).maybeSingle()';

        if (!userId) {
            throw this.createAuthError(UNAUTHORIZED_ACCESS_MESSAGE, "unauthorized");
        }

        const supabase = this.client;

        if (!supabase) {
            console.error("Cliente Supabase no disponible");
            throw this.createAuthError("Cliente Supabase no disponible", "validation");
        }

        const response = await supabase
            .from("perfiles")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();

        if (response.error) {
            const message = response.error.message || "Error consultando public.perfiles.";
            const isRlsError = /row-level security|rls|permission denied|policy/i.test(message);

            console.error("SUPABASE PERFIL ERROR EXACTO:", {
                code: response.error.code || null,
                details: response.error.details || null,
                hint: response.error.hint || null,
                message,
                status: response.status || null,
                statusText: response.statusText || null,
                user_id: userId,
                query: queryDescription
            });

            if (isRlsError) {
                throw this.createAuthError(message, "validation");
            }

            throw response.error;
        }

        return response.data || null;
    },

    async validarEstadoClienteSaas(profile) {
        if (!profile?.gimnasio_id || this.isSuperAdminSaas(profile)) {
            return { allowed: true };
        }

        try {
            const { data, error } = await this.client
                .from("gimnasios_clientes")
                .select("estado,nombre_gimnasio,fecha_vencimiento")
                .eq("gimnasio_id", profile.gimnasio_id)
                .maybeSingle();

            if (error) {
                console.warn("No se pudo validar estado SaaS del gimnasio. Se permite el acceso para no bloquear la migracion gradual.", error);
                return { allowed: true };
            }

            const estado = String(data?.estado || "activo").toLowerCase();

            if (["suspendido", "cancelado"].includes(estado)) {
                return { allowed: false, reason: "cuenta_suspendida" };
            }

            return { allowed: true };
        } catch (error) {
            console.warn("Validacion SaaS no disponible. Se permite el acceso temporalmente.", error);
            return { allowed: true };
        }
    },

    storeActiveUser() {
        if (!this.user || !this.profile) return;

        const usuarioActivo = {
            id: this.user.id,
            email: this.user.email,
            nombre: this.profile.nombre,
            gimnasio_id: this.profile.gimnasio_id,
            rol: this.profile.rol,
            permisos: this.profile.permisos || []
        };

        sessionStorage.setItem(this.sessionKey, JSON.stringify(usuarioActivo));
        sessionStorage.setItem("perfilActivo", JSON.stringify(this.profile));
        if (this.profile.gimnasio_id) {
            sessionStorage.setItem("gimnasio_id", String(this.profile.gimnasio_id));
        } else {
            sessionStorage.removeItem("gimnasio_id");
        }
        sessionStorage.setItem("rol", this.profile.rol);
    },

    getStoredActiveUser() {
        try {
            const raw = sessionStorage.getItem(this.sessionKey);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.warn("No se pudo leer usuario activo de sessionStorage", error);
            return null;
        }
    },

    getPermissions(profile = this.profile) {
        if (!profile) return [];
        return this.normalizePermissions(profile.permisos, profile.rol);
    },

    redirectToLogin(errorCode = "") {
        const target = errorCode
            ? `${this.loginPath()}?error=${encodeURIComponent(errorCode)}`
            : this.loginPath();
        window.location.href = target;
    },

    async rejectAuth(errorCode, options = {}) {
        const { clearAllStorage = false } = options;

        await this.logoutSeguro({ redirect: false });

        if (clearAllStorage) {
            localStorage.clear();
            sessionStorage.clear();
        }

        this.redirectToLogin(errorCode);
        return null;
    },

    async requireAuth() {
        document.body.dataset.authState = "checking";
        let validated = false;

        try {
            const supabase = this.client;

            if (!supabase) {
                console.error("Cliente Supabase no disponible");
                return await this.rejectAuth("supabase_no_disponible");
            }

            if (this.hasOAuthCallbackParams()) {
                await this.handleOAuthCallback();
            }

            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

            if (sessionError) {
                console.error("No se pudo validar la sesion actual", sessionError);
                return await this.rejectAuth("error_validacion");
            }

            const session = sessionData?.session || null;

            if (!session?.user?.id) {
                return await this.rejectAuth("sesion_expirada", { clearAllStorage: true });
            }

            if (!this.userHasVerifiedEmail(session.user)) {
                return await this.rejectAuth("email_no_verificado");
            }

            const { data: perfil, error } = await supabase
                .from("perfiles")
                .select("*")
                .eq("user_id", session.user.id)
                .maybeSingle();

            if (error) {
                console.error("ERROR VALIDANDO PERFIL:", error);
                return await this.rejectAuth("error_validacion");
            }

            if (!perfil) {
                return await this.rejectAuth("usuario_no_autorizado");
            }

            const estadoPerfil = String(perfil.estado || "").toLowerCase();

            if (estadoPerfil !== "activo") {
                try {
                    await supabase.auth.signOut();
                } catch (signOutError) {
                    console.warn("No se pudo cerrar la sesión remota del usuario inactivo", signOutError);
                }
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = "login.html?error=usuario_inactivo";
                return null;
            }

            const perfilNormalizado = this.normalizeProfile(perfil, session.user);

            if (!this.isSuperAdminSaas(perfilNormalizado) && !perfilNormalizado.gimnasio_id) {
                return await this.rejectAuth("usuario_no_autorizado");
            }

            const estadoCliente = await this.validarEstadoClienteSaas(perfilNormalizado);
            if (!estadoCliente.allowed) {
                return await this.rejectAuth(estadoCliente.reason || "cuenta_suspendida");
            }

            this.user = session.user;
            this.profile = perfilNormalizado;
            this.storeActiveUser();
            document.body.dataset.authState = "ready";
            this.startSessionSecurity();
            validated = true;
            return { user: this.user, profile: this.profile, session };
        } catch (error) {
            console.error("REQUIRE AUTH ERROR:", error);
            return await this.rejectAuth("error_validacion");
        } finally {
            if (!validated && document.body.dataset.authState === "checking") {
                document.body.dataset.authState = "blocked";
            }
        }
    },

    async protectRoute() {
        return this.requireAuth();
    },

    async redirectIfAuthenticated() {
        if (!this.client) return;

        if (this.hasOAuthCallbackParams()) {
            await this.handleOAuthCallback();
        }

        const { data, error } = await this.client.auth.getSession();
        const session = data?.session || null;

        if (error) {
            console.warn("No se pudo revisar la sesion activa", error);
            return;
        }

        if (session) {
            try {
                const user = await this.getCurrentUser();
                if (!user) {
                    await this.logoutSeguro({ redirect: false });
                    return;
                }
                await this.getCurrentProfile({ force: true });
                window.location.href = this.appPath();
            } catch (profileError) {
                console.error("SESION EXISTENTE SIN PERFIL VALIDO:", profileError);
                const message = profileError.authReason === "inactive"
                    ? INACTIVE_ACCESS_MESSAGE
                    : profileError.authReason === "suspended"
                        ? SUSPENDED_ACCOUNT_MESSAGE
                        : UNAUTHORIZED_ACCESS_MESSAGE;
                await this.logoutSeguro({ redirect: false, message });
                this.showAuthRuntimeError(message);
            }
        }
    },

    applyPermissions(profile = this.profile) {
        const permisos = this.getPermissions(profile).map(permission => this.normalizePermission(permission));
        const isAdmin = profile?.rol === "administrador";
        const isSuperAdminSaas = profile?.rol === "super_admin_saas";

        document.querySelectorAll(".menu-link[data-page]").forEach(link => {
            const page = this.normalizePermission(link.dataset.page);
            const allowed = page === "logout"
                || (isSuperAdminSaas ? page === "panel_michel_soft" : isAdmin || permisos.includes(page));

            link.classList.toggle("hidden", !allowed);
            link.setAttribute("aria-hidden", String(!allowed));
        });

        document.body.dataset.userRole = profile?.rol || "fallback";
    },

    canAccessPage(pageId, profile = this.profile) {
        const page = this.normalizePermission(pageId);
        if (page === "logout") return true;
        if (!profile) return false;
        if (profile.rol === "super_admin_saas") return page === "panel_michel_soft";
        if (!["administrador", "recepcion"].includes(profile.rol)) return false;
        if (profile.rol === "administrador") return DEFAULT_PERMISSIONS.includes(page);
        return this.getPermissions(profile).includes(page);
    },

    startSessionSecurity() {
        this.stopSessionSecurity();

        const events = ["click", "keydown", "mousemove", "touchstart", "scroll"];
        const reset = () => this.resetInactivityTimer();

        events.forEach(eventName => {
            window.addEventListener(eventName, reset, { passive: true });
        });

        this.sessionActivityHandler = reset;
        window.kilvioEstadoUsuarioInterval = window.setInterval(() => {
            this.verificarEstadoUsuarioActivo();
        }, 30 * 1000);
        this.sessionWatchTimer = window.kilvioEstadoUsuarioInterval;
        this.iniciarRealtimeEstadoUsuario().catch(error => {
            console.warn("No se pudo iniciar Realtime para el estado del usuario.", error);
        });
        this.resetInactivityTimer();
    },

    stopSessionSecurity() {
        if (this.sessionActivityHandler) {
            ["click", "keydown", "mousemove", "touchstart", "scroll"].forEach(eventName => {
                window.removeEventListener(eventName, this.sessionActivityHandler);
            });
        }

        if (this.inactivityTimer) window.clearTimeout(this.inactivityTimer);
        if (window.kilvioEstadoUsuarioInterval) {
            window.clearInterval(window.kilvioEstadoUsuarioInterval);
            window.kilvioEstadoUsuarioInterval = null;
        }

        if (this.perfilRealtimeChannel && this.client?.removeChannel) {
            this.client.removeChannel(this.perfilRealtimeChannel).catch(error => {
                console.warn("No se pudo cerrar el canal Realtime del perfil.", error);
            });
        }

        this.inactivityTimer = null;
        this.sessionWatchTimer = null;
        this.sessionActivityHandler = null;
        this.perfilRealtimeChannel = null;
        this.perfilRealtimeUserId = null;
    },

    resetInactivityTimer() {
        if (this.inactivityTimer) window.clearTimeout(this.inactivityTimer);

        const timeoutMs = Math.max(1, INACTIVITY_TIMEOUT_MINUTES) * 60 * 1000;
        this.inactivityTimer = window.setTimeout(() => {
            this.logoutSeguro({ redirect: true, message: `Sesion cerrada por inactividad (${INACTIVITY_TIMEOUT_MINUTES} min).` });
        }, timeoutMs);
    },

    async validateSessionStillActive() {
        if (!this.client) return;

        const { data, error } = await this.client.auth.getSession();
        const session = data?.session || null;

        if (error || !session?.access_token) {
            await this.logoutSeguro({ redirect: true, message: error ? SESSION_INVALID_MESSAGE : SESSION_EXPIRED_MESSAGE });
            return;
        }

        const expiresAt = Number(session.expires_at || 0) * 1000;
        if (expiresAt && expiresAt <= Date.now()) {
            await this.logoutSeguro({ redirect: true, message: SESSION_EXPIRED_MESSAGE });
        }
    },

    showAuthConfigurationWarning() {
        if (document.getElementById("authConfigWarning")) return;

        const warning = document.createElement("div");
        warning.id = "authConfigWarning";
        warning.className = "fixed bottom-4 right-4 z-[9999] max-w-sm rounded-xl bg-amber-100 border border-amber-300 px-4 py-3 text-sm text-amber-900 shadow-lg";
        warning.textContent = "Supabase no esta configurado. La app usa datos locales como fallback temporal.";
        document.body.appendChild(warning);
    },

    showAuthRuntimeError(message) {
        if (document.getElementById("authRuntimeError")) return;

        const warning = document.createElement("div");
        warning.id = "authRuntimeError";
        warning.className = "fixed bottom-4 right-4 z-[9999] max-w-md rounded-xl bg-red-100 border border-red-300 px-4 py-3 text-sm text-red-900 shadow-lg";
        warning.textContent = message;
        document.body.appendChild(warning);
    }
};

window.auth = auth;
window.login = (...args) => auth.login(...args);
window.loginConGoogle = () => auth.loginConGoogle();
window.logout = () => auth.logout();
window.getCurrentUser = () => auth.getCurrentUser();
window.getCurrentProfile = () => auth.getCurrentProfile();
window.requireAuth = () => auth.requireAuth();
window.protectRoute = () => auth.protectRoute();
window.logoutSeguro = (...args) => auth.logoutSeguro(...args);
window.applyPermissions = (...args) => auth.applyPermissions(...args);
window.verificarEstadoUsuarioActivo = () => auth.verificarEstadoUsuarioActivo();

document.addEventListener("DOMContentLoaded", () => {
    auth.bindLogoutButtons();
});
