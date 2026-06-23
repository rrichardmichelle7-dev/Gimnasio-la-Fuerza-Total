const michelSoftApp = {
    clientes: [],
    pagos: [],
    tickets: [],
    accesos: [],
    alertas: [],
    accesoSaasValidado: false,

    async init() {
        try {
            if (!window.auth?.requireAuth) {
                window.location.replace("login.html");
                return;
            }

            const authResult = await window.auth.requireAuth();
            if (!authResult) return;

            if (!window.auth.isSuperAdminSaas(authResult.profile)) {
                document.body.dataset.authState = "blocked";
                window.location.replace(window.auth.appPath(authResult.profile));
                return;
            }

            this.accesoSaasValidado = true;

            const usuarioActivo = await window.auth.verificarEstadoUsuarioActivo();
            if (!usuarioActivo) return;

            window.auth.bindLogoutButtons();
            await this.cargarDatos();
            this.renderizar();
            document.getElementById("panel-michel-soft")?.classList.remove("hidden");
            document.body.dataset.surfaceState = "ready";
            document.body.dataset.authState = "ready";
        } catch (error) {
            console.error("MICHEL SOFT APP ERROR:", error);
            const errorBox = document.getElementById("saasLoadError");
            if (errorBox) {
                errorBox.textContent = error.message || "No se pudo cargar la administracion SaaS.";
                errorBox.classList.remove("hidden");
            }
            if (this.accesoSaasValidado) {
                document.body.dataset.surfaceState = "ready";
                document.body.dataset.authState = "ready";
            } else {
                document.body.dataset.authState = "blocked";
            }
        }
    },

    async consultar(tabla, columnas, orden = "created_at") {
        const { data, error } = await window.kilvioSupabase
            .from(tabla)
            .select(columnas)
            .order(orden, { ascending: false });

        if (error) throw new Error(tabla + ": " + error.message);
        return data || [];
    },

    async cargarDatos() {
        const [clientes, pagos, tickets, accesos, alertas] = await Promise.all([
            this.consultar(
                "gimnasios_clientes",
                "gimnasio_id,nombre_gimnasio,propietario,plan,estado,fecha_vencimiento,mensualidad,usuarios_count,estado_pago_saas,estado_tecnico",
                "nombre_gimnasio"
            ),
            this.consultar(
                "pagos_saas",
                "id,gimnasio_id,periodo_inicio,periodo_fin,monto,estado,fecha_vencimiento,fecha_pago,referencia_pago"
            ),
            this.consultar(
                "tickets_soporte",
                "id,gimnasio_id,titulo,categoria,prioridad,estado,created_at"
            ),
            this.consultar(
                "soporte_accesos",
                "id,gimnasio_id,motivo,fecha_inicio,fecha_fin,estado,created_at"
            ),
            this.consultar(
                "alertas_vencimiento_saas",
                "id,gimnasio_id,tipo,estado,fecha_programada"
            )
        ]);

        this.clientes = clientes;
        this.pagos = pagos;
        this.tickets = tickets;
        this.accesos = accesos;
        this.alertas = alertas;
    },

    renderizar() {
        const hoy = new Date();
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const finProximos = new Date(hoy);
        finProximos.setDate(finProximos.getDate() + 30);

        const clientesOperativos = this.clientes.filter(cliente => ["activo", "prueba"].includes(cliente.estado));
        const mensualidad = clientesOperativos.reduce((total, cliente) => total + Number(cliente.mensualidad || 0), 0);
        const proximos = this.clientes.filter(cliente => {
            const fecha = this.fecha(cliente.fecha_vencimiento);
            return fecha && fecha >= hoy && fecha <= finProximos;
        }).length;
        const ingresosMes = this.pagos
            .filter(pago => pago.estado === "pagado" && this.fecha(pago.fecha_pago) >= inicioMes)
            .reduce((total, pago) => total + Number(pago.monto || 0), 0);
        const pendientes = this.pagos
            .filter(pago => ["pendiente", "vencido"].includes(pago.estado))
            .reduce((total, pago) => total + Number(pago.monto || 0), 0);
        const vencidos = this.clientes.filter(cliente => {
            const fecha = this.fecha(cliente.fecha_vencimiento);
            return cliente.estado === "suspendido" || (fecha && fecha < hoy);
        }).length;
        const ticketsAbiertos = this.tickets.filter(ticket => !["resuelto", "cerrado"].includes(ticket.estado)).length;
        const accesosPendientes = this.accesos.filter(acceso => ["pendiente", "activo"].includes(acceso.estado)).length;
        const alertasPendientes = this.alertas.filter(alerta => alerta.estado === "pendiente").length;
        const estadoTecnico = this.clientes.some(cliente => cliente.estado_tecnico === "incidente")
            ? "Incidente"
            : this.clientes.some(cliente => cliente.estado_tecnico === "revision")
                ? "Revision"
                : "Operativo";

        this.texto("saasTotalGimnasios", this.clientes.length);
        this.texto("saasGimnasiosActivos", this.contarClientes("activo"));
        this.texto("saasGimnasiosPrueba", this.contarClientes("prueba"));
        this.texto("saasGimnasiosSuspendidos", this.contarClientes("suspendido"));
        this.texto("saasGimnasiosCancelados", this.contarClientes("cancelado"));
        this.texto("saasMensualidadEsperada", this.moneda(mensualidad));
        this.texto("saasProximosVencimientos", proximos);
        this.texto("saasSolicitudesSoporte", accesosPendientes);
        this.texto("saasEstadoTecnico", estadoTecnico);
        this.texto("saasMRR", this.moneda(mensualidad));
        this.texto("saasIngresosMes", this.moneda(ingresosMes));
        this.texto("saasPagosPendientes", this.moneda(pendientes));
        this.texto("saasClientesVencidos", vencidos);
        this.texto("saasTicketsAbiertos", ticketsAbiertos);
        this.texto("saasAlertasVencimiento", alertasPendientes);

        const nombres = new Map(this.clientes.map(cliente => [String(cliente.gimnasio_id), cliente.nombre_gimnasio]));
        this.renderizarClientes();
        this.renderizarPagos(nombres);
        this.renderizarTickets(nombres);
        this.renderizarAccesos(nombres);
    },

    renderizarClientes() {
        this.tabla("tablaClientesSaasTbody", this.clientes, 8, cliente =>
            "<tr class='border-b border-slate-100 text-sm'>" +
                "<td class='py-3 font-semibold'>" + this.esc(cliente.nombre_gimnasio) + "</td>" +
                "<td class='py-3'>" + this.esc(cliente.propietario || "-") + "</td>" +
                "<td class='py-3'>" + this.esc(cliente.plan) + "</td>" +
                "<td class='py-3'>" + this.estado(cliente.estado) + "</td>" +
                "<td class='py-3'>" + this.formatearFecha(cliente.fecha_vencimiento) + "</td>" +
                "<td class='py-3'>" + this.moneda(cliente.mensualidad) + "</td>" +
                "<td class='py-3'>" + Number(cliente.usuarios_count || 0) + "</td>" +
                "<td class='py-3'>" + this.estado(cliente.estado_pago_saas) + "</td>" +
            "</tr>"
        );
    },

    renderizarPagos(nombres) {
        this.tabla("tablaPagosSaasTbody", this.pagos, 7, pago =>
            "<tr class='border-b border-slate-100 text-sm'>" +
                "<td class='py-3 font-semibold'>" + this.esc(nombres.get(String(pago.gimnasio_id)) || "Sin nombre") + "</td>" +
                "<td class='py-3'>" + this.formatearFecha(pago.periodo_inicio) + " - " + this.formatearFecha(pago.periodo_fin) + "</td>" +
                "<td class='py-3'>" + this.moneda(pago.monto) + "</td>" +
                "<td class='py-3'>" + this.estado(pago.estado) + "</td>" +
                "<td class='py-3'>" + this.formatearFecha(pago.fecha_vencimiento) + "</td>" +
                "<td class='py-3'>" + this.formatearFecha(pago.fecha_pago) + "</td>" +
                "<td class='py-3'>" + this.esc(pago.referencia_pago || "-") + "</td>" +
            "</tr>"
        );
    },

    renderizarTickets(nombres) {
        this.tabla("tablaTicketsSoporteTbody", this.tickets, 5, ticket =>
            "<tr class='border-b border-slate-100 text-sm'>" +
                "<td class='py-3 font-semibold'>" + this.esc(nombres.get(String(ticket.gimnasio_id)) || "Sin nombre") + "</td>" +
                "<td class='py-3'>" + this.esc(ticket.titulo) + "</td>" +
                "<td class='py-3'>" + this.esc(ticket.categoria) + "</td>" +
                "<td class='py-3'>" + this.estado(ticket.prioridad) + "</td>" +
                "<td class='py-3'>" + this.estado(ticket.estado) + "</td>" +
            "</tr>"
        );
    },

    renderizarAccesos(nombres) {
        this.tabla("tablaSoporteSaasTbody", this.accesos, 5, acceso =>
            "<tr class='border-b border-slate-100 text-sm'>" +
                "<td class='py-3 font-semibold'>" + this.esc(nombres.get(String(acceso.gimnasio_id)) || "Sin nombre") + "</td>" +
                "<td class='py-3'>" + this.esc(acceso.motivo) + "</td>" +
                "<td class='py-3'>" + this.formatearFecha(acceso.fecha_inicio, true) + "</td>" +
                "<td class='py-3'>" + this.formatearFecha(acceso.fecha_fin, true) + "</td>" +
                "<td class='py-3'>" + this.estado(acceso.estado) + "</td>" +
            "</tr>"
        );
    },

    tabla(id, filas, columnas, renderFila) {
        const tbody = document.getElementById(id);
        if (!tbody) return;
        tbody.innerHTML = filas.length
            ? filas.map(renderFila).join("")
            : "<tr><td colspan='" + columnas + "' class='py-8 text-center text-sm text-slate-500'>Sin registros.</td></tr>";
    },

    contarClientes(estado) {
        return this.clientes.filter(cliente => cliente.estado === estado).length;
    },

    texto(id, valor) {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = String(valor);
    },

    moneda(valor) {
        return new Intl.NumberFormat("es-DO", {
            style: "currency",
            currency: "DOP",
            minimumFractionDigits: 2
        }).format(Number(valor || 0));
    },

    fecha(valor) {
        if (!valor) return null;
        const fecha = new Date(valor);
        return Number.isNaN(fecha.getTime()) ? null : fecha;
    },

    formatearFecha(valor, incluirHora = false) {
        const fecha = this.fecha(valor);
        if (!fecha) return "-";
        return fecha.toLocaleString("es-DO", incluirHora
            ? { dateStyle: "short", timeStyle: "short" }
            : { dateStyle: "short" });
    },

    estado(valor) {
        const texto = String(valor || "-").replaceAll("_", " ");
        return "<span class='inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold capitalize text-slate-700'>" +
            this.esc(texto) +
        "</span>";
    },

    esc(valor) {
        return String(valor ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }
};

window.michelSoftApp = michelSoftApp;
document.addEventListener("DOMContentLoaded", () => michelSoftApp.init());