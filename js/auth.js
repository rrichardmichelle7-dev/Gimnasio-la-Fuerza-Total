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
    "reportes",
    "mensualidad",
    "configuracion"
];

const auth = {
    sessionKey: "kilvio_usuario_activo",
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

    normalizePermission(value) {
        return String(value || "").replaceAll("-", "_");
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

        this.user = data.user || null;
        this.profile = await this.getCurrentProfile({ force: true });
        this.storeActiveUser();

        return { user: this.user, profile: this.profile };
    },

    async logout() {
        if (this.client) {
            await this.client.auth.signOut();
        }

        this.user = null;
        this.profile = null;
        sessionStorage.removeItem(this.sessionKey);
        localStorage.removeItem("usuarioActivo");
        window.location.href = this.loginPath();
    },

    async getCurrentUser() {
        if (!this.client) return null;

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

        const { data, error } = await this.client
            .from("perfiles")
            .select("id,gimnasio_id,nombre,telefono,rol,estado,permisos")
            .eq("id", user.id)
            .single();

        if (error) {
            console.warn("No se pudo cargar el perfil del usuario", error);
            return null;
        }

        this.profile = data;
        this.storeActiveUser();
        return this.profile;
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
        localStorage.setItem("usuarioActivo", JSON.stringify({
            nombre: usuarioActivo.nombre,
            email: usuarioActivo.email,
            rol: usuarioActivo.rol
        }));
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
        if (profile.rol === "administrador") return DEFAULT_PERMISSIONS;
        if (Array.isArray(profile.permisos)) return profile.permisos;
        return [];
    },

    async protectRoute() {
        if (!this.client) {
            this.showAuthConfigurationWarning();
            return { user: null, profile: null, fallback: true };
        }

        const user = await this.getCurrentUser();

        if (!user) {
            window.location.href = this.loginPath();
            return null;
        }

        const profile = await this.getCurrentProfile();

        if (!profile || profile.estado !== "activo") {
            await this.logout();
            return null;
        }

        return { user, profile };
    },

    async redirectIfAuthenticated() {
        if (!this.client) return;

        const user = await this.getCurrentUser();

        if (user) {
            window.location.href = this.appPath();
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
    }
};

window.auth = auth;
window.login = (...args) => auth.login(...args);
window.logout = () => auth.logout();
window.getCurrentUser = () => auth.getCurrentUser();
window.getCurrentProfile = () => auth.getCurrentProfile();
window.protectRoute = () => auth.protectRoute();
window.applyPermissions = (...args) => auth.applyPermissions(...args);
