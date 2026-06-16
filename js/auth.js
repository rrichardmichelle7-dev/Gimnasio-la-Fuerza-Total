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

const auth = {
    sessionKey: "kilvio_usuario_activo",
    loginErrorKey: "kilvio_login_error",
    profile: null,
    user: null,

    get client() {
        return window.kilvioSupabase || null;
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
        return `${window.location.origin}/html/index.html`;
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
            "kilvio_usuario_activo"
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
                query: 'window.kilvioSupabase.from("perfiles").select("*").eq("user_id", user.id).eq("estado", "activo").maybeSingle()'
            });
            throw this.createAuthError(UNAUTHORIZED_ACCESS_MESSAGE, "unauthorized");
        }

        this.profile = this.normalizeProfile(profile, user);

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

    async fetchProfileByUser(user) {
        const queryDescription = 'window.kilvioSupabase.from("perfiles").select("*").eq("user_id", user.id).eq("estado", "activo").maybeSingle()';

        const response = await window.kilvioSupabase
            .from("perfiles")
            .select("*")
            .eq("user_id", user.id)
            .eq("estado", "activo")
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
                user_id: user.id,
                email: user.email,
                query: queryDescription
            });

            if (isRlsError) {
                throw new Error(`RLS bloqueó la lectura del perfil activo en public.perfiles: ${message}`);
            }

            throw response.error;
        }

        if (response.data) {
            return response.data;
        }

        const diagnosticResponse = await window.kilvioSupabase
            .from("perfiles")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle();

        if (diagnosticResponse.error) {
            throw diagnosticResponse.error;
        }

        if (diagnosticResponse.data) {
            const estadoNormalizado = String(diagnosticResponse.data.estado || "").trim().toLowerCase();

            if (estadoNormalizado === "activo") {
                console.warn("PERFIL ENCONTRADO CON ESTADO NO NORMALIZADO. Recomendado ejecutar SQL para guardar estado = 'activo'.", {
                    estado_actual: diagnosticResponse.data.estado
                });
                return diagnosticResponse.data;
            }

            console.warn("PERFIL NO ACTIVO:", {
                user_id: user.id,
                email: user.email,
                estado: diagnosticResponse.data.estado || null
            });
            throw this.createAuthError(INACTIVE_ACCESS_MESSAGE, "inactive");
        }

        return null;
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

    async requireAuth() {
        document.body.dataset.authState = "checking";

        if (!this.client) {
            await this.logoutSeguro({ redirect: false });
            window.location.href = this.loginPath();
            return null;
        }

        const { data: sessionData, error: sessionError } = await this.client.auth.getSession();
        const session = sessionData?.session || null;

        if (sessionError) {
            console.warn("No se pudo validar la sesion actual", sessionError);
        }

        if (!session) {
            this.clearLocalAuthStorage();
            window.location.href = this.loginPath();
            return null;
        }

        const user = await this.getCurrentUser();

        if (!user) {
            await this.logoutSeguro({ redirect: false });
            window.location.href = this.loginPath();
            return null;
        }

        let profile = null;

        try {
            profile = await this.getCurrentProfile({ force: true });
        } catch (error) {
            console.error("No se pudo cargar el perfil del usuario.", error);
            const message = error.authReason === "inactive" ? INACTIVE_ACCESS_MESSAGE : UNAUTHORIZED_ACCESS_MESSAGE;
            await this.logoutSeguro({ redirect: false, message });
            window.location.href = this.loginPath();
            return null;
        }

        if (String(profile?.estado || "").toLowerCase() !== "activo") {
            await this.logoutSeguro({ redirect: false, message: INACTIVE_ACCESS_MESSAGE });
            window.location.href = this.loginPath();
            return null;
        }

        if (!profile.gimnasio_id) {
            await this.logoutSeguro({ redirect: false, message: UNAUTHORIZED_ACCESS_MESSAGE });
            window.location.href = this.loginPath();
            return null;
        }

        document.body.dataset.authState = "ready";
        return { user, profile, session };
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
