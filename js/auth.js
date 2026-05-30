// Kilvio FIT - Estructura base de autenticacion Supabase.
// TODO SUPABASE: conectar perfiles/permisos con tabla perfiles cuando el login quede activo en produccion.

const auth = {
    get client() {
        return window.kilvioSupabase || null;
    },

    async login(email, password) {
        if (!this.client) {
            return { success: false, error: "Supabase no esta configurado." };
        }

        const { data, error } = await this.client.auth.signInWithPassword({ email, password });

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true, user: data.user, session: data.session };
    },

    async logout() {
        if (!this.client) {
            localStorage.removeItem("usuarioActivo");
            return { success: true };
        }

        const { error } = await this.client.auth.signOut();

        if (error) {
            return { success: false, error: error.message };
        }

        localStorage.removeItem("usuarioActivo");
        sessionStorage.removeItem("kilvio_usuario_activo");
        return { success: true };
    },

    async getCurrentUser() {
        if (!this.client) return null;

        const { data, error } = await this.client.auth.getUser();

        if (error) {
            console.warn("No se pudo obtener el usuario actual:", error.message);
            return null;
        }

        return data.user || null;
    },

    async getCurrentSession() {
        if (!this.client) return null;

        const { data, error } = await this.client.auth.getSession();

        if (error) {
            console.warn("No se pudo obtener la sesion actual:", error.message);
            return null;
        }

        return data.session || null;
    }
};

window.auth = auth;
window.login = (...args) => auth.login(...args);
window.logout = () => auth.logout();
window.getCurrentUser = () => auth.getCurrentUser();
