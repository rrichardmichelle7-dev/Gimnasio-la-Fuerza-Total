/**
 * ============================================
 * SISTEMA CENTRALIZADO DE MODALES - v2.0
 * ============================================
 * 
 * Sistema profesional, reutilizable y escalable
 * para gestionar modales en toda la aplicación.
 * 
 * Características:
 * - Gestión centralizada de modales
 * - Transiciones suaves
 * - Prevención de scroll en body
 * - Cierre con ESC
 * - Cierre al hacer click en overlay
 * - Soporte para formularios
 * - Sin dependencias externas
 */

/**
 * ============================================
 * CLASE: ModalManager
 * ============================================
 */
class ModalManager {
    constructor() {
        this.openModals = new Set();
        this.transitionDuration = 300;
        this.init();
    }

    /**
     * Inicializa el sistema de modales
     */
    init() {
        this.setupEventListeners();
        this.setupFormHandlers();
        this.addStyles();
    }

    /**
     * Agrega estilos CSS dinámicamente para transiciones
     */
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Animaciones de modales */
            @keyframes modalFadeIn {
                from {
                    opacity: 0;
                }
                to {
                    opacity: 1;
                }
            }

            @keyframes modalScaleIn {
                from {
                    opacity: 0;
                    transform: scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }

            @keyframes modalScaleOut {
                from {
                    opacity: 1;
                    transform: scale(1);
                }
                to {
                    opacity: 0;
                    transform: scale(0.95);
                }
            }

            /* Modal en proceso de apertura */
            [role="dialog"].modal-opening {
                animation: modalFadeIn 0.3s ease-out forwards;
            }

            [role="dialog"].modal-opening > div {
                animation: modalScaleIn 0.3s ease-out forwards;
            }

            /* Modal en proceso de cierre */
            [role="dialog"].modal-closing {
                animation: modalFadeIn 0.3s ease-out reverse forwards;
            }

            [role="dialog"].modal-closing > div {
                animation: modalScaleOut 0.3s ease-out forwards;
            }

            /* Overlay clickeable */
            .modal-overlay {
                cursor: default;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Configura todos los event listeners de modales
     */
    setupEventListeners() {
        // Esperar a que el DOM esté listo
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.bindModalButtons();
            });
        } else {
            this.bindModalButtons();
        }
    }

    /**
     * Vincula todos los botones de modales
     */
    bindModalButtons() {
        // Botones para abrir modales
        document.querySelectorAll('[data-modal-open]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const modalId = btn.getAttribute('data-modal-open');
                this.openModal(modalId);
            });
        });

        // Botones para cerrar modales (X)
        document.querySelectorAll('[data-modal-close]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const modalId = btn.getAttribute('data-modal-close');
                this.closeModal(modalId);
            });
        });

        // Botones para cancelar modales
        document.querySelectorAll('[data-modal-cancel]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const modalId = btn.getAttribute('data-modal-cancel');
                this.closeModal(modalId);
            });
        });

        // Cerrar modal al hacer clic en el overlay
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    const modal = overlay.closest('[role="dialog"]');
                    if (modal) {
                        this.closeModal(modal.id);
                    }
                }
            });
        });

        // Cerrar al presionar ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.openModals.size > 0) {
                const lastModal = Array.from(this.openModals).pop();
                this.closeModal(lastModal);
            }
        });
    }

    /**
     * Abre un modal con transición suave
     * @param {string} modalId - ID del modal
     */
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.warn(`⚠ Modal "${modalId}" no encontrado`);
            return;
        }

        // Prevenir scroll en body
        document.body.style.overflow = 'hidden';

        // Agregar modal a la lista de abiertos
        this.openModals.add(modalId);

        // Remover clase hidden
        modal.classList.remove('hidden');
        
        // Trigger reflow para aplicar transiciones
        modal.offsetHeight;
        
        // Aplicar animación de apertura
        modal.classList.add('modal-opening');

        // Limpiar formulario si existe
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
        }

    }

    /**
     * Cierra un modal con transición suave
     * @param {string} modalId - ID del modal
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.warn(`⚠ Modal "${modalId}" no encontrado`);
            return;
        }

        // Aplicar transición de cierre
        modal.classList.remove('modal-opening');
        modal.classList.add('modal-closing');

        // Esperar a que termine la transición
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('modal-closing');
            this.openModals.delete(modalId);

            // Restaurar scroll si no hay modales abiertos
            if (this.openModals.size === 0) {
                document.body.style.overflow = 'auto';
            }

        }, this.transitionDuration);
    }

    /**
     * Configura handlers para formularios
     */
    setupFormHandlers() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.bindFormSubmits();
            });
        } else {
            this.bindFormSubmits();
        }
    }

    /**
     * Vincula los eventos submit de formularios
     */
    bindFormSubmits() {
        document.querySelectorAll('[data-modal-form]').forEach(form => {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const modalId = form.getAttribute('data-modal-form');
                const formData = new FormData(form);
                const data = Object.fromEntries(formData);

                // Llamar callback personalizado si existe
                const handlerName = `handle${this.toCamelCase(modalId)}`;
                const handler = window[handlerName];
                
                let shouldClose = true;

                if (typeof handler === 'function') {
                    try {
                        const result = await handler(data);
                        shouldClose = result !== false;
                    } catch (error) {
                        console.warn(`No se pudo procesar el formulario de "${modalId}".`, error);
                        shouldClose = false;
                    }
                } else {
                    console.warn(`Modal "${modalId}" no tiene handler configurado.`);
                    shouldClose = false;
                }

                if (shouldClose) {
                    this.closeModal(modalId);
                }
            });
        });
    }

    /**
     * Convierte snake_case a camelCase
     */
    toCamelCase(str) {
        return str
            .split('-')
            .map((part, i) => i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1))
            .join('');
    }

    /**
     * Limpia un formulario específico
     * @param {string} formId - ID del formulario
     */
    clearForm(formId) {
        const form = document.getElementById(formId);
        if (form) {
            form.reset();
        }
    }

    /**
     * Obtiene los datos de un modal
     * @param {string} modalId - ID del modal
     */
    getModalData(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return null;

        const form = modal.querySelector('form');
        if (!form) return null;

        return Object.fromEntries(new FormData(form));
    }

    /**
     * Obtiene un modal por ID
     * @param {string} modalId - ID del modal
     */
    getModal(modalId) {
        return document.getElementById(modalId);
    }

    /**
     * Verifica si un modal está abierto
     * @param {string} modalId - ID del modal
     */
    isOpen(modalId) {
        return this.openModals.has(modalId);
    }

    /**
     * Cierra todos los modales abiertos
     */
    closeAll() {
        const modalsToClose = Array.from(this.openModals);
        modalsToClose.forEach(modalId => this.closeModal(modalId));
    }
}

// ============================================
// INSTANCIA GLOBAL
// ============================================

// Crear instancia global del gestor de modales
const modalManager = new ModalManager();

// Hacer disponible globalmente
window.modalManager = modalManager;

// Métodos globales para acceso rápido
window.openModal = (modalId) => modalManager.openModal(modalId);
window.closeModal = (modalId) => modalManager.closeModal(modalId);
window.clearForm = (formId) => modalManager.clearForm(formId);
