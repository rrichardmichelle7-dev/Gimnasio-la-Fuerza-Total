(function () {
    "use strict";

    const etiquetasRol = {
        administrador: "Administrador",
        recepcion: "Recepción",
        super_admin_saas: "Super Admin SaaS"
    };

    function obtenerIniciales(nombre) {
        const partes = String(nombre || "Usuario")
            .trim()
            .split(/[\s._-]+/)
            .filter(Boolean);

        if (!partes.length) return "U";
        if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
        return (partes[0][0] + partes[1][0]).toUpperCase();
    }

    function render(profile, user, root = document) {
        const nombre = String(profile?.nombre || user?.email || "Usuario").trim();
        const rol = String(profile?.rol || "recepcion").trim().toLowerCase();
        const etiquetaRol = etiquetasRol[rol] || rol.replaceAll("_", " ");
        const baseIniciales = nombre.includes("@") ? nombre.split("@")[0] : nombre;
        const iniciales = obtenerIniciales(baseIniciales);

        root.querySelectorAll("[data-user-identity]").forEach(contenedor => {
            const nombreElement = contenedor.querySelector("[data-user-name]");
            const rolElement = contenedor.querySelector("[data-user-role]");
            const avatarElement = contenedor.querySelector("[data-user-initials]");
            if (nombreElement) nombreElement.textContent = nombre;
            if (rolElement) rolElement.textContent = etiquetaRol;
            if (avatarElement) {
                avatarElement.textContent = iniciales;
                avatarElement.title = nombre + " · " + etiquetaRol;
            }
        });
    }

    window.userIdentity = { render, obtenerIniciales };
})();