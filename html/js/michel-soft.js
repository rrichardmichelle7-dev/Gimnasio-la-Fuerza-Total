const michelSoftApp = {
    clientes: [],
    pagos: [],
    tickets: [],
    accesos: [],
    alertas: [],
    ticketSeleccionado: null,
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
            window.userIdentity?.render(authResult.profile, authResult.user);
            await this.cargarDatos();
            this.renderizar();
            this.vincularEventosUI();
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
                "gimnasio_id,nombre_gimnasio,propietario,telefono,email,plan,estado,fecha_inicio,fecha_vencimiento,mensualidad,usuarios_count,estado_pago_saas,estado_tecnico",
                "nombre_gimnasio"
            ),
            this.consultar(
                "pagos_saas",
                "id,gimnasio_id,periodo_inicio,periodo_fin,monto,estado,fecha_vencimiento,fecha_pago,metodo_pago,referencia_pago,registrado_por"
            ),
            this.consultar(
                "tickets_soporte",
                "id,gimnasio_id,titulo,descripcion,categoria,prioridad,estado,fecha_cierre,created_at"
            ),
            this.consultar(
                "soporte_accesos",
                "id,gimnasio_id,ticket_id,autorizado_por,motivo,fecha_inicio,fecha_fin,estado,created_at"
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
        const vencidos = this.clientes.filter(cliente => this.estaVencido(cliente, hoy)).length;
        const ticketsAbiertos = this.tickets.filter(ticket => !["resuelto", "cerrado"].includes(ticket.estado)).length;
        const ticketsUrgentes = this.tickets.filter(ticket => !["resuelto", "cerrado"].includes(ticket.estado) && ["urgente", "critica"].includes(ticket.prioridad)).length;
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
        this.texto("saasTicketsUrgentes", ticketsUrgentes);
        document.getElementById("saasTicketsUrgentesBadge")?.classList.toggle("hidden", ticketsUrgentes === 0);
        this.texto("saasAlertasVencimiento", alertasPendientes);

        const nombres = new Map(this.clientes.map(cliente => [String(cliente.gimnasio_id), cliente.nombre_gimnasio]));
        this.renderizarClientes();
        this.renderizarPagos(nombres);
        this.renderizarTickets(nombres);
        this.renderizarAccesos(nombres);
        this.renderizarAlertasVencimiento();
    },

    renderizarClientes() {
        this.tabla("tablaClientesSaasTbody", this.clientes, 9, cliente => {
            const pagoVisual = this.estaVencido(cliente) ? "vencido" : cliente.estado_pago_saas;
            const filaClase = this.estaVencido(cliente) ? "bg-red-50/30" : "";

            return "<tr class='border-b border-slate-100 text-sm last:border-0 " + filaClase + "'>" +
                "<td><div class='flex items-center gap-3'><span class='flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600'><i class='fa-solid fa-building'></i></span><div><p class='font-bold text-slate-900'>" + this.esc(cliente.nombre_gimnasio) + "</p><p class='mt-0.5 text-xs text-slate-400'>Cuenta SaaS</p></div></div></td>" +
                "<td>" + this.esc(cliente.propietario || "-") + "</td>" +
                "<td><span class='inline-flex rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold capitalize text-slate-600'>" + this.esc(cliente.plan) + "</span></td>" +
                "<td>" + this.estado(cliente.estado) + "</td>" +
                "<td class='whitespace-nowrap'>" + this.formatearFecha(cliente.fecha_vencimiento) + "</td>" +
                "<td class='whitespace-nowrap font-semibold text-slate-800'>" + this.moneda(cliente.mensualidad) + "</td>" +
                "<td>" + this.estado(pagoVisual) + "</td>" +
                "<td><span class='inline-flex min-w-8 justify-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700'>" + Number(cliente.usuarios_count || 0) + "</span></td>" +
                "<td><div class='flex justify-end gap-1.5 whitespace-nowrap'>" +
                    "<button type='button' class='action-button action-view' title='Ver detalle' aria-label='Ver detalle' data-cliente-accion='ver' data-gimnasio-id='" + this.esc(cliente.gimnasio_id) + "'><i class='fa-regular fa-eye'></i></button>" +
                    "<button type='button' class='action-button w-auto px-3' title='Editar cliente' aria-label='Editar cliente' data-cliente-accion='editar' data-gimnasio-id='" + this.esc(cliente.gimnasio_id) + "'><i class='fa-solid fa-pen mr-1.5'></i>Editar</button>" +
                    "<button type='button' class='action-button action-pay' title='Registrar pago' aria-label='Registrar pago' data-cliente-accion='pago' data-gimnasio-id='" + this.esc(cliente.gimnasio_id) + "'><i class='fa-solid fa-coins'></i></button>" +
                    "<button type='button' class='action-button action-suspend' title='Suspender' aria-label='Suspender cliente' data-cliente-accion='suspender' data-gimnasio-id='" + this.esc(cliente.gimnasio_id) + "'><i class='fa-solid fa-pause'></i></button>" +
                    "<button type='button' class='action-button action-activate' title='Activar' aria-label='Activar cliente' data-cliente-accion='activar' data-gimnasio-id='" + this.esc(cliente.gimnasio_id) + "'><i class='fa-solid fa-play'></i></button>" +
                    "<button type='button' class='action-button action-whatsapp' title='Enviar recordatorio WhatsApp' aria-label='Enviar recordatorio WhatsApp' data-cliente-accion='whatsapp' data-gimnasio-id='" + this.esc(cliente.gimnasio_id) + "'><i class='fa-brands fa-whatsapp'></i></button>" +
                    "<button type='button' class='action-button action-support' title='Soporte autorizado' aria-label='Soporte autorizado' data-cliente-accion='soporte' data-gimnasio-id='" + this.esc(cliente.gimnasio_id) + "'><i class='fa-solid fa-screwdriver-wrench'></i></button>" +
                "</div></td>" +
            "</tr>";
        });
    },
    renderizarPagos(nombres) {
        this.tabla("tablaPagosSaasTbody", this.pagos, 8, pago => {
            const estaPagado = String(pago.estado || "").toLowerCase() === "pagado";
            const acciones = estaPagado
                ? "<button type='button' class='action-button action-view' title='Ver factura' data-pago-saas-accion='ver' data-pago-saas-id='" + this.esc(pago.id) + "'><i class='fa-regular fa-eye'></i></button>" +
                  "<button type='button' class='action-button' title='Imprimir factura' data-pago-saas-accion='imprimir' data-pago-saas-id='" + this.esc(pago.id) + "'><i class='fa-solid fa-print'></i></button>" +
                  "<button type='button' class='action-button action-whatsapp' title='Enviar confirmación por WhatsApp' data-pago-saas-accion='whatsapp' data-pago-saas-id='" + this.esc(pago.id) + "'><i class='fa-brands fa-whatsapp'></i></button>"
                : "<span class='text-xs font-bold text-slate-400'>Pendiente</span>";
            return "<tr class='border-b border-slate-100 text-sm last:border-0'>" +
                "<td class='py-3 font-semibold'>" + this.esc(nombres.get(String(pago.gimnasio_id)) || "Sin nombre") + "</td>" +
                "<td class='py-3'>" + this.formatearFecha(pago.periodo_inicio) + " - " + this.formatearFecha(pago.periodo_fin) + "</td>" +
                "<td class='py-3'>" + this.moneda(pago.monto) + "</td>" +
                "<td class='py-3'>" + this.estado(pago.estado) + "</td>" +
                "<td class='py-3'>" + this.formatearFecha(pago.fecha_vencimiento) + "</td>" +
                "<td class='py-3'>" + this.formatearFecha(pago.fecha_pago) + "</td>" +
                "<td class='py-3'>" + this.esc(pago.referencia_pago || "-") + "</td>" +
                "<td class='py-3 text-right'><div class='flex justify-end gap-1.5 whitespace-nowrap'>" + acciones + "</div></td>" +
            "</tr>";
        });
    },

    renderizarTickets(nombres) {
        this.tabla("tablaTicketsSoporteTbody", this.tickets, 8, ticket => {
            const acceso = this.obtenerAccesoTicket(ticket.id);
            const urgente = ["urgente", "critica"].includes(ticket.prioridad) && !["resuelto", "cerrado"].includes(ticket.estado);
            return "<tr class='border-b border-slate-100 text-sm last:border-0 " + (urgente ? "bg-red-50/40" : "") + "'>" +
                "<td class='py-3 font-semibold'>" + this.esc(nombres.get(String(ticket.gimnasio_id)) || "Sin nombre") + "</td>" +
                "<td class='py-3 font-bold text-slate-900'>" + this.esc(ticket.titulo) + "</td>" +
                "<td class='py-3 capitalize'>" + this.esc(ticket.categoria) + "</td>" +
                "<td class='py-3'>" + this.estado(ticket.prioridad) + "</td>" +
                "<td class='py-3'>" + this.estado(ticket.estado) + "</td>" +
                "<td class='py-3 whitespace-nowrap'>" + this.formatearFecha(ticket.created_at, true) + "</td>" +
                "<td class='py-3'>" + (acceso ? this.estado(this.estadoAccesoVigente(acceso)) : "<span class='text-xs font-bold text-slate-400'>No autorizado</span>") + "</td>" +
                "<td><div class='flex justify-end gap-1.5 whitespace-nowrap'>" +
                    "<button type='button' class='action-button action-view' title='Ver ticket' data-ticket-accion='ver' data-ticket-id='" + this.esc(ticket.id) + "'><i class='fa-regular fa-eye'></i></button>" +
                    "<button type='button' class='action-button action-pay' title='Marcar en proceso' data-ticket-accion='proceso' data-ticket-id='" + this.esc(ticket.id) + "'><i class='fa-solid fa-spinner'></i></button>" +
                    "<button type='button' class='action-button action-activate' title='Marcar resuelto' data-ticket-accion='resuelto' data-ticket-id='" + this.esc(ticket.id) + "'><i class='fa-solid fa-check'></i></button>" +
                    "<button type='button' class='action-button action-support' title='Ver soporte autorizado' data-ticket-accion='soporte' data-ticket-id='" + this.esc(ticket.id) + "'><i class='fa-solid fa-shield-halved'></i></button>" +
                    "<button type='button' class='action-button action-suspend' title='Cerrar acceso' data-ticket-accion='cerrar' data-ticket-id='" + this.esc(ticket.id) + "'><i class='fa-solid fa-lock'></i></button>" +
                    "<button type='button' class='action-button action-whatsapp' title='Contactar por WhatsApp' data-ticket-accion='whatsapp' data-ticket-id='" + this.esc(ticket.id) + "'><i class='fa-brands fa-whatsapp'></i></button>" +
                "</div></td></tr>";
        });
    },

    renderizarAccesos(nombres) {
        this.tabla("tablaSoporteSaasTbody", this.accesos, 6, acceso =>
            "<tr class='border-b border-slate-100 text-sm last:border-0'>" +
                "<td class='py-3 font-semibold'>" + this.esc(nombres.get(String(acceso.gimnasio_id)) || "Sin nombre") + "</td>" +
                "<td class='py-3'>" + this.esc(acceso.motivo) + "</td>" +
                "<td class='py-3'>" + this.formatearFecha(acceso.fecha_inicio, true) + "</td>" +
                "<td class='py-3'>" + this.formatearFecha(acceso.fecha_fin, true) + "</td>" +
                "<td class='py-3'>" + this.estado(this.estadoAccesoVigente(acceso)) + "</td>" +
                "<td class='text-right'><button type='button' class='action-button action-suspend' title='Cerrar acceso' data-acceso-accion='cerrar' data-acceso-id='" + this.esc(acceso.id) + "'><i class='fa-solid fa-lock'></i></button></td>" +
            "</tr>"
        );
    },

    vincularEventosUI() {
        if (this.eventosUIVinculados) return;
        this.eventosUIVinculados = true;

        document.addEventListener("click", event => {
            const accionButton = event.target.closest("[data-cliente-accion]");
            if (accionButton) {
                const cliente = this.obtenerCliente(accionButton.dataset.gimnasioId);
                if (cliente) {
                    this.manejarAccionCliente(accionButton.dataset.clienteAccion, cliente)
                        .catch(error => this.mostrarToast(error.message || "No se pudo completar la acción.", "error"));
                }
                return;
            }

            const ticketButton = event.target.closest("[data-ticket-accion]");
            if (ticketButton) {
                const ticket = this.tickets.find(item => String(item.id) === String(ticketButton.dataset.ticketId));
                if (ticket) this.manejarAccionTicket(ticketButton.dataset.ticketAccion, ticket).catch(error => this.mostrarToast(error.message || "No se pudo actualizar el ticket.", "error"));
                return;
            }

            const accesoButton = event.target.closest("[data-acceso-accion]");
            if (accesoButton) {
                const acceso = this.accesos.find(item => String(item.id) === String(accesoButton.dataset.accesoId));
                if (acceso) this.cerrarAccesoSoporte(acceso, null).catch(error => this.mostrarToast(error.message || "No se pudo cerrar el acceso.", "error"));
                return;
            }
            const cerrar = event.target.closest("[data-modal-cerrar]");
            const esBotonCerrar = cerrar?.matches("button");
            const esClickBackdrop = cerrar && event.target === cerrar;
            if (cerrar && (esBotonCerrar || esClickBackdrop)) this.cerrarModal(cerrar.dataset.modalCerrar);
        });

        document.getElementById("btnAgregarGimnasio")?.addEventListener("click", () => this.abrirModalClienteSaas());

        document.getElementById("formClienteSaas")?.addEventListener("submit", event => {
            event.preventDefault();
            this.guardarClienteSaas().catch(error => this.mostrarErrorCliente(error.message || "No se pudo guardar el cliente."));
        });

        document.getElementById("formPagoSaas")?.addEventListener("submit", event => {
            event.preventDefault();
            this.registrarPagoSaas().catch(error => this.mostrarErrorPago(error.message || "No se pudo registrar el pago."));
        });

        document.getElementById("btnConfirmarSuspension")?.addEventListener("click", () => {
            if (!this.clienteSeleccionado) return;
            this.suspenderCliente(this.clienteSeleccionado)
                .catch(error => this.mostrarToast(error.message || "No se pudo suspender el gimnasio.", "error"));
        });
    },

    obtenerCliente(gimnasioId) {
        return this.clientes.find(cliente => String(cliente.gimnasio_id) === String(gimnasioId)) || null;
    },

    async manejarAccionCliente(accion, cliente) {
        if (this.accionEnCurso) return;

        if (accion === "ver") return this.abrirDetalleCliente(cliente);
        if (accion === "editar") return this.abrirModalClienteSaas(cliente);
        if (accion === "pago") return this.abrirModalPago(cliente);
        if (accion === "suspender") return this.abrirConfirmacionSuspension(cliente);
        if (accion === "activar") return this.activarCliente(cliente);
        if (accion === "whatsapp") return this.abrirRecordatorioWhatsapp(cliente);
        if (accion === "soporte") return this.abrirDetalleCliente(cliente, true);
    },

    abrirModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.remove("hidden");
        modal.classList.add("flex");
        document.body.classList.add("overflow-hidden");
    },

    cerrarModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.add("hidden");
        modal.classList.remove("flex");
        if (!document.querySelector(".modal-backdrop.flex")) document.body.classList.remove("overflow-hidden");
    },

    abrirModalClienteSaas(cliente = null) {
        document.getElementById("formClienteSaas")?.reset();
        this.clienteSeleccionado = cliente;
        this.mostrarErrorCliente("");
        this.texto("clienteSaasTitulo", cliente ? "Editar cliente" : "Agregar gimnasio");
        this.valor("clienteSaasGimnasioId", cliente?.gimnasio_id || "");
        this.valor("clienteSaasNombre", cliente?.nombre_gimnasio || "");
        this.valor("clienteSaasPropietario", cliente?.propietario || "");
        this.valor("clienteSaasTelefono", cliente?.telefono || "");
        this.valor("clienteSaasEmail", cliente?.email || "");
        this.valor("clienteSaasPlan", cliente?.plan || "");
        this.valor("clienteSaasEstado", cliente?.estado || "prueba");
        this.valor("clienteSaasFechaInicio", cliente?.fecha_inicio || this.formatearFechaInput(new Date()));
        this.valor("clienteSaasFechaVencimiento", cliente?.fecha_vencimiento || "");
        this.valor("clienteSaasMensualidad", Number(cliente?.mensualidad || 0));
        this.valor("clienteSaasEstadoPago", cliente?.estado_pago_saas || "pendiente");
        this.valor("clienteSaasEstadoTecnico", cliente?.estado_tecnico || "operativo");
        this.abrirModal("modalClienteSaas");
        document.getElementById("clienteSaasNombre")?.focus();
    },

    obtenerDatosClienteSaas() {
        const leer = id => (document.getElementById(id)?.value || "").trim();
        const datos = {
            nombre_gimnasio: leer("clienteSaasNombre"),
            propietario: leer("clienteSaasPropietario"),
            telefono: leer("clienteSaasTelefono"),
            email: leer("clienteSaasEmail"),
            plan: leer("clienteSaasPlan"),
            estado: leer("clienteSaasEstado"),
            fecha_inicio: leer("clienteSaasFechaInicio"),
            fecha_vencimiento: leer("clienteSaasFechaVencimiento"),
            mensualidad: Number(leer("clienteSaasMensualidad")),
            estado_pago_saas: leer("clienteSaasEstadoPago"),
            estado_tecnico: leer("clienteSaasEstadoTecnico"),
            updated_at: new Date().toISOString()
        };
        if (!datos.nombre_gimnasio || !datos.propietario || !datos.telefono || !datos.email || !datos.plan ||
            !datos.estado || !datos.fecha_inicio || !datos.fecha_vencimiento || !datos.estado_pago_saas || !datos.estado_tecnico) {
            throw new Error("Completa todos los campos obligatorios.");
        }
        if (!Number.isFinite(datos.mensualidad) || datos.mensualidad < 0) throw new Error("Ingresa una mensualidad válida.");
        if (datos.fecha_vencimiento < datos.fecha_inicio) throw new Error("La fecha de vencimiento no puede ser anterior a la fecha de inicio.");
        return datos;
    },

    async guardarClienteSaas() {
        if (this.accionEnCurso) return;
        const form = document.getElementById("formClienteSaas");
        if (!form?.reportValidity()) return;
        const gimnasioId = document.getElementById("clienteSaasGimnasioId")?.value || "";
        const datos = this.obtenerDatosClienteSaas();
        const editando = Boolean(gimnasioId);
        const boton = document.getElementById("btnGuardarClienteSaas");
        this.accionEnCurso = true;
        this.mostrarErrorCliente("");
        try {
            if (boton) {
                boton.disabled = true;
                boton.innerHTML = "<i class='fa-solid fa-circle-notch fa-spin mr-2'></i>Guardando";
            }
            const consulta = editando
                ? window.kilvioSupabase.from("gimnasios_clientes").update(datos).eq("gimnasio_id", gimnasioId)
                : window.kilvioSupabase.from("gimnasios_clientes").insert({ ...datos, gimnasio_id: window.crypto.randomUUID() });
            const { data, error } = await consulta.select("gimnasio_id").maybeSingle();
            if (error) throw error;
            if (!data) throw new Error("La política de acceso no permitió guardar este cliente.");
            this.cerrarModal("modalClienteSaas");
            await this.recargarDatosSaas();
            this.mostrarToast(editando ? "Cliente actualizado correctamente." : "Cliente agregado correctamente.", "exito");
        } finally {
            this.accionEnCurso = false;
            if (boton) {
                boton.disabled = false;
                boton.innerHTML = "<i class='fa-solid fa-floppy-disk mr-2'></i>Guardar cliente";
            }
        }
    },
    abrirDetalleCliente(cliente, enfocarSoporte = false) {
        this.clienteSeleccionado = cliente;
        this.texto("detalleSaasGimnasio", cliente.nombre_gimnasio || "-");
        this.texto("detalleSaasPropietario", cliente.propietario || "-");
        this.texto("detalleSaasTelefono", cliente.telefono || "-");
        this.texto("detalleSaasEmail", cliente.email || "-");
        this.texto("detalleSaasPlan", `${cliente.plan || "-"} · ${this.moneda(cliente.mensualidad)}`);
        this.texto("detalleSaasVencimiento", this.formatearFecha(cliente.fecha_vencimiento));

        const soporte = document.getElementById("detalleSaasSoporte");
        const accesos = this.accesos.filter(acceso => String(acceso.gimnasio_id) === String(cliente.gimnasio_id));
        if (soporte) {
            soporte.innerHTML = accesos.length
                ? accesos.map(acceso =>
                    "<div class='flex flex-col gap-2 rounded-xl border border-slate-200 p-3 text-sm sm:flex-row sm:items-center sm:justify-between'>" +
                        "<div><p class='font-bold text-slate-800'>" + this.esc(acceso.motivo) + "</p><p class='mt-1 text-xs text-slate-500'>" + this.formatearFecha(acceso.fecha_inicio, true) + " · " + this.formatearFecha(acceso.fecha_fin, true) + "</p></div>" +
                        this.estado(acceso.estado) +
                    "</div>"
                ).join("")
                : "<div class='rounded-xl bg-slate-50 p-4 text-sm text-slate-500'>No existen accesos de soporte autorizados para este cliente.</div>";
        }

        this.abrirModal("modalDetalleClienteSaas");
        if (enfocarSoporte) soporte?.scrollIntoView({ behavior: "smooth", block: "center" });
    },

    abrirModalPago(cliente) {
        this.clienteSeleccionado = cliente;
        const hoy = new Date();
        const baseVencimiento = this.fecha(cliente.fecha_vencimiento);
        const proximo = baseVencimiento && baseVencimiento > hoy ? new Date(baseVencimiento) : new Date(hoy);
        proximo.setMonth(proximo.getMonth() + 1);

        document.getElementById("formPagoSaas")?.reset();
        this.valor("pagoSaasGimnasioId", cliente.gimnasio_id);
        this.valor("pagoSaasGimnasio", cliente.nombre_gimnasio || "-");
        this.valor("pagoSaasMonto", Number(cliente.mensualidad || 0));
        this.valor("pagoSaasMetodo", "Transferencia");
        this.valor("pagoSaasFecha", this.formatearFechaInput(hoy));
        this.valor("pagoSaasPeriodo", `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`);
        this.valor("pagoSaasProximoVencimiento", this.formatearFechaInput(proximo));
        this.mostrarErrorPago("");
        this.abrirModal("modalPagoSaas");
    },

    abrirConfirmacionSuspension(cliente) {
        this.clienteSeleccionado = cliente;
        this.texto("suspensionClienteNombre", cliente.nombre_gimnasio || "");
        this.abrirModal("modalConfirmarSuspension");
    },

    async suspenderCliente(cliente) {
        this.cerrarModal("modalConfirmarSuspension");
        await this.actualizarEstadoCliente(cliente, {
            estado: "suspendido",
            estado_pago_saas: "vencido",
            updated_at: new Date().toISOString()
        }, "Gimnasio suspendido correctamente.");
    },

    async activarCliente(cliente) {
        await this.actualizarEstadoCliente(cliente, {
            estado: "activo",
            estado_pago_saas: "al_dia",
            updated_at: new Date().toISOString()
        }, "Gimnasio activado correctamente.");
    },

    async actualizarEstadoCliente(cliente, cambios, mensaje) {
        if (this.accionEnCurso) return;
        this.accionEnCurso = true;

        try {
            const { data, error } = await window.kilvioSupabase
                .from("gimnasios_clientes")
                .update(cambios)
                .eq("gimnasio_id", cliente.gimnasio_id)
                .select("gimnasio_id")
                .maybeSingle();

            if (error) throw error;
            if (!data) throw new Error("La política de acceso no permitió actualizar este gimnasio.");

            await this.recargarDatosSaas();
            this.mostrarToast(mensaje, "exito");
        } finally {
            this.accionEnCurso = false;
        }
    },

    async registrarPagoSaas() {
        if (this.accionEnCurso) return;

        const gimnasioId = document.getElementById("pagoSaasGimnasioId")?.value;
        const monto = Number(document.getElementById("pagoSaasMonto")?.value || 0);
        const metodoPago = document.getElementById("pagoSaasMetodo")?.value || "Transferencia";
        const referenciaPago = (document.getElementById("pagoSaasReferencia")?.value || "").trim();
        const fechaPago = document.getElementById("pagoSaasFecha")?.value;
        const periodo = document.getElementById("pagoSaasPeriodo")?.value;
        const proximoVencimiento = document.getElementById("pagoSaasProximoVencimiento")?.value;
        const cliente = this.obtenerCliente(gimnasioId);

        if (!cliente) throw new Error("Cliente SaaS no encontrado.");
        if (!Number.isFinite(monto) || monto <= 0) throw new Error("Ingresa un monto válido.");
        if (!fechaPago || !periodo || !proximoVencimiento) throw new Error("Completa la fecha, periodo y próximo vencimiento.");

        const [anio, mes] = periodo.split("-").map(Number);
        if (!anio || !mes) throw new Error("Periodo pagado inválido.");
        const periodoInicio = `${anio}-${String(mes).padStart(2, "0")}-01`;
        const fin = new Date(Date.UTC(anio, mes, 0));
        const periodoFin = `${fin.getUTCFullYear()}-${String(fin.getUTCMonth() + 1).padStart(2, "0")}-${String(fin.getUTCDate()).padStart(2, "0")}`;
        const boton = document.getElementById("btnGuardarPagoSaas");
        this.accionEnCurso = true;
        this.mostrarErrorPago("");

        try {
            if (boton) {
                boton.disabled = true;
                boton.innerHTML = "<i class='fa-solid fa-circle-notch fa-spin mr-2'></i>Guardando";
            }

            const { error: pagoError } = await window.kilvioSupabase
                .from("pagos_saas")
                .insert({
                    gimnasio_id: cliente.gimnasio_id,
                    periodo_inicio: periodoInicio,
                    periodo_fin: periodoFin,
                    fecha_vencimiento: proximoVencimiento,
                    fecha_pago: `${fechaPago}T12:00:00.000Z`,
                    monto,
                    moneda: "DOP",
                    estado: "pagado",
                    metodo_pago: metodoPago,
                    referencia_pago: referenciaPago || null,
                    registrado_por: window.auth?.user?.id || null
                });

            if (pagoError) throw pagoError;

            const { data: clienteActualizado, error: clienteError } = await window.kilvioSupabase
                .from("gimnasios_clientes")
                .update({
                    estado_pago_saas: "al_dia",
                    estado: "activo",
                    fecha_vencimiento: proximoVencimiento,
                    updated_at: new Date().toISOString()
                })
                .eq("gimnasio_id", cliente.gimnasio_id)
                .select("gimnasio_id")
                .maybeSingle();

            if (clienteError) throw clienteError;
            if (!clienteActualizado) throw new Error("Pago registrado, pero no se pudo actualizar el estado del cliente.");

            this.cerrarModal("modalPagoSaas");
            await this.recargarDatosSaas();
            this.mostrarToast("Pago SaaS registrado correctamente.", "exito");
        } finally {
            this.accionEnCurso = false;
            if (boton) {
                boton.disabled = false;
                boton.innerHTML = "<i class='fa-solid fa-check mr-2'></i>Guardar pago";
            }
        }
    },

    abrirRecordatorioWhatsapp(cliente) {
        const telefono = this.normalizarTelefonoWhatsapp(cliente.telefono);
        if (!telefono) {
            this.mostrarToast("Este cliente no tiene teléfono registrado.", "error");
            return;
        }

        const monto = Number(cliente.mensualidad || 0).toLocaleString("es-DO", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        const mensaje = `Saludos, ${cliente.propietario || "cliente"}.\n\n` +
            `Le informamos que el pago mensual del sistema FitControl Pro correspondiente a ${cliente.nombre_gimnasio || "su gimnasio"} está pendiente.\n\n` +
            `📅 Fecha de vencimiento: ${this.formatearFecha(cliente.fecha_vencimiento)}\n` +
            `💰 Monto pendiente: RD$${monto}\n\n` +
            "Para evitar la suspensión del servicio, favor realizar el pago correspondiente.\n\n" +
            "Puede enviar el comprobante por esta misma vía.\n\n" +
            "Gracias por confiar en Michel Soft.";
        const url = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
        window.open(url, "_blank", "noopener,noreferrer");
    },

    normalizarTelefonoWhatsapp(valor) {
        let numero = String(valor || "").replace(/\D/g, "");
        if (!numero) return "";
        if (numero.length === 10) numero = `1${numero}`;
        return numero.length >= 11 ? numero : "";
    },

    obtenerAccesoTicket(ticketId) {
        return this.accesos.find(acceso => String(acceso.ticket_id) === String(ticketId)) || null;
    },

    estadoAccesoVigente(acceso) {
        if (!acceso) return "sin_acceso";
        if (["cerrado", "revocado"].includes(acceso.estado)) return acceso.estado;
        const ahora = new Date();
        const inicio = this.fecha(acceso.fecha_inicio);
        const fin = this.fecha(acceso.fecha_fin);
        if (fin && fin < ahora) return "vencido";
        if (inicio && inicio > ahora) return "pendiente";
        return ["activo", "pendiente"].includes(acceso.estado) ? "activo" : acceso.estado;
    },

    async manejarAccionTicket(accion, ticket) {
        if (accion === "ver" || accion === "soporte") return this.abrirTicketSoporte(ticket, accion === "soporte");
        if (accion === "proceso") return this.actualizarEstadoTicket(ticket, "en_proceso", "Ticket marcado en proceso.");
        if (accion === "resuelto") return this.resolverTicketSoporte(ticket);
        if (accion === "cerrar") return this.cerrarAccesoSoporte(this.obtenerAccesoTicket(ticket.id), ticket);
        if (accion === "whatsapp") return this.contactarTicketWhatsApp(ticket);
    },

    async actualizarEstadoTicket(ticket, estado, mensaje) {
        const cambios = { estado, updated_at: new Date().toISOString() };
        const { data, error } = await window.kilvioSupabase
            .from("tickets_soporte")
            .update(cambios)
            .eq("id", ticket.id)
            .select("id")
            .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("La política de acceso no permitió actualizar este ticket.");
        await this.recargarDatosSaas();
        this.mostrarToast(mensaje, "exito");
        if (this.ticketSeleccionado?.id === ticket.id) this.cerrarModal("modalTicketSoporteSaas");
    },

    async resolverTicketSoporte(ticket) {
        if (!ticket?.id) throw new Error("Ticket no válido.");
        const { data, error } = await window.kilvioSupabase.rpc("resolver_ticket_soporte", { p_ticket_id: ticket.id });
        if (error) throw error;
        if (!data?.ticket_id) throw new Error("No se pudo confirmar la resolución del ticket.");
        await this.recargarDatosSaas();
        if (this.ticketSeleccionado?.id === ticket.id) this.cerrarModal("modalTicketSoporteSaas");
        this.mostrarToast("Ticket resuelto correctamente.", "exito");
    },

    async cerrarAccesoSoporte(acceso, ticket) {
        if (!acceso) {
            this.mostrarToast("Este gimnasio no ha autorizado acceso operativo.", "error");
            return;
        }
        const ahora = new Date().toISOString();
        const finAutorizado = this.fecha(acceso.fecha_fin);
        const fechaCierre = finAutorizado && finAutorizado < new Date() ? acceso.fecha_fin : ahora;
        const { error: accesoError } = await window.kilvioSupabase.from("soporte_accesos").update({ estado: "cerrado", fecha_fin: fechaCierre, updated_at: ahora }).eq("id", acceso.id);
        if (accesoError) throw accesoError;
        if (ticket) {
            const { error: ticketError } = await window.kilvioSupabase.from("tickets_soporte").update({ estado: "resuelto", fecha_cierre: ahora, updated_at: ahora }).eq("id", ticket.id);
            if (ticketError) throw ticketError;
        }
        await this.recargarDatosSaas();
        this.cerrarModal("modalTicketSoporteSaas");
        this.mostrarToast("Soporte cerrado correctamente.", "exito");
    },

    abrirTicketSoporte(ticket, enfocarSoporte = false) {
        const cliente = this.obtenerCliente(ticket.gimnasio_id) || {};
        const acceso = this.obtenerAccesoTicket(ticket.id);
        this.ticketSeleccionado = ticket;
        this.texto("ticketDetalleGimnasio", cliente.nombre_gimnasio || "Sin nombre");
        this.texto("ticketDetallePropietario", cliente.propietario || "-");
        this.texto("ticketDetalleTelefono", cliente.telefono || "-");
        this.texto("ticketDetalleModulo", `${ticket.categoria || "otro"} · ${ticket.prioridad || "media"}`);
        this.texto("ticketDetalleEstado", `${String(ticket.estado || "abierto").replaceAll("_", " ")} · ${this.formatearFecha(ticket.created_at, true)}`);
        this.texto("ticketDetalleDescripcion", ticket.descripcion || "Sin descripción");
        const estado = this.estadoAccesoVigente(acceso);
        const badge = document.getElementById("ticketDetalleAccesoBadge");
        if (badge) badge.innerHTML = acceso ? this.estado(estado) : this.estado("no_autorizado");
        this.texto("ticketDetalleVentana", acceso ? `${this.formatearFecha(acceso.fecha_inicio, true)} — ${this.formatearFecha(acceso.fecha_fin, true)}` : "Este gimnasio no ha autorizado acceso operativo.");
        const resumen = document.getElementById("ticketResumenOperativo");
        if (resumen) {
            resumen.classList.add("hidden");
            resumen.textContent = "";
        }
        document.getElementById("btnTicketCerrarAcceso")?.classList.toggle("hidden", !acceso || ["cerrado", "revocado", "vencido"].includes(estado));
        document.getElementById("btnTicketEnProceso")?.classList.toggle("hidden", ["resuelto", "cerrado"].includes(ticket.estado));
        document.getElementById("btnTicketResuelto")?.classList.toggle("hidden", ["resuelto", "cerrado"].includes(ticket.estado));
        this.abrirModal("modalTicketSoporteSaas");
        if (enfocarSoporte) document.getElementById("ticketDetalleVentana")?.scrollIntoView({ behavior: "smooth", block: "center" });

        const asignar = (id, handler) => {
            const boton = document.getElementById(id);
            if (boton) boton.onclick = handler;
        };
        asignar("btnTicketWhatsApp", () => this.contactarTicketWhatsApp(ticket));
        asignar("btnTicketEnProceso", () => this.actualizarEstadoTicket(ticket, "en_proceso", "Ticket marcado en proceso.").catch(error => this.mostrarToast(error.message, "error")));
        asignar("btnTicketResuelto", () => this.resolverTicketSoporte(ticket).catch(error => this.mostrarToast(error.message, "error")));
        asignar("btnTicketCerrarAcceso", () => this.cerrarAccesoSoporte(acceso, ticket).catch(error => this.mostrarToast(error.message, "error")));
    },


    contactarTicketWhatsApp(ticket) {
        const cliente = this.obtenerCliente(ticket.gimnasio_id) || {};
        const telefono = String(cliente.telefono || "").replace(/\D/g, "");
        if (!telefono) {
            this.mostrarToast("Este cliente no tiene teléfono registrado.", "error");
            return;
        }
        const numero = telefono.length === 10 ? `1${telefono}` : telefono;
        const mensaje = `Saludos, ${cliente.propietario || "cliente"}. Recibimos tu solicitud de soporte sobre ${ticket.categoria || "el sistema"}. Estoy revisando el caso y te mantendré informado.`;
        window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`, "_blank", "noopener,noreferrer");
    },
    renderizarAlertasVencimiento() {
        const contenedor = document.getElementById("listaAlertasVencimiento");
        if (!contenedor) return;

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const alertas = this.clientes.flatMap(cliente => {
            if (cliente.estado === "suspendido") return [{ cliente, tipo: "suspendido", etiqueta: "Suspendido", clase: "red" }];
            if (this.estaVencido(cliente, hoy)) return [{ cliente, tipo: "vencido", etiqueta: "Pago vencido", clase: "red" }];
            if (this.estaProximoAVencer(cliente, hoy)) return [{ cliente, tipo: "proximo", etiqueta: "Próximo a vencer", clase: "amber" }];
            return [];
        });

        this.texto("saasAlertasVencimiento", alertas.length);
        if (!alertas.length) {
            contenedor.innerHTML = "<div class='sm:col-span-2 xl:col-span-3'><div class='empty-state py-8'><span class='empty-state-icon text-emerald-600 bg-emerald-50'><i class='fa-solid fa-circle-check'></i></span><p class='font-black text-slate-800'>Sin alertas de vencimiento</p><p class='mt-1 text-sm text-slate-500'>Todos los clientes se encuentran dentro de sus fechas de pago.</p></div></div>";
            return;
        }

        contenedor.innerHTML = alertas.map(alerta => {
            const color = alerta.clase === "red"
                ? "border-red-100 bg-red-50 text-red-700"
                : "border-amber-100 bg-amber-50 text-amber-700";
            return "<article class='rounded-2xl border p-4 " + color + "'>" +
                "<div class='flex items-start justify-between gap-3'><div><p class='font-black'>" + this.esc(alerta.cliente.nombre_gimnasio) + "</p><p class='mt-1 text-xs font-semibold opacity-80'>" + this.esc(alerta.etiqueta) + "</p></div><i class='fa-solid fa-triangle-exclamation mt-1'></i></div>" +
                "<p class='mt-4 text-xs font-bold'>Vence: " + this.formatearFecha(alerta.cliente.fecha_vencimiento) + "</p>" +
            "</article>";
        }).join("");
    },

    estaVencido(cliente, referencia = new Date()) {
        const fecha = this.fecha(cliente?.fecha_vencimiento);
        if (!fecha || String(cliente?.estado_pago_saas || "").toLowerCase() === "al_dia") return false;
        const hoy = new Date(referencia);
        hoy.setHours(0, 0, 0, 0);
        fecha.setHours(0, 0, 0, 0);
        return fecha < hoy;
    },

    estaProximoAVencer(cliente, referencia = new Date()) {
        const fecha = this.fecha(cliente?.fecha_vencimiento);
        if (!fecha || this.estaVencido(cliente, referencia)) return false;
        const hoy = new Date(referencia);
        hoy.setHours(0, 0, 0, 0);
        const limite = new Date(hoy);
        limite.setDate(limite.getDate() + 30);
        return fecha >= hoy && fecha <= limite;
    },

    async recargarDatosSaas() {
        await this.cargarDatos();
        this.renderizar();
    },

    mostrarToast(mensaje, tipo = "info") {
        const toast = document.getElementById("saasToast");
        if (!toast) return;
        window.clearTimeout(this.toastTimer);
        const clases = tipo === "exito"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : tipo === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-blue-200 bg-blue-50 text-blue-800";
        toast.className = `fixed right-5 top-5 z-[120] max-w-sm rounded-2xl border px-4 py-3 text-sm font-bold shadow-2xl ${clases}`;
        toast.textContent = mensaje;
        this.toastTimer = window.setTimeout(() => toast.classList.add("hidden"), 4500);
    },

    mostrarErrorCliente(mensaje) {
        const error = document.getElementById("errorClienteSaas");
        if (!error) return;
        error.textContent = mensaje || "";
        error.classList.toggle("hidden", !mensaje);
    },

    mostrarErrorPago(mensaje) {
        const error = document.getElementById("errorPagoSaas");
        if (!error) return;
        error.textContent = mensaje || "";
        error.classList.toggle("hidden", !mensaje);
    },

    valor(id, valor) {
        const elemento = document.getElementById(id);
        if (elemento) elemento.value = valor ?? "";
    },

    formatearFechaInput(valor) {
        const fecha = valor instanceof Date ? valor : new Date(valor);
        if (Number.isNaN(fecha.getTime())) return "";
        const anio = fecha.getFullYear();
        const mes = String(fecha.getMonth() + 1).padStart(2, "0");
        const dia = String(fecha.getDate()).padStart(2, "0");
        return `${anio}-${mes}-${dia}`;
    },
    tabla(id, filas, columnas, renderFila) {
        const tbody = document.getElementById(id);
        if (!tbody) return;

        if (filas.length) {
            tbody.innerHTML = filas.map(renderFila).join("");
            return;
        }

        const estadosVacios = {
            tablaClientesSaasTbody: {
                icono: "fa-building-circle-exclamation",
                titulo: "No hay gimnasios registrados",
                descripcion: "Los clientes SaaS aparecerán aquí cuando sean incorporados a la plataforma."
            },
            tablaPagosSaasTbody: {
                icono: "fa-receipt",
                titulo: "No hay pagos SaaS registrados",
                descripcion: "Los cobros y renovaciones aparecerán aquí cuando se registren movimientos."
            },
            tablaTicketsSoporteTbody: {
                icono: "fa-life-ring",
                titulo: "No hay tickets abiertos",
                descripcion: "Los tickets aparecerán aquí cuando los gimnasios creen solicitudes."
            },
            tablaSoporteSaasTbody: {
                icono: "fa-shield-halved",
                titulo: "No existen accesos de soporte activos",
                descripcion: "Las ventanas autorizadas aparecerán aquí respetando el periodo aprobado."
            }
        };
        const vacio = estadosVacios[id] || {
            icono: "fa-inbox",
            titulo: "No hay información disponible",
            descripcion: "Los registros aparecerán aquí cuando estén disponibles."
        };

        tbody.innerHTML = "<tr><td colspan='" + columnas + "'><div class='empty-state'>" +
            "<span class='empty-state-icon'><i class='fa-solid " + vacio.icono + "'></i></span>" +
            "<p class='font-black text-slate-800'>" + this.esc(vacio.titulo) + "</p>" +
            "<p class='mt-1 max-w-md text-sm leading-6 text-slate-500'>" + this.esc(vacio.descripcion) + "</p>" +
        "</div></td></tr>";
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
        const texto = String(valor);
        const soloFecha = texto.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
        const fecha = soloFecha
            ? new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]), 12)
            : new Date(valor);
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
        const clave = String(valor || "-").trim().toLowerCase();
        const texto = clave === "al_dia" ? "Al día" : clave.replaceAll("_", " ");
        const estilos = {
            activo: "border-emerald-200 bg-emerald-50 text-emerald-700",
            al_dia: "border-emerald-200 bg-emerald-50 text-emerald-700",
            pagado: "border-emerald-200 bg-emerald-50 text-emerald-700",
            operativo: "border-emerald-200 bg-emerald-50 text-emerald-700",
            resuelto: "border-emerald-200 bg-emerald-50 text-emerald-700",
            prueba: "border-blue-200 bg-blue-50 text-blue-700",
            en_proceso: "border-blue-200 bg-blue-50 text-blue-700",
            pendiente: "border-amber-200 bg-amber-50 text-amber-700",
            revision: "border-amber-200 bg-amber-50 text-amber-700",
            media: "border-amber-200 bg-amber-50 text-amber-700",
            suspendido: "border-red-200 bg-red-50 text-red-700",
            vencido: "border-red-200 bg-red-50 text-red-700",
            incidente: "border-red-200 bg-red-50 text-red-700",
            alta: "border-red-200 bg-red-50 text-red-700",
            critica: "border-red-200 bg-red-50 text-red-700",
            cancelado: "border-slate-200 bg-slate-100 text-slate-600",
            cerrado: "border-slate-200 bg-slate-100 text-slate-600",
            anulado: "border-slate-200 bg-slate-100 text-slate-600"
        };
        const clase = estilos[clave] || "border-slate-200 bg-slate-50 text-slate-600";

        return "<span class='inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold capitalize " + clase + "'>" +
            "<span class='h-1.5 w-1.5 rounded-full bg-current opacity-70'></span>" + this.esc(texto) +
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
