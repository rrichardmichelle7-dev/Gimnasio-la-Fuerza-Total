/**
 * ============================================
 * CLIENTE SUPABASE - CONFIGURACIÓN SEGURA
 * ============================================
 * 
 * Este archivo configura la conexión a Supabase
 * La anon key es segura de exponer en frontend
 * porque se combina con RLS (Row Level Security)
 * 
 * TODO SECURITY: Nunca exponer la service_role_key en frontend
 * TODO SECURITY: Implementar autenticación antes de usar este cliente
 */

// TODO SECURITY: Reemplazar estas variables con tus credenciales de Supabase
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

let supabase = null;

/**
 * Inicializa el cliente de Supabase
 * Debe llamarse después de cargar la librería
 */
function initSupabase() {
    // TODO SECURITY: Verificar que estas son variables de entorno en producción
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error('TODO SECURITY: Credenciales de Supabase no configuradas');
        return false;
    }

    try {
        // Crear instancia del cliente
        // Esta llamada requiere que supabase-js esté cargado
        if (typeof window.supabase === 'undefined') {
            console.error('TODO SECURITY: Librería supabase-js no cargada');
            return false;
        }

        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        console.log('✓ Cliente Supabase inicializado');
        return true;
    } catch (error) {
        console.error('TODO SECURITY: Error al inicializar Supabase:', error);
        return false;
    }
}

/**
 * Configura listeners de autenticación
 * TODO SECURITY: IMPLEMENTAR ANTES DE PRODUCCIÓN
 * 
 * Este código debe ejecutarse antes de app.init()
 */
function setupAuthListener() {
    if (!supabase) return;

    // TODO SECURITY: Listener de cambios de autenticación
    supabase.auth.onAuthStateChanged((user) => {
        if (!user) {
            // Usuario no autenticado
            console.warn('TODO SECURITY: Usuario no autenticado');
            // TODO SECURITY: Mostrar panel de login
            // mostrarLoginPanel();
            // window.location.href = '/login';
            return;
        }

        // Usuario autenticado
        // TODO SECURITY: Cargar datos del usuario desde tabla profiles
        // const { data: profile } = await supabase
        //     .from('profiles')
        //     .select('*')
        //     .eq('id', user.id)
        //     .single();
        
        console.log('✓ Usuario autenticado:', user.id);
        
        // Inicializar app con ID del usuario
        // app.usuarioActualId = user.id;
        // app.init();
    });
}

/**
 * Funciones de utilidad para Supabase
 * TODO SECURITY: Agregar manejo de errores en todas las operaciones
 */

/**
 * Obtiene miembros del gimnasio actual (del usuario logueado)
 * TODO SECURITY: Solo retorna miembros que el usuario tiene permiso de ver (RLS)
 */
async function obtenerMiembros() {
    try {
        // TODO SECURITY: Reemplazar localStorage por fetch desde Supabase
        const { data, error } = await supabase
            .from('miembros')
            .select('*')
            .order('nombre', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('TODO SECURITY: Error al obtener miembros:', error.message);
        return [];
    }
}

/**
 * Guarda un nuevo miembro
 * TODO SECURITY: Validar datos en servidor mediante RLS
 */
async function crearMiembro(miembroData) {
    try {
        const { data, error } = await supabase
            .from('miembros')
            .insert([miembroData])
            .select();

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('TODO SECURITY: Error al crear miembro:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Obtiene pagos del gimnasio actual
 * TODO SECURITY: Solo retorna pagos visibles para el usuario (RLS)
 */
async function obtenerPagos() {
    try {
        const { data, error } = await supabase
            .from('pagos')
            .select('*')
            .order('fecha', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('TODO SECURITY: Error al obtener pagos:', error.message);
        return [];
    }
}

/**
 * Registra un nuevo pago
 * TODO SECURITY: Validar montos en servidor
 */
async function crearPago(pagoData) {
    try {
        // TODO SECURITY: No almacenar referencias de pago sensibles
        const { data, error } = await supabase
            .from('pagos')
            .insert([pagoData])
            .select();

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('TODO SECURITY: Error al crear pago:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Login con email y contraseña
 * TODO SECURITY: Usar Supabase Auth, no localStorage
 */
async function login(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;
        
        // TODO SECURITY: La sesión se maneja automáticamente
        return { success: true, user: data.user };
    } catch (error) {
        console.error('TODO SECURITY: Error en login:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Logout
 * TODO SECURITY: Limpiar localStorage y sesión
 */
async function logout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;

        // Limpiar datos locales
        localStorage.clear();
        
        // TODO SECURITY: Redirigir a login
        // window.location.href = '/login';
        
        return { success: true };
    } catch (error) {
        console.error('TODO SECURITY: Error en logout:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Registra un nuevo usuario
 * TODO SECURITY: Validar email en servidor
 */
async function registrar(email, password) {
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password
        });

        if (error) throw error;
        return { success: true, user: data.user };
    } catch (error) {
        console.error('TODO SECURITY: Error en registro:', error.message);
        return { success: false, error: error.message };
    }
}

// Exportar para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initSupabase,
        setupAuthListener,
        obtenerMiembros,
        crearMiembro,
        obtenerPagos,
        crearPago,
        login,
        logout,
        registrar
    };
}
