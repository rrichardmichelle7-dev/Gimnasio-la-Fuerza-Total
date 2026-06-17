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
    "configuracion"
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
        "cuadre_caja"
    ],
    entrenador: [
        "dashboard",
        "miembros",
        "asistencia"
    ]
};

const UNAUTHORIZED_ACCESS_MESSAGE = "Usuario no autorizado";
const INACTIVE_ACCESS_MESSAGE = "Usuario inactivo";
const ACCESS_REQUEST_SENT_MESSAGE = "Tu solicitud de acceso fue enviada. Espera aprobación del administrador.";
const ACCESS_REQUEST_PENDING_MESSAGE = "Tu solicitud de acceso está pendiente de aprobación.";

const auth = {
    sessionKey: "kilvio_usuario_activo",
    loginErrorKey: "kilvio_login_error",
    profile: null,
    user: null,

    get client() {
        return window.kilvioSupabase || window.supabaseClient || null;
    },

    isSupabaseReady() {
        return Boolean(this.client);
    },

    loginPath() {
        return "login.html";
    },

    appPath() {
        return "index.html";
    },

    googleRedirectUrl() {
        return `${window.location.origin}/index.html`;
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
        return ["administrador", "recepcion", "entrenador"].includes(rol) ? rol : "recepcion";
    },

    normalizePermissions(permisos, rol = "recepcion") {
        if (Array.isArray(permisos) && permisos.length > 0) {
            return permisos.map(permission => this.normalizePermission(permission));
        }

        if (typeof permisos === "string" && permisos.trim()) {
            try {
                const parsed = JSON.parse(permisos);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed.map(permission => this.normalizePermission(permission));
                }
            } catch (error) {
                return permisos
                    .split(",")
                    .map(permission => this.normalizePermission(permission))
                    .filter(Boolean);
            }
        }

        return ROLE_PERMISSIONS[this.normalizeRole(rol)] || ROLE_PERMISSIONS.recepcion;
    },

    normalizeProfile(profile, user) {
        const rol = this.normalizeRole(profile?.rol || user?.user_metadata?.rol);
        return {
            id: profile?.id || user?.id || null,
            user_id: profile?.user_id || user?.id || null,
            gimnasio_id: profile?.gimnasio_id || user?.user_metadata?.gimnasio_id || null,
            nombre: profile?.nombre || user?.user_metadata?.nombre || user?.email || "Usuario Kilvio FIT",
            telefono: profile?.telefono || user?.user_metadata?.telefono || "",
            rol,
            estado: String(profile?.estado || "activo").toLowerCase(),
            permisos: this.normalizePermissions(profile?.permisos, rol)
        };
    },

    buildFallbackProfile(user) {
        const metadata = user?.user_metadata || {};
        const rol = this.normalizeRole(metadata.rol || "recepcion");

        // TODO SECURITY: fallback temporal solo para desarrollo. En producción debe existir public.perfiles protegido con RLS.
        return this.normalizeProfile({
            id: user?.id || null,
            user_id: user?.id || null,
            gimnasio_id: metadata.gimnasio_id || null,
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

        try {
            this.user = data.user || null;
            this.profile = await this.getCurrentProfile({ force: true });
            this.storeActiveUser();
        } catch (profileError) {
            console.error("LOGIN PERFIL ERROR:", profileError);
            const message = profileError.authReason === "inactive" ? INACTIVE_ACCESS_MESSAGE : UNAUTHORIZED_ACCESS_MESSAGE;
            await this.logoutSeguro({ redirect: false });
            throw new Error(message);
        }

        return { user: this.user, profile: this.profile, session: data.session };
    },

    async loginConGoogle() {
        if (!this.client) {
            throw new Error("Supabase no esta configurado. Revisa SUPABASE_URL y SUPABASE_ANON_KEY.");
        }

        const { error } = await this.client.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: this.googleRedirectUrl()
            }
        });

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
            sessionStorage.removeItem(this.loginErrorKey);

            if (message) {
                sessionStorage.setItem(this.loginErrorKey, message);
            }

            if (redirect) {
                window.location.href = this.loginPath();
            }
        }
    },

    async getCurrentUser() {
        if (!this.client) return null;

        const { data: sessionData, error: sessionError } = await this.client.auth.getSession();
        const session = sessionData?.session || null;

        if (sessionError) {
            console.warn("No se pudo obtener la sesion actual", sessionError);
            return null;
        }

        if (!session) {
            this.user = null;
            return null;
        }

        const { data, error } = await this.client.auth.getUser();

        if (error) {
            console.warn("No se pudo obtener el usuario actual", error);
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

        if (!this.profile.gimnasio_id) {
            console.error("PERFIL SIN GIMNASIO_ID:", this.profile);
            throw this.createAuthError(UNAUTHORIZED_ACCESS_MESSAGE, "unauthorized");
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
        sessionStorage.setItem("gimnasio_id", String(this.profile.gimnasio_id));
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

    async rejectAuth(errorCode) {
        await this.logoutSeguro({ redirect: false });
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

            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

            if (sessionError) {
                console.error("No se pudo validar la sesion actual", sessionError);
                return await this.rejectAuth("error_validacion");
            }

            const session = sessionData?.session || null;

            if (!session?.user?.id) {
                this.clearLocalAuthStorage();
                this.redirectToLogin();
                return null;
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
                return await this.rechazarGoogleSinPerfil(session.user);
            }

            if (String(perfil.estado || "").trim().toLowerCase() !== "activo") {
                return await this.rejectAuth("usuario_inactivo");
            }

            if (!perfil.gimnasio_id) {
                return await this.rejectAuth("usuario_no_autorizado");
            }

            this.user = session.user;
            this.profile = this.normalizeProfile(perfil, session.user);
            this.storeActiveUser();
            document.body.dataset.authState = "ready";
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
                const message = profileError.authReason === "inactive" ? INACTIVE_ACCESS_MESSAGE : UNAUTHORIZED_ACCESS_MESSAGE;
                await this.logoutSeguro({ redirect: false, message });
                this.showAuthRuntimeError(message);
            }
        }
    },

    applyPermissions(profile = this.profile) {
        const permisos = this.getPermissions(profile).map(permission => this.normalizePermission(permission));
        const isAdmin = profile?.rol === "administrador";

        document.querySelectorAll(".menu-link[data-page]").forEach(link => {
            const page = this.normalizePermission(link.dataset.page);
            const allowed = isAdmin || page === "logout" || permisos.includes(page);

            link.classList.toggle("hidden", !allowed);
            link.setAttribute("aria-hidden", String(!allowed));
        });

        document.body.dataset.userRole = profile?.rol || "fallback";
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

document.addEventListener("DOMContentLoaded", () => {
    auth.bindLogoutButtons();
});
