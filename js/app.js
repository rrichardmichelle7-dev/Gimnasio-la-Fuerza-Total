/**
 * Sistema de Gestión de Gimnasio
 * Frontend preparado para conectar con backend/API en el futuro
 *
 * NOTA PARA BACKEND:
 * Este archivo usa arrays temporales y localStorage como fuente de datos.
 * Las funciones de carga y guardado concentran los puntos principales para
 * reemplazar localStorage por fetch/API sin cambiar la interfaz.
 */

const app = {
    // TODO BACKEND: mapear estas claves a recursos de API cuando exista backend.
    storageKeys: {
        miembros: "gimnasio_miembros",
        pagos: "gimnasio_pagos",
        productos: "gimnasio_productos",
        ingresosProductos: "gimnasio_ingresos_productos",
        ingresosDiarios: "gimnasio_ingresos_diarios",
        asistencias: "gimnasio_asistencias",
        usuarios: "gimnasio_usuarios",
        configuracionMensualidad: "gimnasio_configuracion_mensualidad",
        proveedores: "gimnasio_proveedores",
        comprasProveedores: "gimnasio_compras_proveedores",
        ventas: "gimnasio_ventas",
        movimientosInventario: "gimnasio_movimientos_inventario"
    },

    // Datos semilla temporales. TODO BACKEND: reemplazar por GET /api/miembros.
    miembros: [
        { id: 1, nombre: "Carlos Pérez", cedula: "001-0000000-1", telefono: "809-000-0001", estado: "activo", membresia: "mensual", fechaRegistro: "2026-04-01" },
        { id: 2, nombre: "María López", cedula: "001-0000000-2", telefono: "809-000-0002", estado: "activo", membresia: "mensual", fechaRegistro: "2026-04-01" },
        { id: 3, nombre: "Ana Martínez", cedula: "001-0000000-3", telefono: "809-000-0003", estado: "activo", membresia: "mensual", fechaRegistro: "2026-04-01" },
        { id: 4, nombre: "Pedro Santana", cedula: "001-0000000-4", telefono: "809-000-0004", estado: "activo", membresia: "pago-diario", fechaRegistro: "2026-04-01" }
    ],

    // Datos semilla temporales. TODO BACKEND: reemplazar por GET /api/pagos.
    pagos: [
        { id: 1, miembroId: 3, miembroNombre: "Ana Martínez", mes: "Abril 2026", monto: 750, estado: "Pagado", metodo: "Efectivo", referenciaPago: "", fecha: "2026-04-01" },
        { id: 2, miembroId: 4, miembroNombre: "Pedro Santana", mes: "Abril 2026", monto: 750, estado: "Pendiente", metodo: "", referenciaPago: "", fecha: "2026-04-01" },
        { id: 3, miembroId: 1, miembroNombre: "Carlos Pérez", mes: "Abril 2026", monto: 750, estado: "Pagado", metodo: "Tarjeta", referenciaPago: "TAR-001", fecha: "2026-04-01" }
    ],

    // Lista temporal hasta recibir el inventario real del gimnasio.
    // TODO SUPABASE: reemplazar por tabla `productos` filtrada por gimnasio_id.
    productos: [
        { id: 1, nombre: "Agua 500ml", categoria: "Bebidas", precio: 35, costo: 18, stock: 36, stockMinimo: 10, imagen: "../img/agua.png", estado: "Activo" },
        { id: 2, nombre: "Agua 1 litro", categoria: "Bebidas", precio: 50, costo: 25, stock: 24, stockMinimo: 8, imagen: "../img/agua.png", estado: "Activo" },
        { id: 3, nombre: "Gatorade Azul", categoria: "Bebidas", precio: 85, costo: 55, stock: 18, stockMinimo: 6, imagen: "../img/gatorade.png", estado: "Activo" },
        { id: 4, nombre: "Gatorade Naranja", categoria: "Bebidas", precio: 85, costo: 55, stock: 18, stockMinimo: 6, imagen: "../img/gatorade.png", estado: "Activo" },
        { id: 5, nombre: "Gatorade Fruit Punch", categoria: "Bebidas", precio: 85, costo: 55, stock: 18, stockMinimo: 6, imagen: "../img/gatorade.png", estado: "Activo" },
        { id: 6, nombre: "Powerade Azul", categoria: "Bebidas", precio: 80, costo: 50, stock: 16, stockMinimo: 6, imagen: "", estado: "Activo" },
        { id: 7, nombre: "Powerade Rojo", categoria: "Bebidas", precio: 80, costo: 50, stock: 16, stockMinimo: 6, imagen: "", estado: "Activo" },
        { id: 8, nombre: "Red Bull", categoria: "Bebidas", precio: 140, costo: 95, stock: 12, stockMinimo: 4, imagen: "", estado: "Activo" },
        { id: 9, nombre: "Bolón", categoria: "Snacks", precio: 65, costo: 35, stock: 20, stockMinimo: 6, imagen: "", estado: "Activo" },
        { id: 10, nombre: "Paleta de Chocolate", categoria: "Snacks", precio: 45, costo: 22, stock: 20, stockMinimo: 6, imagen: "", estado: "Activo" },
        { id: 11, nombre: "Paleta de Leche", categoria: "Snacks", precio: 45, costo: 22, stock: 20, stockMinimo: 6, imagen: "", estado: "Activo" },
        { id: 12, nombre: "Barra de Proteína", categoria: "Snacks", precio: 120, costo: 75, stock: 14, stockMinimo: 5, imagen: "", estado: "Activo" },
        { id: 13, nombre: "Maní", categoria: "Snacks", precio: 55, costo: 28, stock: 22, stockMinimo: 6, imagen: "", estado: "Activo" },
        { id: 14, nombre: "Granola", categoria: "Snacks", precio: 75, costo: 42, stock: 18, stockMinimo: 6, imagen: "", estado: "Activo" },
        { id: 15, nombre: "Galletas Fitness", categoria: "Snacks", precio: 90, costo: 48, stock: 16, stockMinimo: 5, imagen: "", estado: "Activo" },
        { id: 16, nombre: "Proteína Whey 1 lb", categoria: "Suplementos", precio: 1450, costo: 1050, stock: 8, stockMinimo: 3, imagen: "../img/proteina.png", estado: "Activo" },
        { id: 17, nombre: "Proteína Whey 5 lb", categoria: "Suplementos", precio: 5200, costo: 4100, stock: 5, stockMinimo: 2, imagen: "../img/proteina.png", estado: "Activo" },
        { id: 18, nombre: "Creatina Monohidratada", categoria: "Suplementos", precio: 1600, costo: 1150, stock: 8, stockMinimo: 3, imagen: "../img/creatina.png", estado: "Activo" },
        { id: 19, nombre: "BCAA", categoria: "Suplementos", precio: 1350, costo: 950, stock: 6, stockMinimo: 2, imagen: "", estado: "Activo" },
        { id: 20, nombre: "Pre Workout", categoria: "Suplementos", precio: 1800, costo: 1280, stock: 6, stockMinimo: 2, imagen: "", estado: "Activo" },
        { id: 21, nombre: "Omega 3", categoria: "Suplementos", precio: 950, costo: 650, stock: 10, stockMinimo: 3, imagen: "../img/omega.png", estado: "Activo" },
        { id: 22, nombre: "Multivitamínico", categoria: "Suplementos", precio: 900, costo: 620, stock: 10, stockMinimo: 3, imagen: "", estado: "Activo" },
        { id: 23, nombre: "L-Carnitina", categoria: "Suplementos", precio: 1250, costo: 870, stock: 7, stockMinimo: 2, imagen: "", estado: "Activo" },
        { id: 24, nombre: "Guantes", categoria: "Accesorios", precio: 650, costo: 390, stock: 10, stockMinimo: 3, imagen: "", estado: "Activo" },
        { id: 25, nombre: "Muñequeras", categoria: "Accesorios", precio: 350, costo: 180, stock: 14, stockMinimo: 4, imagen: "", estado: "Activo" },
        { id: 26, nombre: "Botellas Deportivas", categoria: "Accesorios", precio: 450, costo: 240, stock: 12, stockMinimo: 4, imagen: "", estado: "Activo" },
        { id: 27, nombre: "Toallas", categoria: "Accesorios", precio: 500, costo: 280, stock: 10, stockMinimo: 3, imagen: "", estado: "Activo" },
        { id: 28, nombre: "Bandas Elásticas", categoria: "Accesorios", precio: 550, costo: 310, stock: 8, stockMinimo: 3, imagen: "", estado: "Activo" }
    ],

    ingresosProductos: 0,
    ingresosDiarios: [],
    asistencias: [],
    usuarios: [],
    proveedores: [],
    comprasProveedores: [],
    ventas: [],
    movimientosInventario: [],
    carritoPOS: [],
    configuracionMensualidad: {
        mensualidadFija: 750,
        entradaDiaria: 40,
        estado: "Activo",
        nota: ""
    },
    miembroSeleccionado: null,
    supabase: null,
    supabaseConfigurado: false,

    // =============================
    // Inicialización
    // =============================

    init() {
        // TODO SECURITY: Sistema iniciado - Log removido por seguridad
        this.inicializarSupabase();

        this.cargarConfiguracionMensualidad();
        this.cargarDatos();
        this.cargarAsistencias();
        this.cargarUsuarios();
        this.cargarProveedores();
        this.cargarComprasProveedores();
        this.cargarVentas();
        this.cargarMovimientosInventario();
        this.configurarNavegacion();
        this.setFechaActual();
        this.configurarBotones();
        this.actualizarTablaMiembros();
        this.cargarSelectMiembrosPago();
        this.renderizarPagos();
        this.renderizarProductos();
        this.renderizarIngresosDiarios();
        this.renderizarAsistencia();
        this.renderizarReportes();
        this.renderizarUsuarios();
        this.renderizarMensualidad();
        this.renderizarProveedores();
        this.renderizarCompras();
        this.renderizarPOS();
        this.renderizarVentas();
        this.actualizarIndicadores();
        this.actualizarIndicadoresInventario();
    },
    inicializarSupabase() {
        this.supabase = window.kilvioSupabase || null;
        this.supabaseConfigurado = Boolean(this.supabase);

        if (this.supabaseConfigurado) {
            console.log("Supabase configurado: window.kilvioSupabase disponible.");
        }

        // TODO SUPABASE: migrar los modulos desde localStorage hacia consultas Supabase con RLS.
        return this.supabaseConfigurado;
    },

    // =============================
    // Persistencia temporal
    // =============================

    cargarDatos() {
        // TODO SUPABASE: localStorage queda como respaldo temporal mientras se migran los datos.
        // TODO SECURITY: CRÍTICA - localStorage no es seguro para datos personales/financieros
        // TODO SECURITY: Migrar a Supabase con Row Level Security (RLS)
        const miembrosGuardados = this.leerLocalStorage(this.storageKeys.miembros);
        const ingresosProductosGuardados = this.leerLocalStorage(this.storageKeys.ingresosProductos);
        this.cargarPagos();
        this.cargarProductos();
        this.cargarIngresosDiarios();

        if (typeof ingresosProductosGuardados === "number") {
            this.ingresosProductos = ingresosProductosGuardados;
        }

        if (Array.isArray(miembrosGuardados)) {
            this.miembros = miembrosGuardados.map(miembro => ({
                id: Number(miembro.id) || Date.now(),
                nombre: miembro.nombre || "",
                cedula: miembro.cedula || "",
                telefono: miembro.telefono || "",
                estado: miembro.estado || "activo",
                membresia: miembro.membresia || "mensual",
                fechaRegistro: miembro.fechaRegistro || new Date().toISOString().split("T")[0]
            }));
        }

    },

    leerLocalStorage(key) {
        // TODO BACKEND: reemplazar lectura local por fetch GET al endpoint correspondiente.
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.warn(`No se pudo leer ${key} desde localStorage`, error);
            return null;
        }
    },

    guardarMiembros() {
        // TODO BACKEND: reemplazar por POST/PUT/DELETE /api/miembros según la acción.
        try {
            localStorage.setItem(this.storageKeys.miembros, JSON.stringify(this.miembros));
        } catch (error) {
            console.warn("No se pudieron guardar los miembros en localStorage", error);
        }
    },

    guardarPagos() {
        // TODO BACKEND: reemplazar por POST /api/pagos y refrescar con GET /api/pagos.
        try {
            localStorage.setItem(this.storageKeys.pagos, JSON.stringify(this.pagos));
        } catch (error) {
            console.warn("No se pudieron guardar los pagos en localStorage", error);
        }
    },

    cargarPagos() {
        // TODO BACKEND: reemplazar localStorage por GET /api/pagos.
        const pagosGuardados = this.leerLocalStorage(this.storageKeys.pagos);

        if (!Array.isArray(pagosGuardados)) return;

        this.pagos = pagosGuardados.map(pago => ({
            id: Number(pago.id) || Date.now(),
            miembroId: Number(pago.miembroId),
            miembroNombre: pago.miembroNombre || "",
            mes: pago.mes || this.obtenerMesActual(),
            monto: Number(pago.monto) || 0,
            estado: pago.estado || "Pagado",
            metodo: pago.metodo || "",
            referenciaPago: pago.referenciaPago || "",
            fecha: pago.fecha || new Date().toISOString().split("T")[0]
        }));
    },

    cargarProductos() {
        // TODO BACKEND: reemplazar localStorage por GET /api/productos.
        const productosGuardados = this.leerLocalStorage(this.storageKeys.productos);
        const productosTemporales = [...this.productos];

        if (Array.isArray(productosGuardados)) {
            this.productos = productosGuardados.map(producto => ({
                id: Number(producto.id) || Date.now(),
                nombre: producto.nombre || "",
                categoria: producto.categoria || "Otros",
                precio: Number(producto.precio) || 0,
                costo: Number(producto.costo) || 0,
                stock: Number(producto.stock) || 0,
                stockMinimo: Number(producto.stockMinimo) || 5,
                imagen: producto.imagen || producto.imagen_url || "",
                estado: producto.estado || "Activo"
            }));

            productosTemporales.forEach(productoTemporal => {
                const existe = this.productos.some(producto =>
                    producto.nombre.toLowerCase() === productoTemporal.nombre.toLowerCase()
                );

                if (!existe) {
                    const idExiste = this.productos.some(producto => producto.id === productoTemporal.id);
                    this.productos.push({
                        ...productoTemporal,
                        id: idExiste ? Date.now() + productoTemporal.id : productoTemporal.id
                    });
                }
            });

            this.guardarProductos();
        }
    },

    guardarProductos() {
        // TODO BACKEND: reemplazar por POST/PUT/DELETE /api/productos según la acción.
        try {
            localStorage.setItem(this.storageKeys.productos, JSON.stringify(this.productos));
        } catch (error) {
            console.warn("No se pudieron guardar los productos en localStorage", error);
        }
    },

    guardarIngresosProductos() {
        // TODO BACKEND: consolidar ventas de productos en endpoint de ventas o caja diaria.
        try {
            localStorage.setItem(this.storageKeys.ingresosProductos, JSON.stringify(this.ingresosProductos));
        } catch (error) {
            console.warn("No se pudieron guardar los ingresos del inventario en localStorage", error);
        }
    },

    guardarIngresosDiarios() {
        // TODO BACKEND: reemplazar por POST /api/ingresos-diarios.
        try {
            this.ingresosDiarios = this.agruparIngresosDiarios(this.ingresosDiarios);
            localStorage.setItem(this.storageKeys.ingresosDiarios, JSON.stringify(this.ingresosDiarios));
        } catch (error) {
            console.warn("No se pudieron guardar los ingresos diarios en localStorage", error);
        }
    },

    cargarIngresosDiarios() {
        // TODO BACKEND: reemplazar localStorage por GET /api/ingresos-diarios.
        const ingresosDiariosGuardados = this.leerLocalStorage(this.storageKeys.ingresosDiarios);

        if (!Array.isArray(ingresosDiariosGuardados)) return;

        this.ingresosDiarios = this.agruparIngresosDiarios(ingresosDiariosGuardados);
        this.guardarIngresosDiarios();
    },

    cargarAsistencias() {
        // TODO BACKEND: reemplazar localStorage por GET /api/asistencias.
        const asistenciasGuardadas = this.leerLocalStorage(this.storageKeys.asistencias);

        if (!Array.isArray(asistenciasGuardadas)) return;

        this.asistencias = asistenciasGuardadas
            .map(asistencia => ({
                id: Number(asistencia.id) || Date.now(),
                miembroId: Number(asistencia.miembroId),
                fecha: asistencia.fecha || new Date().toISOString().split("T")[0],
                hora: asistencia.hora || "",
                estado: asistencia.estado || "Presente"
            }))
            .filter(asistencia => asistencia.miembroId);
    },

    guardarAsistencias() {
        // TODO BACKEND: reemplazar por POST /api/asistencias.
        try {
            localStorage.setItem(this.storageKeys.asistencias, JSON.stringify(this.asistencias));
        } catch (error) {
            console.warn("No se pudieron guardar las asistencias en localStorage", error);
        }
    },

    cargarUsuarios() {
        // TODO BACKEND: reemplazar por GET /api/usuarios. No usar localStorage para autenticación real.
        // TODO SECURITY: CRÍTICA - NUNCA guardar contraseñas en localStorage
        // TODO SECURITY: Reemplazar completamente con Supabase Auth cuando migre
        const usuariosGuardados = this.leerLocalStorage(this.storageKeys.usuarios);

        if (!Array.isArray(usuariosGuardados)) return;

        this.usuarios = usuariosGuardados.map(usuario => ({
            id: Number(usuario.id) || Date.now(),
            nombre: usuario.nombre || "",
            usuario: usuario.usuario || "",
            password: usuario.password || "",
            rol: usuario.rol || "Recepción",
            estado: usuario.estado || "Activo",
            permisos: Array.isArray(usuario.permisos) ? usuario.permisos : []
        }));
    },

    guardarUsuarios() {
        // TODO BACKEND: reemplazar por endpoints administrativos de usuarios; contraseñas deben hashearse en servidor.
        // TODO SECURITY: CRÍTICA - No guardar contraseñas en texto plano
        // TODO SECURITY: Usar Supabase Auth (auth.users) en su lugar
        try {
            localStorage.setItem(this.storageKeys.usuarios, JSON.stringify(this.usuarios));
        } catch (error) {
            console.warn("No se pudieron guardar los usuarios en localStorage", error);
        }
    },

    cargarConfiguracionMensualidad() {
        // TODO BACKEND: reemplazar localStorage por GET /api/configuracion/mensualidad.
        const configuracionGuardada = this.leerLocalStorage(this.storageKeys.configuracionMensualidad);

        if (!configuracionGuardada || typeof configuracionGuardada !== "object") return;

        this.configuracionMensualidad = {
            mensualidadFija: this.normalizarMonto(configuracionGuardada.mensualidadFija, 750),
            entradaDiaria: this.normalizarMonto(configuracionGuardada.entradaDiaria, 40),
            estado: configuracionGuardada.estado === "Inactivo" ? "Inactivo" : "Activo",
            nota: configuracionGuardada.nota || ""
        };
    },

    guardarConfiguracionMensualidad() {
        // TODO BACKEND: reemplazar por PUT /api/configuracion/mensualidad.
        try {
            localStorage.setItem(this.storageKeys.configuracionMensualidad, JSON.stringify(this.configuracionMensualidad));
        } catch (error) {
            console.warn("No se pudo guardar la configuración de mensualidad en localStorage", error);
        }
    },

    cargarProveedores() {
        // TODO SUPABASE: reemplazar por tabla `proveedores` filtrada por gimnasio_id.
        const proveedoresGuardados = this.leerLocalStorage(this.storageKeys.proveedores);

        if (Array.isArray(proveedoresGuardados)) {
            this.proveedores = proveedoresGuardados.map(proveedor => ({
                id: Number(proveedor.id) || Date.now(),
                nombre: proveedor.nombre || "",
                telefono: proveedor.telefono || "",
                email: proveedor.email || "",
                direccion: proveedor.direccion || "",
                productoPrincipal: proveedor.productoPrincipal || "",
                estado: proveedor.estado || "Activo",
                observaciones: proveedor.observaciones || ""
            }));
        }
    },

    guardarProveedores() {
        // TODO SUPABASE: reemplazar por upsert/delete en `proveedores`.
        try {
            localStorage.setItem(this.storageKeys.proveedores, JSON.stringify(this.proveedores));
        } catch (error) {
            console.warn("No se pudieron guardar los proveedores en localStorage", error);
        }
    },

    cargarComprasProveedores() {
        // TODO SUPABASE: reemplazar por tabla `compras_proveedores` filtrada por gimnasio_id.
        const comprasGuardadas = this.leerLocalStorage(this.storageKeys.comprasProveedores);

        if (Array.isArray(comprasGuardadas)) {
            this.comprasProveedores = comprasGuardadas.map(compra => ({
                id: Number(compra.id) || Date.now(),
                proveedorId: Number(compra.proveedorId),
                productoId: Number(compra.productoId),
                cantidad: Number(compra.cantidad) || 0,
                costoUnitario: Number(compra.costoUnitario) || 0,
                total: Number(compra.total) || 0,
                fecha: compra.fecha || new Date().toISOString().split("T")[0]
            }));
        }
    },

    guardarComprasProveedores() {
        // TODO SUPABASE: reemplazar por insert en `compras_proveedores`.
        try {
            localStorage.setItem(this.storageKeys.comprasProveedores, JSON.stringify(this.comprasProveedores));
        } catch (error) {
            console.warn("No se pudieron guardar las compras en localStorage", error);
        }
    },

    cargarVentas() {
        // TODO SUPABASE: reemplazar por tablas `ventas` y `venta_detalles` filtradas por gimnasio_id.
        const ventasGuardadas = this.leerLocalStorage(this.storageKeys.ventas);

        if (Array.isArray(ventasGuardadas)) {
            this.ventas = ventasGuardadas.map(venta => ({
                id: Number(venta.id) || Date.now(),
                numero: venta.numero || "",
                fecha: venta.fecha || new Date().toISOString().split("T")[0],
                usuario: venta.usuario || "Usuario demo",
                cliente: venta.cliente || "Cliente mostrador",
                metodoPago: venta.metodoPago || "Efectivo",
                referenciaPago: venta.referenciaPago || "",
                voucher: venta.voucher || "",
                subtotal: Number(venta.subtotal) || 0,
                total: Number(venta.total) || 0,
                detalles: Array.isArray(venta.detalles) ? venta.detalles : []
            }));
        }
    },

    guardarVentas() {
        // TODO SUPABASE: reemplazar por insert transaccional en `ventas` y `venta_detalles`.
        try {
            localStorage.setItem(this.storageKeys.ventas, JSON.stringify(this.ventas));
        } catch (error) {
            console.warn("No se pudieron guardar las ventas en localStorage", error);
        }
    },

    cargarMovimientosInventario() {
        // TODO SUPABASE: reemplazar por tabla `movimientos_inventario` filtrada por gimnasio_id.
        const movimientosGuardados = this.leerLocalStorage(this.storageKeys.movimientosInventario);

        if (Array.isArray(movimientosGuardados)) {
            this.movimientosInventario = movimientosGuardados;
        }
    },

    guardarMovimientosInventario() {
        // TODO SUPABASE: reemplazar por insert en `movimientos_inventario`.
        try {
            localStorage.setItem(this.storageKeys.movimientosInventario, JSON.stringify(this.movimientosInventario));
        } catch (error) {
            console.warn("No se pudieron guardar los movimientos de inventario en localStorage", error);
        }
    },

    guardarTodo() {
        this.guardarMiembros();
        this.guardarPagos();
        this.guardarProductos();
        this.guardarIngresosDiarios();
        this.guardarAsistencias();
        this.guardarUsuarios();
        this.guardarConfiguracionMensualidad();
        this.guardarProveedores();
        this.guardarComprasProveedores();
        this.guardarVentas();
        this.guardarMovimientosInventario();
    },

    // =============================
    // Navegación SPA y eventos base
    // =============================

    configurarNavegacion() {
        const links = document.querySelectorAll(".menu-link[data-page]");
        const pages = document.querySelectorAll(".page");

        const mostrarPagina = (pageId) => {
            const target = document.getElementById(pageId);

            if (!target) return;

            pages.forEach(page => {
                page.classList.add("hidden");
            });

            target.classList.remove("hidden");

            if (pageId === "reportes") {
                this.renderizarReportes();
            }

            if (pageId === "configuracion") {
                this.renderizarUsuarios();
            }

            if (pageId === "mensualidad") {
                this.renderizarMensualidad();
            }

            if (pageId === "pos") {
                this.renderizarPOS();
            }

            if (pageId === "proveedores") {
                this.renderizarProveedores();
            }

            if (pageId === "compras") {
                this.renderizarCompras();
            }

            if (pageId === "ventas") {
                this.renderizarVentas();
            }

            links.forEach(link => {
                const activo = link.dataset.page === pageId;

                link.classList.toggle("bg-purple-600", activo);
                link.classList.toggle("text-white", activo);
                link.classList.toggle("text-indigo-100", !activo);
            });
        };

        links.forEach(link => {
            link.addEventListener("click", (event) => {
                event.preventDefault();
                mostrarPagina(link.dataset.page);
            });
        });

        document.querySelectorAll("[data-page-shortcut]").forEach(link => {
            link.addEventListener("click", (event) => {
                event.preventDefault();
                mostrarPagina(link.dataset.pageShortcut);
            });
        });

        mostrarPagina("dashboard");
    },

    setFechaActual() {
        const hoy = new Date().toISOString().split("T")[0];
        const mesActual = hoy.slice(0, 7);
        const inicioMes = `${mesActual}-01`;

        const fechaPago = document.getElementById("fechaPagoRegistro");
        const fechaMiembro = document.getElementById("fechaMiembro");
        const fechaPagoPagina = document.getElementById("pagoFechaPagina");
        const fechaAsistencia = document.getElementById("fechaAsistencia");
        const reporteFechaDesde = document.getElementById("reporteFechaDesde");
        const reporteFechaHasta = document.getElementById("reporteFechaHasta");
        const mesPago = document.getElementById("mesPagoRegistro");
        const mesPagoPagina = document.getElementById("pagoMesPagina");

        if (fechaPago) fechaPago.value = hoy;
        if (fechaMiembro) fechaMiembro.value = hoy;
        if (fechaPagoPagina) fechaPagoPagina.value = hoy;
        if (fechaAsistencia) fechaAsistencia.value = hoy;
        if (reporteFechaDesde) reporteFechaDesde.value = inicioMes;
        if (reporteFechaHasta) reporteFechaHasta.value = hoy;
        if (mesPago) mesPago.value = mesActual;
        if (mesPagoPagina) mesPagoPagina.value = mesActual;
    },

    configurarBotones() {
        const btnEliminar = document.getElementById("btnEliminarMiembro");

        if (btnEliminar) {
            btnEliminar.addEventListener("click", () => {
                this.eliminarMiembroSeleccionado();
            });
        }

        const btnEditar = document.getElementById("btnAbrirEditarMiembroTabla");

        if (btnEditar) {
            btnEditar.addEventListener("click", () => {
                this.cargarMiembroEnModal();
            });
        }

        const btnNuevoProducto = document.getElementById("btnNuevoProducto");

        if (btnNuevoProducto) {
            btnNuevoProducto.addEventListener("click", () => {
                this.abrirModalProducto();
            });
        }

        const formProducto = document.getElementById("formProductoInventario");

        if (formProducto) {
            formProducto.addEventListener("submit", (event) => {
                event.preventDefault();
                this.guardarProductoDesdeFormulario();
            });
        }

        const buscarProducto = document.getElementById("buscarProducto");
        const filtroCategoria = document.getElementById("filtroCategoriaProducto");

        if (buscarProducto) {
            buscarProducto.addEventListener("input", () => {
                this.renderizarProductos();
            });
        }

        if (filtroCategoria) {
            filtroCategoria.addEventListener("change", () => {
                this.renderizarProductos();
            });
        }

        const buscarProductoPOS = document.getElementById("buscarProductoPOS");
        const metodoPagoPOS = document.getElementById("metodoPagoPOS");
        const btnCompletarVentaPOS = document.getElementById("btnCompletarVentaPOS");
        const formProveedor = document.getElementById("formProveedor");
        const formCompraProveedor = document.getElementById("formCompraProveedor");

        if (buscarProductoPOS) {
            buscarProductoPOS.addEventListener("input", () => this.renderizarPOSProductos());
        }

        if (metodoPagoPOS) {
            metodoPagoPOS.addEventListener("change", () => this.actualizarReferenciaPOS());
            this.actualizarReferenciaPOS();
        }

        if (btnCompletarVentaPOS) {
            btnCompletarVentaPOS.addEventListener("click", () => this.completarVentaPOS());
        }

        if (formProveedor) {
            formProveedor.addEventListener("submit", (event) => {
                event.preventDefault();
                this.guardarProveedorDesdeFormulario();
            });
        }

        if (formCompraProveedor) {
            formCompraProveedor.addEventListener("submit", (event) => {
                event.preventDefault();
                this.registrarCompraProveedor();
            });
        }

        const formRegistrarPagoPagina = document.getElementById("formRegistrarPagoPagina");
        const btnGenerarFacturaPagoPagina = document.getElementById("btnGenerarFacturaPagoPagina");
        const metodoPagoPagina = document.getElementById("pagoMetodoPagina");
        const filtrosPagos = [
            document.getElementById("filtroPagoMiembro"),
            document.getElementById("filtroPagoMes"),
            document.getElementById("filtroPagoEstado")
        ];

        if (formRegistrarPagoPagina) {
            formRegistrarPagoPagina.addEventListener("submit", (event) => {
                event.preventDefault();
                this.registrarPago(this.obtenerDatosPagoPagina(), { validarReferencia: true });
            });
        }

        if (btnGenerarFacturaPagoPagina) {
            btnGenerarFacturaPagoPagina.addEventListener("click", () => {
                this.registrarPago(this.obtenerDatosPagoPagina(), { abrirFactura: true, validarReferencia: true });
            });
        }

        if (metodoPagoPagina) {
            metodoPagoPagina.addEventListener("change", () => {
                this.actualizarReferenciaPagoRequerida();
            });
            this.actualizarReferenciaPagoRequerida();
        }

        filtrosPagos.forEach(filtro => {
            if (filtro) {
                filtro.addEventListener("change", () => {
                    this.renderizarPagos();
                });
            }
        });

        const cantidadIngresosDiarios = document.getElementById("cantidadIngresosDiarios");
        const btnRegistrarIngresoDiario = document.getElementById("btnRegistrarIngresoDiario");

        if (cantidadIngresosDiarios) {
            cantidadIngresosDiarios.addEventListener("input", () => {
                this.actualizarTotalIngresoDiarioPreview();
            });
        }

        if (btnRegistrarIngresoDiario) {
            btnRegistrarIngresoDiario.addEventListener("click", () => {
                this.registrarIngresoDiario();
            });
        }

        document.querySelectorAll('[data-modal-open="modalRegistrarPago"]').forEach(btn => {
            btn.addEventListener("click", () => {
                setTimeout(() => this.aplicarPreciosConfigurados(), 0);
            });
        });

        const fechaAsistencia = document.getElementById("fechaAsistencia");
        const buscarMiembroAsistencia = document.getElementById("buscarMiembroAsistencia");

        if (fechaAsistencia) {
            fechaAsistencia.addEventListener("change", () => {
                this.renderizarAsistencia();
            });
        }

        if (buscarMiembroAsistencia) {
            buscarMiembroAsistencia.addEventListener("input", () => {
                this.renderizarAsistencia();
            });
        }

        const btnGenerarReporte = document.getElementById("btnGenerarReporte");
        const btnExportarReporte = document.getElementById("btnExportarReporte");
        const formUsuarioSistema = document.getElementById("formUsuarioSistema");
        const btnCancelarEdicionUsuario = document.getElementById("btnCancelarEdicionUsuario");
        const formConfiguracionMensualidad = document.getElementById("formConfiguracionMensualidad");

        if (btnGenerarReporte) {
            btnGenerarReporte.addEventListener("click", () => {
                this.generarReporte();
            });
        }

        if (btnExportarReporte) {
            btnExportarReporte.addEventListener("click", () => {
                this.mostrarAlerta("info", "Exportación preparada para conectar con PDF o Excel.");
            });
        }

        if (formUsuarioSistema) {
            formUsuarioSistema.addEventListener("submit", (event) => {
                event.preventDefault();
                this.crearUsuario();
            });
        }

        if (btnCancelarEdicionUsuario) {
            btnCancelarEdicionUsuario.addEventListener("click", () => {
                this.limpiarFormularioUsuario();
            });
        }

        if (formConfiguracionMensualidad) {
            formConfiguracionMensualidad.addEventListener("submit", (event) => {
                event.preventDefault();
                this.guardarConfiguracionMensualidadDesdeFormulario();
            });
        }
    },

    // =============================
    // Miembros
    // =============================

    handleModalNuevoMiembro(data) {
        if (!data.nombreMiembro || !data.cedulaMiembro) {
            this.mostrarAlerta("error", "Completa el nombre y la cédula.");
            return;
        }

        // TODO SECURITY: Agregar validaciones de formato
        // TODO SECURITY: Validar cédula: /^\d{3}-?\d{7}-?\d{1}$/
        // TODO SECURITY: Validar nombre: /^[a-zA-Zá-úñ\s]{2,50}$/
        // TODO SECURITY: Validar teléfono: /^(\d{3}-?\d{3}-?\d{4}|\d{10})$/
        
        const cedulaExiste = this.miembros.some(m => m.cedula === data.cedulaMiembro);

        if (cedulaExiste) {
            this.mostrarAlerta("error", "Esta cédula ya está registrada.");
            return;
        }

        const nuevoMiembro = {
            id: Date.now(),
            nombre: data.nombreMiembro.trim(),
            cedula: data.cedulaMiembro.trim(),
            telefono: data.telefonoMiembro || "",
            estado: data.estadoMiembro || "activo",
            membresia: data.membresiaMiembro || "mensual",
            fechaRegistro: data.fechaMiembro || new Date().toISOString().split("T")[0]
        };

        this.miembros.push(nuevoMiembro);

        this.guardarMiembros();
        this.actualizarTablaMiembros();
        this.cargarSelectMiembrosPago();
        this.renderizarAsistencia();
        this.actualizarIndicadores();

        this.mostrarAlerta("exito", `Miembro ${nuevoMiembro.nombre} registrado correctamente.`);

        if (typeof modalManager !== "undefined") {
            modalManager.closeModal("modalNuevoMiembro");
        }
    },

    handleModalEditarMiembro(data) {
        if (!this.miembroSeleccionado) {
            this.mostrarAlerta("error", "Selecciona un miembro primero.");
            return;
        }

        if (!data.nombreEditarMiembro || !data.cedulaEditarMiembro) {
            this.mostrarAlerta("error", "Completa los campos requeridos.");
            return;
        }

        const index = this.miembros.findIndex(m => m.id === this.miembroSeleccionado.id);

        if (index === -1) {
            this.mostrarAlerta("error", "Miembro no encontrado.");
            return;
        }

        this.miembros[index] = {
            ...this.miembros[index],
            nombre: data.nombreEditarMiembro.trim(),
            cedula: data.cedulaEditarMiembro.trim(),
            telefono: data.telefonoEditarMiembro || "",
            estado: data.estadoEditarMiembro || "activo"
        };

        this.guardarMiembros();
        this.actualizarTablaMiembros();
        this.cargarSelectMiembrosPago();
        this.renderizarAsistencia();
        this.actualizarIndicadores();
        this.limpiarSeleccion();

        this.mostrarAlerta("exito", "Miembro actualizado correctamente.");

        if (typeof modalManager !== "undefined") {
            modalManager.closeModal("modalEditarMiembro");
        }
    },

    // =============================
    // Pagos y facturación
    // =============================

    handleModalRegistrarPago(data) {
        this.registrarPago({
            miembroId: data.miembroPagoRegistro,
            monto: data.montoPagoRegistro,
            mes: data.mesPagoRegistro,
            fecha: data.fechaPagoRegistro,
            metodo: data.metodoPagoRegistro,
            referenciaPago: data.referenciaPagoRegistro || ""
        });
    },

    obtenerDatosPagoPagina() {
        return {
            miembroId: document.getElementById("pagoMiembroPagina")?.value || "",
            monto: document.getElementById("pagoMontoPagina")?.value || "",
            mes: document.getElementById("pagoMesPagina")?.value || "",
            fecha: document.getElementById("pagoFechaPagina")?.value || "",
            metodo: document.getElementById("pagoMetodoPagina")?.value || "",
            referenciaPago: document.getElementById("pagoReferenciaPagina")?.value || ""
        };
    },

    actualizarReferenciaPagoRequerida() {
        const metodo = document.getElementById("pagoMetodoPagina")?.value || "";
        const referencia = document.getElementById("pagoReferenciaPagina");

        if (!referencia) return;

        const requerida = ["Tarjeta", "Transferencia"].includes(metodo);

        referencia.required = requerida;
        referencia.placeholder = requerida
            ? "Obligatorio para este método de pago"
            : "Opcional para pagos en efectivo";
    },

    registrarPago(data, opciones = {}) {
        const { abrirFactura = false, validarReferencia = false } = opciones;
        const referenciaPago = (data.referenciaPago || "").trim();

        if (!data.miembroId || !data.monto || !data.fecha || !data.metodo) {
            this.mostrarAlerta("error", "Completa todos los campos del pago.");
            return null;
        }

        if (validarReferencia && ["Tarjeta", "Transferencia"].includes(data.metodo) && !referenciaPago) {
            this.mostrarAlerta("error", "El No. de referencia / voucher es obligatorio para tarjeta o transferencia.");
            return null;
        }

        const monto = parseFloat(data.monto);

        if (isNaN(monto) || monto <= 0) {
            this.mostrarAlerta("error", "El monto debe ser mayor a cero.");
            return null;
        }

        // TODO SECURITY: Agregar validación de máximo monto
        // TODO SECURITY: if (monto > 100000) { mostrarAlerta("error", "Monto demasiado alto"); return null; }
        // TODO SECURITY: Esto previene entrada accidental de datos inconsistentes

        const miembroId = parseInt(data.miembroId);
        const miembro = this.miembros.find(m => m.id === miembroId);

        if (!miembro) {
            this.mostrarAlerta("error", "Miembro no encontrado.");
            return null;
        }

        const nuevoPago = {
            id: Date.now(),
            miembroId: miembro.id,
            miembroNombre: miembro.nombre,
            mes: data.mes ? this.formatearMes(data.mes) : this.obtenerMesActual(),
            monto,
            estado: "Pagado",
            metodo: data.metodo,
            referenciaPago,
            fecha: data.fecha
        };

        this.pagos.push(nuevoPago);

        this.guardarPagos();
        this.renderizarPagos();
        this.actualizarIndicadores();

        this.mostrarAlerta("exito", `Pago de RD$ ${monto.toFixed(2)} registrado para ${miembro.nombre}.`);

        if (abrirFactura) {
            this.abrirFactura(nuevoPago.id);
        }

        return nuevoPago;
    },

    actualizarTablaMiembros() {
        const tbody = document.getElementById("tablaMiembrosTbody");

        if (!tbody) {
            console.warn("No se encontró tablaMiembrosTbody");
            return;
        }

        tbody.innerHTML = "";

        this.miembros.forEach(miembro => {
            const estadoClase = miembro.estado === "activo"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700";

            const row = document.createElement("tr");
            row.className = "border-b cursor-pointer hover:bg-slate-50";
            row.dataset.id = miembro.id;

            row.innerHTML = `
                <td class="py-4 font-medium text-slate-800">${miembro.nombre}</td>
                <td class="py-4 text-slate-500">${miembro.cedula}</td>
                <td class="py-4 text-slate-500">${miembro.telefono}</td>
                <td class="py-4 text-slate-500">${this.formatearFecha(miembro.fechaRegistro)}</td>
                <td class="py-4">
                    <span class="${estadoClase} px-3 py-1 rounded-full text-xs font-semibold">
                        ${this.capitalizar(miembro.estado)}
                    </span>
                </td>
            `;

            row.addEventListener("click", () => {
                this.seleccionarMiembro(miembro.id, row);
            });

            tbody.appendChild(row);
        });
    },

    seleccionarMiembro(miembroId, row) {
        this.miembroSeleccionado = this.miembros.find(m => m.id === miembroId);

        document.querySelectorAll("#tablaMiembrosTbody tr").forEach(tr => {
            tr.classList.remove("bg-purple-50");
        });

        row.classList.add("bg-purple-50");

        const btnEditar = document.getElementById("btnAbrirEditarMiembroTabla");
        const btnEliminar = document.getElementById("btnEliminarMiembro");

        if (btnEditar) btnEditar.disabled = false;
        if (btnEliminar) btnEliminar.disabled = false;
    },

    cargarMiembroEnModal() {
        if (!this.miembroSeleccionado) {
            this.mostrarAlerta("error", "Selecciona un miembro primero.");
            return;
        }

        const miembro = this.miembroSeleccionado;

        this.setValue("miembroIdEditar", miembro.id);
        this.setValue("nombreEditarMiembro", miembro.nombre);
        this.setValue("cedulaEditarMiembro", miembro.cedula);
        this.setValue("telefonoEditarMiembro", miembro.telefono);
        this.setValue("estadoEditarMiembro", miembro.estado);
    },

    eliminarMiembroSeleccionado() {
        if (!this.miembroSeleccionado) {
            this.mostrarAlerta("error", "Selecciona un miembro primero.");
            return;
        }

        // TODO SECURITY: MEDIA - confirm() es fácil de ignorar
        // TODO SECURITY: Mejorar a modal con doble confirmación o contraseña
        const confirmar = confirm(`¿Seguro que deseas eliminar a ${this.miembroSeleccionado.nombre}?`);

        if (!confirmar) return;

        this.miembros = this.miembros.filter(m => m.id !== this.miembroSeleccionado.id);
        this.pagos = this.pagos.filter(p => p.miembroId !== this.miembroSeleccionado.id);
        this.asistencias = this.asistencias.filter(a => a.miembroId !== this.miembroSeleccionado.id);

        this.guardarTodo();
        this.actualizarTablaMiembros();
        this.actualizarTablaPagos();
        this.cargarSelectMiembrosPago();
        this.renderizarAsistencia();
        this.actualizarIndicadores();
        this.limpiarSeleccion();

        this.mostrarAlerta("exito", "Miembro eliminado correctamente.");
    },

    limpiarSeleccion() {
        this.miembroSeleccionado = null;

        document.querySelectorAll("#tablaMiembrosTbody tr").forEach(tr => {
            tr.classList.remove("bg-purple-50");
        });

        const btnEditar = document.getElementById("btnAbrirEditarMiembroTabla");
        const btnEliminar = document.getElementById("btnEliminarMiembro");

        if (btnEditar) btnEditar.disabled = true;
        if (btnEliminar) btnEliminar.disabled = true;
    },

    renderizarAsistencia() {
        const tbody = document.getElementById("tablaAsistenciaTbody");

        if (!tbody) return;

        const fechaInput = document.getElementById("fechaAsistencia");
        const fechaSeleccionada = fechaInput?.value || new Date().toISOString().split("T")[0];
        const busqueda = (document.getElementById("buscarMiembroAsistencia")?.value || "").trim().toLowerCase();

        if (fechaInput && !fechaInput.value) {
            fechaInput.value = fechaSeleccionada;
        }

        const miembrosActivos = this.miembros
            .filter(miembro => (miembro.estado || "").toLowerCase() === "activo")
            .filter(miembro => {
                if (!busqueda) return true;

                return String(miembro.nombre || "").toLowerCase().includes(busqueda)
                    || String(miembro.cedula || "").toLowerCase().includes(busqueda);
            });

        tbody.innerHTML = "";

        if (miembrosActivos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="py-8 text-center text-slate-500">
                        No hay miembros activos para mostrar.
                    </td>
                </tr>
            `;
            return;
        }

        miembrosActivos.forEach(miembro => {
            const asistencia = this.asistencias.find(item =>
                item.miembroId === miembro.id && item.fecha === fechaSeleccionada
            );
            const presente = asistencia?.estado === "Presente";
            const estadoClase = presente
                ? "bg-green-100 text-green-700"
                : "bg-orange-100 text-orange-700";
            const botonClase = presente
                ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                : "bg-purple-600 text-white hover:bg-purple-700";

            const row = document.createElement("tr");
            row.className = "border-b";
            row.innerHTML = `
                <td class="py-4">
                    <div class="font-medium text-slate-800">${this.escaparHtml(miembro.nombre)}</div>
                    ${asistencia?.hora ? `<div class="text-xs text-slate-400 mt-1">Hora: ${this.escaparHtml(asistencia.hora)}</div>` : ""}
                </td>
                <td class="py-4 text-slate-500">${this.escaparHtml(miembro.cedula)}</td>
                <td class="py-4">
                    <span class="${estadoClase} px-3 py-1 rounded-full text-xs font-semibold">
                        ${presente ? "Presente" : "Pendiente"}
                    </span>
                </td>
                <td class="py-4 text-right">
                    <button 
                        type="button"
                        data-miembro-id="${miembro.id}"
                        class="marcar-presente-btn ${botonClase} px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
                        ${presente ? "disabled" : ""}>
                        Marcar presente
                    </button>
                </td>
            `;

            // TODO SECURITY: MEDIA - Usar event listener en lugar de onclick inline
            const btn = row.querySelector('.marcar-presente-btn');
            if (btn) {
                btn.addEventListener('click', () => this.marcarPresente(miembro.id));
            }

            tbody.appendChild(row);
        });
    },

    marcarPresente(miembroId) {
        const miembro = this.miembros.find(item => item.id === Number(miembroId));

        if (!miembro || (miembro.estado || "").toLowerCase() !== "activo") {
            this.mostrarAlerta("error", "El miembro seleccionado no está activo.");
            return;
        }

        const fechaInput = document.getElementById("fechaAsistencia");
        const fecha = fechaInput?.value || new Date().toISOString().split("T")[0];
        const yaRegistrada = this.asistencias.some(item =>
            item.miembroId === miembro.id && item.fecha === fecha
        );

        if (yaRegistrada) {
            this.mostrarAlerta("info", "Este miembro ya fue marcado presente en esta fecha.");
            this.renderizarAsistencia();
            return;
        }

        this.asistencias.push({
            id: Date.now(),
            miembroId: miembro.id,
            fecha,
            hora: new Date().toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" }),
            estado: "Presente"
        });

        this.guardarAsistencias();
        this.renderizarAsistencia();
        this.mostrarAlerta("exito", `${miembro.nombre} marcado presente.`);
    },

    renderizarPagos() {
        const tbodyRecientes = document.getElementById("tablaPagosRecientesTbody");
        const tbodyHistorial = document.getElementById("tablaPagosHistorialTbody");

        const pagosRecientes = [...this.pagos].slice(-5).reverse();

        if (tbodyRecientes) {
            tbodyRecientes.innerHTML = "";

            pagosRecientes.forEach(pago => {
                const estadoClase = pago.estado === "Pagado"
                    ? "bg-green-100 text-green-700"
                    : "bg-orange-100 text-orange-700";

                const row = document.createElement("tr");
                row.className = "border-b";

                row.innerHTML = `
                    <td class="py-4 font-medium text-slate-800">${this.escaparHtml(pago.miembroNombre)}</td>
                    <td class="py-4 text-slate-500">${this.escaparHtml(pago.mes)}</td>
                    <td class="py-4 text-slate-500">RD$ ${pago.monto.toFixed(2)}</td>
                    <td class="py-4">
                        <span class="${estadoClase} px-3 py-1 rounded-full text-xs font-semibold">
                            ${this.escaparHtml(pago.estado)}
                        </span>
                    </td>
                    <td class="py-4">
                        <button 
                            type="button"
                            data-pago-id="${pago.id}"
                            class="ver-factura-btn text-purple-600 hover:text-purple-700 text-xs font-semibold transition-colors">
                            <i class="fa-solid fa-eye mr-1"></i> Ver
                        </button>
                    </td>
                `;

            // TODO SECURITY: MEDIA - Usar event listener en lugar de onclick inline
            const btnVer = row.querySelector('.ver-factura-btn');
            if (btnVer) {
                btnVer.addEventListener('click', () => this.abrirFactura(pago.id));
            }

                tbodyRecientes.appendChild(row);
            });
        }

        if (!tbodyHistorial) return;

        tbodyHistorial.innerHTML = "";

        const miembroFiltro = document.getElementById("filtroPagoMiembro")?.value || "todos";
        const mesFiltro = document.getElementById("filtroPagoMes")?.value || "";
        const estadoFiltro = document.getElementById("filtroPagoEstado")?.value || "todos";

        const pagosFiltrados = [...this.pagos]
            .filter(pago => {
                const coincideMiembro = miembroFiltro === "todos" || String(pago.miembroId) === miembroFiltro;
                const coincideMes = !mesFiltro || pago.mes === this.formatearMes(mesFiltro);
                const coincideEstado = estadoFiltro === "todos" || pago.estado === estadoFiltro;

                return coincideMiembro && coincideMes && coincideEstado;
            })
            .reverse();

        if (pagosFiltrados.length === 0) {
            tbodyHistorial.innerHTML = `
                <tr>
                    <td colspan="7" class="py-8 text-center text-slate-500">
                        No hay pagos para los filtros seleccionados.
                    </td>
                </tr>
            `;
            return;
        }

        pagosFiltrados.forEach(pago => {
            const estadoClase = pago.estado === "Pagado"
                ? "bg-green-100 text-green-700"
                : "bg-orange-100 text-orange-700";

            const row = document.createElement("tr");
            row.className = "border-b";

            row.innerHTML = `
                <td class="py-4 font-medium text-slate-800">${this.escaparHtml(pago.miembroNombre)}</td>
                <td class="py-4 text-slate-500">${this.escaparHtml(pago.mes)}</td>
                <td class="py-4 text-slate-500">RD$ ${pago.monto.toFixed(2)}</td>
                <td class="py-4 text-slate-500">${this.formatearFecha(pago.fecha)}</td>
                <td class="py-4 text-slate-500">${this.escaparHtml(pago.referenciaPago || "N/A")}</td>
                <td class="py-4">
                    <span class="${estadoClase} px-3 py-1 rounded-full text-xs font-semibold">
                        ${this.escaparHtml(pago.estado)}
                    </span>
                </td>
                <td class="py-4">
                    <button 
                        type="button"
                        data-pago-id="${pago.id}"
                        class="ver-factura-btn-historial text-purple-600 hover:text-purple-700 text-xs font-semibold transition-colors">
                        <i class="fa-solid fa-eye mr-1"></i> Ver
                    </button>
                </td>
            `;

            // TODO SECURITY: MEDIA - Usar event listener en lugar de onclick inline
            const btnVerHistorial = row.querySelector('.ver-factura-btn-historial');
            if (btnVerHistorial) {
                btnVerHistorial.addEventListener('click', () => this.abrirFactura(pago.id));
            }

            tbodyHistorial.appendChild(row);
        });
    },

    actualizarTablaPagos() {
        this.renderizarPagos();
    },

    // =============================
    // Inventario
    // =============================

    renderizarProductos() {
        const contenedor = document.getElementById("contenedorProductos");

        if (!contenedor) return;

        contenedor.innerHTML = "";

        const busqueda = (document.getElementById("buscarProducto")?.value || "").trim().toLowerCase();
        const categoria = document.getElementById("filtroCategoriaProducto")?.value || "todas";

        const productosFiltrados = this.productos.filter(producto => {
            const coincideBusqueda = producto.nombre.toLowerCase().includes(busqueda)
                || producto.categoria.toLowerCase().includes(busqueda);
            const coincideCategoria = categoria === "todas" || producto.categoria === categoria;

            return coincideBusqueda && coincideCategoria;
        });

        if (productosFiltrados.length === 0) {
            contenedor.innerHTML = `
                <div class="sm:col-span-2 xl:col-span-4 bg-white rounded-3xl p-10 shadow-sm border border-slate-200 text-center">
                    <i class="fa-solid fa-box-open text-4xl text-slate-300 mb-4"></i>
                    <h2 class="text-xl font-bold text-slate-900">No hay productos para mostrar</h2>
                    <p class="text-slate-500 mt-2">Agrega un producto o ajusta la búsqueda del inventario.</p>
                </div>
            `;
            return;
        }

        productosFiltrados.forEach(producto => {
            const stockBajo = producto.stock <= producto.stockMinimo;
            const sinStock = producto.stock <= 0;
            const inactivo = producto.estado === "Inactivo";
            const estadoTexto = inactivo ? "Inactivo" : stockBajo ? "Stock bajo" : "Disponible";
            const estadoClase = stockBajo
                ? "bg-orange-100 text-orange-700"
                : inactivo
                ? "bg-slate-100 text-slate-600"
                : "bg-green-100 text-green-700";
            const stockClase = stockBajo
                ? "bg-orange-100 text-orange-700"
                : producto.categoria === "Bebidas"
                ? "bg-blue-100 text-blue-700"
                : "bg-emerald-100 text-emerald-700";
            const iconoFallback = producto.categoria === "Bebidas"
                ? "fa-bottle-water"
                : producto.categoria === "Suplementos"
                ? "fa-capsules"
                : "fa-box";

            const card = document.createElement("article");
            card.className = "bg-white rounded-3xl p-6 shadow-sm border border-slate-200";
            card.innerHTML = `
                <div class="h-40 bg-slate-100 rounded-2xl flex items-center justify-center overflow-hidden mb-5">
                    <img src="${this.escaparHtml(producto.imagen)}" alt="${this.escaparHtml(producto.nombre)}" class="h-full w-full object-contain p-4" onerror="this.classList.add('hidden'); this.nextElementSibling.classList.remove('hidden');">
                    <i class="fa-solid ${iconoFallback} hidden text-5xl text-slate-400"></i>
                </div>
                <div class="space-y-2">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <h2 class="text-xl font-bold text-slate-900">${this.escaparHtml(producto.nombre)}</h2>
                            <p class="text-sm text-slate-500">${this.escaparHtml(producto.categoria)}</p>
                        </div>
                        <span class="${stockClase} px-3 py-1 rounded-full text-xs font-semibold">Stock ${producto.stock}</span>
                    </div>
                    <div class="flex items-center justify-between gap-3">
                        <p class="text-2xl font-bold text-purple-600">RD$ ${producto.precio.toLocaleString("es-DO")}</p>
                        <span class="${estadoClase} px-3 py-1 rounded-full text-xs font-semibold">${estadoTexto}</span>
                    </div>
                    <p class="text-xs text-slate-400">Costo: ${this.formatearMoneda(producto.costo || 0)} · Mínimo: ${producto.stockMinimo}</p>
                </div>
                <div class="grid grid-cols-2 gap-3 mt-6">
                    <button type="button" data-producto-vender="${producto.id}" class="bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" ${sinStock || inactivo ? "disabled" : ""}>Vender</button>
                    <button type="button" data-producto-editar="${producto.id}" class="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">Editar</button>
                    <button type="button" data-producto-eliminar="${producto.id}" class="col-span-2 bg-red-50 text-red-600 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors">Eliminar</button>
                </div>
            `;

            const vender = card.querySelector("[data-producto-vender]");
            if (vender) {
                vender.addEventListener("click", () => {
                    this.venderProducto(producto.id);
                });
            }

            const editar = card.querySelector("[data-producto-editar]");
            if (editar) {
                editar.addEventListener("click", () => {
                    this.abrirModalProducto(producto.id);
                });
            }

            const eliminar = card.querySelector("[data-producto-eliminar]");
            if (eliminar) {
                eliminar.addEventListener("click", () => {
                    this.eliminarProducto(producto.id);
                });
            }

            contenedor.appendChild(card);
        });
    },

    abrirModalProducto(productoId = null) {
        const producto = this.productos.find(item => item.id === productoId);
        const form = document.getElementById("formProductoInventario");

        if (form) form.reset();

        if (typeof modalManager !== "undefined") {
            modalManager.openModal("modalProductoInventario");
        }

        this.setText("modalProductoInventarioTitle", producto ? "Editar producto" : "Nuevo producto");
        this.setValue("productoIdInventario", producto?.id || "");
        this.setValue("nombreProductoInventario", producto?.nombre || "");
        this.setValue("categoriaProductoInventario", producto?.categoria || "Bebidas");
        this.setValue("precioProductoInventario", producto?.precio ?? "");
        this.setValue("costoProductoInventario", producto?.costo ?? "");
        this.setValue("stockProductoInventario", producto?.stock ?? "");
        this.setValue("stockMinimoProductoInventario", producto?.stockMinimo ?? 5);
        this.setValue("imagenProductoInventario", producto?.imagen || "");
        this.setValue("estadoProductoInventario", producto?.estado || "Activo");
    },

    guardarProductoDesdeFormulario() {
        const id = Number(document.getElementById("productoIdInventario")?.value);
        const nombre = (document.getElementById("nombreProductoInventario")?.value || "").trim();
        const categoria = document.getElementById("categoriaProductoInventario")?.value || "Otros";
        const precio = Number(document.getElementById("precioProductoInventario")?.value);
        const costo = Number(document.getElementById("costoProductoInventario")?.value);
        const stock = Number(document.getElementById("stockProductoInventario")?.value);
        const stockMinimo = Number(document.getElementById("stockMinimoProductoInventario")?.value);
        const imagen = (document.getElementById("imagenProductoInventario")?.value || "").trim();
        const estado = document.getElementById("estadoProductoInventario")?.value || "Activo";

        if (!nombre) {
            this.mostrarAlerta("error", "Completa el nombre del producto.");
            return;
        }

        if (isNaN(precio) || precio < 0 || isNaN(costo) || costo < 0 || isNaN(stock) || stock < 0 || isNaN(stockMinimo) || stockMinimo < 0) {
            this.mostrarAlerta("error", "Precio, costo, stock y stock mínimo deben ser valores válidos.");
            return;
        }

        if (id) {
            const index = this.productos.findIndex(producto => producto.id === id);

            if (index === -1) {
                this.mostrarAlerta("error", "Producto no encontrado.");
                return;
            }

            this.productos[index] = {
                ...this.productos[index],
                nombre,
                categoria,
                precio,
                costo,
                stock,
                stockMinimo,
                imagen,
                estado
            };

            this.mostrarAlerta("exito", "Producto actualizado correctamente.");
        } else {
            this.productos.push({
                id: Date.now(),
                nombre,
                categoria,
                precio,
                costo,
                stock,
                stockMinimo,
                imagen,
                estado
            });

            this.mostrarAlerta("exito", "Producto agregado correctamente.");
        }

        this.guardarProductos();
        this.renderizarProductos();
        this.actualizarIndicadoresInventario();

        if (typeof modalManager !== "undefined") {
            modalManager.closeModal("modalProductoInventario");
        }
    },

    venderProducto(productoId) {
        const producto = this.productos.find(item => item.id === productoId);

        if (!producto) {
            this.mostrarAlerta("error", "Producto no encontrado.");
            return;
        }

        if (producto.stock <= 0) {
            this.mostrarAlerta("error", "No hay stock disponible para este producto.");
            return;
        }

        producto.stock -= 1;
        this.ingresosProductos += producto.precio;
        this.registrarMovimientoInventario("salida", producto, 1, "Venta rápida inventario", `VR-${Date.now()}`);

        this.guardarProductos();
        this.guardarIngresosProductos();
        this.renderizarProductos();
        this.actualizarIndicadoresInventario();
        this.mostrarAlerta("exito", `Venta registrada: ${producto.nombre}.`);
    },

    eliminarProducto(productoId) {
        const producto = this.productos.find(item => item.id === productoId);

        if (!producto) {
            this.mostrarAlerta("error", "Producto no encontrado.");
            return;
        }

        const confirmar = confirm(`¿Seguro que deseas eliminar ${producto.nombre} del inventario?`);

        if (!confirmar) return;

        this.productos = this.productos.filter(item => item.id !== productoId);

        this.guardarProductos();
        this.renderizarProductos();
        this.actualizarIndicadoresInventario();
        this.mostrarAlerta("exito", "Producto eliminado correctamente.");
    },

    actualizarIndicadoresInventario() {
        const totalProductos = this.productos.length;
        const stockBajo = this.productos.filter(producto => producto.stock <= producto.stockMinimo).length;

        this.setText("totalProductos", totalProductos);
        this.setText("stockBajo", stockBajo);
        this.setText("ingresosProductos", `RD$ ${this.ingresosProductos.toLocaleString("es-DO")}`);
    },

    registrarMovimientoInventario(tipo, producto, cantidad, motivo, referencia = "") {
        this.movimientosInventario.push({
            id: Date.now() + Math.floor(Math.random() * 1000),
            tipo,
            productoId: producto.id,
            productoNombre: producto.nombre,
            cantidad,
            motivo,
            referencia,
            fecha: new Date().toISOString()
        });

        this.guardarMovimientosInventario();
    },

    cargarSelectsOperacionInventario() {
        const compraProveedor = document.getElementById("compraProveedor");
        const compraProducto = document.getElementById("compraProducto");

        if (compraProveedor) {
            compraProveedor.innerHTML = this.proveedores.length
                ? this.proveedores.map(proveedor => `<option value="${proveedor.id}">${this.escaparHtml(proveedor.nombre)}</option>`).join("")
                : `<option value="">Registra un proveedor primero</option>`;
        }

        if (compraProducto) {
            compraProducto.innerHTML = this.productos.map(producto =>
                `<option value="${producto.id}">${this.escaparHtml(producto.nombre)} - Stock ${producto.stock}</option>`
            ).join("");
        }
    },

    renderizarPOS() {
        this.renderizarPOSProductos();
        this.renderizarCarritoPOS();
        this.cargarSelectsOperacionInventario();
    },

    renderizarPOSProductos() {
        const contenedor = document.getElementById("posProductos");

        if (!contenedor) return;

        const busqueda = (document.getElementById("buscarProductoPOS")?.value || "").trim().toLowerCase();
        const productos = this.productos
            .filter(producto => producto.estado !== "Inactivo")
            .filter(producto =>
                !busqueda ||
                producto.nombre.toLowerCase().includes(busqueda) ||
                producto.categoria.toLowerCase().includes(busqueda)
            );

        if (productos.length === 0) {
            contenedor.innerHTML = `<p class="md:col-span-2 2xl:col-span-3 text-center text-slate-500 py-10">No hay productos disponibles para venta.</p>`;
            return;
        }

        contenedor.innerHTML = "";

        productos.forEach(producto => {
            const sinStock = producto.stock <= 0;
            const card = document.createElement("article");
            card.className = "border border-slate-200 rounded-2xl p-4";
            card.innerHTML = `
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <h3 class="font-bold text-slate-900">${this.escaparHtml(producto.nombre)}</h3>
                        <p class="text-xs text-slate-500">${this.escaparHtml(producto.categoria)} · Stock ${producto.stock}</p>
                    </div>
                    <strong class="text-purple-600">${this.formatearMoneda(producto.precio)}</strong>
                </div>
                <button type="button" class="w-full mt-4 bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50" ${sinStock ? "disabled" : ""}>
                    ${sinStock ? "Sin stock" : "Agregar"}
                </button>
            `;

            card.querySelector("button")?.addEventListener("click", () => this.agregarAlCarritoPOS(producto.id));
            contenedor.appendChild(card);
        });
    },

    agregarAlCarritoPOS(productoId) {
        const producto = this.productos.find(item => item.id === Number(productoId));

        if (!producto || producto.stock <= 0) {
            this.mostrarAlerta("error", "Producto sin stock disponible.");
            return;
        }

        const item = this.carritoPOS.find(linea => linea.productoId === producto.id);
        const cantidadActual = item ? item.cantidad : 0;

        if (cantidadActual + 1 > producto.stock) {
            this.mostrarAlerta("error", "No hay stock suficiente.");
            return;
        }

        if (item) {
            item.cantidad += 1;
        } else {
            this.carritoPOS.push({
                productoId: producto.id,
                nombre: producto.nombre,
                precio: producto.precio,
                cantidad: 1
            });
        }

        this.renderizarCarritoPOS();
    },

    cambiarCantidadCarritoPOS(productoId, delta) {
        const item = this.carritoPOS.find(linea => linea.productoId === Number(productoId));
        const producto = this.productos.find(producto => producto.id === Number(productoId));

        if (!item || !producto) return;

        const nuevaCantidad = item.cantidad + delta;

        if (nuevaCantidad <= 0) {
            this.eliminarDelCarritoPOS(productoId);
            return;
        }

        if (nuevaCantidad > producto.stock) {
            this.mostrarAlerta("error", "No hay stock suficiente.");
            return;
        }

        item.cantidad = nuevaCantidad;
        this.renderizarCarritoPOS();
    },

    eliminarDelCarritoPOS(productoId) {
        this.carritoPOS = this.carritoPOS.filter(item => item.productoId !== Number(productoId));
        this.renderizarCarritoPOS();
    },

    calcularTotalCarritoPOS() {
        return this.carritoPOS.reduce((total, item) => total + (item.precio * item.cantidad), 0);
    },

    renderizarCarritoPOS() {
        const contenedor = document.getElementById("posCarrito");
        const total = this.calcularTotalCarritoPOS();

        this.setText("posSubtotal", this.formatearMoneda(total));
        this.setText("posTotal", this.formatearMoneda(total));
        this.setText("posTotalHeader", this.formatearMoneda(total));

        if (!contenedor) return;

        if (this.carritoPOS.length === 0) {
            contenedor.innerHTML = `<p class="text-sm text-slate-500 py-6 text-center">Agrega productos al carrito.</p>`;
            return;
        }

        contenedor.innerHTML = "";

        this.carritoPOS.forEach(item => {
            const row = document.createElement("div");
            row.className = "py-4";
            row.innerHTML = `
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <p class="font-semibold text-slate-900">${this.escaparHtml(item.nombre)}</p>
                        <p class="text-xs text-slate-500">${this.formatearMoneda(item.precio)} x ${item.cantidad}</p>
                    </div>
                    <strong>${this.formatearMoneda(item.precio * item.cantidad)}</strong>
                </div>
                <div class="flex items-center gap-2 mt-3">
                    <button type="button" data-action="minus" class="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 font-bold">-</button>
                    <span class="w-8 text-center font-semibold">${item.cantidad}</span>
                    <button type="button" data-action="plus" class="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 font-bold">+</button>
                    <button type="button" data-action="remove" class="ml-auto text-xs text-red-600 font-semibold">Eliminar</button>
                </div>
            `;

            row.querySelector('[data-action="minus"]')?.addEventListener("click", () => this.cambiarCantidadCarritoPOS(item.productoId, -1));
            row.querySelector('[data-action="plus"]')?.addEventListener("click", () => this.cambiarCantidadCarritoPOS(item.productoId, 1));
            row.querySelector('[data-action="remove"]')?.addEventListener("click", () => this.eliminarDelCarritoPOS(item.productoId));
            contenedor.appendChild(row);
        });
    },

    actualizarReferenciaPOS() {
        const metodo = document.getElementById("metodoPagoPOS")?.value || "Efectivo";
        const wrap = document.getElementById("posReferenciaWrap");

        if (wrap) {
            wrap.classList.toggle("hidden", metodo === "Efectivo");
        }
    },

    completarVentaPOS() {
        if (this.carritoPOS.length === 0) {
            this.mostrarAlerta("error", "Agrega productos al carrito.");
            return;
        }

        const metodoPago = document.getElementById("metodoPagoPOS")?.value || "Efectivo";
        const referenciaPago = (document.getElementById("referenciaPagoPOS")?.value || "").trim();
        const voucher = (document.getElementById("voucherPagoPOS")?.value || "").trim();

        if (["Tarjeta", "Transferencia"].includes(metodoPago) && (!referenciaPago || !voucher)) {
            this.mostrarAlerta("error", "Referencia y voucher son obligatorios para tarjeta o transferencia.");
            return;
        }

        for (const item of this.carritoPOS) {
            const producto = this.productos.find(producto => producto.id === item.productoId);
            if (!producto || producto.stock < item.cantidad) {
                this.mostrarAlerta("error", `Stock insuficiente para ${item.nombre}.`);
                return;
            }
        }

        const total = this.calcularTotalCarritoPOS();
        const fecha = new Date().toISOString().split("T")[0];
        const venta = {
            id: Date.now(),
            numero: `PV-${String(this.ventas.length + 1).padStart(6, "0")}`,
            fecha,
            usuario: this.obtenerUsuarioRegistroActivo(),
            cliente: (document.getElementById("posCliente")?.value || "").trim() || "Cliente mostrador",
            metodoPago,
            referenciaPago,
            voucher,
            subtotal: total,
            total,
            detalles: this.carritoPOS.map(item => ({ ...item, total: item.precio * item.cantidad }))
        };

        venta.detalles.forEach(item => {
            const producto = this.productos.find(producto => producto.id === item.productoId);
            producto.stock -= item.cantidad;
            this.registrarMovimientoInventario("salida", producto, item.cantidad, "Venta POS", venta.numero);
        });

        this.ventas.push(venta);
        this.ingresosProductos += total;
        this.carritoPOS = [];

        this.guardarVentas();
        this.guardarProductos();
        this.guardarIngresosProductos();
        this.renderizarPOS();
        this.renderizarVentas();
        this.renderizarProductos();
        this.actualizarIndicadores();
        this.actualizarIndicadoresInventario();
        this.abrirReciboVenta(venta.id);
        this.mostrarAlerta("exito", "Venta completada correctamente.");
    },

    abrirReciboVenta(ventaId) {
        const venta = this.ventas.find(item => item.id === Number(ventaId));

        if (!venta) return;

        this.setText("facturaNumero", venta.numero);
        this.setText("facturaNumeroDetalle", venta.numero);
        this.setText("facturafecha", this.formatearFecha(venta.fecha));
        this.setText("facturavencimiento", this.formatearFecha(venta.fecha));
        this.setText("facturaCliente", venta.cliente);
        this.setText("facturaCedula", "N/A");
        this.setText("facturaMetodo", venta.metodoPago);
        this.setText("facturaReferencia", venta.referenciaPago || "N/A");
        this.setText("facturaDescripcion", venta.detalles.map(item => `${item.nombre} x${item.cantidad}`).join(", "));
        this.setText("facturaPrecio", this.formatearMoneda(venta.total));
        this.setText("facturaTotalLinea", this.formatearMoneda(venta.total));
        this.setText("facturaSubtotal", this.formatearMoneda(venta.subtotal));
        this.setText("facturaImpuesto", this.formatearMoneda(0));
        this.setText("facturaTotalFinal", this.formatearMoneda(venta.total));

        if (typeof modalManager !== "undefined") {
            modalManager.openModal("modalFactura");
        }
    },

    renderizarVentas() {
        const tbody = document.getElementById("tablaVentasTbody");
        const totalVentas = this.ventas.length;
        const totalIngresos = this.ventas.reduce((total, venta) => total + Number(venta.total || 0), 0);
        const unidades = this.ventas.reduce((total, venta) =>
            total + venta.detalles.reduce((subtotal, item) => subtotal + Number(item.cantidad || 0), 0), 0);

        this.setText("totalVentasRegistradas", totalVentas);
        this.setText("totalIngresosVentas", this.formatearMoneda(totalIngresos));
        this.setText("totalUnidadesVendidas", unidades);

        if (!tbody) return;

        if (this.ventas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-500">No hay ventas registradas.</td></tr>`;
            return;
        }

        tbody.innerHTML = "";

        [...this.ventas].reverse().forEach(venta => {
            const row = document.createElement("tr");
            row.className = "border-b";
            row.innerHTML = `
                <td class="py-4 font-semibold text-slate-800">${this.escaparHtml(venta.numero)}</td>
                <td class="py-4 text-slate-500">${this.formatearFecha(venta.fecha)}</td>
                <td class="py-4 text-slate-500">${this.escaparHtml(venta.cliente)}</td>
                <td class="py-4 text-slate-500">${this.escaparHtml(venta.metodoPago)}</td>
                <td class="py-4 font-bold text-slate-900">${this.formatearMoneda(venta.total)}</td>
                <td class="py-4"><button type="button" class="text-purple-600 text-xs font-semibold">Ver recibo</button></td>
            `;

            row.querySelector("button")?.addEventListener("click", () => this.abrirReciboVenta(venta.id));
            tbody.appendChild(row);
        });
    },

    renderizarProveedores() {
        const contenedor = document.getElementById("listaProveedores");

        this.cargarSelectsOperacionInventario();

        if (!contenedor) return;

        if (this.proveedores.length === 0) {
            contenedor.innerHTML = `<p class="md:col-span-2 text-center text-slate-500 py-10">No hay proveedores registrados.</p>`;
            return;
        }

        contenedor.innerHTML = this.proveedores.map(proveedor => `
            <article class="border border-slate-200 rounded-2xl p-4">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <h3 class="font-bold text-slate-900">${this.escaparHtml(proveedor.nombre)}</h3>
                        <p class="text-sm text-slate-500">${this.escaparHtml(proveedor.productoPrincipal || "Sin producto principal")}</p>
                    </div>
                    <span class="px-3 py-1 rounded-full text-xs font-semibold ${proveedor.estado === "Activo" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}">${this.escaparHtml(proveedor.estado)}</span>
                </div>
                <p class="text-sm text-slate-500 mt-3">${this.escaparHtml(proveedor.telefono || "Sin teléfono")}</p>
                <p class="text-sm text-slate-500">${this.escaparHtml(proveedor.email || "Sin email")}</p>
                <p class="text-xs text-slate-400 mt-3">${this.escaparHtml(proveedor.observaciones || "")}</p>
            </article>
        `).join("");
    },

    guardarProveedorDesdeFormulario() {
        const nombre = (document.getElementById("proveedorNombre")?.value || "").trim();

        if (!nombre) {
            this.mostrarAlerta("error", "El nombre del proveedor es obligatorio.");
            return;
        }

        this.proveedores.push({
            id: Date.now(),
            nombre,
            telefono: (document.getElementById("proveedorTelefono")?.value || "").trim(),
            email: (document.getElementById("proveedorEmail")?.value || "").trim(),
            direccion: (document.getElementById("proveedorDireccion")?.value || "").trim(),
            productoPrincipal: (document.getElementById("proveedorProductoPrincipal")?.value || "").trim(),
            estado: document.getElementById("proveedorEstado")?.value || "Activo",
            observaciones: (document.getElementById("proveedorObservaciones")?.value || "").trim()
        });

        document.getElementById("formProveedor")?.reset();
        this.guardarProveedores();
        this.renderizarProveedores();
        this.mostrarAlerta("exito", "Proveedor guardado correctamente.");
    },

    registrarCompraProveedor() {
        const proveedorId = Number(document.getElementById("compraProveedor")?.value);
        const productoId = Number(document.getElementById("compraProducto")?.value);
        const cantidad = Number(document.getElementById("compraCantidad")?.value);
        const costoUnitario = Number(document.getElementById("compraCostoUnitario")?.value);
        const fecha = document.getElementById("compraFecha")?.value || new Date().toISOString().split("T")[0];
        const producto = this.productos.find(item => item.id === productoId);
        const proveedor = this.proveedores.find(item => item.id === proveedorId);

        if (!proveedor || !producto || cantidad <= 0 || costoUnitario < 0) {
            this.mostrarAlerta("error", "Completa proveedor, producto, cantidad y costo.");
            return;
        }

        const compra = {
            id: Date.now(),
            proveedorId,
            productoId,
            cantidad,
            costoUnitario,
            total: cantidad * costoUnitario,
            fecha
        };

        producto.stock += cantidad;
        producto.costo = costoUnitario;
        this.comprasProveedores.push(compra);
        this.registrarMovimientoInventario("entrada", producto, cantidad, `Compra a ${proveedor.nombre}`, `CP-${compra.id}`);

        document.getElementById("formCompraProveedor")?.reset();
        this.guardarComprasProveedores();
        this.guardarProductos();
        this.renderizarCompras();
        this.renderizarProductos();
        this.renderizarPOS();
        this.actualizarIndicadoresInventario();
        this.mostrarAlerta("exito", "Compra registrada y stock actualizado.");
    },

    renderizarCompras() {
        const tbody = document.getElementById("tablaComprasTbody");

        this.cargarSelectsOperacionInventario();

        const fecha = document.getElementById("compraFecha");
        if (fecha && !fecha.value) fecha.value = new Date().toISOString().split("T")[0];

        if (!tbody) return;

        if (this.comprasProveedores.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-500">No hay compras registradas.</td></tr>`;
            return;
        }

        tbody.innerHTML = [...this.comprasProveedores].reverse().map(compra => {
            const proveedor = this.proveedores.find(item => item.id === compra.proveedorId);
            const producto = this.productos.find(item => item.id === compra.productoId);

            return `
                <tr class="border-b">
                    <td class="py-4 text-slate-500">${this.formatearFecha(compra.fecha)}</td>
                    <td class="py-4 font-medium text-slate-800">${this.escaparHtml(proveedor?.nombre || "Proveedor eliminado")}</td>
                    <td class="py-4 text-slate-500">${this.escaparHtml(producto?.nombre || "Producto eliminado")}</td>
                    <td class="py-4 text-slate-500">${compra.cantidad}</td>
                    <td class="py-4 font-bold text-slate-900">${this.formatearMoneda(compra.total)}</td>
                </tr>
            `;
        }).join("");
    },

    // =============================
    // Ingresos diarios
    // =============================

    actualizarTotalIngresoDiarioPreview() {
        const cantidadInput = document.getElementById("cantidadIngresosDiarios");
        const cantidad = Math.max(1, Number(cantidadInput?.value) || 1);
        const total = cantidad * this.obtenerEntradaDiaria();

        if (cantidadInput && Number(cantidadInput.value) !== cantidad) {
            cantidadInput.value = cantidad;
        }

        this.setText("totalIngresoDiarioPreview", `RD$ ${total.toLocaleString("es-DO")}`);
    },

    registrarIngresoDiario() {
        const cantidadInput = document.getElementById("cantidadIngresosDiarios");
        const cantidad = Math.max(1, Number(cantidadInput?.value) || 1);
        const total = cantidad * this.obtenerEntradaDiaria();
        const fechaHoy = new Date().toISOString().split("T")[0];
        const ingresoDelDia = this.ingresosDiarios.find(ingreso => ingreso.fecha === fechaHoy);

        if (ingresoDelDia) {
            ingresoDelDia.cantidad += cantidad;
            ingresoDelDia.total = Number(ingresoDelDia.total || 0) + total;
        } else {
            this.ingresosDiarios.push({
                id: Date.now(),
                fecha: fechaHoy,
                cantidad,
                total
            });
        }

        if (cantidadInput) cantidadInput.value = 1;

        this.guardarIngresosDiarios();
        this.actualizarTotalIngresoDiarioPreview();
        this.renderizarIngresosDiarios();
        this.actualizarIndicadores();
        this.renderizarReportes();
        this.mostrarAlerta("exito", `Ingreso diario registrado por RD$ ${total.toLocaleString("es-DO")}.`);
    },

    renderizarIngresosDiarios() {
        const tbody = document.getElementById("tablaIngresosDiariosTbody");

        if (!tbody) return;

        this.ingresosDiarios = this.agruparIngresosDiarios(this.ingresosDiarios);
        tbody.innerHTML = "";

        if (this.ingresosDiarios.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" class="py-8 text-center text-slate-500">
                        No hay ingresos diarios registrados.
                    </td>
                </tr>
            `;
            this.actualizarTotalIngresoDiarioPreview();
            return;
        }

        [...this.ingresosDiarios]
            .sort((a, b) => b.fecha.localeCompare(a.fecha))
            .forEach(ingreso => {
                const row = document.createElement("tr");
                row.className = "border-b";
                row.innerHTML = `
                    <td class="py-4 text-slate-600">${this.formatearFecha(ingreso.fecha)}</td>
                    <td class="py-4 font-medium text-slate-800">${ingreso.cantidad}</td>
                    <td class="py-4 font-bold text-purple-600">RD$ ${ingreso.total.toLocaleString("es-DO")}</td>
                `;
                tbody.appendChild(row);
            });

        this.actualizarTotalIngresoDiarioPreview();
    },

    agruparIngresosDiarios(ingresos = []) {
        const ingresosPorFecha = new Map();
        const hoy = new Date().toISOString().split("T")[0];
        const precioEntrada = this.obtenerEntradaDiaria();

        ingresos.forEach((ingreso, index) => {
            const fecha = String(ingreso.fecha || hoy).slice(0, 10);
            const cantidadDesdeTotal = Math.floor((Number(ingreso.total) || 0) / precioEntrada);
            const cantidad = Math.max(0, Number(ingreso.cantidad) || cantidadDesdeTotal);
            const total = Number(ingreso.total) || cantidad * precioEntrada;

            if (!fecha || cantidad <= 0) return;

            const existente = ingresosPorFecha.get(fecha) || {
                id: Number(ingreso.id) || Date.now() + index,
                fecha,
                cantidad: 0,
                total: 0
            };

            existente.cantidad += cantidad;
            existente.total += total;
            ingresosPorFecha.set(fecha, existente);
        });

        return [...ingresosPorFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
    },

    // =============================
    // Selects compartidos y factura
    // =============================

    cargarSelectMiembrosPago() {
        const selectsPago = [
            document.getElementById("miembroPagoRegistro"),
            document.getElementById("pagoMiembroPagina")
        ];
        const filtroPagoMiembro = document.getElementById("filtroPagoMiembro");

        selectsPago.forEach(select => {
            if (!select) return;

            select.innerHTML = `<option value="">-- Seleccionar miembro --</option>`;

            this.miembros.forEach(miembro => {
                const option = document.createElement("option");
                option.value = miembro.id;
                option.textContent = miembro.nombre;
                select.appendChild(option);
            });
        });

        if (filtroPagoMiembro) {
            filtroPagoMiembro.innerHTML = `<option value="todos">Todos los miembros</option>`;

            this.miembros.forEach(miembro => {
                const option = document.createElement("option");
                option.value = miembro.id;
                option.textContent = miembro.nombre;
                filtroPagoMiembro.appendChild(option);
            });
        }
    },

    abrirFactura(pagoId) {
        const pago = this.pagos.find(p => p.id === pagoId);

        if (!pago) {
            this.mostrarAlerta("error", "Factura no encontrada.");
            return;
        }

        this.actualizarContenidoFactura(pago);

        if (typeof modalManager !== "undefined") {
            modalManager.openModal("modalFactura");
        }
    },

    actualizarContenidoFactura(pago) {
        const miembro = this.miembros.find(m => m.id === pago.miembroId);
        const facturaNumero = `#${String(pago.id).padStart(3, "0")}`;
        const monto = `RD$ ${pago.monto.toFixed(2)}`;

        this.setText("facturaNumero", facturaNumero);
        this.setText("facturaNumeroDetalle", facturaNumero);
        this.setText("facturafecha", this.formatearFecha(pago.fecha));
        this.setText("facturavencimiento", this.calcularVencimiento(pago.fecha));
        this.setText("facturaCliente", pago.miembroNombre);
        this.setText("facturaCedula", miembro?.cedula || "N/A");
        this.setText("facturaMetodo", pago.metodo || "N/A");
        this.setText("facturaReferencia", pago.referenciaPago || "N/A");
        this.setText("facturaDescripcion", `Membresía ${pago.mes}`);
        this.setText("facturaPrecio", monto);
        this.setText("facturaTotalLinea", monto);
        this.setText("facturaSubtotal", monto);
        this.setText("facturaTotalFinal", monto);
    },

    // =============================
    // Mensualidad
    // =============================

    renderizarMensualidad() {
        const mensualidadFija = this.obtenerMensualidadFija();
        const entradaDiaria = this.obtenerEntradaDiaria();
        const estado = this.configuracionMensualidad.estado || "Activo";
        const nota = this.configuracionMensualidad.nota || "";

        this.setValue("configMensualidadFija", mensualidadFija);
        this.setValue("configEntradaDiaria", entradaDiaria);
        this.setValue("configEstadoMensualidad", estado);
        this.setValue("configNotaMensualidad", nota);
        this.setText("resumenMensualidadFija", this.formatearMoneda(mensualidadFija));
        this.setText("resumenEntradaDiaria", this.formatearMoneda(entradaDiaria));
        this.setText("resumenEstadoMensualidad", estado);
        this.setText("resumenNotaMensualidad", nota || "Sin nota registrada.");
        this.setText("entradaDiariaTexto", this.formatearMoneda(entradaDiaria));

        const estadoResumen = document.getElementById("resumenEstadoMensualidad");

        if (estadoResumen) {
            estadoResumen.classList.toggle("text-green-600", estado === "Activo");
            estadoResumen.classList.toggle("text-red-600", estado === "Inactivo");
        }

        this.aplicarPreciosConfigurados();
        this.actualizarTotalIngresoDiarioPreview();
    },

    guardarConfiguracionMensualidadDesdeFormulario() {
        const mensualidadFija = this.normalizarMonto(document.getElementById("configMensualidadFija")?.value, 0);
        const entradaDiaria = this.normalizarMonto(document.getElementById("configEntradaDiaria")?.value, 0);
        const estado = document.getElementById("configEstadoMensualidad")?.value || "Activo";
        const nota = (document.getElementById("configNotaMensualidad")?.value || "").trim();

        if (mensualidadFija <= 0 || entradaDiaria <= 0) {
            this.mostrarAlerta("error", "Los montos deben ser mayores que cero.");
            return;
        }

        this.configuracionMensualidad = {
            mensualidadFija,
            entradaDiaria,
            estado: estado === "Inactivo" ? "Inactivo" : "Activo",
            nota
        };

        this.guardarConfiguracionMensualidad();
        this.renderizarMensualidad();
        this.renderizarReportes();
        this.mostrarAlerta("exito", "Configuración de mensualidad guardada correctamente.");
    },

    aplicarPreciosConfigurados() {
        const mensualidadFija = this.obtenerMensualidadFija();

        this.setValue("pagoMontoPagina", mensualidadFija.toFixed(2));
        this.setValue("montoPagoRegistro", mensualidadFija.toFixed(2));
    },

    obtenerMensualidadFija() {
        return this.normalizarMonto(this.configuracionMensualidad.mensualidadFija, 750);
    },

    obtenerEntradaDiaria() {
        return this.normalizarMonto(this.configuracionMensualidad.entradaDiaria, 40);
    },

    // =============================
    // Reportes
    // =============================

    renderizarReportes() {
        this.generarReporte({ silencioso: true });
    },

    generarReporte(opciones = {}) {
        const { silencioso = false } = opciones;
        const fechaDesde = document.getElementById("reporteFechaDesde")?.value || "";
        const fechaHasta = document.getElementById("reporteFechaHasta")?.value || "";

        if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
            this.mostrarAlerta("error", "La fecha desde no puede ser mayor que la fecha hasta.");
            return null;
        }

        const miembrosActivos = this.miembros.filter(miembro => (miembro.estado || "").toLowerCase() === "activo").length;
        const totalPagosMensuales = this.pagos
            .filter(pago => pago.estado === "Pagado" && this.fechaEnRango(pago.fecha, fechaDesde, fechaHasta))
            .reduce((total, pago) => total + Number(pago.monto || 0), 0);
        const pagosPendientes = this.pagos.filter(pago => pago.estado === "Pendiente").length;
        const ingresosDiarios = this.ingresosDiarios
            .filter(ingreso => this.fechaEnRango(ingreso.fecha, fechaDesde, fechaHasta))
            .reduce((total, ingreso) => total + Number(ingreso.total || 0), 0);
        const ventasProductos = Number(this.ingresosProductos) || 0;
        const stockBajo = this.calcularStockBajo();
        const asistenciasMes = this.asistencias
            .filter(asistencia => asistencia.estado === "Presente" && this.fechaEnRango(asistencia.fecha, fechaDesde, fechaHasta))
            .length;
        const ingresosTotales = this.calcularIngresosTotales(fechaDesde, fechaHasta);
        const periodo = fechaDesde || fechaHasta
            ? `${fechaDesde || "Inicio"} - ${fechaHasta || "Hoy"}`
            : "Periodo completo";

        this.setText("reporteMiembrosActivos", miembrosActivos);
        this.setText("reporteTotalPagosMensuales", `RD$ ${totalPagosMensuales.toLocaleString("es-DO")}`);
        this.setText("reportePagosPendientes", pagosPendientes);
        this.setText("reporteIngresosDiarios", `RD$ ${ingresosDiarios.toLocaleString("es-DO")}`);
        this.setText("reporteVentasProductos", `RD$ ${ventasProductos.toLocaleString("es-DO")}`);
        this.setText("reporteStockBajo", stockBajo);
        this.setText("reporteAsistenciasMes", asistenciasMes);
        this.setText("reporteIngresosTotales", `RD$ ${ingresosTotales.toLocaleString("es-DO")}`);

        const filas = [
            { indicador: "Miembros activos", valor: miembrosActivos, detalle: "Miembros actualmente activos" },
            { indicador: "Total pagos mensuales", valor: `RD$ ${totalPagosMensuales.toLocaleString("es-DO")}`, detalle: periodo },
            { indicador: "Pagos pendientes", valor: pagosPendientes, detalle: "Pagos marcados como pendientes" },
            { indicador: "Ingresos diarios", valor: `RD$ ${ingresosDiarios.toLocaleString("es-DO")}`, detalle: periodo },
            { indicador: "Ventas de productos", valor: `RD$ ${ventasProductos.toLocaleString("es-DO")}`, detalle: "Total acumulado de inventario" },
            { indicador: "Stock bajo", valor: stockBajo, detalle: "Productos bajo su mínimo definido" },
            { indicador: "Asistencias del mes", valor: asistenciasMes, detalle: periodo },
            { indicador: "Ingresos totales", valor: `RD$ ${ingresosTotales.toLocaleString("es-DO")}`, detalle: "Pagos, entradas diarias y productos" }
        ];

        const tbody = document.getElementById("tablaReportesTbody");

        if (tbody) {
            tbody.innerHTML = filas.map(fila => `
                <tr class="border-b">
                    <td class="py-4 font-medium text-slate-800">${this.escaparHtml(fila.indicador)}</td>
                    <td class="py-4 font-bold text-slate-900">${this.escaparHtml(fila.valor)}</td>
                    <td class="py-4 text-slate-500">${this.escaparHtml(fila.detalle)}</td>
                </tr>
            `).join("");
        }

        this.renderizarAreaGraficoReporte([
            { etiqueta: "Pagos", valor: totalPagosMensuales, color: "bg-purple-600" },
            { etiqueta: "Diarios", valor: ingresosDiarios, color: "bg-amber-500" },
            { etiqueta: "Productos", valor: ventasProductos, color: "bg-green-600" }
        ]);

        if (!silencioso) {
            this.mostrarAlerta("exito", "Reporte generado correctamente.");
        }

        return {
            miembrosActivos,
            totalPagosMensuales,
            pagosPendientes,
            ingresosDiarios,
            ventasProductos,
            stockBajo,
            asistenciasMes,
            ingresosTotales
        };
    },

    calcularIngresosTotales(fechaDesde = "", fechaHasta = "") {
        const pagosMensuales = this.pagos
            .filter(pago => pago.estado === "Pagado" && this.fechaEnRango(pago.fecha, fechaDesde, fechaHasta))
            .reduce((total, pago) => total + Number(pago.monto || 0), 0);
        const ingresosDiarios = this.ingresosDiarios
            .filter(ingreso => this.fechaEnRango(ingreso.fecha, fechaDesde, fechaHasta))
            .reduce((total, ingreso) => total + Number(ingreso.total || 0), 0);
        const ventasProductos = Number(this.ingresosProductos) || 0;

        return pagosMensuales + ingresosDiarios + ventasProductos;
    },

    calcularStockBajo() {
        return this.productos.filter(producto =>
            Number(producto.stock || 0) <= Number(producto.stockMinimo || 0)
        ).length;
    },

    renderizarAreaGraficoReporte(items) {
        const area = document.getElementById("areaGraficoReporte");

        if (!area) return;

        const maximo = Math.max(...items.map(item => Number(item.valor || 0)), 1);

        area.innerHTML = items.map(item => {
            const valor = Number(item.valor || 0);
            const ancho = valor > 0 ? Math.max(8, Math.round((valor / maximo) * 100)) : 4;

            return `
                <div>
                    <div class="flex items-center justify-between text-sm mb-2">
                        <span class="font-semibold text-slate-700">${this.escaparHtml(item.etiqueta)}</span>
                        <span class="text-slate-500">RD$ ${valor.toLocaleString("es-DO")}</span>
                    </div>
                    <div class="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div class="${item.color} h-full rounded-full" style="width: ${ancho}%"></div>
                    </div>
                </div>
            `;
        }).join("");
    },

    fechaEnRango(fecha, fechaDesde = "", fechaHasta = "") {
        const valor = String(fecha || "").slice(0, 10);

        if (!valor) return false;
        if (fechaDesde && valor < fechaDesde) return false;
        if (fechaHasta && valor > fechaHasta) return false;

        return true;
    },

    // =============================
    // Configuración de usuarios
    // =============================

    renderizarUsuarios() {
        const tbody = document.getElementById("tablaUsuariosTbody");

        if (!tbody) return;

        tbody.innerHTML = "";

        if (this.usuarios.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="py-8 text-center text-slate-500">
                        No hay usuarios registrados.
                    </td>
                </tr>
            `;
            return;
        }

        this.usuarios.forEach(usuario => {
            const estadoClase = usuario.estado === "Activo"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700";
            const rolClase = usuario.rol === "Administrador"
                ? "bg-purple-100 text-purple-700"
                : usuario.rol === "Entrenador"
                ? "bg-blue-100 text-blue-700"
                : "bg-slate-100 text-slate-700";

            const row = document.createElement("tr");
            row.className = "border-b";
            row.innerHTML = `
                <td class="py-4">
                    <div class="font-medium text-slate-800">${this.escaparHtml(usuario.nombre)}</div>
                    <div class="text-xs text-slate-400 mt-1">${usuario.permisos.length} permisos asignados</div>
                </td>
                <td class="py-4 text-slate-500">${this.escaparHtml(usuario.usuario)}</td>
                <td class="py-4">
                    <span class="${rolClase} px-3 py-1 rounded-full text-xs font-semibold">
                        ${this.escaparHtml(usuario.rol)}
                    </span>
                </td>
                <td class="py-4">
                    <span class="${estadoClase} px-3 py-1 rounded-full text-xs font-semibold">
                        ${this.escaparHtml(usuario.estado)}
                    </span>
                </td>
                <td class="py-4 text-right">
                    <button type="button" data-usuario-id="${usuario.id}" class="editar-usuario-btn text-purple-600 hover:text-purple-700 text-xs font-semibold mr-3">
                        Editar
                    </button>
                    <button type="button" data-usuario-id="${usuario.id}" class="eliminar-usuario-btn text-red-600 hover:text-red-700 text-xs font-semibold">
                        Eliminar
                    </button>
                </td>
            `;

            // TODO SECURITY: MEDIA - Usar event listeners en lugar de onclick inline
            const btnEditar = row.querySelector('.editar-usuario-btn');
            const btnEliminar = row.querySelector('.eliminar-usuario-btn');
            if (btnEditar) {
                btnEditar.addEventListener('click', () => this.editarUsuario(usuario.id));
            }
            if (btnEliminar) {
                btnEliminar.addEventListener('click', () => this.eliminarUsuario(usuario.id));
            }

            tbody.appendChild(row);
        });
    },

    crearUsuario() {
        const id = document.getElementById("usuarioSistemaId")?.value || "";
        const nombre = (document.getElementById("nombreUsuarioSistema")?.value || "").trim();
        const usuarioLogin = (document.getElementById("usuarioLoginSistema")?.value || "").trim();
        const password = (document.getElementById("passwordUsuarioSistema")?.value || "").trim();
        const rol = document.getElementById("rolUsuarioSistema")?.value || "Recepción";
        const estado = document.getElementById("estadoUsuarioSistema")?.value || "Activo";
        const permisos = this.obtenerPermisosUsuarioFormulario();

        if (!nombre || !usuarioLogin || !password) {
            this.mostrarAlerta("error", "Completa nombre, usuario y contraseña.");
            return;
        }

        const usuarioDuplicado = this.usuarios.some(usuario =>
            usuario.usuario.toLowerCase() === usuarioLogin.toLowerCase() && String(usuario.id) !== String(id)
        );

        if (usuarioDuplicado) {
            this.mostrarAlerta("error", "Ese usuario ya existe.");
            return;
        }

        if (id) {
            const index = this.usuarios.findIndex(usuario => String(usuario.id) === String(id));

            if (index === -1) {
                this.mostrarAlerta("error", "Usuario no encontrado.");
                return;
            }

            this.usuarios[index] = {
                ...this.usuarios[index],
                nombre,
                usuario: usuarioLogin,
                password,
                rol,
                estado,
                permisos
            };

            this.mostrarAlerta("exito", "Usuario actualizado correctamente.");
        } else {
            this.usuarios.push({
                id: Date.now(),
                nombre,
                usuario: usuarioLogin,
                password,
                rol,
                estado,
                permisos
            });

            this.mostrarAlerta("exito", "Usuario creado correctamente.");
        }

        this.guardarUsuarios();
        this.renderizarUsuarios();
        this.limpiarFormularioUsuario();
    },

    editarUsuario(usuarioId) {
        const usuario = this.usuarios.find(item => item.id === Number(usuarioId));

        if (!usuario) {
            this.mostrarAlerta("error", "Usuario no encontrado.");
            return;
        }

        this.setValue("usuarioSistemaId", usuario.id);
        this.setValue("nombreUsuarioSistema", usuario.nombre);
        this.setValue("usuarioLoginSistema", usuario.usuario);
        this.setValue("passwordUsuarioSistema", usuario.password);
        this.setValue("rolUsuarioSistema", usuario.rol);
        this.setValue("estadoUsuarioSistema", usuario.estado);
        this.setText("tituloFormularioUsuario", "Editar usuario");
        this.setText("btnGuardarUsuarioSistema", "Actualizar usuario");

        document.querySelectorAll('input[name="permisosUsuarioSistema"]').forEach(checkbox => {
            checkbox.checked = usuario.permisos.includes(checkbox.value);
        });
    },

    eliminarUsuario(usuarioId) {
        const usuario = this.usuarios.find(item => item.id === Number(usuarioId));

        if (!usuario) {
            this.mostrarAlerta("error", "Usuario no encontrado.");
            return;
        }

        const confirmar = confirm(`¿Seguro que deseas eliminar a ${usuario.nombre}?`);

        if (!confirmar) return;

        this.usuarios = this.usuarios.filter(item => item.id !== usuario.id);
        this.guardarUsuarios();
        this.renderizarUsuarios();
        this.limpiarFormularioUsuario();
        this.mostrarAlerta("exito", "Usuario eliminado correctamente.");
    },

    obtenerPermisosUsuarioFormulario() {
        return [...document.querySelectorAll('input[name="permisosUsuarioSistema"]:checked')]
            .map(checkbox => checkbox.value);
    },

    limpiarFormularioUsuario() {
        const form = document.getElementById("formUsuarioSistema");

        if (form) form.reset();

        this.setValue("usuarioSistemaId", "");
        this.setText("tituloFormularioUsuario", "Nuevo usuario");
        this.setText("btnGuardarUsuarioSistema", "Guardar usuario");

        document.querySelectorAll('input[name="permisosUsuarioSistema"]').forEach(checkbox => {
            checkbox.checked = false;
        });
    },

    // =============================
    // Indicadores y utilidades
    // =============================

    actualizarIndicadores() {
        const miembrosActivos = this.miembros.filter(m => m.estado === "activo").length;

        const pagosPendientes = this.pagos.filter(p => p.estado === "Pendiente").length;
        const mesActual = this.obtenerMesActual();

        const pagosMes = this.pagos
            .filter(p => p.estado === "Pagado" && p.mes === mesActual)
            .reduce((total, pago) => total + pago.monto, 0);

        const hoy = new Date().toISOString().split("T")[0];
        const ingresosDiariosHoy = this.ingresosDiarios
            .filter(ingreso => ingreso.fecha === hoy)
            .reduce((total, ingreso) => total + ingreso.total, 0);
        const ventasDia = this.ventas
            .filter(venta => venta.fecha === hoy)
            .reduce((total, venta) => total + Number(venta.total || 0), 0);
        const stockBajo = this.productos.filter(producto => producto.stock <= producto.stockMinimo).length;

        this.setText("totalMiembros", miembrosActivos);
        this.setText("pagosPendientes", pagosPendientes);
        this.setText("pagosMes", `RD$ ${pagosMes.toLocaleString("es-DO")}`);
        this.setText("ingresosDiariosHoy", `RD$ ${ingresosDiariosHoy.toLocaleString("es-DO")}`);
        this.setText("ventasDiaDashboard", this.formatearMoneda(ventasDia));
        this.setText("stockBajoDashboard", stockBajo);
        this.renderizarResumenVentasDashboard();
    },

    renderizarResumenVentasDashboard() {
        const ultimas = document.getElementById("ultimasVentasDashboard");
        const top = document.getElementById("productosMasVendidosDashboard");

        if (ultimas) {
            const ventas = [...this.ventas].reverse().slice(0, 5);
            ultimas.innerHTML = ventas.length
                ? ventas.map(venta => `
                    <div class="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                        <span>${this.escaparHtml(venta.numero)} · ${this.escaparHtml(venta.cliente)}</span>
                        <strong>${this.formatearMoneda(venta.total)}</strong>
                    </div>
                `).join("")
                : `<p class="text-slate-500">No hay ventas registradas.</p>`;
        }

        if (top) {
            const acumulado = new Map();
            this.ventas.forEach(venta => {
                venta.detalles.forEach(item => {
                    acumulado.set(item.nombre, (acumulado.get(item.nombre) || 0) + Number(item.cantidad || 0));
                });
            });
            const productos = [...acumulado.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
            top.innerHTML = productos.length
                ? productos.map(([nombre, cantidad]) => `
                    <div class="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                        <span>${this.escaparHtml(nombre)}</span>
                        <strong>${cantidad} uds.</strong>
                    </div>
                `).join("")
                : `<p class="text-slate-500">Sin ventas suficientes para calcular ranking.</p>`;
        }
    },

    mostrarAlerta(tipo, mensaje) {
        const color = tipo === "exito"
            ? "bg-green-500"
            : tipo === "error"
            ? "bg-red-500"
            : "bg-blue-500";

        const alerta = document.createElement("div");
        alerta.className = `fixed top-4 right-4 ${color} text-white px-6 py-3 rounded-xl font-semibold z-[9999] shadow-lg`;
        alerta.textContent = mensaje;

        document.body.appendChild(alerta);

        setTimeout(() => {
            alerta.remove();
        }, 3000);
    },

    formatearMes(valor) {
        const [anio, mes] = valor.split("-");
        const meses = [
            "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ];

        return `${meses[parseInt(mes) - 1]} ${anio}`;
    },

    obtenerMesActual() {
        const fecha = new Date();

        const meses = [
            "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ];

        return `${meses[fecha.getMonth()]} ${fecha.getFullYear()}`;
    },

    formatearFecha(fecha) {
        if (!fecha) return "N/A";

        const date = new Date(fecha);

        if (isNaN(date)) return fecha;

        return date.toLocaleDateString("es-DO");
    },

    calcularVencimiento(fecha) {
        const date = new Date(fecha);

        if (isNaN(date)) return "N/A";

        date.setDate(date.getDate() + 30);

        return date.toLocaleDateString("es-DO");
    },

    capitalizar(texto) {
        if (!texto) return "";

        return texto.charAt(0).toUpperCase() + texto.slice(1);
    },

    normalizarMonto(valor, fallback) {
        const monto = Number(valor);

        return Number.isFinite(monto) && monto > 0 ? monto : fallback;
    },

    formatearMoneda(valor) {
        const monto = Number(valor) || 0;

        return `RD$ ${monto.toLocaleString("es-DO", {
            minimumFractionDigits: monto % 1 === 0 ? 0 : 2,
            maximumFractionDigits: 2
        })}`;
    },

    setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    },

    setValue(id, value) {
        const element = document.getElementById(id);
        if (element) element.value = value;
    },

    escaparHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }
};

document.addEventListener("DOMContentLoaded", () => {
    app.init();
});

function handleModalNuevoMiembro(data) {
    app.handleModalNuevoMiembro(data);
}

function handleModalEditarMiembro(data) {
    app.handleModalEditarMiembro(data);
}

function handleModalRegistrarPago(data) {
    app.handleModalRegistrarPago(data);
}



