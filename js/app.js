/**
 * Sistema de Gestión de Gimnasio
 * Frontend conectado a Supabase como fuente principal
 *
 * NOTA DE SEGURIDAD:
 * Supabase debe ser la fuente principal. localStorage se conserva solo como
 * cache/fallback temporal para datos no sensibles cuando la conexion falle.
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
        proveedores: "gimnasio_proveedores",
        comprasProveedores: "gimnasio_compras_proveedores",
        ventas: "gimnasio_ventas_productos",
        ventaDetalles: "gimnasio_venta_detalles",
        movimientosInventario: "gimnasio_movimientos_inventario",
        configuracionMensualidad: "gimnasio_configuracion_mensualidad",
        facturas: "gimnasio_facturas",
        ultimoNumeroFactura: "gimnasio_ultimo_numero_factura"
    },

    // Datos semilla temporales. TODO BACKEND: reemplazar por tabla `miembros` en Supabase.
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

    productos: [],

    ingresosProductos: 0,
    ingresosDiarios: [],
    asistencias: [],
    usuarios: [],
    proveedores: [
        { id: 1, nombre: "Proveedor general", telefono: "", email: "", direccion: "", producto_principal: "Bebidas y snacks", observaciones: "Proveedor temporal", estado: "activo" }
    ],
    comprasProveedores: [],
    ventas: [],
    ventaDetalles: [],
    movimientosInventario: [],
    facturas: [],
    carritoPOS: [],
    configuracionMensualidad: {
        mensualidadFija: 750,
        entradaDiaria: 40,
        diasProrroga: 3,
        estado: "Activo",
        nota: ""
    },
    miembroSeleccionado: null,
    usuarioActivo: null,
    perfilActivo: null,
    gimnasioId: null,
    supabaseDisponible: false,
    reporteActualFilas: [],
    navegacionConfigurada: false,

    // =============================
    // Inicialización
    // =============================

    async init() {
        this.cargarContextoAuth();
        this.cargarConfiguracionMensualidad();
        await this.cargarDatos();
        this.configurarNavegacion();
        this.configurarSidebarColapsable();
        this.setFechaActual();
        this.configurarBotones();
        this.actualizarTablaMiembros();
        this.cargarSelectMiembrosPago();
        this.renderizarPagos();
        this.renderizarProductos();
        this.renderizarPOS();
        this.renderizarCarritoPOS();
        this.renderizarProveedores();
        this.renderizarComprasProveedores();
        this.renderizarIngresosDiarios();
        this.renderizarAsistencia();
        this.renderizarReportes();
        this.renderizarResumenAuth();
        this.renderizarMensualidad();
        this.actualizarIndicadores();
        this.actualizarIndicadoresInventario();

        if (window.auth?.profile) {
            window.auth.applyPermissions(window.auth.profile);
        }
    },

    cargarContextoAuth() {
        const usuarioSesion = window.auth?.getStoredActiveUser?.() || null;

        this.usuarioActivo = usuarioSesion;
        this.perfilActivo = window.auth?.profile || null;
        this.gimnasioId = this.normalizarId(this.perfilActivo?.gimnasio_id || usuarioSesion?.gimnasio_id || null);
        this.supabaseDisponible = Boolean(window.kilvioSupabase && this.gimnasioId);

        if (!this.supabaseDisponible) {
            console.warn("Supabase no esta listo o no hay gimnasio_id. Se mantiene localStorage como fallback temporal.");
        }
    },

    obtenerGimnasioIdActivo() {
        return this.normalizarId(this.gimnasioId || window.auth?.profile?.gimnasio_id || window.auth?.getStoredActiveUser?.()?.gimnasio_id || null);
    },

    get supabase() {
        return window.kilvioSupabase || null;
    },

    puedeUsarSupabase() {
        return Boolean(this.supabase && this.obtenerGimnasioIdActivo());
    },

    normalizarId(value) {
        if (value === null || value === undefined || value === "") return "";
        const text = String(value);
        return /^[0-9]+$/.test(text) ? Number(text) : text;
    },

    idsIguales(a, b) {
        return String(a) === String(b);
    },

    guardarCacheLocal(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.warn(`No se pudo actualizar cache local ${key}`, error);
        }
    },

    obtenerRolActivo() {
        return window.auth?.profile?.rol || this.usuarioActivo?.rol || "recepcion";
    },

    esAdministrador() {
        return this.obtenerRolActivo() === "administrador";
    },

    puedeVenderProductos() {
        return ["administrador", "recepcion"].includes(this.obtenerRolActivo());
    },

    // =============================
    // Persistencia temporal
    // =============================

    async cargarDatos() {
        // Supabase es la fuente principal. localStorage queda solo como cache/fallback temporal.
        if (this.puedeUsarSupabase()) {
            try {
                await this.cargarDatosDesdeSupabase();
                return;
            } catch (error) {
                console.warn("No se pudo cargar desde Supabase. Se usara cache local temporal.", error);
            }
        }

        const miembrosGuardados = this.leerLocalStorage(this.storageKeys.miembros);
        const ingresosProductosGuardados = this.leerLocalStorage(this.storageKeys.ingresosProductos);
        this.cargarPagos();
        this.cargarProductos();
        this.cargarProveedores();
        this.cargarComprasProveedores();
        this.cargarVentasProductos();
        this.cargarMovimientosInventario();
        this.cargarIngresosDiarios();
        this.cargarFacturas();

        if (typeof ingresosProductosGuardados === "number") {
            this.ingresosProductos = ingresosProductosGuardados;
        }

        if (this.ventas.length > 0) {
            this.ingresosProductos = this.ventas.reduce((total, venta) => total + Number(venta.total || 0), 0);
        }

        if (Array.isArray(miembrosGuardados)) {
            this.miembros = this.normalizarMiembros(miembrosGuardados);
        }
    },

    async cargarDatosDesdeSupabase() {
        await this.ejecutarCargaSupabase("configuracion_mensualidad", () => this.cargarConfiguracionMensualidadDesdeSupabase());

        await Promise.all([
            this.ejecutarCargaSupabase("Miembros", () => this.cargarMiembrosDesdeSupabase()),
            this.ejecutarCargaSupabase("productos", () => this.cargarProductosDesdeSupabase()),
            this.ejecutarCargaSupabase("pagos", () => this.cargarPagosDesdeSupabase()),
            this.ejecutarCargaSupabase("asistencias", () => this.cargarAsistenciasDesdeSupabase()),
            this.ejecutarCargaSupabase("ingresos_diarios", () => this.cargarIngresosDiariosDesdeSupabase()),
            this.ejecutarCargaSupabase("proveedores", () => this.cargarProveedoresDesdeSupabase()),
            this.ejecutarCargaSupabase("compras_proveedores", () => this.cargarComprasDesdeSupabase()),
            this.ejecutarCargaSupabase("ventas", () => this.cargarVentasDesdeSupabase()),
            this.ejecutarCargaSupabase("movimientos_inventario", () => this.cargarMovimientosDesdeSupabase()),
            this.ejecutarCargaSupabase("facturas", () => this.cargarFacturasDesdeSupabase())
        ]);

        this.ingresosProductos = this.ventas.reduce((total, venta) => total + Number(venta.total || 0), 0);
        this.guardarCacheLocal(this.storageKeys.ingresosProductos, this.ingresosProductos);
    },

    async ejecutarCargaSupabase(nombre, loader) {
        try {
            await loader();
        } catch (error) {
            console.warn(`No se pudo cargar ${nombre} desde Supabase. Se mantiene fallback/cache para ese modulo.`, error);
        }
    },

    normalizarMiembros(miembros = []) {
        return miembros.map(miembro => ({
            id: this.normalizarId(miembro.id) || Date.now(),
            nombre: miembro.nombre || "",
            cedula: miembro.cedula || "",
            telefono: miembro.telefono || "",
            estado: miembro.estado || "activo",
            membresia: miembro.membresia || "mensual",
            fechaRegistro: miembro.fechaRegistro || miembro.fecha_registro || new Date().toISOString().split("T")[0],
            montoMensual: Number(miembro.montoMensual || miembro.monto_mensual || 0),
            diaPago: Number(miembro.diaPago || miembro.dia_pago || 1),
            gimnasioId: this.normalizarId(miembro.gimnasioId || miembro.gimnasio_id)
        }));
    },

    normalizarPago(pago = {}) {
        const miembro = pago.miembros || pago.Miembros || pago.miembro || {};
        return {
            id: this.normalizarId(pago.id) || Date.now(),
            miembroId: this.normalizarId(pago.miembroId || pago.miembro_id),
            miembroNombre: pago.miembroNombre || miembro.nombre || "",
            mes: pago.mes || this.obtenerMesActual(),
            monto: Number(pago.monto) || 0,
            estado: this.normalizarEstadoPago(pago.estado),
            metodo: pago.metodo || pago.metodo_pago || "",
            referenciaPago: pago.referenciaPago || pago.referencia_pago || "",
            fecha: pago.fecha || pago.fecha_pago || new Date().toISOString().split("T")[0],
            facturaNumero: pago.facturaNumero || pago.numero_recibo || "",
            concepto: pago.concepto || "mensualidad",
            usuarioRegistro: pago.usuarioRegistro || "Usuario demo"
        };
    },

    normalizarAsistencia(asistencia = {}) {
        return {
            id: this.normalizarId(asistencia.id) || Date.now(),
            miembroId: this.normalizarId(asistencia.miembroId || asistencia.miembro_id),
            fecha: asistencia.fecha || new Date().toISOString().split("T")[0],
            hora: asistencia.hora || asistencia.hora_llegada || "",
            estado: asistencia.estado || "Presente",
            usuarioRegistro: asistencia.usuarioRegistro || asistencia.usuario_registro || "",
            createdAt: asistencia.createdAt || asistencia.created_at || ""
        };
    },

    normalizarIngresoDiario(ingreso = {}) {
        const precioUnitario = Number(ingreso.precioUnitario || ingreso.precio_unitario || this.obtenerEntradaDiaria()) || 40;
        const cantidad = Math.max(0, Number(ingreso.cantidad) || 0);
        const total = Number(ingreso.total) || cantidad * precioUnitario;

        return {
            id: this.normalizarId(ingreso.id) || Date.now(),
            fecha: String(ingreso.fecha || new Date().toISOString().split("T")[0]).slice(0, 10),
            cantidad,
            precioUnitario,
            total,
            usuarioRegistro: ingreso.usuarioRegistro || ingreso.usuario_registro || "",
            createdAt: ingreso.createdAt || ingreso.created_at || ""
        };
    },

    normalizarConfiguracionMensualidad(configuracion = {}) {
        return {
            id: this.normalizarId(configuracion.id) || "",
            mensualidadFija: this.normalizarMonto(configuracion.mensualidadFija || configuracion.monto_mensual, 750),
            entradaDiaria: this.normalizarMonto(configuracion.entradaDiaria || configuracion.entrada_diaria, 40),
            diasProrroga: Math.max(0, Number(configuracion.diasProrroga ?? configuracion.dias_prorroga ?? 3) || 0),
            estado: configuracion.estado === "Inactivo" ? "Inactivo" : "Activo",
            nota: configuracion.nota || "",
            gimnasioId: this.normalizarId(configuracion.gimnasioId || configuracion.gimnasio_id)
        };
    },

    normalizarProducto(producto = {}) {
        return {
            id: this.normalizarId(producto.id) || Date.now(),
            nombre: producto.nombre || "",
            categoria: producto.categoria || "Otros",
            precio: Number(producto.precio) || 0,
            costo: Number(producto.costo) || 0,
            stock: Number(producto.stock) || 0,
            stockMinimo: Number(producto.stockMinimo ?? producto.stock_minimo ?? 5),
            estado: String(producto.estado || "activo").toLowerCase(),
            imagen: producto.imagen || producto.imagen_url || "",
            imagen_url: producto.imagen_url || producto.imagenUrl || producto.imagen || "",
            gimnasioId: this.normalizarId(producto.gimnasioId || producto.gimnasio_id)
        };
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

    async cargarMiembrosDesdeSupabase() {
        try {
            const { data, error } = await this.supabase
                .from("Miembros")
                .select("id,gimnasio_id,nombre,cedula,telefono,fecha_registro,estado,monto_mensual,dia_pago")
                .eq("estado", "activo")
                .order("nombre", { ascending: true });

            if (error) {
                console.error("Error cargando miembros desde Supabase:", error);
                throw error;
            }

            this.miembros = this.normalizarMiembros(data || []);
            this.guardarCacheLocal(this.storageKeys.miembros, this.miembros);
        } catch (error) {
            console.error("Fallback a localStorage para miembros:", error);
            const miembrosGuardados = this.leerLocalStorage(this.storageKeys.miembros);
            if (Array.isArray(miembrosGuardados)) {
                this.miembros = this.normalizarMiembros(miembrosGuardados);
                this.mostrarAlerta("advertencia", "Usando datos en caché: Supabase no disponible para miembros.");
            } else {
                this.miembros = [];
            }
        }
    },

    async cargarPagosDesdeSupabase() {
        try {
            const [{ data: pagos, error: pagosError }, { data: miembros, error: miembrosError }] = await Promise.all([
                this.supabase
                    .from("pagos")
                    .select("id,miembro_id,monto,mes,fecha_pago,metodo_pago,referencia_pago,estado,concepto,numero_recibo,usuario_registro,created_at")
                    .order("created_at", { ascending: true }),
                this.supabase
                    .from("Miembros")
                    .select("id,nombre,telefono")
            ]);

            if (pagosError) throw pagosError;
            if (miembrosError) throw miembrosError;

            const miembrosPorId = new Map((miembros || []).map(miembro => [
                String(miembro.id),
                miembro
            ]));

            this.pagos = (pagos || []).map(pago => this.normalizarPago({
                ...pago,
                miembroNombre: miembrosPorId.get(String(pago.miembro_id))?.nombre || "",
                miembroTelefono: miembrosPorId.get(String(pago.miembro_id))?.telefono || ""
            }));
            this.guardarCacheLocal(this.storageKeys.pagos, this.pagos);
        } catch (error) {
            console.warn("No se pudieron cargar pagos desde Supabase. Se usara cache local temporal.", error);
            this.cargarPagos();
        }
    },

    async cargarProductosDesdeSupabase() {
        try {
            const { data, error } = await this.supabase
                .from("productos")
                .select("id,gimnasio_id,nombre,categoria,precio,costo,stock,stock_minimo,imagen_url,estado,created_at")
                .order("nombre", { ascending: true });

            if (error) throw error;

            this.productos = (data || []).map(producto => this.normalizarProducto(producto));
            this.guardarCacheLocal(this.storageKeys.productos, this.productos);
        } catch (error) {
            console.warn("No se pudieron cargar productos desde Supabase. Se usara cache local temporal.", error);
            this.cargarProductos();
        }
    },

    async cargarAsistenciasDesdeSupabase() {
        try {
            const { data, error } = await this.supabase
                .from("asistencias")
                .select("id,created_at,miembro_id,fecha,hora_llegada,estado,usuario_registro")
                .order("fecha", { ascending: false })
                .order("hora_llegada", { ascending: false });

            if (error) throw error;

            this.asistencias = (data || []).map(asistencia => this.normalizarAsistencia(asistencia));
            this.guardarCacheLocal(this.storageKeys.asistencias, this.asistencias);
        } catch (error) {
            console.warn("No se pudieron cargar asistencias desde Supabase. Se usara cache local temporal.", error);
            this.cargarAsistencias();
        }
    },

    async cargarIngresosDiariosDesdeSupabase() {
        try {
            const { data, error } = await this.supabase
                .from("ingresos_diarios")
                .select("id,created_at,fecha,cantidad,precio_unitario,total,usuario_registro,gimnasio_id")
                .order("fecha", { ascending: false });

            if (error) throw error;

            this.ingresosDiarios = this.agruparIngresosDiarios(
                (data || []).map(ingreso => this.normalizarIngresoDiario(ingreso))
            );
            this.guardarCacheLocal(this.storageKeys.ingresosDiarios, this.ingresosDiarios);
        } catch (error) {
            console.warn("No se pudieron cargar ingresos diarios desde Supabase. Se usara cache local temporal.", error);
            this.cargarIngresosDiarios();
        }
    },

    async cargarProveedoresDesdeSupabase() {
        const { data, error } = await this.supabase
            .from("proveedores")
            .select("id,nombre,telefono,email,direccion,producto_principal,observaciones,estado")
            .order("nombre", { ascending: true });

        if (error) throw error;

        this.proveedores = (data || []).map(proveedor => ({
            id: this.normalizarId(proveedor.id),
            nombre: proveedor.nombre || "",
            telefono: proveedor.telefono || "",
            email: proveedor.email || "",
            direccion: proveedor.direccion || "",
            producto_principal: proveedor.producto_principal || "",
            observaciones: proveedor.observaciones || "",
            estado: proveedor.estado || "activo"
        }));
        this.guardarCacheLocal(this.storageKeys.proveedores, this.proveedores);
    },

    async cargarComprasDesdeSupabase() {
        const { data, error } = await this.supabase
            .from("compras_proveedores")
            .select("id,proveedor_id,producto_id,cantidad,costo_unitario,total,fecha,observacion,proveedores(nombre),productos(nombre)")
            .order("fecha", { ascending: false });

        if (error) throw error;

        this.comprasProveedores = (data || []).map(compra => ({
            id: this.normalizarId(compra.id),
            proveedorId: this.normalizarId(compra.proveedor_id),
            proveedorNombre: compra.proveedores?.nombre || "",
            productoId: this.normalizarId(compra.producto_id),
            productoNombre: compra.productos?.nombre || "",
            cantidad: Number(compra.cantidad) || 0,
            costoUnitario: Number(compra.costo_unitario) || 0,
            total: Number(compra.total) || 0,
            fecha: compra.fecha || "",
            observacion: compra.observacion || "",
            usuarioRegistro: "Supabase"
        }));
        this.guardarCacheLocal(this.storageKeys.comprasProveedores, this.comprasProveedores);
    },

    async cargarVentasDesdeSupabase() {
        const [{ data: ventas, error: ventasError }, { data: detalles, error: detallesError }] = await Promise.all([
            this.supabase.from("ventas").select("id,fecha,metodo_pago,referencia_pago,total,numero_recibo").order("fecha", { ascending: false }),
            this.supabase.from("venta_detalles").select("id,venta_id,producto_id,cantidad,precio_unitario,costo_unitario,total,productos(nombre)")
        ]);

        if (ventasError) throw ventasError;
        if (detallesError) throw detallesError;

        this.ventas = (ventas || []).map(venta => ({
            id: this.normalizarId(venta.id),
            fecha: venta.fecha || "",
            metodoPago: venta.metodo_pago || "Efectivo",
            referenciaPago: venta.referencia_pago || "",
            total: Number(venta.total) || 0,
            usuarioRegistro: "Supabase",
            facturaNumero: venta.numero_recibo || ""
        }));

        this.ventaDetalles = (detalles || []).map(detalle => ({
            id: this.normalizarId(detalle.id),
            ventaId: this.normalizarId(detalle.venta_id),
            productoId: this.normalizarId(detalle.producto_id),
            productoNombre: detalle.productos?.nombre || "",
            cantidad: Number(detalle.cantidad) || 0,
            precioUnitario: Number(detalle.precio_unitario) || 0,
            costoUnitario: Number(detalle.costo_unitario) || 0,
            total: Number(detalle.total) || 0
        }));
        this.guardarCacheLocal(this.storageKeys.ventas, this.ventas);
        this.guardarCacheLocal(this.storageKeys.ventaDetalles, this.ventaDetalles);
    },

    async cargarMovimientosDesdeSupabase() {
        const { data, error } = await this.supabase
            .from("movimientos_inventario")
            .select("id,producto_id,tipo,cantidad,stock_posterior,referencia_tipo,referencia_id,observacion,created_at,productos(nombre)")
            .order("created_at", { ascending: false });

        if (error) throw error;

        this.movimientosInventario = data || [];
        this.guardarCacheLocal(this.storageKeys.movimientosInventario, this.movimientosInventario);
    },

    async cargarFacturasDesdeSupabase() {
        const { data, error } = await this.supabase
            .from("facturas")
            .select("id,gimnasio_id,tipo,referencia_id,numero_recibo,fecha,cliente,concepto,metodo_pago,referencia_pago,total,usuario_registro,created_at")
            .order("created_at", { ascending: true });

        if (error) {
            console.warn("Tabla facturas no disponible o sin permisos. Se usaran facturas desde pagos/cache.", error);
            return;
        }

        this.facturas = (data || []).map(factura => ({
            id: this.normalizarId(factura.referencia_id || factura.id),
            uuid: factura.id,
            gimnasioId: this.normalizarId(factura.gimnasio_id),
            tipo: factura.tipo || "pago",
            referenciaId: this.normalizarId(factura.referencia_id),
            numero: factura.numero_recibo,
            fecha: factura.fecha,
            cliente: factura.cliente || "",
            concepto: factura.concepto || factura.tipo,
            monto: Number(factura.total) || 0,
            estado: "Pagado",
            metodoPago: factura.metodo_pago || "",
            referenciaPago: factura.referencia_pago || "",
            usuarioRegistro: factura.usuario_registro || "Supabase",
            createdAt: factura.created_at || ""
        }));
        this.guardarCacheLocal(this.storageKeys.facturas, this.facturas);
    },

    guardarMiembros() {
        // Guardar en cache local como fallback
        try {
            this.guardarCacheLocal(this.storageKeys.miembros, this.miembros);
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
            id: this.normalizarId(pago.id) || Date.now(),
            miembroId: this.normalizarId(pago.miembroId),
            miembroNombre: pago.miembroNombre || "",
            mes: pago.mes || this.obtenerMesActual(),
            monto: Number(pago.monto) || 0,
            estado: this.normalizarEstadoPago(pago.estado),
            metodo: pago.metodo || "",
            referenciaPago: pago.referenciaPago || "",
            fecha: pago.fecha || new Date().toISOString().split("T")[0],
            facturaNumero: pago.facturaNumero || "",
            concepto: pago.concepto || "mensualidad",
            usuarioRegistro: pago.usuarioRegistro || "Usuario demo"
        }));
    },

    cargarProductos() {
        // TODO BACKEND: reemplazar localStorage por GET /api/productos.
        const productosGuardados = this.leerLocalStorage(this.storageKeys.productos);

        if (Array.isArray(productosGuardados)) {
            this.productos = productosGuardados.map(producto => this.normalizarProducto(producto));
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

    cargarProveedores() {
        const proveedoresGuardados = this.leerLocalStorage(this.storageKeys.proveedores);

        if (!Array.isArray(proveedoresGuardados)) return;

        this.proveedores = proveedoresGuardados.map(proveedor => ({
            id: this.normalizarId(proveedor.id) || Date.now(),
            nombre: proveedor.nombre || "",
            telefono: proveedor.telefono || "",
            email: proveedor.email || "",
            direccion: proveedor.direccion || "",
            producto_principal: proveedor.producto_principal || proveedor.productoPrincipal || "",
            observaciones: proveedor.observaciones || "",
            estado: proveedor.estado || "activo"
        }));
    },

    guardarProveedores() {
        // TODO SUPABASE: reemplazar por insert/update en public.proveedores filtrado por gimnasio_id.
        try {
            localStorage.setItem(this.storageKeys.proveedores, JSON.stringify(this.proveedores));
        } catch (error) {
            console.warn("No se pudieron guardar los proveedores en localStorage", error);
        }
    },

    cargarComprasProveedores() {
        const comprasGuardadas = this.leerLocalStorage(this.storageKeys.comprasProveedores);

        if (!Array.isArray(comprasGuardadas)) return;

        this.comprasProveedores = comprasGuardadas.map(compra => ({
            id: this.normalizarId(compra.id) || Date.now(),
            proveedorId: this.normalizarId(compra.proveedorId),
            proveedorNombre: compra.proveedorNombre || "",
            productoId: this.normalizarId(compra.productoId),
            productoNombre: compra.productoNombre || "",
            cantidad: Number(compra.cantidad) || 0,
            costoUnitario: Number(compra.costoUnitario) || 0,
            total: Number(compra.total) || 0,
            fecha: compra.fecha || new Date().toISOString().split("T")[0],
            observacion: compra.observacion || "",
            usuarioRegistro: compra.usuarioRegistro || "Usuario demo"
        }));
    },

    guardarComprasProveedores() {
        // TODO SUPABASE: reemplazar por insert en public.compras_proveedores.
        try {
            localStorage.setItem(this.storageKeys.comprasProveedores, JSON.stringify(this.comprasProveedores));
        } catch (error) {
            console.warn("No se pudieron guardar las compras a proveedores en localStorage", error);
        }
    },

    cargarVentasProductos() {
        const ventasGuardadas = this.leerLocalStorage(this.storageKeys.ventas);
        const detallesGuardados = this.leerLocalStorage(this.storageKeys.ventaDetalles);

        if (Array.isArray(ventasGuardadas)) {
            this.ventas = ventasGuardadas.map(venta => ({
                id: this.normalizarId(venta.id) || Date.now(),
                fecha: venta.fecha || new Date().toISOString().split("T")[0],
                metodoPago: venta.metodoPago || "Efectivo",
                referenciaPago: venta.referenciaPago || "",
                total: Number(venta.total) || 0,
                usuarioRegistro: venta.usuarioRegistro || "Usuario demo",
                facturaNumero: venta.facturaNumero || ""
            }));
        }

        if (Array.isArray(detallesGuardados)) {
            this.ventaDetalles = detallesGuardados.map(detalle => ({
                id: this.normalizarId(detalle.id) || Date.now(),
                ventaId: this.normalizarId(detalle.ventaId),
                productoId: this.normalizarId(detalle.productoId),
                productoNombre: detalle.productoNombre || "",
                cantidad: Number(detalle.cantidad) || 0,
                precioUnitario: Number(detalle.precioUnitario) || 0,
                costoUnitario: Number(detalle.costoUnitario) || 0,
                total: Number(detalle.total) || 0
            }));
        }
    },

    guardarVentasProductos() {
        // TODO SUPABASE: reemplazar por insert en public.ventas y public.venta_detalles.
        try {
            localStorage.setItem(this.storageKeys.ventas, JSON.stringify(this.ventas));
            localStorage.setItem(this.storageKeys.ventaDetalles, JSON.stringify(this.ventaDetalles));
        } catch (error) {
            console.warn("No se pudieron guardar las ventas de productos en localStorage", error);
        }
    },

    cargarMovimientosInventario() {
        const movimientosGuardados = this.leerLocalStorage(this.storageKeys.movimientosInventario);

        if (!Array.isArray(movimientosGuardados)) return;

        this.movimientosInventario = movimientosGuardados;
    },

    guardarMovimientosInventario() {
        // TODO SUPABASE: reemplazar por insert en public.movimientos_inventario.
        try {
            localStorage.setItem(this.storageKeys.movimientosInventario, JSON.stringify(this.movimientosInventario));
        } catch (error) {
            console.warn("No se pudieron guardar los movimientos de inventario en localStorage", error);
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

        this.ingresosDiarios = this.agruparIngresosDiarios(
            ingresosDiariosGuardados.map(ingreso => this.normalizarIngresoDiario(ingreso))
        );
        this.guardarIngresosDiarios();
    },

    cargarAsistencias() {
        // TODO BACKEND: reemplazar localStorage por GET /api/asistencias.
        const asistenciasGuardadas = this.leerLocalStorage(this.storageKeys.asistencias);

        if (!Array.isArray(asistenciasGuardadas)) return;

        this.asistencias = asistenciasGuardadas
            .map(asistencia => this.normalizarAsistencia(asistencia))
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
        // Usuarios reales se administran exclusivamente en Supabase Auth.
        this.usuarios = [];
    },

    guardarUsuarios() {
        // TODO SECURITY: no crear ni persistir usuarios desde el frontend.
        // Los usuarios se crean manualmente en Supabase Auth y se autorizan desde public.perfiles.
    },

    cargarConfiguracionMensualidad() {
        const configuracionGuardada = this.leerLocalStorage(this.storageKeys.configuracionMensualidad);

        if (!configuracionGuardada || typeof configuracionGuardada !== "object") return;

        this.configuracionMensualidad = this.normalizarConfiguracionMensualidad(configuracionGuardada);
    },

    async cargarConfiguracionMensualidadDesdeSupabase() {
        try {
            const gimnasioId = this.obtenerGimnasioIdActivo();
            let query = this.supabase
                .from("configuracion_mensualidad")
                .select("id,gimnasio_id,monto_mensual,entrada_diaria,dias_prorroga,estado,nota,created_at,updated_at")
                .order("created_at", { ascending: true })
                .limit(1);

            if (gimnasioId) {
                query = query.eq("gimnasio_id", gimnasioId);
            }

            const { data, error } = await query;

            if (error) throw error;

            const configuracion = Array.isArray(data) ? data[0] : null;

            if (configuracion) {
                this.configuracionMensualidad = this.normalizarConfiguracionMensualidad(configuracion);
                this.guardarConfiguracionMensualidad();
                return;
            }

            await this.crearConfiguracionMensualidadInicialSupabase();
        } catch (error) {
            console.warn("No se pudo cargar configuracion de mensualidad desde Supabase. Se usara cache local temporal.", error);
            this.cargarConfiguracionMensualidad();
        }
    },

    async crearConfiguracionMensualidadInicialSupabase() {
        const payload = {
            monto_mensual: 750,
            entrada_diaria: 40,
            dias_prorroga: 3,
            estado: "Activo",
            nota: ""
        };

        if (this.obtenerGimnasioIdActivo()) {
            payload.gimnasio_id = this.obtenerGimnasioIdActivo();
        }

        let { data, error } = await this.supabase
            .from("configuracion_mensualidad")
            .insert(payload)
            .select("id,gimnasio_id,monto_mensual,entrada_diaria,dias_prorroga,estado,nota,created_at,updated_at")
            .single();

        if (error && payload.gimnasio_id && String(error.message || "").toLowerCase().includes("gimnasio_id")) {
            delete payload.gimnasio_id;
            ({ data, error } = await this.supabase
                .from("configuracion_mensualidad")
                .insert(payload)
                .select("id,gimnasio_id,monto_mensual,entrada_diaria,dias_prorroga,estado,nota,created_at,updated_at")
                .single());
        }

        if (error) throw error;

        this.configuracionMensualidad = this.normalizarConfiguracionMensualidad(data);
        this.guardarConfiguracionMensualidad();
    },

    guardarConfiguracionMensualidad() {
        try {
            localStorage.setItem(this.storageKeys.configuracionMensualidad, JSON.stringify(this.configuracionMensualidad));
        } catch (error) {
            console.warn("No se pudo guardar la configuración de mensualidad en localStorage", error);
        }
    },

    cargarFacturas() {
        // TODO BACKEND:
        // - Reemplazar localStorage con API.
        // - Reemplazar usuarioRegistro con usuario autenticado.
        // - Validar fecha desde servidor.
        const facturasGuardadas = this.leerLocalStorage(this.storageKeys.facturas);

        if (!Array.isArray(facturasGuardadas)) return;

        this.facturas = facturasGuardadas.map(factura => ({
            id: Number(factura.id) || Date.now(),
            numero: String(factura.numero || "").padStart(6, "0"),
            fecha: factura.fecha || new Date().toISOString().split("T")[0],
            concepto: factura.concepto || "mensualidad",
            monto: Number(factura.monto) || 0,
            estado: this.normalizarEstadoPago(factura.estado),
            usuarioRegistro: factura.usuarioRegistro || "Usuario demo"
        }));
    },

    guardarFacturas() {
        // TODO BACKEND: reemplazar por POST/GET /api/facturas.
        try {
            localStorage.setItem(this.storageKeys.facturas, JSON.stringify(this.facturas));
        } catch (error) {
            console.warn("No se pudieron guardar las facturas en localStorage", error);
        }
    },

    guardarTodo() {
        this.guardarMiembros();
        this.guardarPagos();
        this.guardarProductos();
        this.guardarProveedores();
        this.guardarComprasProveedores();
        this.guardarVentasProductos();
        this.guardarMovimientosInventario();
        this.guardarIngresosDiarios();
        this.guardarAsistencias();
        this.guardarUsuarios();
        this.guardarConfiguracionMensualidad();
        this.guardarFacturas();
    },

    // =============================
    // Navegación SPA y eventos base
    // =============================

    configurarNavegacion() {
        if (this.navegacionConfigurada) return;

        const links = document.querySelectorAll(".menu-link[data-page]");
        const pages = document.querySelectorAll(".page");

        this.navegacionConfigurada = true;

        this.mostrarPagina = (pageId) => {
            const targetPageId = pageId === "facturas" ? "pagos" : pageId;
            const target = document.getElementById(targetPageId);

            if (!target) return;

            pages.forEach(page => {
                page.classList.add("hidden");
            });

            target.classList.remove("hidden");

            if (targetPageId === "reportes") {
                this.renderizarReportes();
            }

            if (targetPageId === "configuracion") {
                this.renderizarResumenAuth();
            }

            if (targetPageId === "mensualidad") {
                this.renderizarMensualidad();
            }

            if (targetPageId === "registrar-pago") {
                this.actualizarIndicadoresPagosInteligentes();
            }

            if (targetPageId === "inventario" || targetPageId === "pos") {
                this.renderizarProductos();
                this.renderizarPOS();
            }

            if (targetPageId === "proveedores") {
                this.renderizarProveedores();
                this.renderizarComprasProveedores();
            }

            links.forEach(link => {
                const activo = link.dataset.page === pageId;
                const esLogout = link.dataset.page === "logout";

                link.classList.toggle("bg-emerald-500/10", activo && !esLogout);
                link.classList.toggle("text-emerald-400", activo && !esLogout);
                link.classList.toggle("border-l-2", activo && !esLogout);
                link.classList.toggle("border-emerald-500", activo && !esLogout);
                link.classList.toggle("font-semibold", activo && !esLogout);
                link.classList.toggle("text-slate-400", !activo && !esLogout);
                link.classList.toggle("bg-red-500/10", activo && esLogout);
                link.classList.toggle("text-red-300", activo && esLogout);
                link.classList.toggle("text-red-400", !activo && esLogout);
            });
        };

        links.forEach(link => {
            link.addEventListener("click", (event) => {
                event.preventDefault();

                if (link.dataset.page === "logout") {
                    if (window.auth?.logout) {
                        window.auth.logout();
                        return;
                    }
                }

                this.mostrarPagina(link.dataset.page);
            });
        });

        document.querySelectorAll("[data-dashboard-target]").forEach(link => {
            link.addEventListener("click", (event) => {
                event.preventDefault();
                const pageId = link.dataset.dashboardTarget;
                const estadoPago = link.dataset.pagoEstado || "";

                this.mostrarPagina(pageId);

                if (pageId === "pagos") {
                    this.setValue("filtroPagoEstado", estadoPago || "todos");
                    this.renderizarPagos();
                }
            });
        });

        this.mostrarPagina("dashboard");
    },

    configurarSidebarColapsable() {
        const sidebar = document.getElementById("sidebar");
        const boton = document.getElementById("btnToggleSidebar");

        if (!sidebar || !boton) return;

        const icono = boton.querySelector("i");
        const textos = sidebar.querySelectorAll("span, h2, p");

        boton.addEventListener("click", () => {
            const colapsado = sidebar.classList.toggle("w-20");

            sidebar.classList.toggle("w-64", !colapsado);
            boton.setAttribute("aria-expanded", String(!colapsado));
            boton.setAttribute("aria-label", colapsado ? "Expandir menú lateral" : "Contraer menú lateral");

            textos.forEach(texto => {
                texto.classList.toggle("hidden", colapsado);
            });

            if (icono) {
                icono.classList.toggle("fa-chevron-left", !colapsado);
                icono.classList.toggle("fa-chevron-right", colapsado);
            }
        });
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
        const buscarMiembro = document.getElementById("buscarMiembro");

        if (buscarMiembro) {
            buscarMiembro.addEventListener("input", () => {
                this.actualizarTablaMiembros();
            });
        }

        if (btnEliminar) {
            btnEliminar.addEventListener("click", async () => {
                await this.eliminarMiembroSeleccionado();
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
            formProducto.addEventListener("submit", async (event) => {
                event.preventDefault();
                await this.guardarProductoDesdeFormulario();
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

        if (buscarProductoPOS) {
            buscarProductoPOS.addEventListener("input", () => {
                this.renderizarPOS();
            });
        }

        const btnConfirmarVentaPOS = document.getElementById("btnConfirmarVentaPOS");

        if (btnConfirmarVentaPOS) {
            btnConfirmarVentaPOS.addEventListener("click", () => {
                if (this.carritoPOS.length === 0) {
                    this.mostrarAlerta("error", "Agrega productos al carrito antes de confirmar.");
                    return;
                }

                this.mostrarAlerta("info", "Carrito listo para confirmar venta. Paso 3 pendiente.");
            });
        }

        const btnLimpiarCarritoPOS = document.getElementById("btnLimpiarCarritoPOS");

        if (btnLimpiarCarritoPOS) {
            btnLimpiarCarritoPOS.addEventListener("click", () => {
                this.limpiarCarritoPOS();
            });
        }

        const formActualizarStock = document.getElementById("formActualizarStock");

        if (formActualizarStock) {
            formActualizarStock.addEventListener("submit", async (event) => {
                event.preventDefault();
                await this.guardarActualizacionStock();
            });
        }

        const btnNuevoProveedor = document.getElementById("btnNuevoProveedor");

        if (btnNuevoProveedor) {
            btnNuevoProveedor.addEventListener("click", () => {
                this.abrirModalProveedor();
            });
        }

        const formProveedor = document.getElementById("formProveedor");

        if (formProveedor) {
            formProveedor.addEventListener("submit", (event) => {
                event.preventDefault();
                this.guardarProveedorDesdeFormulario();
            });
        }

        const formRegistrarPagoPagina = document.getElementById("formRegistrarPagoPagina");
        const btnGenerarFacturaPagoPagina = document.getElementById("btnGenerarFacturaPagoPagina");
        const metodoPagoPagina = document.getElementById("pagoMetodoPagina");
        const metodoPagoRegistro = document.getElementById("metodoPagoRegistro");
        const filtrosPagos = [
            document.getElementById("filtroPagoMiembro"),
            document.getElementById("filtroPagoMes"),
            document.getElementById("filtroPagoEstado")
        ];

        if (formRegistrarPagoPagina) {
            formRegistrarPagoPagina.addEventListener("submit", async (event) => {
                event.preventDefault();
                await this.registrarPago(this.obtenerDatosPagoPagina(), { validarReferencia: true });
            });
        }

        if (btnGenerarFacturaPagoPagina) {
            btnGenerarFacturaPagoPagina.addEventListener("click", async () => {
                await this.registrarPago(this.obtenerDatosPagoPagina(), { abrirFactura: true, validarReferencia: true });
            });
        }

        if (metodoPagoPagina) {
            metodoPagoPagina.addEventListener("change", () => {
                this.actualizarReferenciaPagoRequerida();
            });
            this.actualizarReferenciaPagoRequerida();
        }

        if (metodoPagoRegistro) {
            metodoPagoRegistro.addEventListener("change", () => {
                this.actualizarReferenciaPagoModalRequerida();
            });
            this.actualizarReferenciaPagoModalRequerida();
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
            btnRegistrarIngresoDiario.addEventListener("click", async () => {
                await this.registrarIngresoDiario();
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
        const tipoReporte = document.getElementById("tipoReporte");
        const formConfiguracionMensualidad = document.getElementById("formConfiguracionMensualidad");

        if (btnGenerarReporte) {
            btnGenerarReporte.addEventListener("click", () => {
                this.generarReporte();
            });
        }

        if (tipoReporte) {
            tipoReporte.addEventListener("change", () => {
                this.renderizarFiltrosReporte();
                this.generarReporte({ silencioso: true });
            });
            this.renderizarFiltrosReporte();
        }

        if (btnExportarReporte) {
            btnExportarReporte.addEventListener("click", () => {
                this.exportarReporteCsv();
            });
        }

        if (formConfiguracionMensualidad) {
            formConfiguracionMensualidad.addEventListener("submit", async (event) => {
                event.preventDefault();
                await this.guardarConfiguracionMensualidadDesdeFormulario();
            });
        }
    },

    // =============================
    // Miembros
    // =============================

    async handleModalNuevoMiembro(data) {
        if (!data.nombreMiembro || !data.cedulaMiembro) {
            this.mostrarAlerta("error", "Completa el nombre y la cédula.");
            return false;
        }

        const cedulaTrimmed = data.cedulaMiembro.trim();
        const nombreTrimmed = data.nombreMiembro.trim();
        const cedulaExiste = this.miembros.some(m => m.cedula === cedulaTrimmed);

        if (cedulaExiste) {
            this.mostrarAlerta("error", "Esta cédula ya está registrada.");
            return false;
        }

        const fechaRegistro = data.fechaMiembro || new Date().toISOString().split("T")[0];
        const diaPago = new Date(`${fechaRegistro}T00:00:00`).getDate() || 1;

        if (!this.puedeUsarSupabase()) {
            const mensaje = "No se puede registrar el miembro: falta sesión Supabase o gimnasio_id en el perfil.";
            console.error(mensaje, {
                supabase: Boolean(this.supabase),
                gimnasio_id: this.obtenerGimnasioIdActivo(),
                perfil: this.perfilActivo
            });
            this.mostrarAlerta("error", mensaje);
            return false;
        }

        try {
            const payload = {
                gimnasio_id: this.obtenerGimnasioIdActivo(),
                nombre: nombreTrimmed,
                cedula: cedulaTrimmed,
                telefono: data.telefonoMiembro || "",
                estado: data.estadoMiembro || "activo",
                fecha_registro: fechaRegistro,
                monto_mensual: this.obtenerMensualidadFija(),
                dia_pago: diaPago
            };

            const { data: row, error } = await this.supabase
                .from("Miembros")
                .insert([payload])
                .select("id,gimnasio_id,nombre,cedula,telefono,fecha_registro,estado,monto_mensual,dia_pago")
                .single();

            if (error) {
                console.error("SUPABASE INSERT MIEMBRO ERROR:", error);
                throw new Error(error.message || "No se pudo registrar el miembro en Supabase.");
            }

            const nuevoMiembroNormalizado = this.normalizarMiembros([row])[0];
            this.miembros.push(nuevoMiembroNormalizado);
            this.guardarMiembros();
            this.mostrarAlerta("exito", `Miembro ${nombreTrimmed} registrado correctamente en Supabase.`);
        } catch (error) {
            console.error("Error registrando miembro en Supabase:", error);
            this.mostrarAlerta("error", error.message || "No se pudo registrar el miembro.");
            return false;
        }

        this.sincronizarVistaMiembros();

        if (typeof modalManager !== "undefined") {
            modalManager.closeModal("modalNuevoMiembro");
        }

        return false;
    },

    async handleModalEditarMiembro(data) {
        if (!this.miembroSeleccionado) {
            this.mostrarAlerta("error", "Selecciona un miembro primero.");
            return false;
        }

        if (!data.nombreEditarMiembro || !data.cedulaEditarMiembro) {
            this.mostrarAlerta("error", "Completa los campos requeridos.");
            return false;
        }

        const index = this.miembros.findIndex(m => this.idsIguales(m.id, this.miembroSeleccionado.id));

        if (index === -1) {
            this.mostrarAlerta("error", "Miembro no encontrado.");
            return false;
        }

        const nombreActualizado = data.nombreEditarMiembro.trim();
        const cedulaActualizada = data.cedulaEditarMiembro.trim();
        const telefonoActualizado = data.telefonoEditarMiembro || "";
        const estadoActualizado = data.estadoEditarMiembro || "activo";

        if (this.puedeUsarSupabase()) {
            try {
                const { data: row, error } = await this.supabase
                    .from("Miembros")
                    .update({
                        nombre: nombreActualizado,
                        cedula: cedulaActualizada,
                        telefono: telefonoActualizado,
                        estado: estadoActualizado
                    })
                    .eq("id", this.miembroSeleccionado.id)
                    .select("id,gimnasio_id,nombre,cedula,telefono,fecha_registro,estado,monto_mensual,dia_pago")
                    .single();

                if (error) {
                    throw new Error(error.message || "No se pudo actualizar el miembro en Supabase.");
                }

                this.miembros[index] = this.normalizarMiembros([row])[0];
                this.guardarMiembros();
                this.mostrarAlerta("exito", "Miembro actualizado correctamente en Supabase.");
            } catch (error) {
                console.error("Error actualizando miembro en Supabase:", error);
                this.mostrarAlerta("error", error.message || "No se pudo actualizar el miembro.");
                return false;
            }
        } else {
            const miembroActualizado = {
                ...this.miembros[index],
                nombre: nombreActualizado,
                cedula: cedulaActualizada,
                telefono: telefonoActualizado,
                estado: estadoActualizado
            };
            this.miembros[index] = miembroActualizado;
            this.guardarMiembros();
            this.mostrarAlerta("info", "Miembro actualizado localmente (Supabase no disponible).");
        }

        this.sincronizarVistaMiembros();
        this.limpiarSeleccion();

        if (typeof modalManager !== "undefined") {
            modalManager.closeModal("modalEditarMiembro");
        }

        return false;
    },

    // =============================
    // Pagos y facturación
    // =============================

    async handleModalRegistrarPago(data) {
        return Boolean(await this.registrarPago({
            miembroId: data.miembroPagoRegistro,
            monto: data.montoPagoRegistro,
            mes: data.mesPagoRegistro,
            fecha: data.fechaPagoRegistro,
            metodo: data.metodoPagoRegistro,
            referenciaPago: data.referenciaPagoRegistro || ""
        }, { validarReferencia: true }));
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

    actualizarReferenciaPagoModalRequerida() {
        const metodo = document.getElementById("metodoPagoRegistro")?.value || "";
        const referencia = document.getElementById("referenciaPagoRegistro");

        if (!referencia) return;

        const requerida = ["Tarjeta", "Transferencia"].includes(metodo);

        referencia.required = requerida;
        referencia.placeholder = requerida
            ? "Obligatorio para este método de pago"
            : "Opcional para pagos en efectivo";
    },

    async registrarPago(data, opciones = {}) {
        const { abrirFactura = false, validarReferencia = false } = opciones;
        const referenciaPago = (data.referenciaPago || "").trim();

        if (!data.miembroId || !data.monto || !data.fecha || !data.metodo) {
            this.mostrarAlerta("error", "Completa todos los campos del pago.");
            return null;
        }

        if ((validarReferencia || ["Tarjeta", "Transferencia"].includes(data.metodo)) && ["Tarjeta", "Transferencia"].includes(data.metodo) && !referenciaPago) {
            this.mostrarAlerta("error", "El No. de referencia / voucher es obligatorio para tarjeta o transferencia.");
            return null;
        }

        const monto = parseFloat(data.monto);

        if (isNaN(monto) || monto <= 0) {
            this.mostrarAlerta("error", "El monto debe ser mayor a cero.");
            return null;
        }

        const miembroId = this.normalizarId(data.miembroId);
        const miembro = this.miembros.find(m => this.idsIguales(m.id, miembroId));

        if (!miembro) {
            this.mostrarAlerta("error", "Miembro no encontrado.");
            return null;
        }

        if (this.puedeUsarSupabase()) {
            const mesPago = data.mes ? this.formatearMes(data.mes) : this.obtenerMesActual();
            const numeroRecibo = this.generarNumeroReciboTemporal("PAG");
            const pagoData = {
                miembro_id: miembroId,
                gimnasio_id: this.obtenerGimnasioIdActivo(),
                monto,
                mes: mesPago,
                fecha_pago: data.fecha,
                metodo_pago: data.metodo,
                referencia_pago: referenciaPago || null,
                estado: data.estado || "Pagado",
                concepto: data.concepto || "mensualidad",
                numero_recibo: numeroRecibo,
                usuario_registro: this.obtenerUsuarioRegistroActivo()
            };

            const { data: pagoServidor, error } = await this.supabase
                .from("pagos")
                .insert(pagoData)
                .select("id,miembro_id,monto,mes,fecha_pago,metodo_pago,referencia_pago,estado,concepto,numero_recibo,usuario_registro,created_at")
                .single();

            if (error) {
                this.mostrarAlerta("error", error.message || "No se pudo registrar el pago en Supabase.");
                return null;
            }

            if (!pagoServidor?.id) {
                this.mostrarAlerta("error", "Supabase no devolvio el pago registrado.");
                return null;
            }

            const nuevoPago = this.normalizarPago({
                ...pagoServidor,
                miembroNombre: miembro.nombre
            });

            this.pagos = [
                ...this.pagos.filter(pago => !this.idsIguales(pago.id, nuevoPago.id)),
                nuevoPago
            ];
            this.guardarPagos();
            this.sincronizarFacturaPagoSupabase(nuevoPago);

            try {
                await this.cargarFacturasDesdeSupabase();
            } catch (errorFactura) {
                console.warn("No se pudo actualizar cache de facturas desde Supabase.", errorFactura);
            }

            this.renderizarPagos();
            this.actualizarIndicadores();
            this.actualizarIndicadoresPagosInteligentes();

            this.mostrarAlerta("exito", `Pago ${nuevoPago.facturaNumero || ""} registrado para ${miembro.nombre}.`);

            if (abrirFactura) {
                await this.abrirFactura(nuevoPago.id);
            }

            return nuevoPago;
        }

        const nuevoPago = {
            id: Date.now(),
            miembroId: miembro.id,
            miembroNombre: miembro.nombre,
            mes: data.mes ? this.formatearMes(data.mes) : this.obtenerMesActual(),
            monto,
            estado: data.estado || "Pagado",
            metodo: data.metodo,
            referenciaPago,
            fecha: data.fecha,
            concepto: data.concepto || "mensualidad",
            usuarioRegistro: this.obtenerUsuarioRegistroActivo()
        };

        this.pagos.push(nuevoPago);

        this.guardarPagos();
        this.sincronizarFacturaPagoSupabase(nuevoPago);
        this.renderizarPagos();
        this.actualizarIndicadores();
        this.actualizarIndicadoresPagosInteligentes();

        this.mostrarAlerta("exito", `Pago de RD$ ${monto.toFixed(2)} registrado para ${miembro.nombre}.`);

        if (abrirFactura) {
            await this.abrirFactura(nuevoPago.id);
        }

        return nuevoPago;
    },

    actualizarIndicadoresPagosInteligentes() {
        // TODO BACKEND:
        // Reemplazar cálculos con datos del servidor.
        // Validar fechas desde backend.
        // Autenticación real de usuarios.
        const mesActual = this.obtenerMesActual();
        const pagosPagadosMes = this.pagos.filter(pago =>
            this.normalizarEstadoPago(pago.estado) === "Pagado" && pago.mes === mesActual
        );
        const totalRecaudado = pagosPagadosMes.reduce((total, pago) => total + Number(pago.monto || 0), 0);
        const estados = this.calcularEstadosPagoMiembros();

        this.setText("pagosInteligentesRecibidos", pagosPagadosMes.length);
        this.setText("pagosInteligentesPendientes", estados.filter(item => item.estado === "Pendiente").length);
        this.setText("pagosInteligentesPorVencer", estados.filter(item => item.estado === "Por vencer").length);
        this.setText("pagosInteligentesTotal", this.formatearMoneda(totalRecaudado));
    },

    calcularEstadosPagoMiembros() {
        const hoy = new Date();
        const mesActual = this.obtenerMesActual();
        const diasProrroga = this.obtenerDiasProrroga();

        return this.miembros
            .filter(miembro => (miembro.estado || "").toLowerCase() === "activo")
            .map(miembro => {
                const pagoMes = this.pagos.find(pago =>
                    this.idsIguales(pago.miembroId, miembro.id) &&
                    pago.mes === mesActual &&
                    this.normalizarEstadoPago(pago.estado) === "Pagado"
                );

                if (pagoMes) {
                    return { miembro, estado: "Pagado", fechaPago: pagoMes.fecha };
                }

                const fechaVencimiento = this.obtenerFechaVencimientoMiembro(miembro, hoy);
                const finProrroga = new Date(fechaVencimiento);
                finProrroga.setDate(finProrroga.getDate() + diasProrroga);

                if (this.esMismoDia(hoy, fechaVencimiento)) {
                    return { miembro, estado: "Por vencer", fechaPago: this.fechaISO(fechaVencimiento) };
                }

                if (hoy > fechaVencimiento && hoy <= finProrroga) {
                    return { miembro, estado: "Por vencer", fechaPago: this.fechaISO(fechaVencimiento) };
                }

                if (hoy > finProrroga) {
                    return { miembro, estado: "Pendiente", fechaPago: this.fechaISO(fechaVencimiento) };
                }

                return { miembro, estado: "Al día", fechaPago: this.fechaISO(fechaVencimiento) };
            });
    },

    obtenerFechaVencimientoMiembro(miembro, base = new Date()) {
        const fechaRegistro = new Date(`${miembro.fechaRegistro || this.fechaISO(base)}T00:00:00`);
        const diaRegistro = Number.isNaN(fechaRegistro.getTime()) ? 1 : fechaRegistro.getDate();
        const anio = base.getFullYear();
        const mes = base.getMonth();
        const ultimoDiaMes = new Date(anio, mes + 1, 0).getDate();
        const diaPago = Math.min(diaRegistro, ultimoDiaMes);

        return new Date(anio, mes, diaPago);
    },

    esMismoDia(a, b) {
        return a.getFullYear() === b.getFullYear()
            && a.getMonth() === b.getMonth()
            && a.getDate() === b.getDate();
    },

    fechaISO(fecha) {
        return fecha.toISOString().split("T")[0];
    },

    actualizarTablaMiembros() {
        const tbody = document.getElementById("tablaMiembrosTbody");

        if (!tbody) {
            console.warn("No se encontró tablaMiembrosTbody");
            return;
        }

        tbody.innerHTML = "";
        const busqueda = (document.getElementById("buscarMiembro")?.value || "").trim().toLowerCase();
        const miembrosFiltrados = this.miembros.filter(miembro => {
            if (!busqueda) return true;

            return String(miembro.nombre || "").toLowerCase().includes(busqueda)
                || String(miembro.cedula || "").toLowerCase().includes(busqueda);
        });

        if (miembrosFiltrados.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="py-8 text-center text-slate-500">
                        No hay miembros que coincidan con la búsqueda.
                    </td>
                </tr>
            `;
        }

        miembrosFiltrados.forEach(miembro => {
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
        this.miembroSeleccionado = this.miembros.find(m => this.idsIguales(m.id, miembroId));

        document.querySelectorAll("#tablaMiembrosTbody tr").forEach(tr => {
            tr.classList.remove("bg-emerald-50");
        });

        row.classList.add("bg-emerald-50");

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

    async eliminarMiembroSeleccionado() {
        if (!this.miembroSeleccionado) {
            this.mostrarAlerta("error", "Selecciona un miembro primero.");
            return;
        }

        const confirmar = confirm(`¿Seguro que deseas eliminar a ${this.miembroSeleccionado.nombre}? Se marcará como inactivo.`);

        if (!confirmar) return;

        try {
            if (this.puedeUsarSupabase()) {
                const { error } = await this.supabase
                    .from("Miembros")
                    .update({ estado: "inactivo" })
                    .eq("id", this.miembroSeleccionado.id);

                if (error) {
                    throw new Error(error.message || "No se pudo inactivar el miembro en Supabase.");
                }
                this.mostrarAlerta("exito", "Miembro marcado como inactivo correctamente.");
            } else {
                this.mostrarAlerta("info", "Eliminando localmente (Supabase no disponible).");
            }
        } catch (error) {
            console.error("Error eliminando miembro:", error);
            this.mostrarAlerta("error", error.message || "No se pudo eliminar el miembro.");
            return;
        }

        // Remover localmente también
        this.miembros = this.miembros.filter(m => !this.idsIguales(m.id, this.miembroSeleccionado.id));
        this.pagos = this.pagos.filter(p => !this.idsIguales(p.miembroId, this.miembroSeleccionado.id));
        this.asistencias = this.asistencias.filter(a => !this.idsIguales(a.miembroId, this.miembroSeleccionado.id));

        this.guardarMiembros();
        this.guardarPagos();
        this.guardarAsistencias();
        this.actualizarTablaPagos();
        this.sincronizarVistaMiembros();
        this.limpiarSeleccion();
    },

    limpiarSeleccion() {
        this.miembroSeleccionado = null;

        document.querySelectorAll("#tablaMiembrosTbody tr").forEach(tr => {
            tr.classList.remove("bg-emerald-50");
        });

        const btnEditar = document.getElementById("btnAbrirEditarMiembroTabla");
        const btnEliminar = document.getElementById("btnEliminarMiembro");

        if (btnEditar) btnEditar.disabled = true;
        if (btnEliminar) btnEliminar.disabled = true;
    },

    sincronizarVistaMiembros() {
        this.actualizarTablaMiembros();
        this.cargarSelectMiembrosPago();
        this.renderizarAsistencia();
        this.actualizarIndicadores();
        this.renderizarReportes();
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

        this.actualizarIndicadoresAsistencia(fechaSeleccionada);

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
                this.idsIguales(item.miembroId, miembro.id) && item.fecha === fechaSeleccionada
            );
            const presente = asistencia?.estado === "Presente";
            const estadoClase = presente
                ? "bg-green-100 text-green-700"
                : "bg-orange-100 text-orange-700";
            const botonClase = presente
                ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                : "bg-emerald-600 text-white hover:bg-emerald-700";

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
                        data-marcar-presente="${this.escaparHtml(miembro.id)}"
                        ${presente ? "disabled" : ""}
                        class="${botonClase} px-4 py-2 rounded-xl text-xs font-semibold transition-colors">
                        Marcar presente
                    </button>
                </td>
            `;

            tbody.appendChild(row);
        });

        tbody.querySelectorAll("[data-marcar-presente]").forEach(button => {
            button.addEventListener("click", () => this.marcarPresente(button.dataset.marcarPresente));
        });

        this.setText("contadorMiembros", `Total de Miembros: ${miembrosActivos.length} de ${this.miembros.length}`);
    },

    actualizarIndicadoresAsistencia(fechaSeleccionada = "") {
        const fecha = fechaSeleccionada || document.getElementById("fechaAsistencia")?.value || new Date().toISOString().split("T")[0];
        const activos = this.miembros.filter(miembro => (miembro.estado || "").toLowerCase() === "activo");
        const presentes = activos.filter(miembro =>
            this.asistencias.some(asistencia =>
                this.idsIguales(asistencia.miembroId, miembro.id) &&
                asistencia.fecha === fecha &&
                asistencia.estado === "Presente"
            )
        ).length;
        const ausentes = Math.max(0, activos.length - presentes);
        const porcentaje = activos.length > 0 ? Math.round((presentes / activos.length) * 100) : 0;

        this.setText("asistenciaPresentes", presentes);
        this.setText("asistenciaAusentes", ausentes);
        this.setText("asistenciaPorcentaje", `${porcentaje}%`);
    },

    obtenerHoraLlegadaActual() {
        return new Date().toLocaleTimeString("en-GB", { hour12: false });
    },

    async marcarPresente(miembroId) {
        const miembroNormalizado = this.normalizarId(miembroId);
        const miembro = this.miembros.find(item => this.idsIguales(item.id, miembroNormalizado));

        if (!miembro || (miembro.estado || "").toLowerCase() !== "activo") {
            this.mostrarAlerta("error", "El miembro seleccionado no está activo.");
            return;
        }

        const fechaInput = document.getElementById("fechaAsistencia");
        const fecha = fechaInput?.value || new Date().toISOString().split("T")[0];
        const yaRegistrada = this.asistencias.some(item =>
            this.idsIguales(item.miembroId, miembro.id) && item.fecha === fecha
        );

        if (yaRegistrada) {
            this.mostrarAlerta("info", "Este miembro ya fue marcado presente en esta fecha.");
            this.renderizarAsistencia();
            return;
        }

        if (this.puedeUsarSupabase()) {
            const { data: existente, error: errorConsulta } = await this.supabase
                .from("asistencias")
                .select("id")
                .eq("miembro_id", miembro.id)
                .eq("fecha", fecha)
                .maybeSingle();

            if (errorConsulta) {
                this.mostrarAlerta("error", errorConsulta.message || "No se pudo validar la asistencia existente.");
                return;
            }

            if (existente?.id) {
                this.mostrarAlerta("info", "Este miembro ya tiene asistencia registrada en esta fecha.");
                await this.cargarAsistenciasDesdeSupabase();
                this.renderizarAsistencia();
                this.actualizarIndicadores();
                return;
            }

            const horaLlegada = this.obtenerHoraLlegadaActual();
            const payload = {
                miembro_id: miembro.id,
                fecha,
                hora_llegada: horaLlegada,
                estado: "Presente",
                usuario_registro: this.obtenerUsuarioRegistroActivo()
            };

            if (this.obtenerGimnasioIdActivo()) {
                payload.gimnasio_id = this.obtenerGimnasioIdActivo();
            }

            let { data: row, error } = await this.supabase
                .from("asistencias")
                .insert(payload)
                .select("id,created_at,miembro_id,fecha,hora_llegada,estado,usuario_registro")
                .single();

            if (error && payload.gimnasio_id && String(error.message || "").toLowerCase().includes("gimnasio_id")) {
                delete payload.gimnasio_id;
                ({ data: row, error } = await this.supabase
                    .from("asistencias")
                    .insert(payload)
                    .select("id,created_at,miembro_id,fecha,hora_llegada,estado,usuario_registro")
                    .single());
            }

            if (error) {
                const duplicado = error.code === "23505" || String(error.message || "").toLowerCase().includes("duplicate");
                this.mostrarAlerta("error", duplicado
                    ? "Este miembro ya tiene asistencia registrada en esta fecha."
                    : error.message || "No se pudo registrar la asistencia.");
                return;
            }

            this.asistencias.push(this.normalizarAsistencia(row));

            this.guardarAsistencias();
            this.renderizarAsistencia();
            this.actualizarIndicadores();
            this.mostrarAlerta("exito", `${miembro.nombre} marcado presente.`);
            return;
        }

        this.asistencias.push({
            id: Date.now(),
            miembroId: miembro.id,
            fecha,
            hora: this.obtenerHoraLlegadaActual(),
            estado: "Presente",
            usuarioRegistro: this.obtenerUsuarioRegistroActivo()
        });

        this.guardarAsistencias();
        this.renderizarAsistencia();
        this.actualizarIndicadores();
        this.mostrarAlerta("exito", `${miembro.nombre} marcado presente.`);
    },

    renderizarPagos() {
        const tbodyRecientes = document.getElementById("tablaPagosRecientesTbody");
        const tbodyHistorial = document.getElementById("tablaPagosHistorialTbody");

        const pagosRecientes = [...this.pagos].slice(-5).reverse();

        if (tbodyRecientes) {
            tbodyRecientes.innerHTML = "";

            pagosRecientes.forEach(pago => {
                const estado = this.normalizarEstadoPago(pago.estado);
                const estadoClase = this.obtenerClaseEstadoPago(estado);

                const row = document.createElement("tr");
                row.className = "border-b";

                row.innerHTML = `
                    <td class="py-4 font-medium text-slate-800">${this.escaparHtml(pago.miembroNombre)}</td>
                    <td class="py-4 text-slate-500">${this.escaparHtml(pago.mes)}</td>
                    <td class="py-4 text-slate-500">RD$ ${pago.monto.toFixed(2)}</td>
                    <td class="py-4">
                        <span class="${estadoClase} px-3 py-1 rounded-full text-xs font-semibold">
                            ${this.escaparHtml(estado)}
                        </span>
                    </td>
                    <td class="py-4">
                        <button 
                            type="button"
                            data-factura-pago="${this.escaparHtml(pago.id)}"
                            class="text-emerald-600 hover:text-emerald-700 text-xs font-semibold transition-colors">
                            <i class="fa-solid fa-eye mr-1"></i> Ver
                        </button>
                    </td>
                `;

                tbodyRecientes.appendChild(row);
            });

            tbodyRecientes.querySelectorAll("[data-factura-pago]").forEach(button => {
                button.addEventListener("click", () => this.abrirFactura(button.dataset.facturaPago));
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
                const coincideEstado = estadoFiltro === "todos" || this.normalizarEstadoPago(pago.estado) === estadoFiltro;

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
            const estado = this.normalizarEstadoPago(pago.estado);
            const estadoClase = this.obtenerClaseEstadoPago(estado);

            const row = document.createElement("tr");
            row.className = "border-b";

            row.innerHTML = `
                <td class="py-4 font-medium text-slate-800">${this.escaparHtml(pago.miembroNombre)}</td>
                <td class="py-4 text-slate-500">${this.escaparHtml(pago.mes)}</td>
                <td class="py-4 text-slate-500">RD$ ${pago.monto.toFixed(2)}</td>
                <td class="py-4 text-slate-500">${this.formatearFecha(pago.fecha)}</td>
                <td class="py-4 text-slate-500">${this.escaparHtml(pago.referenciaPago || "N/A")}</td>
                <td class="py-4">
                    <select
                        data-estado-pago="${this.escaparHtml(pago.id)}"
                        aria-label="Cambiar estado del pago de ${this.escaparHtml(pago.miembroNombre)}"
                        title="Cambiar estado del pago"
                        class="${estadoClase} max-w-36 rounded-full border-0 px-3 py-1 text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500">
                        <option value="Pagado" ${estado === "Pagado" ? "selected" : ""}>Pagado</option>
                        <option value="Pendiente" ${estado === "Pendiente" ? "selected" : ""}>Pendiente</option>
                        <option value="En gracia" ${estado === "En gracia" ? "selected" : ""}>En gracia</option>
                    </select>
                </td>
                <td class="py-4">
                    <button 
                        type="button"
                            data-factura-pago="${this.escaparHtml(pago.id)}"
                        class="text-emerald-600 hover:text-emerald-700 text-xs font-semibold transition-colors">
                        <i class="fa-solid fa-eye mr-1"></i> Ver
                    </button>
                </td>
            `;

            tbodyHistorial.appendChild(row);
        });

        tbodyHistorial.querySelectorAll("[data-factura-pago]").forEach(button => {
            button.addEventListener("click", () => this.abrirFactura(button.dataset.facturaPago));
        });

        tbodyHistorial.querySelectorAll("[data-estado-pago]").forEach(select => {
            select.addEventListener("change", async () => {
                await this.actualizarEstadoPago(select.dataset.estadoPago, select.value);
            });
        });
    },

    actualizarTablaPagos() {
        this.renderizarPagos();
    },

    obtenerClaseEstadoPago(estado) {
        if (estado === "Pagado") return "bg-green-100 text-green-700";
        if (estado === "En gracia") return "bg-blue-100 text-blue-700";
        return "bg-orange-100 text-orange-700";
    },

    async actualizarEstadoPago(pagoId, estadoNuevo) {
        const pago = this.pagos.find(item => this.idsIguales(item.id, pagoId));

        if (!pago) {
            this.mostrarAlerta("error", "Pago no encontrado.");
            return;
        }

        const estado = this.normalizarEstadoPago(estadoNuevo);
        const estadoAnterior = pago.estado;

        pago.estado = estado;
        this.sincronizarFacturaPagoSupabase(pago);
        this.guardarPagos();
        this.renderizarPagos();
        this.actualizarIndicadores();
        this.actualizarIndicadoresPagosInteligentes();

        if (this.puedeUsarSupabase()) {
            const { error } = await this.supabase
                .from("pagos")
                .update({ estado })
                .eq("id", pago.id);

            if (error) {
                pago.estado = estadoAnterior;
                this.sincronizarFacturaPagoSupabase(pago);
                this.guardarPagos();
                this.renderizarPagos();
                this.actualizarIndicadores();
                this.actualizarIndicadoresPagosInteligentes();
                this.mostrarAlerta("error", error.message || "No se pudo actualizar el estado del pago.");
                return;
            }
        }

        this.mostrarAlerta("exito", `Pago marcado como ${estado}.`);
    },

    async eliminarPago(pagoId) {
        const pago = this.pagos.find(item => this.idsIguales(item.id, pagoId));

        if (!pago) return false;

        if (this.puedeUsarSupabase()) {
            const { error } = await this.supabase
                .from("pagos")
                .delete()
                .eq("id", pago.id);

            if (error) {
                this.mostrarAlerta("error", error.message || "No se pudo eliminar el pago.");
                return false;
            }
        }

        this.pagos = this.pagos.filter(item => !this.idsIguales(item.id, pago.id));
        this.facturas = this.facturas.filter(item => !this.idsIguales(item.referenciaId || item.id, pago.id));
        this.guardarPagos();
        this.guardarFacturas();
        this.renderizarPagos();
        this.actualizarIndicadores();
        this.actualizarIndicadoresPagosInteligentes();

        return true;
    },

    // =============================
    // Inventario
    // =============================

    obtenerImagenProducto(producto = {}, categoria = "") {
        if (typeof producto === "string") {
            return this.obtenerImagenAutomaticaProducto(producto, categoria);
        }

        return producto.imagen_url
            || producto.imagenUrl
            || producto.imagen
            || this.obtenerImagenAutomaticaProducto(producto.nombre, producto.categoria);
    },

    normalizarTextoImagenProducto(valor = "") {
        return String(valor)
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, " ")
            .trim();
    },

    obtenerImagenAutomaticaProducto(nombre = "", categoria = "") {
        const texto = this.normalizarTextoImagenProducto(`${nombre} ${categoria}`);

        const reglas = [
            { claves: ["gatorade", "powerade"], imagen: "../img/gatorade.png" },
            { claves: ["agua", "bebida", "bebidas"], imagen: "../img/agua.png" },
            { claves: ["creatina", "creatine"], imagen: "../img/creatina.png" },
            { claves: ["omega", "multivitaminico", "multivitamin"], imagen: "../img/omega.png" },
            { claves: ["proteina", "protein", "whey", "suplemento", "suplementos", "bcaa", "pre workout", "l carnitina"], imagen: "../img/proteina.png" }
        ];

        const regla = reglas.find(item => item.claves.some(clave => texto.includes(clave)));

        return regla?.imagen || "";
    },

    obtenerIconoCategoriaProducto(categoria = "Otros") {
        if (categoria === "Bebidas") return "fa-bottle-water";
        if (categoria === "Snacks") return "fa-cookie-bite";
        if (categoria === "Suplementos") return "fa-capsules";
        if (categoria === "Accesorios") return "fa-dumbbell";
        return "fa-box";
    },

    crearNombreArchivoProducto(file, productoId = Date.now()) {
        const extension = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        const base = file.name
            .replace(/\.[^/.]+$/, "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 48) || "producto";

        return `${this.obtenerGimnasioIdActivo() || "sin-gimnasio"}/${productoId}-${Date.now()}-${base}.${extension}`;
    },

    async subirImagenProducto(file, productoId) {
        if (!file) return "";

        if (!file.type.startsWith("image/")) {
            throw new Error("Selecciona un archivo de imagen valido.");
        }

        if (!window.kilvioSupabase) {
            throw new Error("Supabase no esta configurado para subir imagenes.");
        }

        const rutaArchivo = this.crearNombreArchivoProducto(file, productoId);
        const { error } = await window.kilvioSupabase.storage
            .from("productos")
            .upload(rutaArchivo, file, {
                cacheControl: "3600",
                upsert: false,
                contentType: file.type
            });

        if (error) {
            throw new Error(`No se pudo subir la imagen: ${error.message}`);
        }

        const { data } = window.kilvioSupabase.storage
            .from("productos")
            .getPublicUrl(rutaArchivo);

        return data?.publicUrl || "";
    },

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
                    <p class="text-slate-500 mt-2">Ajusta la búsqueda o solicita la activación de productos al administrador del sistema.</p>
                </div>
            `;
            return;
        }

        productosFiltrados.forEach(producto => {
            const stockBajo = producto.stock <= producto.stockMinimo;
            const sinStock = producto.stock <= 0;
            const inactivo = producto.estado === "inactivo";
            const estadoTexto = inactivo ? "Inactivo" : stockBajo ? "Stock bajo" : "Disponible";
            const estadoClase = inactivo
                ? "bg-slate-200 text-slate-600"
                : stockBajo
                ? "bg-orange-100 text-orange-700"
                : "bg-green-100 text-green-700";
            const stockClase = stockBajo
                ? "bg-orange-100 text-orange-700"
                : producto.categoria === "Bebidas"
                ? "bg-blue-100 text-blue-700"
                : "bg-emerald-100 text-emerald-700";
            const imagenProducto = this.obtenerImagenProducto(producto);
            const iconoFallback = this.obtenerIconoCategoriaProducto(producto.categoria);
            const iconoClase = imagenProducto ? "hidden" : "";
            const imagenMarkup = imagenProducto
                ? `<img src="${this.escaparHtml(imagenProducto)}" alt="${this.escaparHtml(producto.nombre)}" class="h-full w-full object-contain p-4" onerror="this.classList.add('hidden'); this.nextElementSibling.classList.remove('hidden');">`
                : "";

            const card = document.createElement("article");
            card.className = "bg-white rounded-3xl p-6 shadow-sm border border-slate-200";
            card.innerHTML = `
                <div class="h-40 bg-slate-100 rounded-2xl flex items-center justify-center overflow-hidden mb-5">
                    ${imagenMarkup}
                    <i class="fa-solid ${iconoFallback} ${iconoClase} text-5xl text-slate-400"></i>
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
                        <p class="text-2xl font-bold text-emerald-600">RD$ ${producto.precio.toLocaleString("es-DO")}</p>
                        <span class="${estadoClase} px-3 py-1 rounded-full text-xs font-semibold">${estadoTexto}</span>
                    </div>
                    <div class="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
                        <p>Costo: <span class="font-semibold text-slate-900">RD$ ${Number(producto.costo || 0).toLocaleString("es-DO")}</span></p>
                        <p>Mínimo: <span class="font-semibold text-slate-900">${producto.stockMinimo}</span></p>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3 mt-6">
                    <button type="button" data-producto-ver="${producto.id}" class="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors">Ver</button>
                    <button type="button" data-producto-editar="${producto.id}" class="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors ${this.esAdministrador() ? "" : "hidden"}">Editar</button>
                    <button type="button" data-producto-stock="${producto.id}" class="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors ${this.esAdministrador() ? "" : "hidden"}">Actualizar stock</button>
                    <button type="button" data-producto-estado="${producto.id}" class="col-span-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors ${this.esAdministrador() ? "" : "hidden"}">${inactivo ? "Activar" : "Inactivar"}</button>
                </div>
            `;

            const ver = card.querySelector("[data-producto-ver]");
            if (ver) {
                ver.addEventListener("click", () => {
                    this.mostrarAlerta("info", `${producto.nombre}: stock ${producto.stock}, minimo ${producto.stockMinimo}, precio RD$ ${producto.precio.toLocaleString("es-DO")}.`);
                });
            }

            const actualizarStock = card.querySelector("[data-producto-stock]");
            if (actualizarStock) {
                actualizarStock.addEventListener("click", () => {
                    this.abrirModalActualizarStock(producto.id);
                });
            }

            const editarProducto = card.querySelector("[data-producto-editar]");
            if (editarProducto) {
                editarProducto.addEventListener("click", () => {
                    this.abrirModalProducto(producto.id);
                });
            }

            const cambiarEstado = card.querySelector("[data-producto-estado]");
            if (cambiarEstado) {
                cambiarEstado.addEventListener("click", () => {
                    this.alternarEstadoProducto(producto.id);
                });
            }

            contenedor.appendChild(card);
        });
    },

    abrirModalProducto(productoId = null) {
        if (!this.esAdministrador()) {
            this.mostrarAlerta("error", "Solo el administrador puede crear o editar productos.");
            return;
        }

        const producto = this.productos.find(item => this.idsIguales(item.id, productoId));
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
        this.setValue("stockProductoInventario", producto?.stock ?? "");
        this.setValue("stockMinimoProductoInventario", producto?.stockMinimo ?? 5);
    },

    async guardarProductoDesdeFormulario() {
        const id = this.normalizarId(document.getElementById("productoIdInventario")?.value);
        const nombre = (document.getElementById("nombreProductoInventario")?.value || "").trim();
        const categoria = document.getElementById("categoriaProductoInventario")?.value || "Otros";
        const precio = Number(document.getElementById("precioProductoInventario")?.value);
        const stock = Number(document.getElementById("stockProductoInventario")?.value);
        const stockMinimo = Number(document.getElementById("stockMinimoProductoInventario")?.value);

        if (!nombre) {
            this.mostrarAlerta("error", "Completa el nombre del producto.");
            return;
        }

        if (isNaN(precio) || precio < 0 || isNaN(stock) || stock < 0 || isNaN(stockMinimo) || stockMinimo < 0) {
            this.mostrarAlerta("error", "Precio, stock y stock mínimo deben ser valores válidos.");
            return;
        }

        const productoId = id || Date.now();
        const imagenUrl = this.obtenerImagenProducto(nombre, categoria);

        const productoData = {
            nombre,
            categoria,
            precio,
            costo: 0,
            stock,
            stock_minimo: stockMinimo,
            imagen_url: imagenUrl || null,
            estado: "activo"
        };

        if (this.obtenerGimnasioIdActivo()) {
            productoData.gimnasio_id = this.obtenerGimnasioIdActivo();
        }

        let guardadoEnSupabase = false;

        if (this.puedeUsarSupabase()) {
            try {
                if (id) {
                const { data, error } = await this.supabase
                    .from("productos")
                    .update({
                        nombre,
                        categoria,
                        precio,
                        stock,
                        stock_minimo: stockMinimo,
                        imagen_url: imagenUrl || null
                    })
                    .eq("id", id)
                    .select("id,gimnasio_id,nombre,categoria,precio,costo,stock,stock_minimo,imagen_url,estado,created_at")
                    .single();

                if (error) throw error;

                const index = this.productos.findIndex(producto => this.idsIguales(producto.id, id));
                const productoNormalizado = this.normalizarProducto(data);

                if (index >= 0) {
                    this.productos[index] = productoNormalizado;
                } else {
                    this.productos.push(productoNormalizado);
                }
                } else {
                let { data, error } = await this.supabase
                    .from("productos")
                    .insert(productoData)
                    .select("id,gimnasio_id,nombre,categoria,precio,costo,stock,stock_minimo,imagen_url,estado,created_at")
                    .single();

                if (error) throw error;

                this.productos.push(this.normalizarProducto(data));
                }

                guardadoEnSupabase = true;
            } catch (error) {
                console.warn("No se pudo guardar producto en Supabase.", error);
                this.mostrarAlerta("error", error?.message || "No se pudo guardar producto en Supabase.");
                return;
            }
        }

        if (guardadoEnSupabase) {
            this.guardarProductos();
            this.renderizarProductos();
            this.actualizarIndicadoresInventario();

            if (typeof modalManager !== "undefined") {
                modalManager.closeModal("modalProductoInventario");
            }

            this.mostrarAlerta("exito", id ? "Producto actualizado correctamente." : "Producto creado correctamente.");
            return;
        }

        if (id) {
            const index = this.productos.findIndex(producto => this.idsIguales(producto.id, id));

            if (index === -1) {
                this.mostrarAlerta("error", "Producto no encontrado.");
                return;
            }

            this.productos[index] = {
                ...this.productos[index],
                nombre,
                categoria,
                precio,
                stock,
                stockMinimo,
                estado: this.productos[index].estado || "activo",
                imagen: imagenUrl,
                imagen_url: imagenUrl
            };

            this.mostrarAlerta("exito", "Producto actualizado correctamente.");
        } else {
            this.productos.push({
                id: productoId,
                nombre,
                categoria,
                precio,
                costo: 0,
                stock,
                stockMinimo,
                estado: "activo",
                imagen: imagenUrl,
                imagen_url: imagenUrl
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

    async alternarEstadoProducto(productoId) {
        if (!this.esAdministrador()) {
            this.mostrarAlerta("error", "Solo el administrador puede activar o inactivar productos.");
            return;
        }

        const producto = this.productos.find(item => this.idsIguales(item.id, productoId));

        if (!producto) return;

        const nuevoEstado = producto.estado === "inactivo" ? "activo" : "inactivo";

        if (this.puedeUsarSupabase()) {
            try {
                const { error } = await this.supabase
                    .from("productos")
                    .update({ estado: nuevoEstado })
                    .eq("id", producto.id);

                if (error) throw error;
            } catch (error) {
                console.warn("No se pudo cambiar estado en Supabase. Se usara localStorage temporal.", error);
            }
        }

        producto.estado = nuevoEstado;
        this.guardarProductos();
        this.renderizarProductos();
        this.renderizarPOS();
        this.mostrarAlerta("exito", `${producto.nombre} marcado como ${producto.estado}.`);
    },

    abrirModalActualizarStock(productoId) {
        if (!this.esAdministrador()) {
            this.mostrarAlerta("error", "Solo el administrador puede actualizar stock.");
            return;
        }

        const producto = this.productos.find(item => this.idsIguales(item.id, productoId));

        if (!producto) {
            this.mostrarAlerta("error", "Producto no encontrado.");
            return;
        }

        const form = document.getElementById("formActualizarStock");
        if (form) form.reset();

        this.setValue("stockProductoId", producto.id);
        this.setValue("stockProductoNombre", producto.nombre);
        this.setValue("stockActualProducto", producto.stock);
        this.setValue("costoUnitarioCompraProducto", Number(producto.costo || 0).toFixed(2));
        this.setValue("fechaCompraProducto", new Date().toISOString().split("T")[0]);
        this.cargarSelectProveedoresCompra();

        if (typeof modalManager !== "undefined") {
            modalManager.openModal("modalActualizarStock");
        }
    },

    cargarSelectProveedoresCompra() {
        const select = document.getElementById("proveedorCompraProducto");

        if (!select) return;

        const proveedoresActivos = this.proveedores.filter(proveedor => proveedor.estado !== "inactivo");
        select.innerHTML = proveedoresActivos.length
            ? proveedoresActivos.map(proveedor => `<option value="${proveedor.id}">${this.escaparHtml(proveedor.nombre)}</option>`).join("")
            : `<option value="">Sin proveedores activos</option>`;
    },

    async guardarActualizacionStock() {
        if (!this.esAdministrador()) {
            this.mostrarAlerta("error", "Solo el administrador puede actualizar stock.");
            return;
        }

        const productoId = this.normalizarId(document.getElementById("stockProductoId")?.value);
        const cantidad = Number(document.getElementById("cantidadCompraProducto")?.value);
        const costoUnitario = Number(document.getElementById("costoUnitarioCompraProducto")?.value);
        const producto = this.productos.find(item => this.idsIguales(item.id, productoId));

        if (!producto || cantidad <= 0 || costoUnitario < 0) {
            this.mostrarAlerta("error", "Completa producto, cantidad y costo unitario.");
            return;
        }

        if (this.puedeUsarSupabase()) {
            try {
                const stockActualizado = Number(producto.stock || 0) + cantidad;
                const { data, error } = await this.supabase
                    .from("productos")
                    .update({
                        stock: stockActualizado,
                        costo: costoUnitario
                    })
                    .eq("id", producto.id)
                    .select("id,gimnasio_id,nombre,categoria,precio,costo,stock,stock_minimo,imagen_url,estado,created_at")
                    .single();

                if (error) throw error;

                const productoActualizado = this.normalizarProducto(data);
                this.productos = this.productos.map(item =>
                    this.idsIguales(item.id, producto.id) ? productoActualizado : item
                );
                this.guardarProductos();

                this.renderizarProductos();
                this.actualizarIndicadoresInventario();

                if (typeof modalManager !== "undefined") {
                    modalManager.closeModal("modalActualizarStock");
                }

                this.mostrarAlerta("exito", `Stock actualizado: ${producto.nombre} queda en ${productoActualizado.stock}.`);
                return;
            } catch (error) {
                console.warn("No se pudo actualizar stock en Supabase. Se usara localStorage temporal.", error);
            }
        }

        producto.stock += cantidad;
        producto.costo = costoUnitario;

        this.guardarProductos();
        this.renderizarProductos();
        this.actualizarIndicadoresInventario();

        if (typeof modalManager !== "undefined") {
            modalManager.closeModal("modalActualizarStock");
        }

        this.mostrarAlerta("exito", `Stock actualizado: +${cantidad} ${producto.nombre}.`);
    },

    renderizarPOS() {
        const contenedor = document.getElementById("contenedorProductosPOS");

        if (!contenedor) return;

        const busqueda = (document.getElementById("buscarProductoPOS")?.value || "").trim().toLowerCase();
        const productosDisponibles = this.productos.filter(producto => {
            const activo = producto.estado !== "inactivo";
            const coincide = producto.nombre.toLowerCase().includes(busqueda) || producto.categoria.toLowerCase().includes(busqueda);
            return activo && coincide;
        });

        if (productosDisponibles.length === 0) {
            contenedor.innerHTML = `
                <div class="sm:col-span-2 xl:col-span-4 bg-white rounded-3xl p-10 shadow-sm border border-slate-200 text-center">
                    <i class="fa-solid fa-cash-register text-4xl text-slate-300 mb-4"></i>
                    <h2 class="text-xl font-bold text-slate-900">No hay productos disponibles para vender</h2>
                    <p class="text-slate-500 mt-2">Revisa el inventario o activa productos existentes.</p>
                </div>
            `;
            return;
        }

        contenedor.innerHTML = productosDisponibles.map(producto => {
            const imagenProducto = this.obtenerImagenProducto(producto);
            const iconoFallback = this.obtenerIconoCategoriaProducto(producto.categoria);
            const imagenMarkup = imagenProducto
                ? `<img src="${this.escaparHtml(imagenProducto)}" alt="${this.escaparHtml(producto.nombre)}" class="h-full w-full object-contain p-4" onerror="this.classList.add('hidden'); this.nextElementSibling.classList.remove('hidden');">`
                : "";
            const sinStock = Number(producto.stock) <= 0;

            return `
                <article class="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                    <div class="h-32 bg-slate-100 rounded-2xl flex items-center justify-center overflow-hidden mb-4">
                        ${imagenMarkup}
                        <i class="fa-solid ${iconoFallback} ${imagenProducto ? "hidden" : ""} text-4xl text-slate-400"></i>
                    </div>
                    <h2 class="text-lg font-bold text-slate-900">${this.escaparHtml(producto.nombre)}</h2>
                    <p class="text-sm text-slate-500">${this.escaparHtml(producto.categoria)} · Stock ${producto.stock}</p>
                    <p class="text-2xl font-bold text-emerald-600 mt-3">RD$ ${Number(producto.precio || 0).toLocaleString("es-DO")}</p>
                    <button type="button" data-pos-agregar="${producto.id}" class="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60" ${sinStock || !this.puedeVenderProductos() ? "disabled" : ""}>
                        Agregar
                    </button>
                </article>
            `;
        }).join("");

        contenedor.querySelectorAll("[data-pos-agregar]").forEach(button => {
            button.addEventListener("click", () => {
                this.agregarAlCarritoPOS(button.dataset.posAgregar);
            });
        });
    },

    agregarAlCarritoPOS(productoId) {
        if (!this.puedeVenderProductos()) {
            this.mostrarAlerta("error", "Tu rol no permite vender productos desde POS.");
            return;
        }

        const productoNormalizado = this.normalizarId(productoId);
        const producto = this.productos.find(item => this.idsIguales(item.id, productoNormalizado));

        if (!producto) {
            this.mostrarAlerta("error", "Producto no encontrado.");
            return;
        }

        if (producto.estado === "inactivo") {
            this.mostrarAlerta("error", "Este producto esta inactivo y no puede agregarse al carrito.");
            return;
        }

        if (Number(producto.stock || 0) <= 0) {
            this.mostrarAlerta("error", "No hay stock disponible para este producto.");
            return;
        }

        const itemExistente = this.carritoPOS.find(item => this.idsIguales(item.productoId, producto.id));
        const cantidadActual = Number(itemExistente?.cantidad || 0);

        if (cantidadActual + 1 > Number(producto.stock || 0)) {
            this.mostrarAlerta("error", "No puedes agregar mas unidades que el stock disponible.");
            return;
        }

        if (itemExistente) {
            itemExistente.cantidad += 1;
        } else {
            this.carritoPOS.push({
                productoId: producto.id,
                nombre: producto.nombre,
                precio: Number(producto.precio || 0),
                stockDisponible: Number(producto.stock || 0),
                cantidad: 1
            });
        }

        this.renderizarCarritoPOS();
    },

    quitarDelCarritoPOS(productoId) {
        this.carritoPOS = this.carritoPOS.filter(item => !this.idsIguales(item.productoId, productoId));
        this.renderizarCarritoPOS();
    },

    actualizarCantidadCarritoPOS(productoId, cantidad) {
        const item = this.carritoPOS.find(carritoItem => this.idsIguales(carritoItem.productoId, productoId));
        const producto = this.productos.find(productoItem => this.idsIguales(productoItem.id, productoId));

        if (!item || !producto) return;

        const cantidadNormalizada = Math.floor(Number(cantidad));

        if (!Number.isFinite(cantidadNormalizada) || cantidadNormalizada < 1) {
            this.mostrarAlerta("error", "La cantidad debe ser al menos 1.");
            this.renderizarCarritoPOS();
            return;
        }

        if (cantidadNormalizada > Number(producto.stock || 0)) {
            this.mostrarAlerta("error", "No puedes vender mas unidades que el stock disponible.");
            this.renderizarCarritoPOS();
            return;
        }

        item.cantidad = cantidadNormalizada;
        item.stockDisponible = Number(producto.stock || 0);
        item.precio = Number(producto.precio || 0);
        this.renderizarCarritoPOS();
    },

    renderizarCarritoPOS() {
        const tbody = document.getElementById("tablaCarritoPOSTbody");
        const total = this.calcularTotalCarritoPOS();
        const totalElemento = document.getElementById("totalCarritoPOS");
        const btnConfirmar = document.getElementById("btnConfirmarVentaPOS");
        const btnLimpiar = document.getElementById("btnLimpiarCarritoPOS");

        if (totalElemento) {
            totalElemento.textContent = this.formatearMoneda(total);
        }

        if (btnConfirmar) {
            btnConfirmar.disabled = this.carritoPOS.length === 0;
        }

        if (btnLimpiar) {
            btnLimpiar.disabled = this.carritoPOS.length === 0;
            btnLimpiar.classList.toggle("opacity-60", this.carritoPOS.length === 0);
            btnLimpiar.classList.toggle("cursor-not-allowed", this.carritoPOS.length === 0);
        }

        if (!tbody) return;

        if (this.carritoPOS.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="py-8 text-center text-slate-500">El carrito esta vacio.</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.carritoPOS.map(item => {
            const subtotal = Number(item.cantidad || 0) * Number(item.precio || 0);

            return `
                <tr class="border-b">
                    <td class="py-4">
                        <p class="font-semibold text-slate-900">${this.escaparHtml(item.nombre)}</p>
                        <p class="text-xs text-slate-500">Stock disponible: ${item.stockDisponible}</p>
                    </td>
                    <td class="py-4">
                        <input type="number" min="1" max="${item.stockDisponible}" value="${item.cantidad}" data-pos-cantidad="${item.productoId}" aria-label="Cantidad de ${this.escaparHtml(item.nombre)}" class="w-24 rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500">
                    </td>
                    <td class="py-4 text-slate-600">${this.formatearMoneda(item.precio)}</td>
                    <td class="py-4 font-bold text-slate-900">${this.formatearMoneda(subtotal)}</td>
                    <td class="py-4 text-right">
                        <button type="button" data-pos-quitar="${item.productoId}" class="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100">
                            Quitar
                        </button>
                    </td>
                </tr>
            `;
        }).join("");

        tbody.querySelectorAll("[data-pos-cantidad]").forEach(input => {
            input.addEventListener("change", () => {
                this.actualizarCantidadCarritoPOS(input.dataset.posCantidad, input.value);
            });
        });

        tbody.querySelectorAll("[data-pos-quitar]").forEach(button => {
            button.addEventListener("click", () => {
                this.quitarDelCarritoPOS(button.dataset.posQuitar);
            });
        });
    },

    limpiarCarritoPOS() {
        this.carritoPOS = [];
        this.renderizarCarritoPOS();
    },

    calcularTotalCarritoPOS() {
        return this.carritoPOS.reduce((total, item) =>
            total + (Number(item.precio || 0) * Number(item.cantidad || 0)), 0
        );
    },

    async venderProducto(productoId) {
        if (!this.puedeVenderProductos()) {
            this.mostrarAlerta("error", "Tu rol no permite vender productos desde POS.");
            return;
        }

        const productoNormalizado = this.normalizarId(productoId);
        const producto = this.productos.find(item => this.idsIguales(item.id, productoNormalizado));

        if (!producto) {
            this.mostrarAlerta("error", "Producto no encontrado.");
            return;
        }

        if (producto.estado === "inactivo") {
            this.mostrarAlerta("error", "Este producto esta inactivo y no puede venderse.");
            return;
        }

        if (producto.stock <= 0) {
            this.mostrarAlerta("error", "No hay stock disponible para este producto.");
            return;
        }

        const metodoPago = document.getElementById("metodoPagoPOS")?.value || "Efectivo";
        const referenciaPago = (document.getElementById("referenciaPagoPOS")?.value || "").trim();

        if (["Tarjeta", "Transferencia"].includes(metodoPago) && !referenciaPago) {
            this.mostrarAlerta("error", "Para tarjeta o transferencia debes registrar referencia o voucher.");
            return;
        }

        if (this.puedeUsarSupabase()) {
            const { data: resultado, error } = await this.supabase.rpc("vender_producto", {
                p_producto_id: producto.id,
                p_cantidad: 1,
                p_metodo_pago: metodoPago,
                p_referencia_pago: referenciaPago || null
            });

            if (error) {
                this.mostrarAlerta("error", error.message || "No se pudo registrar la venta en Supabase.");
                return;
            }

            const ventaServidor = Array.isArray(resultado) ? resultado[0] : resultado;

            await Promise.all([
                this.cargarProductosDesdeSupabase(),
                this.cargarVentasDesdeSupabase(),
                this.cargarMovimientosDesdeSupabase(),
                this.cargarFacturasDesdeSupabase()
            ]);

            this.ingresosProductos = this.ventas.reduce((total, venta) => total + Number(venta.total || 0), 0);
            this.guardarIngresosProductos();
            this.renderizarProductos();
            this.renderizarPOS();
            this.actualizarIndicadoresInventario();
            this.renderizarReportes();
            this.mostrarAlerta("exito", `Venta registrada ${ventaServidor?.numero_recibo || ""}: ${producto.nombre}.`);
            return;
        }

        const fecha = new Date().toISOString().split("T")[0];
        const usuarioRegistro = this.obtenerUsuarioRegistroActivo();
        const ventaId = Date.now();
        const detalleId = ventaId + 1;
        const factura = this.crearFacturaOperacion({
            fecha,
            concepto: `producto - ${producto.nombre}`,
            monto: producto.precio,
            estado: "Pagado",
            usuarioRegistro
        });

        producto.stock -= 1;
        this.ingresosProductos += producto.precio;

        this.ventas.push({
            id: ventaId,
            fecha,
            metodoPago,
            referenciaPago,
            total: producto.precio,
            usuarioRegistro,
            facturaNumero: factura?.numero || ""
        });

        this.ventaDetalles.push({
            id: detalleId,
            ventaId,
            productoId: producto.id,
            productoNombre: producto.nombre,
            cantidad: 1,
            precioUnitario: producto.precio,
            costoUnitario: Number(producto.costo || 0),
            total: producto.precio
        });

        this.movimientosInventario.push({
            id: ventaId + 2,
            productoId: producto.id,
            productoNombre: producto.nombre,
            tipo: "salida",
            cantidad: 1,
            stockPosterior: producto.stock,
            referenciaTipo: "venta",
            referenciaId: ventaId,
            fecha,
            usuarioRegistro,
            observacion: metodoPago
        });

        this.guardarProductos();
        this.guardarIngresosProductos();
        this.guardarVentasProductos();
        this.guardarMovimientosInventario();
        this.renderizarProductos();
        this.renderizarPOS();
        this.actualizarIndicadoresInventario();
        this.renderizarReportes();
        this.mostrarAlerta("exito", `Venta registrada: ${producto.nombre}.`);
    },

    async eliminarProducto(productoId) {
        const producto = this.productos.find(item => this.idsIguales(item.id, productoId));

        if (!producto) {
            this.mostrarAlerta("error", "Producto no encontrado.");
            return;
        }

        const confirmar = confirm(`¿Seguro que deseas inactivar ${producto.nombre} del inventario?`);

        if (!confirmar) return;

        if (this.puedeUsarSupabase()) {
            try {
                const { error } = await this.supabase
                    .from("productos")
                    .update({ estado: "inactivo" })
                    .eq("id", producto.id);

                if (error) throw error;
            } catch (error) {
                console.warn("No se pudo inactivar producto en Supabase. Se usara localStorage temporal.", error);
            }
        }

        producto.estado = "inactivo";
        this.guardarProductos();
        this.renderizarProductos();
        this.actualizarIndicadoresInventario();
        this.mostrarAlerta("exito", "Producto inactivado correctamente.");
    },

    actualizarIndicadoresInventario() {
        const totalProductos = this.productos.length;
        const stockBajo = this.productos.filter(producto => producto.stock <= producto.stockMinimo).length;

        this.setText("totalProductos", totalProductos);
        this.setText("stockBajo", stockBajo);
        this.setText("ingresosProductos", `RD$ ${this.ingresosProductos.toLocaleString("es-DO")}`);
    },

    abrirModalProveedor(proveedorId = null) {
        if (!this.esAdministrador()) {
            this.mostrarAlerta("error", "Solo el administrador puede editar proveedores.");
            return;
        }

        const proveedor = this.proveedores.find(item => this.idsIguales(item.id, proveedorId));
        const form = document.getElementById("formProveedor");

        if (form) form.reset();

        this.setText("modalProveedorTitle", proveedor ? "Editar proveedor" : "Nuevo proveedor");
        this.setValue("proveedorId", proveedor?.id || "");
        this.setValue("nombreProveedor", proveedor?.nombre || "");
        this.setValue("telefonoProveedor", proveedor?.telefono || "");
        this.setValue("emailProveedor", proveedor?.email || "");
        this.setValue("direccionProveedor", proveedor?.direccion || "");
        this.setValue("productoPrincipalProveedor", proveedor?.producto_principal || "");
        this.setValue("observacionesProveedor", proveedor?.observaciones || "");
        this.setValue("estadoProveedor", proveedor?.estado || "activo");

        if (typeof modalManager !== "undefined") {
            modalManager.openModal("modalProveedor");
        }
    },

    guardarProveedorDesdeFormulario() {
        if (!this.esAdministrador()) {
            this.mostrarAlerta("error", "Solo el administrador puede guardar proveedores.");
            return;
        }

        const id = this.normalizarId(document.getElementById("proveedorId")?.value);
        const nombre = (document.getElementById("nombreProveedor")?.value || "").trim();

        if (!nombre) {
            this.mostrarAlerta("error", "Completa el nombre del proveedor.");
            return;
        }

        const proveedor = {
            id: id || Date.now(),
            nombre,
            telefono: (document.getElementById("telefonoProveedor")?.value || "").trim(),
            email: (document.getElementById("emailProveedor")?.value || "").trim(),
            direccion: (document.getElementById("direccionProveedor")?.value || "").trim(),
            producto_principal: (document.getElementById("productoPrincipalProveedor")?.value || "").trim(),
            observaciones: (document.getElementById("observacionesProveedor")?.value || "").trim(),
            estado: document.getElementById("estadoProveedor")?.value || "activo"
        };

        if (id) {
            const index = this.proveedores.findIndex(item => this.idsIguales(item.id, id));
            if (index !== -1) this.proveedores[index] = proveedor;
        } else {
            this.proveedores.push(proveedor);
        }

        this.guardarProveedores();
        this.renderizarProveedores();
        this.cargarSelectProveedoresCompra();

        if (typeof modalManager !== "undefined") {
            modalManager.closeModal("modalProveedor");
        }

        this.mostrarAlerta("exito", "Proveedor guardado correctamente.");
    },

    alternarEstadoProveedor(proveedorId) {
        if (!this.esAdministrador()) {
            this.mostrarAlerta("error", "Solo el administrador puede cambiar proveedores.");
            return;
        }

        const proveedor = this.proveedores.find(item => this.idsIguales(item.id, proveedorId));

        if (!proveedor) return;

        proveedor.estado = proveedor.estado === "inactivo" ? "activo" : "inactivo";
        this.guardarProveedores();
        this.renderizarProveedores();
        this.cargarSelectProveedoresCompra();
    },

    renderizarProveedores() {
        const lista = document.getElementById("listaProveedores");
        const btnNuevoProveedor = document.getElementById("btnNuevoProveedor");

        if (btnNuevoProveedor) {
            btnNuevoProveedor.classList.toggle("hidden", !this.esAdministrador());
        }

        if (!lista) return;

        if (this.proveedores.length === 0) {
            lista.innerHTML = `<p class="text-sm text-slate-500">No hay proveedores registrados.</p>`;
            return;
        }

        lista.innerHTML = this.proveedores.map(proveedor => {
            const estadoClase = proveedor.estado === "inactivo" ? "bg-slate-200 text-slate-600" : "bg-green-100 text-green-700";
            return `
                <article class="rounded-2xl border border-slate-200 p-4">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <h3 class="font-bold text-slate-900">${this.escaparHtml(proveedor.nombre)}</h3>
                            <p class="text-sm text-slate-500">${this.escaparHtml(proveedor.producto_principal || "Sin producto principal")}</p>
                        </div>
                        <span class="${estadoClase} px-3 py-1 rounded-full text-xs font-semibold">${this.escaparHtml(proveedor.estado)}</span>
                    </div>
                    <p class="mt-3 text-sm text-slate-600">${this.escaparHtml(proveedor.telefono || "Sin telefono")}</p>
                    <p class="text-sm text-slate-600">${this.escaparHtml(proveedor.email || "Sin email")}</p>
                    <div class="mt-4 grid grid-cols-2 gap-2 ${this.esAdministrador() ? "" : "hidden"}">
                        <button type="button" data-proveedor-editar="${proveedor.id}" class="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">Editar</button>
                        <button type="button" data-proveedor-estado="${proveedor.id}" class="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">${proveedor.estado === "inactivo" ? "Activar" : "Inactivar"}</button>
                    </div>
                </article>
            `;
        }).join("");

        lista.querySelectorAll("[data-proveedor-editar]").forEach(button => {
            button.addEventListener("click", () => this.abrirModalProveedor(button.dataset.proveedorEditar));
        });

        lista.querySelectorAll("[data-proveedor-estado]").forEach(button => {
            button.addEventListener("click", () => this.alternarEstadoProveedor(button.dataset.proveedorEstado));
        });
    },

    renderizarComprasProveedores() {
        const tbody = document.getElementById("tablaComprasProveedoresTbody");

        if (!tbody) return;

        if (this.comprasProveedores.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="py-8 text-center text-slate-500">No hay compras registradas.</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = [...this.comprasProveedores]
            .sort((a, b) => b.fecha.localeCompare(a.fecha))
            .map(compra => `
                <tr class="border-b">
                    <td class="py-4 text-slate-600">${this.formatearFecha(compra.fecha)}</td>
                    <td class="py-4 font-medium text-slate-800">${this.escaparHtml(compra.proveedorNombre)}</td>
                    <td class="py-4 text-slate-600">${this.escaparHtml(compra.productoNombre)}</td>
                    <td class="py-4 text-slate-600">${compra.cantidad}</td>
                    <td class="py-4 text-slate-600">${this.formatearMoneda(compra.costoUnitario)}</td>
                    <td class="py-4 font-bold text-slate-900">${this.formatearMoneda(compra.total)}</td>
                    <td class="py-4 text-slate-600">${this.escaparHtml(compra.usuarioRegistro)}</td>
                </tr>
            `).join("");
    },

    // =============================
    // Ingresos diarios
    // =============================

    actualizarTotalIngresoDiarioPreview() {
        const cantidadInput = document.getElementById("cantidadIngresosDiarios");
        const cantidad = Math.max(1, Number(cantidadInput?.value) || 1);
        const precioUnitario = this.obtenerEntradaDiaria();
        const total = cantidad * precioUnitario;

        if (cantidadInput && Number(cantidadInput.value) !== cantidad) {
            cantidadInput.value = cantidad;
        }

        this.setText("totalIngresoDiarioPreview", `RD$ ${total.toLocaleString("es-DO")}`);
    },

    async registrarIngresoDiario() {
        const cantidadInput = document.getElementById("cantidadIngresosDiarios");
        const cantidad = Number(cantidadInput?.value) || 0;
        const precioUnitario = this.obtenerEntradaDiaria();
        const total = cantidad * precioUnitario;

        if (cantidad <= 0) {
            this.mostrarAlerta("error", "La cantidad debe ser mayor a cero.");
            return;
        }

        if (total < 0) {
            this.mostrarAlerta("error", "El total no puede ser negativo.");
            return;
        }

        // TODO BACKEND: la fecha debe validarse desde backend para evitar manipulacion desde el navegador.
        const fechaHoy = new Date().toISOString().split("T")[0];
        const usuarioRegistro = this.obtenerUsuarioRegistroActivo();
        const ingresoDelDia = this.ingresosDiarios.find(ingreso => ingreso.fecha === fechaHoy);

        if (this.puedeUsarSupabase()) {
            const { data: ingresosExistentes, error: errorConsulta } = await this.supabase
                .from("ingresos_diarios")
                .select("id,fecha,cantidad,precio_unitario,total,usuario_registro")
                .eq("fecha", fechaHoy)
                .order("created_at", { ascending: true })
                .limit(1);

            if (errorConsulta) {
                this.mostrarAlerta("error", errorConsulta.message || "No se pudo consultar el ingreso del día.");
                return;
            }

            let row = null;

            const ingresoExistente = Array.isArray(ingresosExistentes) ? ingresosExistentes[0] : null;

            if (ingresoExistente?.id) {
                const cantidadActual = Number(ingresoExistente.cantidad) || 0;
                const usuarioActual = ingresoExistente.usuario_registro || "";
                const payloadUpdate = {
                    cantidad: cantidadActual + cantidad,
                    precio_unitario: precioUnitario,
                    usuario_registro: this.combinarUsuariosRegistro(usuarioActual, usuarioRegistro)
                };

                const { data, error } = await this.supabase
                    .from("ingresos_diarios")
                    .update(payloadUpdate)
                    .eq("id", ingresoExistente.id)
                    .select("id,created_at,fecha,cantidad,precio_unitario,total,usuario_registro")
                    .single();

                if (error) {
                    this.mostrarAlerta("error", error.message || "No se pudo actualizar el ingreso diario.");
                    return;
                }

                row = data;
            } else {
                const payloadInsert = {
                    fecha: fechaHoy,
                    cantidad,
                    precio_unitario: precioUnitario,
                    usuario_registro: usuarioRegistro
                };

                if (this.obtenerGimnasioIdActivo()) {
                    payloadInsert.gimnasio_id = this.obtenerGimnasioIdActivo();
                }

                let { data, error } = await this.supabase
                    .from("ingresos_diarios")
                    .insert(payloadInsert)
                    .select("id,created_at,fecha,cantidad,precio_unitario,total,usuario_registro")
                    .single();

                if (error && payloadInsert.gimnasio_id && String(error.message || "").toLowerCase().includes("gimnasio_id")) {
                    delete payloadInsert.gimnasio_id;
                    ({ data, error } = await this.supabase
                        .from("ingresos_diarios")
                        .insert(payloadInsert)
                        .select("id,created_at,fecha,cantidad,precio_unitario,total,usuario_registro")
                        .single());
                }

                if (error) {
                    this.mostrarAlerta("error", error.message || "No se pudo registrar el ingreso diario.");
                    return;
                }

                row = data;
            }

            const ingresoNormalizado = this.normalizarIngresoDiario(row);
            this.ingresosDiarios = this.agruparIngresosDiarios([
                ...this.ingresosDiarios.filter(ingreso => ingreso.fecha !== fechaHoy),
                ingresoNormalizado
            ]);

            if (cantidadInput) cantidadInput.value = 1;

            this.guardarIngresosDiarios();
            this.actualizarTotalIngresoDiarioPreview();
            this.renderizarIngresosDiarios();
            this.actualizarIndicadores();
            this.renderizarReportes();
            this.mostrarAlerta("exito", `Ingreso diario registrado por RD$ ${total.toLocaleString("es-DO")}.`);
            return;
        }

        if (ingresoDelDia) {
            ingresoDelDia.cantidad += cantidad;
            ingresoDelDia.precioUnitario = precioUnitario;
            ingresoDelDia.total = Number(ingresoDelDia.total || 0) + total;
            ingresoDelDia.usuarioRegistro = this.combinarUsuariosRegistro(ingresoDelDia.usuarioRegistro, usuarioRegistro);
        } else {
            this.ingresosDiarios.push({
                id: Date.now(),
                fecha: fechaHoy,
                cantidad,
                precioUnitario,
                total,
                usuarioRegistro
            });
        }

        this.crearFacturaOperacion({
            fecha: fechaHoy,
            concepto: "entrada diaria",
            monto: total,
            estado: "Pagado",
            usuarioRegistro
        });

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
                    <td colspan="5" class="py-8 text-center text-slate-500">
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
                    <td class="py-4 text-slate-600">${this.formatearMoneda(ingreso.precioUnitario || this.obtenerEntradaDiaria())}</td>
                    <td class="py-4 font-bold text-emerald-600">RD$ ${ingreso.total.toLocaleString("es-DO")}</td>
                    <td class="py-4 text-slate-600">${this.escaparHtml(ingreso.usuarioRegistro || "Usuario demo")}</td>
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
            const precioUnitario = Number(ingreso.precioUnitario || ingreso.precio_unitario || precioEntrada) || precioEntrada;
            const cantidadDesdeTotal = Math.floor((Number(ingreso.total) || 0) / precioUnitario);
            const cantidad = Math.max(0, Number(ingreso.cantidad) || cantidadDesdeTotal);
            const total = Number(ingreso.total) || cantidad * precioUnitario;

            if (!fecha || cantidad <= 0) return;

            const existente = ingresosPorFecha.get(fecha) || {
                id: Number(ingreso.id) || Date.now() + index,
                fecha,
                cantidad: 0,
                precioUnitario,
                total: 0,
                usuarioRegistro: ingreso.usuarioRegistro || "Usuario demo"
            };

            existente.cantidad += cantidad;
            existente.total += total;
            existente.precioUnitario = precioUnitario;
            existente.usuarioRegistro = this.combinarUsuariosRegistro(existente.usuarioRegistro, ingreso.usuarioRegistro || "Usuario demo");
            ingresosPorFecha.set(fecha, existente);
        });

        return [...ingresosPorFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
    },

    obtenerUsuarioRegistroActivo() {
        const usuarioSesion = this.usuarioActivo || window.auth?.getStoredActiveUser?.();

        if (usuarioSesion?.nombre || usuarioSesion?.email) {
            return usuarioSesion.nombre || usuarioSesion.email;
        }

        // Fallback temporal para datos locales heredados.
        const usuarioActivoRaw = localStorage.getItem("usuarioActivo");

        if (!usuarioActivoRaw) return "Usuario demo";

        try {
            const usuarioActivo = JSON.parse(usuarioActivoRaw);

            if (typeof usuarioActivo === "string" && usuarioActivo.trim()) {
                return usuarioActivo.trim();
            }

            return (
                usuarioActivo.nombre ||
                usuarioActivo.usuario ||
                usuarioActivo.email ||
                "Usuario demo"
            );
        } catch (error) {
            return usuarioActivoRaw.trim() || "Usuario demo";
        }
    },

    combinarUsuariosRegistro(usuarioActual, usuarioNuevo) {
        const usuarios = new Set(
            String(usuarioActual || "Usuario demo")
                .split(",")
                .map(usuario => usuario.trim())
                .filter(Boolean)
        );

        usuarios.add(usuarioNuevo || "Usuario demo");

        return [...usuarios].join(", ");
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

    generarNumeroReciboTemporal(prefijo = "PAG") {
        const fecha = new Date();
        const compacta = [
            fecha.getFullYear(),
            String(fecha.getMonth() + 1).padStart(2, "0"),
            String(fecha.getDate()).padStart(2, "0"),
            String(fecha.getHours()).padStart(2, "0"),
            String(fecha.getMinutes()).padStart(2, "0"),
            String(fecha.getSeconds()).padStart(2, "0")
        ].join("");
        const aleatorio = Math.floor(Math.random() * 1000).toString().padStart(3, "0");

        return `${prefijo}-${compacta}-${aleatorio}`;
    },

    normalizarFacturaSupabase(factura = {}) {
        return {
            id: this.normalizarId(factura.referencia_id || factura.id),
            uuid: factura.id,
            gimnasioId: this.normalizarId(factura.gimnasio_id),
            tipo: factura.tipo || "pago",
            referenciaId: this.normalizarId(factura.referencia_id),
            numero: factura.numero_recibo || "",
            fecha: factura.fecha || new Date().toISOString().split("T")[0],
            cliente: factura.cliente || "",
            concepto: factura.concepto || factura.tipo || "mensualidad",
            monto: Number(factura.total) || 0,
            estado: "Pagado",
            metodoPago: factura.metodo_pago || "",
            referenciaPago: factura.referencia_pago || "",
            usuarioRegistro: factura.usuario_registro || this.obtenerUsuarioRegistroActivo(),
            createdAt: factura.created_at || ""
        };
    },

    sincronizarFacturaPagoSupabase(pago) {
        const factura = {
            id: pago.id,
            referenciaId: pago.id,
            numero: pago.facturaNumero || this.generarNumeroReciboTemporal("FAC"),
            fecha: pago.fecha,
            cliente: pago.miembroNombre,
            concepto: pago.concepto || "mensualidad",
            monto: Number(pago.monto) || 0,
            estado: this.normalizarEstadoPago(pago.estado),
            metodoPago: pago.metodo || "",
            referenciaPago: pago.referenciaPago || "",
            usuarioRegistro: pago.usuarioRegistro || this.obtenerUsuarioRegistroActivo()
        };

        this.facturas = [
            ...this.facturas.filter(item => !this.idsIguales(item.referenciaId || item.id, pago.id)),
            factura
        ];
        this.guardarFacturas();
    },

    async abrirFactura(pagoId) {
        const pago = this.pagos.find(p => this.idsIguales(p.id, pagoId));

        if (!pago) {
            this.mostrarAlerta("error", "Factura no encontrada.");
            return;
        }

        const factura = await this.obtenerFacturaPago(pago);

        if (!factura) {
            this.mostrarAlerta("error", "No se pudo generar la factura.");
            return;
        }

        this.actualizarContenidoFactura(pago, factura);

        if (typeof modalManager !== "undefined") {
            modalManager.openModal("modalFactura");
        }
    },

    async obtenerFacturaPago(pago) {
        let factura = this.facturas.find(item =>
            this.idsIguales(item.referenciaId, pago.id) ||
            (this.idsIguales(item.id, pago.id) && item.concepto === (pago.concepto || "mensualidad")) ||
            (pago.facturaNumero && item.numero === pago.facturaNumero)
        );

        if (this.puedeUsarSupabase()) {
            const facturaSupabase = await this.obtenerOCrearFacturaPagoSupabase(pago);

            if (facturaSupabase) {
                factura = facturaSupabase;
            }
        }

        if (!factura) {
            factura = this.crearFacturaOperacion({
                id: pago.id,
                fecha: pago.fecha,
                concepto: pago.concepto || "mensualidad",
                monto: pago.monto,
                estado: pago.estado,
                usuarioRegistro: pago.usuarioRegistro || this.obtenerUsuarioRegistroActivo()
            });
        } else {
            factura.monto = Number(pago.monto) || factura.monto;
            factura.estado = this.normalizarEstadoPago(pago.estado);
            factura.fecha = pago.fecha || factura.fecha;
            this.guardarFacturas();
        }

        pago.facturaNumero = factura.numero;
        this.guardarPagos();

        return factura;
    },

    async obtenerOCrearFacturaPagoSupabase(pago) {
        const referenciaId = this.normalizarId(pago.id);
        const { data: existentes, error: errorConsulta } = await this.supabase
            .from("facturas")
            .select("id,gimnasio_id,tipo,referencia_id,numero_recibo,fecha,cliente,concepto,metodo_pago,referencia_pago,total,usuario_registro,created_at")
            .eq("tipo", "pago")
            .eq("referencia_id", referenciaId)
            .limit(1);

        if (errorConsulta) {
            console.error("FACTURA CONSULTA ERROR:", errorConsulta);
            this.mostrarAlerta("error", errorConsulta.message || "No se pudo consultar la factura en Supabase.");
            return null;
        }

        if (Array.isArray(existentes) && existentes.length > 0) {
            const facturaExistente = this.normalizarFacturaSupabase(existentes[0]);
            this.facturas = [
                ...this.facturas.filter(item => !this.idsIguales(item.referenciaId || item.id, pago.id)),
                facturaExistente
            ];
            this.guardarFacturas();
            return facturaExistente;
        }

        const facturaData = {
            gimnasio_id: this.obtenerGimnasioIdActivo(),
            tipo: "pago",
            referencia_id: referenciaId,
            numero_recibo: pago.facturaNumero || this.generarNumeroReciboTemporal("FAC"),
            fecha: pago.fecha,
            cliente: pago.miembroNombre || "",
            concepto: pago.concepto || "mensualidad",
            metodo_pago: pago.metodo || "",
            referencia_pago: pago.referenciaPago || null,
            total: Number(pago.monto) || 0,
            usuario_registro: pago.usuarioRegistro || this.obtenerUsuarioRegistroActivo()
        };

        const { data, error } = await this.supabase
            .from("facturas")
            .insert(facturaData)
            .select("id,gimnasio_id,tipo,referencia_id,numero_recibo,fecha,cliente,concepto,metodo_pago,referencia_pago,total,usuario_registro,created_at")
            .single();

        if (error) {
            this.mostrarAlerta("error", error.message || "No se pudo insertar la factura en Supabase.");
            return null;
        }

        const facturaCreada = this.normalizarFacturaSupabase(data);
        this.facturas = [
            ...this.facturas.filter(item => !this.idsIguales(item.referenciaId || item.id, pago.id)),
            facturaCreada
        ];
        this.guardarFacturas();

        pago.facturaNumero = facturaCreada.numero;
        this.guardarPagos();

        return facturaCreada;
    },

    crearFacturaOperacion(datos) {
        // TODO BACKEND:
        // - Reemplazar usuarioRegistro con usuario autenticado.
        // - Validar fecha desde servidor.
        // - Reemplazar localStorage con API.
        const factura = {
            id: Number(datos.id) || Date.now(),
            numero: this.obtenerSiguienteNumeroFactura(),
            fecha: datos.fecha || new Date().toISOString().split("T")[0],
            concepto: datos.concepto || "mensualidad",
            monto: Number(datos.monto) || 0,
            estado: this.normalizarEstadoPago(datos.estado),
            usuarioRegistro: datos.usuarioRegistro || this.obtenerUsuarioRegistroActivo()
        };

        this.facturas.push(factura);
        this.guardarFacturas();

        return factura;
    },

    obtenerSiguienteNumeroFactura() {
        const ultimoNumero = Number(localStorage.getItem(this.storageKeys.ultimoNumeroFactura)) || 148;
        const siguienteNumero = ultimoNumero + 1;

        localStorage.setItem(this.storageKeys.ultimoNumeroFactura, String(siguienteNumero));

        return String(siguienteNumero).padStart(6, "0");
    },

    actualizarContenidoFactura(pago, factura) {
        const miembro = this.miembros.find(m => this.idsIguales(m.id, pago.miembroId));
        const fecha = new Date(`${factura.fecha}T00:00:00`);
        const monto = this.formatearMoneda(factura.monto);
        const estado = this.normalizarEstadoPago(factura.estado || pago.estado);
        const estadoBadge = document.getElementById("facturaEstadoPago");

        this.setText("facturaNumero", factura.numero);
        this.setText("facturaCliente", pago.miembroNombre);
        this.setText("facturaTelefono", miembro?.telefono || "No registrado");
        this.setText("facturaConcepto", this.capitalizar(factura.concepto));
        this.setText("facturaMonto", monto);
        this.setText("facturaDia", String(fecha.getDate()).padStart(2, "0"));
        this.setText("facturaMes", String(fecha.getMonth() + 1).padStart(2, "0"));
        this.setText("facturaAnio", String(fecha.getFullYear()));
        this.setText("facturaUsuarioRegistro", factura.usuarioRegistro || "Usuario demo");
        this.setText("facturaEstadoPago", estado);

        if (estadoBadge) {
            estadoBadge.className = `inline-flex rounded-full px-3 py-1 text-xs font-bold ${this.obtenerClaseEstadoPago(estado)}`;
        }
    },

    // =============================
    // Mensualidad
    // =============================

    renderizarMensualidad() {
        const mensualidadFija = this.obtenerMensualidadFija();
        const entradaDiaria = this.obtenerEntradaDiaria();
        const diasProrroga = this.obtenerDiasProrroga();
        const estado = this.configuracionMensualidad.estado || "Activo";
        const nota = this.configuracionMensualidad.nota || "";

        this.setValue("configMensualidadFija", mensualidadFija);
        this.setValue("configEntradaDiaria", entradaDiaria);
        this.setValue("configDiasProrroga", diasProrroga);
        this.setValue("configEstadoMensualidad", estado);
        this.setValue("configNotaMensualidad", nota);
        this.setText("resumenMensualidadFija", this.formatearMoneda(mensualidadFija));
        this.setText("resumenEntradaDiaria", this.formatearMoneda(entradaDiaria));
        this.setText("resumenDiasProrroga", diasProrroga);
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

    async guardarConfiguracionMensualidadDesdeFormulario() {
        const mensualidadFija = this.normalizarMonto(document.getElementById("configMensualidadFija")?.value, 0);
        const entradaDiaria = this.normalizarMonto(document.getElementById("configEntradaDiaria")?.value, 0);
        const diasProrroga = Number(document.getElementById("configDiasProrroga")?.value);
        const estado = document.getElementById("configEstadoMensualidad")?.value || "Activo";
        const nota = (document.getElementById("configNotaMensualidad")?.value || "").trim();

        if (mensualidadFija <= 0 || entradaDiaria <= 0) {
            this.mostrarAlerta("error", "Los montos deben ser mayores que cero.");
            return;
        }

        if (!Number.isFinite(diasProrroga) || diasProrroga < 0) {
            this.mostrarAlerta("error", "Los días de prórroga no pueden ser negativos.");
            return;
        }

        const configuracionActualizada = {
            ...this.configuracionMensualidad,
            mensualidadFija,
            entradaDiaria,
            diasProrroga,
            estado: estado === "Inactivo" ? "Inactivo" : "Activo",
            nota
        };
        let guardadoEnSupabase = false;

        if (this.puedeUsarSupabase()) {
            try {
                const payload = {
                    monto_mensual: mensualidadFija,
                    entrada_diaria: entradaDiaria,
                    dias_prorroga: diasProrroga,
                    estado: configuracionActualizada.estado,
                    nota
                };
                let query = this.supabase
                    .from("configuracion_mensualidad")
                    .update(payload)
                    .select("id,gimnasio_id,monto_mensual,entrada_diaria,dias_prorroga,estado,nota,created_at,updated_at");

                if (configuracionActualizada.id) {
                    query = query.eq("id", configuracionActualizada.id);
                } else if (this.obtenerGimnasioIdActivo()) {
                    query = query.eq("gimnasio_id", this.obtenerGimnasioIdActivo());
                }

                const { data, error } = await query;

                if (error) throw error;

                const configuracionGuardada = Array.isArray(data) ? data[0] : data;

                if (configuracionGuardada) {
                    this.configuracionMensualidad = this.normalizarConfiguracionMensualidad(configuracionGuardada);
                    guardadoEnSupabase = true;
                } else {
                    await this.crearConfiguracionMensualidadInicialSupabase();
                    await this.guardarConfiguracionMensualidadDesdeFormulario();
                    return;
                }
            } catch (error) {
                console.warn("No se pudo guardar configuracion en Supabase. Se usara localStorage temporal.", error);
                this.configuracionMensualidad = configuracionActualizada;
            }
        } else {
            this.configuracionMensualidad = configuracionActualizada;
        }

        this.guardarConfiguracionMensualidad();
        this.renderizarMensualidad();
        this.renderizarReportes();
        this.mostrarAlerta(
            guardadoEnSupabase ? "exito" : "info",
            guardadoEnSupabase
                ? "Configuración de mensualidad guardada correctamente."
                : "Configuración guardada localmente como fallback temporal."
        );
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

    obtenerDiasProrroga() {
        return Math.max(0, Number(this.configuracionMensualidad.diasProrroga ?? 3) || 0);
    },

    // =============================
    // Reportes
    // =============================

    renderizarReportes() {
        this.renderizarFiltrosReporte();
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
            .filter(pago => this.normalizarEstadoPago(pago.estado) === "Pagado" && this.fechaEnRango(pago.fecha, fechaDesde, fechaHasta))
            .reduce((total, pago) => total + Number(pago.monto || 0), 0);
        const pagosPendientes = this.pagos.filter(pago => this.esPagoPendienteOperativo(pago.estado)).length;
        const mensualidadFija = this.obtenerMensualidadFija();
        const entradaDiariaConfigurada = this.obtenerEntradaDiaria();
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
        const tipoReporte = document.getElementById("tipoReporte")?.value || "ingresos";
        const filtroDetalle = document.getElementById("filtroReporteDetalle")?.value || "todos";

        this.setText("reporteMiembrosActivos", miembrosActivos);
        this.setText("reporteTotalPagosMensuales", `RD$ ${totalPagosMensuales.toLocaleString("es-DO")}`);
        this.setText("reportePagosPendientes", pagosPendientes);
        this.setText("reporteIngresosDiarios", `RD$ ${ingresosDiarios.toLocaleString("es-DO")}`);
        this.setText("reporteVentasProductos", `RD$ ${ventasProductos.toLocaleString("es-DO")}`);
        this.setText("reporteStockBajo", stockBajo);
        this.setText("reporteAsistenciasMes", asistenciasMes);
        this.setText("reporteIngresosTotales", `RD$ ${ingresosTotales.toLocaleString("es-DO")}`);
        this.renderizarRentabilidadProductos(fechaDesde, fechaHasta);

        const filasBase = [
            { indicador: "Miembros activos", valor: miembrosActivos, detalle: "Miembros actualmente activos" },
            { indicador: "Total pagos mensuales", valor: `RD$ ${totalPagosMensuales.toLocaleString("es-DO")}`, detalle: periodo },
            { indicador: "Pagos pendientes", valor: pagosPendientes, detalle: "Pagos marcados como pendientes" },
            { indicador: "Mensualidad fija", valor: this.formatearMoneda(mensualidadFija), detalle: "Valor configurado para registrar pagos" },
            { indicador: "Entrada diaria", valor: this.formatearMoneda(entradaDiariaConfigurada), detalle: "Valor configurado para ingresos diarios" },
            { indicador: "Ingresos diarios", valor: `RD$ ${ingresosDiarios.toLocaleString("es-DO")}`, detalle: periodo },
            { indicador: "Ventas de productos", valor: `RD$ ${ventasProductos.toLocaleString("es-DO")}`, detalle: "Total acumulado de inventario" },
            { indicador: "Stock bajo", valor: stockBajo, detalle: "Productos bajo su mínimo definido" },
            { indicador: "Asistencias del mes", valor: asistenciasMes, detalle: periodo },
            { indicador: "Ingresos totales", valor: `RD$ ${ingresosTotales.toLocaleString("es-DO")}`, detalle: "Pagos, entradas diarias y productos" }
        ];
        const filasPorTipo = {
            miembros: filasBase.filter(fila => ["Miembros activos", "Pagos pendientes", "Asistencias del mes"].includes(fila.indicador)),
            pagos: filasBase.filter(fila => ["Total pagos mensuales", "Pagos pendientes", "Mensualidad fija"].includes(fila.indicador)),
            asistencia: filasBase.filter(fila => ["Miembros activos", "Asistencias del mes"].includes(fila.indicador)),
            ingresos: filasBase.filter(fila => ["Ingresos diarios", "Ventas de productos", "Ingresos totales", "Entrada diaria"].includes(fila.indicador))
        };
        let filas = filasPorTipo[tipoReporte] || filasBase;

        if (tipoReporte === "miembros" && filtroDetalle !== "todos") {
            const totalEstado = this.miembros.filter(miembro => (miembro.estado || "").toLowerCase() === filtroDetalle).length;
            filas = [{ indicador: `Miembros ${filtroDetalle}`, valor: totalEstado, detalle: "Filtro por estado de miembro" }];
        }

        if (tipoReporte === "pagos" && filtroDetalle !== "todos") {
            filas = filas.filter(fila =>
                filtroDetalle === "Pagado"
                    ? fila.indicador === "Total pagos mensuales"
                    : fila.indicador === "Pagos pendientes"
            );
        }

        if (tipoReporte === "asistencia" && filtroDetalle !== "todos") {
            const activos = this.miembros.filter(miembro => (miembro.estado || "").toLowerCase() === "activo").length;
            const presentes = asistenciasMes;
            const valor = filtroDetalle === "Presente" ? presentes : Math.max(0, activos - presentes);
            filas = [{ indicador: filtroDetalle === "Presente" ? "Asistencias presentes" : "Miembros sin asistencia", valor, detalle: periodo }];
        }

        if (tipoReporte === "ingresos" && filtroDetalle !== "todos") {
            const indicadores = {
                pagos: "Total pagos mensuales",
                diarios: "Ingresos diarios",
                productos: "Ventas de productos"
            };
            filas = filas.filter(fila => fila.indicador === indicadores[filtroDetalle]);
        }

        this.reporteActualFilas = filas;

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
            { etiqueta: "Pagos", valor: totalPagosMensuales, color: "bg-emerald-600" },
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
            mensualidadFija,
            entradaDiariaConfigurada,
            ingresosDiarios,
            ventasProductos,
            stockBajo,
            asistenciasMes,
            ingresosTotales,
            filas
        };
    },

    exportarReporteCsv() {
        const filas = this.reporteActualFilas?.length
            ? this.reporteActualFilas
            : this.generarReporte({ silencioso: true })?.filas || [];

        if (!filas.length) {
            this.mostrarAlerta("info", "No hay datos de reporte para exportar.");
            return;
        }

        const escapeCsv = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
        const contenido = [
            ["Indicador", "Valor", "Detalle"],
            ...filas.map(fila => [fila.indicador, fila.valor, fila.detalle])
        ]
            .map(row => row.map(escapeCsv).join(","))
            .join("\r\n");
        const blob = new Blob([contenido], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = `reporte-kilvio-fit-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        this.mostrarAlerta("exito", "Reporte exportado correctamente.");
    },

    calcularRentabilidadProductos(fechaDesde = "", fechaHasta = "") {
        return this.productos.map(producto => {
            const detalles = this.ventaDetalles.filter(detalle => {
                if (!this.idsIguales(detalle.productoId, producto.id)) return false;
                const venta = this.ventas.find(item => this.idsIguales(item.id, detalle.ventaId));
                return this.fechaEnRango(venta?.fecha || "", fechaDesde, fechaHasta);
            });
            const unidades = detalles.reduce((total, detalle) => total + Number(detalle.cantidad || 0), 0);
            const ingresos = detalles.reduce((total, detalle) => total + Number(detalle.total || 0), 0);
            const costoTotal = detalles.reduce((total, detalle) => total + (Number(detalle.costoUnitario || producto.costo || 0) * Number(detalle.cantidad || 0)), 0);
            const ganancia = ingresos - costoTotal;
            const margen = ingresos > 0 ? (ganancia / ingresos) * 100 : 0;

            return {
                producto: producto.nombre,
                unidades,
                ingresos,
                costoTotal,
                ganancia,
                margen
            };
        }).filter(item => item.unidades > 0);
    },

    renderizarRentabilidadProductos(fechaDesde = "", fechaHasta = "") {
        const seccion = document.getElementById("seccionRentabilidadProductos");
        const tbody = document.getElementById("tablaRentabilidadProductosTbody");

        if (seccion) {
            seccion.classList.toggle("hidden", !this.esAdministrador());
        }

        if (!tbody || !this.esAdministrador()) return;

        const filas = this.calcularRentabilidadProductos(fechaDesde, fechaHasta);

        if (filas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="py-8 text-center text-slate-500">No hay ventas de productos para calcular rentabilidad.</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filas.map(fila => `
            <tr class="border-b">
                <td class="py-4 font-medium text-slate-800">${this.escaparHtml(fila.producto)}</td>
                <td class="py-4 text-slate-600">${fila.unidades}</td>
                <td class="py-4 text-slate-600">${this.formatearMoneda(fila.ingresos)}</td>
                <td class="py-4 text-slate-600">${this.formatearMoneda(fila.costoTotal)}</td>
                <td class="py-4 font-bold ${fila.ganancia >= 0 ? "text-emerald-600" : "text-red-600"}">${this.formatearMoneda(fila.ganancia)}</td>
                <td class="py-4 text-slate-600">${fila.margen.toFixed(1)}%</td>
            </tr>
        `).join("");
    },

    renderizarFiltrosReporte() {
        const tipoReporte = document.getElementById("tipoReporte")?.value || "ingresos";
        const contenedor = document.getElementById("filtrosReporteDinamicos");

        if (!contenedor) return;

        const textos = {
            miembros: {
                label: "Estado de miembro",
                options: [["todos", "Todos"], ["activo", "Activos"], ["inactivo", "Inactivos"]]
            },
            pagos: {
                label: "Estado de pago",
                options: [["todos", "Todos"], ["Pagado", "Pagados"], ["Pendiente", "Pendientes"]]
            },
            asistencia: {
                label: "Estado de asistencia",
                options: [["todos", "Todos"], ["Presente", "Presentes"], ["Ausente", "Ausentes"]]
            },
            ingresos: {
                label: "Fuente de ingreso",
                options: [["todos", "Todos"], ["pagos", "Pagos"], ["diarios", "Entradas diarias"], ["productos", "Productos"]]
            }
        };

        const config = textos[tipoReporte] || textos.ingresos;

        contenedor.innerHTML = `
            <label for="filtroReporteDetalle" class="block text-xs font-semibold text-slate-500 mb-2">${config.label}</label>
            <select id="filtroReporteDetalle" class="w-full md:w-64 border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500">
                ${config.options.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}
            </select>
        `;

        document.getElementById("filtroReporteDetalle")?.addEventListener("change", () => {
            this.generarReporte({ silencioso: true });
        });
    },

    calcularIngresosTotales(fechaDesde = "", fechaHasta = "") {
        const pagosMensuales = this.pagos
            .filter(pago => this.normalizarEstadoPago(pago.estado) === "Pagado" && this.fechaEnRango(pago.fecha, fechaDesde, fechaHasta))
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

    renderizarGraficoIngresosMensuales() {
        const area = document.getElementById("graficoIngresosMensuales");

        if (!area) return;

        const ingresosPorMes = new Map();
        const registrar = (fecha, monto) => {
            const clave = String(fecha || new Date().toISOString().split("T")[0]).slice(0, 7);
            ingresosPorMes.set(clave, (ingresosPorMes.get(clave) || 0) + Number(monto || 0));
        };

        this.pagos
            .filter(pago => this.normalizarEstadoPago(pago.estado) === "Pagado")
            .forEach(pago => registrar(pago.fecha, pago.monto));

        this.ingresosDiarios.forEach(ingreso => registrar(ingreso.fecha, ingreso.total));
        registrar(new Date().toISOString().slice(0, 7), this.ingresosProductos);

        const meses = [...ingresosPorMes.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-6);

        if (meses.length === 0) {
            area.innerHTML = `<p class="text-sm text-slate-500">No hay ingresos registrados para graficar.</p>`;
            return;
        }

        const maximo = Math.max(...meses.map(([, total]) => total), 1);

        area.innerHTML = meses.map(([mes, total]) => {
            const ancho = Math.max(6, Math.round((total / maximo) * 100));

            return `
                <div>
                    <div class="flex items-center justify-between text-sm mb-2">
                        <span class="font-semibold text-slate-700">${this.escaparHtml(mes)}</span>
                        <span class="text-slate-500">${this.formatearMoneda(total)}</span>
                    </div>
                    <div class="h-4 bg-slate-100 rounded-full overflow-hidden">
                        <div class="bg-emerald-600 h-full rounded-full" style="width: ${ancho}%"></div>
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

    renderizarResumenAuth() {
        const usuarioSesion = window.auth?.getStoredActiveUser?.() || {};
        const perfil = window.auth?.profile || this.perfilActivo || {};
        const usuarioAuth = window.auth?.user || this.usuarioActivo || {};
        const permisos = Array.isArray(usuarioSesion.permisos)
            ? usuarioSesion.permisos
            : Array.isArray(perfil.permisos)
            ? perfil.permisos
            : [];

        this.setText("configUsuarioActivoNombre", usuarioSesion.nombre || perfil.nombre || "No disponible");
        this.setText("configUsuarioActivoEmail", usuarioSesion.email || usuarioAuth.email || "No disponible");
        this.setText("configUsuarioActivoRol", usuarioSesion.rol || perfil.rol || "No disponible");
        this.setText("configUsuarioActivoPermisos", permisos.length ? permisos.join(", ") : "Sin permisos asignados");
    },

    renderizarUsuarios() {
        this.renderizarResumenAuth();
    },

    crearUsuario() {
        this.mostrarAlerta("info", "Los usuarios se crean manualmente desde Supabase Auth.");
    },

    editarUsuario(usuarioId) {
        this.mostrarAlerta("info", "Edita usuarios y perfiles directamente en Supabase.");
    },

    eliminarUsuario(usuarioId) {
        this.mostrarAlerta("info", "Elimina o desactiva usuarios desde Supabase Auth.");
    },

    obtenerPermisosUsuarioFormulario() {
        return [];
    },

    limpiarFormularioUsuario() {
        this.renderizarResumenAuth();
    },

    // =============================
    // Indicadores y utilidades
    // =============================

    actualizarIndicadores() {
        const miembrosActivos = this.miembros.filter(m => m.estado === "activo").length;

        const pagosPendientes = this.pagos.filter(p => this.esPagoPendienteOperativo(p.estado)).length;
        const mesActual = this.obtenerMesActual();

        const pagosMes = this.pagos
            .filter(p => this.normalizarEstadoPago(p.estado) === "Pagado" && p.mes === mesActual)
            .reduce((total, pago) => total + pago.monto, 0);

        const hoy = new Date().toISOString().split("T")[0];
        const asistenciasHoy = this.asistencias.filter(asistencia =>
            asistencia.fecha === hoy && asistencia.estado === "Presente"
        ).length;
        const ingresosDiariosHoy = this.ingresosDiarios
            .filter(ingreso => ingreso.fecha === hoy)
            .reduce((total, ingreso) => total + ingreso.total, 0);
        const mesActualISO = hoy.slice(0, 7);
        const ingresosDiariosMes = this.ingresosDiarios
            .filter(ingreso => String(ingreso.fecha || "").slice(0, 7) === mesActualISO)
            .reduce((total, ingreso) => total + Number(ingreso.total || 0), 0);

        this.setText("totalMiembros", miembrosActivos);
        this.setText("asistenciasHoy", asistenciasHoy);
        this.setText("pagosPendientes", pagosPendientes);
        this.setText("pagosMes", `RD$ ${pagosMes.toLocaleString("es-DO")}`);
        this.setText("ingresosDiariosHoy", `RD$ ${ingresosDiariosHoy.toLocaleString("es-DO")}`);
        this.setText("resumenMensualDashboard", this.formatearMoneda(pagosMes + ingresosDiariosMes + Number(this.ingresosProductos || 0)));
        this.actualizarIndicadoresPagosInteligentes();
        this.actualizarIndicadoresAsistencia();
        this.renderizarGraficoIngresosMensuales();
        this.renderizarAsistenciasRecientesDashboard();
    },

    renderizarAsistenciasRecientesDashboard() {
        const tbody = document.getElementById("tablaAsistenciasRecientesTbody");

        if (!tbody) return;

        const recientes = [...this.asistencias]
            .sort((a, b) => `${b.fecha} ${b.hora}`.localeCompare(`${a.fecha} ${a.hora}`))
            .slice(0, 5);

        if (recientes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="py-8 text-center text-slate-500">
                        No hay asistencias recientes.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = recientes.map(asistencia => {
            const miembro = this.miembros.find(item => this.idsIguales(item.id, asistencia.miembroId));

            return `
                <tr class="border-b">
                    <td class="py-4 font-medium text-slate-800">${this.escaparHtml(miembro?.nombre || "Miembro eliminado")}</td>
                    <td class="py-4 text-slate-500">${this.formatearFecha(asistencia.fecha)}</td>
                    <td class="py-4 text-slate-500">${this.escaparHtml(asistencia.hora || "N/A")}</td>
                    <td class="py-4">
                        <span class="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                            ${this.escaparHtml(asistencia.estado || "Presente")}
                        </span>
                    </td>
                </tr>
            `;
        }).join("");
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

    normalizarEstadoPago(estado) {
        const valor = String(estado || "").trim().toLowerCase();

        if (["pendiente", "pending"].includes(valor)) return "Pendiente";
        if (["en gracia", "gracia", "en_gracia"].includes(valor)) return "En gracia";
        return "Pagado";
    },

    esPagoPendienteOperativo(estado) {
        return ["Pendiente", "En gracia"].includes(this.normalizarEstadoPago(estado));
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

document.addEventListener("DOMContentLoaded", async () => {
    window.auth?.bindLogoutButtons?.();
    app.configurarNavegacion();

    const authResult = await window.auth?.protectRoute?.();

    if (authResult === null) return;

    try {
        await app.init();
    } catch (error) {
        console.error("APP INIT ERROR:", error);
        app.mostrarAlerta?.("error", error.message || "No se pudo iniciar correctamente la aplicacion.");
    }
});

function handleModalNuevoMiembro(data) {
    return app.handleModalNuevoMiembro(data);
}

function handleModalEditarMiembro(data) {
    return app.handleModalEditarMiembro(data);
}

function handleModalRegistrarPago(data) {
    return app.handleModalRegistrarPago(data);
}
