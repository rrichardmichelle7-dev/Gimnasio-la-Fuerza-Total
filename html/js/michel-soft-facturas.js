(function () {
    "use strict";

    const app = window.michelSoftApp;
    if (!app) return;

    app.facturas = [];
    app.facturaSeleccionada = null;
    app.facturacionSaasDisponible = true;

    const cargarDatosBase = app.cargarDatos;
    app.cargarDatos = async function () {
        await cargarDatosBase.call(this);

        const vencidas = await window.kilvioSupabase.rpc("actualizar_facturas_saas_vencidas");
        if (vencidas.error && !this.esErrorFacturacionNoInstalada(vencidas.error)) throw vencidas.error;

        const { data, error } = await window.kilvioSupabase
            .from("facturas_saas")
            .select("id,gimnasio_id,pago_saas_id,numero_factura,fecha_emision,fecha_vencimiento,periodo_inicio,periodo_fin,servicio,plan,cantidad,precio_unitario,subtotal,itbis,total,estado,metodo_pago,referencia_pago,observaciones,cliente_nombre,cliente_propietario,cliente_telefono,cliente_email,cliente_direccion,created_at,updated_at")
            .order("fecha_emision", { ascending: false })
            .order("numero_factura", { ascending: false });

        if (error) {
            if (this.esErrorFacturacionNoInstalada(error)) {
                this.facturacionSaasDisponible = false;
                this.facturas = [];
                return;
            }
            throw error;
        }

        this.facturacionSaasDisponible = true;
        this.facturas = data || [];
    };

    const renderizarBase = app.renderizar;
    app.renderizar = function () {
        renderizarBase.call(this);
        this.renderizarFacturasSaas();
    };

    const vincularEventosBase = app.vincularEventosUI;
    app.vincularEventosUI = function () {
        vincularEventosBase.call(this);
        if (this.eventosFacturasVinculados) return;
        this.eventosFacturasVinculados = true;

        document.addEventListener("click", event => {
            const botonPago = event.target.closest("[data-pago-saas-accion]");
            if (botonPago) {
                const pago = this.obtenerPagoSaas(botonPago.dataset.pagoSaasId);
                if (pago) {
                    this.manejarAccionPagoSaas(botonPago.dataset.pagoSaasAccion, pago)
                        .catch(error => this.mostrarToast(error.message || "No se pudo completar la acción del pago.", "error"));
                }
                return;
            }
            const boton = event.target.closest("[data-factura-accion]");
            if (!boton) return;
            const factura = this.obtenerFactura(boton.dataset.facturaId);
            if (!factura) return;
            this.manejarAccionFactura(boton.dataset.facturaAccion, factura)
                .catch(error => this.mostrarToast(error.message || "No se pudo completar la acción de factura.", "error"));
        });

        document.getElementById("btnNuevaFacturaSaas")?.addEventListener("click", () => this.abrirModalNuevaFacturaSaas());
        document.getElementById("formNuevaFacturaSaas")?.addEventListener("submit", event => {
            event.preventDefault();
            this.guardarFacturaSaas().catch(error => this.mostrarErrorFactura(error.message || "No se pudo generar la factura."));
        });
        ["facturaCantidad", "facturaPrecio", "facturaItbisPorcentaje"].forEach(id => {
            document.getElementById(id)?.addEventListener("input", () => this.calcularTotalesFactura());
        });
        document.getElementById("facturaGimnasioId")?.addEventListener("change", event => this.cargarClienteEnFactura(event.target.value));
        document.getElementById("pagoSaasFacturaId")?.addEventListener("change", event => this.cargarFacturaEnPago(event.target.value));
        document.getElementById("btnFacturaWhatsapp")?.addEventListener("click", () => {
            if (this.facturaSeleccionada) {
                this.enviarFacturaWhatsapp(this.facturaSeleccionada)
                    .catch(error => this.mostrarToast(error.message || "No se pudo abrir WhatsApp.", "error"));
            }
        });
        document.getElementById("btnFacturaDescargar")?.addEventListener("click", () => {
            if (this.facturaSeleccionada) this.descargarFacturaPdf(this.facturaSeleccionada).catch(error => this.mostrarToast(error.message || "No se pudo descargar el PDF.", "error"));
        });
        document.getElementById("btnFacturaImprimir")?.addEventListener("click", () => {
            if (this.facturaSeleccionada) this.imprimirFactura(this.facturaSeleccionada);
        });
        document.getElementById("btnPagoVerFactura")?.addEventListener("click", () => {
            if (this.facturaPagadaSeleccionada) {
                this.cerrarModal("modalConfirmacionPagoSaas");
                this.verFacturaSaas(this.facturaPagadaSeleccionada);
            }
        });
        document.getElementById("btnPagoImprimirFactura")?.addEventListener("click", () => {
            if (this.facturaPagadaSeleccionada) this.imprimirFactura(this.facturaPagadaSeleccionada);
        });
        document.getElementById("btnPagoDescargarFactura")?.addEventListener("click", () => {
            if (this.facturaPagadaSeleccionada) this.descargarFacturaPdf(this.facturaPagadaSeleccionada).catch(error => this.mostrarToast(error.message || "No se pudo descargar el PDF.", "error"));
        });
        document.getElementById("btnPagoWhatsappFactura")?.addEventListener("click", () => {
            if (this.facturaPagadaSeleccionada) this.enviarFacturaWhatsapp(this.facturaPagadaSeleccionada).catch(error => this.mostrarToast(error.message || "No se pudo abrir WhatsApp.", "error"));
        });
    };

    app.esErrorFacturacionNoInstalada = function (error) {
        const codigo = String(error?.code || "");
        const mensaje = String(error?.message || "");
        return ["42P01", "42883", "PGRST202", "PGRST205"].includes(codigo) ||
            (/facturas_saas|actualizar_facturas_saas_vencidas/i.test(mensaje) &&
             /does not exist|not found|schema cache|no se encontr/i.test(mensaje));
    };

    app.obtenerFactura = function (facturaId) {
        return this.facturas.find(factura => String(factura.id) === String(facturaId)) || null;
    };

    app.estadoFacturaVisual = function (factura) {
        if (factura?.estado === "pendiente") {
            const vencimiento = this.fecha(factura.fecha_vencimiento);
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            if (vencimiento && vencimiento < hoy) return "vencida";
        }
        return factura?.estado || "pendiente";
    };

    app.badgeFactura = function (estado) {
        const clave = String(estado || "pendiente").toLowerCase();
        const estilos = {
            pendiente: "border-amber-200 bg-amber-50 text-amber-700",
            pagada: "border-emerald-200 bg-emerald-50 text-emerald-700",
            vencida: "border-red-200 bg-red-50 text-red-700",
            anulada: "border-slate-200 bg-slate-100 text-slate-600"
        };
        return "<span class='inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold capitalize " +
            (estilos[clave] || estilos.pendiente) + "'><span class='h-1.5 w-1.5 rounded-full bg-current opacity-70'></span>" +
            this.esc(clave) + "</span>";
    };

    app.renderizarFacturasSaas = function () {
        const pendientes = this.facturas.filter(f => this.estadoFacturaVisual(f) === "pendiente").reduce((t, f) => t + Number(f.total || 0), 0);
        const pagadas = this.facturas.filter(f => f.estado === "pagada").reduce((t, f) => t + Number(f.total || 0), 0);
        const vencidas = this.facturas.filter(f => this.estadoFacturaVisual(f) === "vencida").reduce((t, f) => t + Number(f.total || 0), 0);
        this.texto("facturasPendientesTotal", this.moneda(pendientes));
        this.texto("facturasPagadasTotal", this.moneda(pagadas));
        this.texto("facturasVencidasTotal", this.moneda(vencidas));

        const tbody = document.getElementById("tablaFacturasSaasTbody");
        if (!tbody) return;
        if (!this.facturacionSaasDisponible) {
            tbody.innerHTML = "<tr><td colspan='7'><div class='empty-state'><span class='empty-state-icon'><i class='fa-solid fa-database'></i></span><p class='font-black text-slate-800'>Instala el módulo de facturación</p><p class='mt-1 max-w-lg text-sm leading-6 text-slate-500'>Ejecuta docs/sql-facturacion-saas-panel-michel-soft.sql en Supabase para habilitar facturas.</p></div></td></tr>";
            return;
        }
        if (!this.facturas.length) {
            tbody.innerHTML = "<tr><td colspan='7'><div class='empty-state'><span class='empty-state-icon'><i class='fa-regular fa-file-lines'></i></span><p class='font-black text-slate-800'>No hay facturas emitidas</p><p class='mt-1 text-sm text-slate-500'>Genera la primera factura SaaS desde este panel.</p></div></td></tr>";
            return;
        }

        tbody.innerHTML = this.facturas.map(factura => {
            const estado = this.estadoFacturaVisual(factura);
            const puedePagar = ["pendiente", "vencida"].includes(estado);
            return "<tr class='border-b border-slate-100 text-sm last:border-0'>" +
                "<td><p class='font-black text-slate-900'>" + this.esc(factura.numero_factura) + "</p><p class='mt-1 text-xs text-slate-400'>" + this.esc(factura.plan) + "</p></td>" +
                "<td><p class='font-bold text-slate-800'>" + this.esc(factura.cliente_nombre) + "</p><p class='mt-1 text-xs text-slate-400'>" + this.esc(factura.cliente_propietario || "-") + "</p></td>" +
                "<td class='whitespace-nowrap'>" + this.formatearFecha(factura.fecha_emision) + "</td>" +
                "<td class='whitespace-nowrap'>" + this.formatearFecha(factura.fecha_vencimiento) + "</td>" +
                "<td class='whitespace-nowrap font-black text-slate-900'>" + this.moneda(factura.total) + "</td>" +
                "<td>" + this.badgeFactura(estado) + "</td>" +
                "<td><div class='flex justify-end gap-1.5 whitespace-nowrap'>" +
                    "<button type='button' class='action-button action-view' title='Ver factura' data-factura-accion='ver' data-factura-id='" + this.esc(factura.id) + "'><i class='fa-regular fa-eye'></i></button>" +
                    "<button type='button' class='action-button action-activate' title='Descargar PDF' data-factura-accion='pdf' data-factura-id='" + this.esc(factura.id) + "'><i class='fa-solid fa-download'></i></button>" +
                    "<button type='button' class='action-button' title='Imprimir' data-factura-accion='imprimir' data-factura-id='" + this.esc(factura.id) + "'><i class='fa-solid fa-print'></i></button>" +
                    (puedePagar ? "<button type='button' class='action-button action-pay' title='Registrar pago' data-factura-accion='pago' data-factura-id='" + this.esc(factura.id) + "'><i class='fa-solid fa-coins'></i></button>" : "") +
                    "<button type='button' class='action-button action-whatsapp' title='Enviar cobro por WhatsApp' data-factura-accion='whatsapp' data-factura-id='" + this.esc(factura.id) + "'><i class='fa-brands fa-whatsapp'></i></button>" +
                "</div></td></tr>";
        }).join("");
    };
    app.abrirModalNuevaFacturaSaas = function () {
        if (!this.facturacionSaasDisponible) {
            this.mostrarToast("Ejecuta primero el SQL de facturación SaaS.", "error");
            return;
        }
        document.getElementById("formNuevaFacturaSaas")?.reset();
        this.mostrarErrorFactura("");
        const clientes = this.clientes.filter(cliente => cliente.estado !== "cancelado");
        const selector = document.getElementById("facturaGimnasioId");
        if (selector) {
            selector.innerHTML = "<option value=''>Seleccionar gimnasio</option>" + clientes.map(cliente =>
                "<option value='" + this.esc(cliente.gimnasio_id) + "'>" + this.esc(cliente.nombre_gimnasio) + "</option>"
            ).join("");
        }
        const hoy = new Date();
        const vencimiento = new Date(hoy);
        vencimiento.setDate(vencimiento.getDate() + 5);
        const inicioPeriodo = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const finPeriodo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
        this.valor("facturaFechaEmision", this.formatearFechaInput(hoy));
        this.valor("facturaFechaVencimiento", this.formatearFechaInput(vencimiento));
        this.valor("facturaPeriodoInicio", this.formatearFechaInput(inicioPeriodo));
        this.valor("facturaPeriodoFin", this.formatearFechaInput(finPeriodo));
        this.valor("facturaCantidad", 1);
        this.valor("facturaItbisPorcentaje", 18);
        if (clientes.length) {
            this.valor("facturaGimnasioId", clientes[0].gimnasio_id);
            this.cargarClienteEnFactura(clientes[0].gimnasio_id);
        }
        this.calcularTotalesFactura();
        this.abrirModal("modalNuevaFacturaSaas");
    };

    app.cargarClienteEnFactura = function (gimnasioId) {
        const cliente = this.obtenerCliente(gimnasioId);
        this.valor("facturaPlan", cliente?.plan || "");
        this.valor("facturaPrecio", Number(cliente?.mensualidad || 0));
        this.calcularTotalesFactura();
    };

    app.calcularTotalesFactura = function () {
        const cantidad = Number(document.getElementById("facturaCantidad")?.value || 0);
        const precio = Number(document.getElementById("facturaPrecio")?.value || 0);
        const porcentaje = Number(document.getElementById("facturaItbisPorcentaje")?.value || 0);
        const subtotal = Math.round((cantidad * precio + Number.EPSILON) * 100) / 100;
        const itbis = Math.round((subtotal * porcentaje / 100 + Number.EPSILON) * 100) / 100;
        this.texto("facturaSubtotalPreview", this.moneda(subtotal));
        this.texto("facturaItbisPreview", this.moneda(itbis));
        this.texto("facturaTotalPreview", this.moneda(subtotal + itbis));
        return { subtotal, itbis, total: subtotal + itbis };
    };

    app.guardarFacturaSaas = async function () {
        if (this.accionEnCurso) return;
        const form = document.getElementById("formNuevaFacturaSaas");
        if (!form?.reportValidity()) return;
        const cliente = this.obtenerCliente(document.getElementById("facturaGimnasioId")?.value || "");
        if (!cliente) throw new Error("Selecciona un cliente SaaS válido.");

        const fechaEmision = document.getElementById("facturaFechaEmision")?.value;
        const fechaVencimiento = document.getElementById("facturaFechaVencimiento")?.value;
        const periodoInicio = document.getElementById("facturaPeriodoInicio")?.value;
        const periodoFin = document.getElementById("facturaPeriodoFin")?.value;
        const plan = (document.getElementById("facturaPlan")?.value || "").trim();
        const cantidad = Number(document.getElementById("facturaCantidad")?.value || 0);
        const precio = Number(document.getElementById("facturaPrecio")?.value || 0);
        const observaciones = (document.getElementById("facturaObservaciones")?.value || "").trim();
        const direccion = (document.getElementById("facturaClienteDireccion")?.value || "").trim();
        const { itbis } = this.calcularTotalesFactura();

        if (!fechaEmision || !fechaVencimiento || !periodoInicio || !periodoFin || !plan) throw new Error("Completa todos los campos obligatorios de la factura.");
        if (fechaVencimiento < fechaEmision) throw new Error("El vencimiento no puede ser anterior a la emisión.");
        if (periodoFin < periodoInicio) throw new Error("El periodo facturado no es válido.");

        const boton = document.getElementById("btnGuardarFacturaSaas");
        this.accionEnCurso = true;
        this.mostrarErrorFactura("");
        try {
            if (boton) {
                boton.disabled = true;
                boton.innerHTML = "<i class='fa-solid fa-circle-notch fa-spin mr-2'></i>Generando";
            }
            const { data, error } = await window.kilvioSupabase.rpc("crear_factura_saas", {
                p_gimnasio_id: cliente.gimnasio_id,
                p_fecha_emision: fechaEmision,
                p_fecha_vencimiento: fechaVencimiento,
                p_periodo_inicio: periodoInicio,
                p_periodo_fin: periodoFin,
                p_plan: plan,
                p_cantidad: cantidad,
                p_precio_unitario: precio,
                p_itbis: itbis,
                p_cliente_nombre: cliente.nombre_gimnasio,
                p_cliente_propietario: cliente.propietario || null,
                p_cliente_telefono: cliente.telefono || null,
                p_cliente_email: cliente.email || null,
                p_cliente_direccion: direccion || null,
                p_observaciones: observaciones || null
            });
            if (error) throw error;
            const creada = Array.isArray(data) ? data[0] : data;
            this.cerrarModal("modalNuevaFacturaSaas");
            await this.recargarDatosSaas();
            const factura = this.obtenerFactura(creada?.id);
            if (factura) this.verFacturaSaas(factura);
            this.mostrarToast("Factura generada correctamente.", "exito");
        } finally {
            this.accionEnCurso = false;
            if (boton) {
                boton.disabled = false;
                boton.innerHTML = "<i class='fa-solid fa-file-circle-check mr-2'></i>Generar factura";
            }
        }
    };

    app.mostrarErrorFactura = function (mensaje) {
        const error = document.getElementById("errorNuevaFacturaSaas");
        if (!error) return;
        error.textContent = mensaje || "";
        error.classList.toggle("hidden", !mensaje);
    };

    app.manejarAccionFactura = async function (accion, factura) {
        if (accion === "ver") return this.verFacturaSaas(factura);
        if (accion === "pdf") return this.descargarFacturaPdf(factura);
        if (accion === "imprimir") return this.imprimirFactura(factura);
        if (accion === "pago") return this.abrirModalPago(this.obtenerCliente(factura.gimnasio_id), factura);
        if (accion === "whatsapp") return this.enviarFacturaWhatsapp(factura);
    };
    app.verFacturaSaas = function (factura) {
        this.facturaSeleccionada = factura;
        this.texto("vistaFacturaSaasTitulo", factura.numero_factura || "Factura SaaS");
        const contenedor = document.getElementById("facturaVistaContenido");
        if (contenedor) contenedor.innerHTML = this.construirVistaFactura(factura);
        const botonWhatsappFactura = document.getElementById("btnFacturaWhatsapp");
        if (botonWhatsappFactura) {
            botonWhatsappFactura.classList.toggle("hidden", factura.estado === "anulada");
            botonWhatsappFactura.innerHTML = factura.estado === "pagada"
                ? "<i class='fa-brands fa-whatsapp mr-1.5'></i>Confirmar WhatsApp"
                : "<i class='fa-brands fa-whatsapp mr-1.5'></i>WhatsApp";
        }
        this.abrirModal("modalVistaFacturaSaas");
    };

    app.construirVistaFactura = function (factura) {
        const estado = this.estadoFacturaVisual(factura);
        const pagada = estado === "pagada";
        const detalle = this.detallePagoFacturaSaas(factura);
        const pendiente = pagada ? 0 : Number(factura.total || 0);
        const pagoHtml = pagada ?
            "<div class='grid gap-3 px-7 pb-7 sm:grid-cols-2 lg:grid-cols-4'>" +
                "<div class='rounded-xl border border-emerald-200 bg-emerald-50 p-4'><p class='text-xs font-bold text-emerald-700'>Fecha pago</p><p class='mt-1 font-black text-emerald-950'>" + this.formatearFecha(detalle.fechaPago) + "</p></div>" +
                "<div class='rounded-xl border border-slate-200 p-4'><p class='text-xs font-bold text-slate-400'>Vencimiento anterior</p><p class='mt-1 font-black text-slate-800'>" + this.formatearFecha(detalle.fechaVencimientoAnterior) + "</p></div>" +
                "<div class='rounded-xl border border-slate-200 p-4'><p class='text-xs font-bold text-slate-400'>Próximo vencimiento</p><p class='mt-1 font-black text-slate-800'>" + this.formatearFecha(detalle.proximoVencimiento) + "</p></div>" +
                "<div class='rounded-xl border border-slate-200 p-4'><p class='text-xs font-bold text-slate-400'>Recibido por</p><p class='mt-1 truncate font-black text-slate-800'>" + this.esc(detalle.recibidoPor) + "</p></div>" +
            "</div>" : "";
        return "<article class='mx-auto max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5'>" +
            "<div class='flex flex-col justify-between gap-6 border-b border-slate-200 bg-slate-950 p-7 text-white sm:flex-row'>" +
                "<div class='flex items-center gap-4'><div class='flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-2'><img src='img/Logo.png' alt='Michel Soft' class='h-full w-full object-contain'></div><div><p class='text-xl font-black tracking-[.08em]'>MICHEL SOFT</p><p class='mt-1 text-xs font-semibold uppercase tracking-[.14em] text-blue-300'>Software & Business Solutions</p><p class='mt-3 text-xs font-black uppercase tracking-[.18em] text-white/80'>FACTURA ELECTRÓNICA</p></div></div>" +
                "<div class='text-left sm:text-right'><p class='text-xs font-bold uppercase tracking-[.16em] text-slate-400'>Factura No:</p><p class='mt-2 text-2xl font-black'>" + this.esc(factura.numero_factura) + "</p><div class='mt-3'>" + this.badgeFactura(estado) + "</div></div>" +
            "</div>" +
            "<div class='grid gap-6 p-7 sm:grid-cols-2'>" +
                "<section><p class='text-xs font-black uppercase tracking-[.14em] text-blue-600'>Emisor</p><h3 class='mt-3 font-black text-slate-900'>MICHEL SOFT</h3><p class='mt-2 text-sm leading-6 text-slate-600'>Software & Business Solutions<br>Teléfono: 849-862-8813<br>Correo: rrichardmichelle7@gmail.com<br>Dirección: Calle Central Manzana 13, Santo Domingo Este<br>Cédula: 402-3926213-8</p></section>" +
                "<section class='rounded-2xl bg-slate-50 p-5'><p class='text-xs font-black uppercase tracking-[.14em] text-blue-600'>Cliente</p><h3 class='mt-3 font-black text-slate-900'>" + this.esc(factura.cliente_nombre) + "</h3><p class='mt-2 text-sm leading-6 text-slate-600'>Propietario: " + this.esc(factura.cliente_propietario || "-") + "<br>Servicio: " + this.esc(factura.servicio || "FitControl Pro") + "<br>Plan: " + this.esc(factura.plan || "-") + "<br>Teléfono: " + this.esc(factura.cliente_telefono || "-") + "</p></section>" +
            "</div>" +
            "<div class='grid gap-3 px-7 pb-7 sm:grid-cols-3'><div class='rounded-xl border border-slate-200 p-4'><p class='text-xs font-bold text-slate-400'>Fecha factura</p><p class='mt-1 font-black text-slate-800'>" + this.formatearFecha(factura.fecha_emision) + "</p></div><div class='rounded-xl border border-slate-200 p-4'><p class='text-xs font-bold text-slate-400'>Vencimiento</p><p class='mt-1 font-black text-slate-800'>" + this.formatearFecha(factura.fecha_vencimiento) + "</p></div><div class='rounded-xl border border-slate-200 p-4'><p class='text-xs font-bold text-slate-400'>Periodo</p><p class='mt-1 font-black text-slate-800'>" + this.formatearFecha(factura.periodo_inicio) + " - " + this.formatearFecha(factura.periodo_fin) + "</p></div></div>" +
            pagoHtml +
            "<div class='px-7 pb-7'><div class='overflow-hidden rounded-2xl border border-slate-200'><table class='w-full text-left text-sm'><thead class='bg-slate-50 text-xs uppercase tracking-wide text-slate-500'><tr><th class='px-4 py-3'>Servicio</th><th class='px-4 py-3'>Plan</th><th class='px-4 py-3 text-right'>Cantidad</th><th class='px-4 py-3 text-right'>Precio</th><th class='px-4 py-3 text-right'>Subtotal</th></tr></thead><tbody><tr><td class='px-4 py-4 font-bold text-slate-900'>" + this.esc(factura.servicio || "FitControl Pro") + "</td><td class='px-4 py-4 text-slate-600'>" + this.esc(factura.plan) + "</td><td class='px-4 py-4 text-right'>" + Number(factura.cantidad || 1) + "</td><td class='px-4 py-4 text-right'>" + this.moneda(factura.precio_unitario) + "</td><td class='px-4 py-4 text-right font-bold'>" + this.moneda(factura.subtotal) + "</td></tr></tbody></table></div>" +
                "<div class='ml-auto mt-5 max-w-sm space-y-3 rounded-2xl bg-slate-950 p-5 text-white'><div class='flex justify-between text-sm text-slate-300'><span>Monto facturado</span><span>" + this.moneda(factura.subtotal) + "</span></div><div class='flex justify-between text-sm text-slate-300'><span>ITBIS</span><span>" + this.moneda(factura.itbis) + "</span></div><div class='flex justify-between border-t border-slate-700 pt-3 text-lg font-black'><span>Total</span><span>" + this.moneda(factura.total) + "</span></div>" +
                (pagada ? "<div class='flex justify-between text-sm text-emerald-200'><span>Depósito / monto recibido</span><span>" + this.moneda(detalle.montoPagado) + "</span></div><div class='flex justify-between text-sm text-slate-300'><span>Método de pago</span><span>" + this.esc(detalle.metodoPago) + "</span></div><div class='flex justify-between text-sm text-slate-300'><span>Referencia</span><span>" + this.esc(detalle.referenciaPago) + "</span></div><div class='flex justify-between border-t border-slate-700 pt-3 text-sm font-black text-emerald-200'><span>Total pendiente</span><span>" + this.moneda(pendiente) + "</span></div>" : "") + "</div>" +
                "<div class='mt-5 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-900'><span class='font-black'>Nota:</span> Recuerde contactarnos en caso de no poder pagar a tiempo para evitar la suspensión automática del servicio.</div>" +
                "<p class='mt-5 text-center text-sm font-bold text-slate-600'>Gracias por confiar en Michel Soft.</p>" +
                (factura.observaciones ? "<div class='mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600'><span class='font-bold text-slate-800'>Observaciones:</span> " + this.esc(factura.observaciones) + "</div>" : "") +
            "</div>" +
        "</article>";
    };    app.abrirModalPago = function (cliente, facturaPreseleccionada = null) {
        if (!cliente) {
            this.mostrarToast("Cliente SaaS no encontrado.", "error");
            return;
        }
        const pendientes = this.facturas.filter(factura =>
            String(factura.gimnasio_id) === String(cliente.gimnasio_id) &&
            ["pendiente", "vencida"].includes(this.estadoFacturaVisual(factura))
        );
        if (!pendientes.length) {
            this.mostrarToast("Este cliente no tiene facturas pendientes. Genera una factura antes de registrar el pago.", "error");
            return;
        }

        document.getElementById("formPagoSaas")?.reset();
        this.clienteSeleccionado = cliente;
        this.valor("pagoSaasGimnasioId", cliente.gimnasio_id);
        this.valor("pagoSaasGimnasio", cliente.nombre_gimnasio || "-");
        this.valor("pagoSaasMetodo", "Transferencia");
        this.valor("pagoSaasFecha", this.formatearFechaInput(new Date()));

        const selector = document.getElementById("pagoSaasFacturaId");
        if (selector) {
            selector.innerHTML = pendientes.map(factura =>
                "<option value='" + this.esc(factura.id) + "'>" + this.esc(factura.numero_factura) + " · " + this.moneda(factura.total) + "</option>"
            ).join("");
        }
        const seleccionada = facturaPreseleccionada && pendientes.some(item => String(item.id) === String(facturaPreseleccionada.id))
            ? facturaPreseleccionada
            : pendientes[0];
        this.valor("pagoSaasFacturaId", seleccionada.id);
        this.cargarFacturaEnPago(seleccionada.id);
        this.mostrarErrorPago("");
        this.abrirModal("modalPagoSaas");
    };

    app.cargarFacturaEnPago = function (facturaId) {
        const factura = this.obtenerFactura(facturaId);
        if (!factura) return;
        this.valor("pagoSaasMonto", Number(factura.total || 0));
        this.valor("pagoSaasPeriodo", String(factura.periodo_inicio || "").slice(0, 7));
        this.valor("pagoSaasProximoVencimiento", factura.periodo_fin || factura.fecha_vencimiento || "");
    };

    app.obtenerPagoSaas = function (pagoId) {
        return this.pagos.find(pago => String(pago.id) === String(pagoId)) || null;
    };

    app.obtenerPagoFacturaSaas = function (factura) {
        if (!factura) return null;
        return this.pagos.find(pago => String(pago.id) === String(factura.pago_saas_id || "")) ||
            this.pagos.find(pago =>
                String(pago.gimnasio_id) === String(factura.gimnasio_id) &&
                String(pago.periodo_inicio || "").slice(0, 10) === String(factura.periodo_inicio || "").slice(0, 10) &&
                String(pago.periodo_fin || "").slice(0, 10) === String(factura.periodo_fin || "").slice(0, 10) &&
                String(pago.estado || "").toLowerCase() === "pagado"
            ) || null;
    };

    app.obtenerFacturaPorPagoSaas = function (pago) {
        if (!pago) return null;
        return this.facturas.find(factura => String(factura.pago_saas_id || "") === String(pago.id)) ||
            this.facturas.find(factura =>
                String(factura.gimnasio_id) === String(pago.gimnasio_id) &&
                String(factura.periodo_inicio || "").slice(0, 10) === String(pago.periodo_inicio || "").slice(0, 10) &&
                String(factura.periodo_fin || "").slice(0, 10) === String(pago.periodo_fin || "").slice(0, 10)
            ) || null;
    };

    app.obtenerNombreUsuarioLogueado = function () {
        return String(window.auth?.profile?.nombre || window.auth?.user?.email || "Super Admin SaaS").trim();
    };

    app.detallePagoFacturaSaas = function (factura) {
        const pago = this.obtenerPagoFacturaSaas(factura) || {};
        const cliente = this.obtenerCliente(factura?.gimnasio_id) || {};
        return {
            pago,
            cliente,
            fechaPago: pago.fecha_pago || factura?.updated_at || new Date().toISOString(),
            fechaVencimientoAnterior: factura?.fecha_vencimiento || pago.fecha_vencimiento || factura?.periodo_fin,
            proximoVencimiento: cliente.fecha_vencimiento || factura?.periodo_fin || factura?.fecha_vencimiento,
            montoPagado: pago.monto ?? factura?.total ?? 0,
            metodoPago: pago.metodo_pago || factura?.metodo_pago || "-",
            referenciaPago: pago.referencia_pago || factura?.referencia_pago || "-",
            recibidoPor: this.obtenerNombreUsuarioLogueado()
        };
    };

    app.mostrarConfirmacionPagoSaas = function (factura) {
        if (!factura) return;
        this.facturaPagadaSeleccionada = factura;
        this.facturaSeleccionada = factura;
        this.texto("confirmacionPagoSaasDetalle", "Factura " + (factura.numero_factura || "SaaS") + " marcada como pagada para " + (factura.cliente_nombre || "el cliente") + ".");
        this.abrirModal("modalConfirmacionPagoSaas");
    };

    app.manejarAccionPagoSaas = async function (accion, pago) {
        const factura = this.obtenerFacturaPorPagoSaas(pago);
        if (!factura) throw new Error("No se encontró una factura asociada a este pago.");
        if (accion === "ver") return this.verFacturaSaas(factura);
        if (accion === "imprimir") return this.imprimirFactura(factura);
        if (accion === "whatsapp") return this.enviarFacturaWhatsapp(factura);
    };
    app.registrarPagoSaas = async function () {
        if (this.accionEnCurso) return;
        const factura = this.obtenerFactura(document.getElementById("pagoSaasFacturaId")?.value || "");
        const metodoPago = document.getElementById("pagoSaasMetodo")?.value || "Transferencia";
        const referenciaPago = (document.getElementById("pagoSaasReferencia")?.value || "").trim();
        const fechaPago = document.getElementById("pagoSaasFecha")?.value;
        if (!factura) throw new Error("Selecciona una factura pendiente.");
        if (!fechaPago) throw new Error("Selecciona la fecha de pago.");

        const boton = document.getElementById("btnGuardarPagoSaas");
        this.accionEnCurso = true;
        this.mostrarErrorPago("");
        try {
            if (boton) {
                boton.disabled = true;
                boton.innerHTML = "<i class='fa-solid fa-circle-notch fa-spin mr-2'></i>Guardando";
            }
            const { data, error } = await window.kilvioSupabase.rpc("registrar_pago_factura_saas", {
                p_factura_id: factura.id,
                p_metodo_pago: metodoPago,
                p_referencia_pago: referenciaPago || null,
                p_fecha_pago: fechaPago + "T12:00:00.000Z"
            });
            if (error) throw error;
            if (!data?.factura_id) throw new Error("No se pudo confirmar el pago de la factura.");
            this.cerrarModal("modalPagoSaas");
            await this.recargarDatosSaas();
            const facturaPagada = this.obtenerFactura(data.factura_id) || factura;
            this.mostrarToast("Pago registrado correctamente.", "exito");
            this.mostrarConfirmacionPagoSaas(facturaPagada);
        } finally {
            this.accionEnCurso = false;
            if (boton) {
                boton.disabled = false;
                boton.innerHTML = "<i class='fa-solid fa-check mr-2'></i>Guardar pago";
            }
        }
    };

    app.enviarFacturaWhatsapp = async function (factura) {
        let cliente = this.obtenerCliente(factura.gimnasio_id) || {};

        if (factura.gimnasio_id && window.kilvioSupabase) {
            const { data, error } = await window.kilvioSupabase
                .from("gimnasios_clientes")
                .select("gimnasio_id,nombre_gimnasio,propietario,propietario_whatsapp,propietario_telefono,telefono,telefono_gimnasio,contacto_principal_telefono,fecha_vencimiento")
                .eq("gimnasio_id", factura.gimnasio_id)
                .maybeSingle();

            if (!error && data) cliente = { ...cliente, ...data };
        }

        const telefonoCliente = [
            cliente.propietario_whatsapp,
            cliente.propietario_telefono,
            cliente.telefono,
            cliente.telefono_gimnasio,
            cliente.contacto_principal_telefono
        ].find(valor => this.normalizarTelefonoWhatsapp(valor));
        const telefono = this.normalizarTelefonoWhatsapp(telefonoCliente || factura.cliente_telefono);
        if (!telefono) {
            this.mostrarToast("Este cliente no tiene teléfono registrado.", "error");
            return;
        }

        const salto = String.fromCharCode(10);
        const monto = valor => Number(valor || 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const pagada = this.estadoFacturaVisual(factura) === "pagada";
        let mensaje;

        if (pagada) {
            const detalle = this.detallePagoFacturaSaas(factura);
            mensaje = [
                "Factura electrónica",
                "MICHEL SOFT",
                "",
                "Pago de servicio FitControl Pro",
                "Cliente: " + (cliente.nombre_gimnasio || factura.cliente_nombre || "-"),
                "Propietario: " + (cliente.propietario || factura.cliente_propietario || "-"),
                "",
                "Factura: " + (factura.numero_factura || "-"),
                "Fecha factura: " + this.formatearFecha(factura.fecha_emision),
                "Estado: PAGADA",
                "Plan: " + (factura.plan || "-"),
                "Monto pagado: RD$" + monto(detalle.montoPagado),
                "Método de pago: " + (detalle.metodoPago || "-"),
                "Referencia: " + (detalle.referenciaPago || "-"),
                "Recibido por: " + detalle.recibidoPor,
                "Fecha pago: " + this.formatearFecha(detalle.fechaPago),
                "Próximo vencimiento: " + this.formatearFecha(detalle.proximoVencimiento),
                "Total pendiente: RD$0.00",
                "",
                "Nota: Recuerde contactarnos en caso de no poder pagar a tiempo para evitar la suspensión automática del servicio.",
                "",
                "Gracias por confiar en Michel Soft."
            ].join(salto);
        } else {
            mensaje = [
                "Saludos " + (cliente.propietario || factura.cliente_propietario || "cliente") + ".",
                "",
                "Le informamos que la factura " + factura.numero_factura + " correspondiente al servicio FitControl Pro para " + (cliente.nombre_gimnasio || factura.cliente_nombre || "su gimnasio") + " se encuentra pendiente de pago.",
                "",
                "Monto:",
                "RD$" + monto(factura.total),
                "",
                "Fecha de vencimiento:",
                this.formatearFecha(factura.fecha_vencimiento),
                "",
                "Puede realizar el pago mediante:",
                "",
                "Banreservas:",
                "9607204887",
                "",
                "Qik:",
                "1000103957",
                "",
                "Popular:",
                "841534712",
                "",
                "Cédula:",
                "402-3926213-8",
                "",
                "Favor enviar comprobante de pago luego de realizar la transferencia.",
                "",
                "Gracias por confiar en Michel Soft."
            ].join(salto);
        }

        window.open("https://wa.me/" + telefono + "?text=" + encodeURIComponent(mensaje), "_blank", "noopener,noreferrer");
    };    app.descargarFacturaPdf = async function (factura) {
        const jsPDF = window.jspdf?.jsPDF;
        if (!jsPDF) throw new Error("El generador PDF no está disponible.");
        const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
        const azul = [37, 99, 235];
        const oscuro = [15, 23, 42];
        const gris = [100, 116, 139];
        const verde = [22, 163, 74];
        const logo = await this.cargarLogoFactura();
        const estado = this.estadoFacturaVisual(factura);
        const pagada = estado === "pagada";
        const detalle = this.detallePagoFacturaSaas(factura);

        doc.setFillColor(...oscuro);
        doc.rect(0, 0, 210, 44, "F");
        doc.addImage(logo, "PNG", 16, 9, 25, 25);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text("MICHEL SOFT", 48, 18);
        doc.setFontSize(8);
        doc.setTextColor(147, 197, 253);
        doc.text("SOFTWARE & BUSINESS SOLUTIONS", 48, 25);
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.text("FACTURA ELECTRÓNICA", 194, 14, { align: "right" });
        doc.text(String(factura.numero_factura || "-"), 194, 21, { align: "right" });
        doc.setFillColor(...(pagada ? verde : azul));
        doc.roundedRect(164, 27, 30, 8, 2, 2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(String(estado || "pendiente").toUpperCase(), 179, 32.5, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...gris);
        doc.text(["Teléfono: 849-862-8813", "Correo: rrichardmichelle7@gmail.com", "Dirección: Calle Central Manzana 13, Santo Domingo Este", "Cédula: 402-3926213-8"], 16, 54);

        doc.setFillColor(248, 250, 252);
        doc.roundedRect(108, 49, 86, 35, 3, 3, "F");
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...azul);
        doc.text("CLIENTE", 114, 57);
        doc.setTextColor(...oscuro);
        doc.setFontSize(11);
        doc.text(String(factura.cliente_nombre || "-"), 114, 65);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...gris);
        doc.text(["Propietario: " + (factura.cliente_propietario || "-"), "Servicio: " + (factura.servicio || "FitControl Pro"), "Plan: " + (factura.plan || "-")], 114, 71);

        let y = 98;
        const campo = (label, value, x, yCampo) => {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...gris);
            doc.setFontSize(7);
            doc.text(label, x, yCampo);
            doc.setFontSize(9);
            doc.setTextColor(...oscuro);
            doc.text(String(value || "-"), x, yCampo + 6);
        };
        campo("FECHA FACTURA", this.formatearFecha(factura.fecha_emision), 16, y);
        campo("FECHA PAGO", pagada ? this.formatearFecha(detalle.fechaPago) : "-", 70, y);
        campo("VENCIMIENTO ANTERIOR", this.formatearFecha(detalle.fechaVencimientoAnterior), 124, y);
        y += 20;
        campo("PRÓXIMO VENCIMIENTO", pagada ? this.formatearFecha(detalle.proximoVencimiento) : this.formatearFecha(factura.fecha_vencimiento), 16, y);
        campo("MÉTODO DE PAGO", pagada ? detalle.metodoPago : "-", 70, y);
        campo("REFERENCIA", pagada ? detalle.referenciaPago : "-", 124, y);
        y += 23;

        doc.setFillColor(...azul);
        doc.rect(16, y, 178, 9, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("SERVICIO", 20, y + 6);
        doc.text("PLAN", 78, y + 6);
        doc.text("SUBTOTAL", 190, y + 6, { align: "right" });
        y += 18;
        doc.setTextColor(...oscuro);
        doc.text(String(factura.servicio || "FitControl Pro"), 20, y);
        doc.setFont("helvetica", "normal");
        doc.text(String(factura.plan || "-"), 78, y);
        doc.text(this.monedaPdf(factura.subtotal), 190, y, { align: "right" });
        doc.line(16, y + 7, 194, y + 7);
        y += 20;

        doc.setFillColor(...oscuro);
        doc.roundedRect(108, y, 86, pagada ? 66 : 38, 3, 3, "F");
        doc.setTextColor(203, 213, 225);
        doc.setFont("helvetica", "normal");
        doc.text("Monto facturado", 115, y + 10);
        doc.text(this.monedaPdf(factura.subtotal), 187, y + 10, { align: "right" });
        doc.text("ITBIS", 115, y + 20);
        doc.text(this.monedaPdf(factura.itbis), 187, y + 20, { align: "right" });
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("TOTAL", 115, y + 32);
        doc.text(this.monedaPdf(factura.total), 187, y + 32, { align: "right" });
        if (pagada) {
            doc.setFontSize(8);
            doc.setTextColor(187, 247, 208);
            doc.text("Depósito / monto recibido", 115, y + 44);
            doc.text(this.monedaPdf(detalle.montoPagado), 187, y + 44, { align: "right" });
            doc.text("Total pendiente", 115, y + 56);
            doc.text(this.monedaPdf(0), 187, y + 56, { align: "right" });
        }

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...gris);
        doc.text("Recibido por: " + (pagada ? detalle.recibidoPor : "-"), 16, y + 10);
        doc.text(doc.splitTextToSize("Nota: Recuerde contactarnos en caso de no poder pagar a tiempo para evitar la suspensión automática del servicio.", 82), 16, y + 22);
        doc.setFont("helvetica", "bold");
        doc.text("Gracias por confiar en Michel Soft.", 105, 276, { align: "center" });
        doc.save((factura.numero_factura || "factura-saas") + ".pdf");
    };    app.monedaPdf = function (valor) {
        return "RD$ " + Number(valor || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    app.imprimirFactura = function (factura) {
        const ventana = window.open("", "_blank", "width=1000,height=800");
        if (!ventana) {
            this.mostrarToast("El navegador bloqueó la ventana de impresión.", "error");
            return;
        }
        ventana.opener = null;
        const contenido = this.construirVistaFactura(factura);
        ventana.document.write("<!DOCTYPE html><html lang='es'><head><meta charset='UTF-8'><title>" + this.esc(factura.numero_factura) + "</title><script src='https://cdn.tailwindcss.com'></script><style>@page{size:A4;margin:12mm}body{background:white!important}article{box-shadow:none!important}</style></head><body class='bg-white p-0'>" + contenido + "<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),350));</script></body></html>");
        ventana.document.close();
    };
})();