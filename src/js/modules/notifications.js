// src/js/modules/notifications.js

import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";

// Opções padrão para todas as nossas notificações
const defaultOptions = {
    duration: 5000,
    close: true,
    gravity: "top", // `top` ou `bottom`
    position: "right", // `left`, `center` ou `right`
    stopOnFocus: true, // Impede que a notificação suma ao passar o mouse
};

/**
 * Exibe uma notificação de sucesso (azul).
 * @param {string} message A mensagem a ser exibida.
 */
export function showSuccessToast(message) {
    Toastify({
        ...defaultOptions,
        text: message,
        style: {
            background: "linear-gradient(to right, #0071e3, #2563EB)",
        },
    }).showToast();
}

/**
 * Exibe uma notificação de erro (vermelha).
 * @param {string} message A mensagem a ser exibida.
 */
export function showErrorToast(message) {
    Toastify({
        ...defaultOptions,
        text: message,
        style: {
            // Um gradiente de vermelho para erros
            background: "linear-gradient(to right, #D32F2F, #C62828)",
        },
    }).showToast();
}