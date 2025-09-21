import { showSuccessToast, showErrorToast } from './notifications.js';
import { supabase } from '../supabaseClient.js';

function initSignUpForm() {
    const signUpForm = document.getElementById('signup-form');
    if (!signUpForm) return;

    const emailInput = signUpForm.querySelector('#email');
    const submitButton = signUpForm.querySelector('button[type="submit"]');

    emailInput.addEventListener('blur', async () => {
        const email = emailInput.value;
        if (email.length < 5 || !email.includes('@')) {
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Verificando e-mail...';

        try {
            const response = await fetch('/api/verify-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email }),
            });
            const result = await response.json();

            if (result.isValid) {
                showSuccessToast('E-mail parece ser válido!');
                submitButton.disabled = false;
                submitButton.textContent = 'Criar Conta';
            } else {
                showErrorToast(result.message || 'Este e-mail não parece ser válido.');
                submitButton.textContent = 'E-mail Inválido';
            }
        } catch (error) {
            console.error('Erro ao verificar e-mail:', error);
            submitButton.disabled = false;
            submitButton.textContent = 'Criar Conta';
        }
    });

    signUpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = signUpForm.querySelector('#full_name').value;
        const username = signUpForm.querySelector('#username').value;
        const email = signUpForm.querySelector('#email').value;
        const password = signUpForm.querySelector('#password').value;
        const passwordConfirm = signUpForm.querySelector('#password-confirm').value;

        if (password !== passwordConfirm) {
            showErrorToast('As senhas não coincidem. Por favor, tente novamente.');
            return;
        }
        
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: { data: { full_name: fullName, username: username } }
        });

        if (error) {
            showErrorToast('Erro ao criar a conta: ' + error.message);
        } else {
            // CORREÇÃO: Usando a notificação de sucesso
            showSuccessToast('Conta criada com sucesso! Verifique seu email para confirmar.');
            window.location.href = '/login.html';
        }
    });
}

function initLoginForm() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginForm.querySelector('#email').value;
        const password = loginForm.querySelector('#password').value;

        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            showErrorToast('Erro no login: ' + error.message);
        } else if (data.user) {
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', data.user.id)
                .single();

            if (profileError) {
                showErrorToast('Erro ao buscar perfil: ' + profileError.message);
            } else {
                // CORREÇÃO: Usando a notificação de sucesso
                showSuccessToast('Login realizado com sucesso!');
                if (profile && profile.role === 'admin') {
                    window.location.href = '/admin.html';
                } else {
                    window.location.href = '/dashboard.html';
                }
            }
        }
    });
}

function initForgotPasswordForm() {
    const form = document.getElementById('forgot-password-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = form.querySelector('#email').value;
        const resetUrl = `${window.location.origin}/resetar-senha.html`;

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: resetUrl,
        });

        if (error) {
            showErrorToast('Erro: ' + error.message);
        } else {
            // CORREÇÃO: Usando a notificação de sucesso
            showSuccessToast('Se este email estiver cadastrado, um link de recuperação foi enviado.');
            form.reset();
        }
    });
}

function initResetPasswordForm() {
    const form = document.getElementById('reset-password-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = form.querySelector('#new-password').value;
        const confirmPassword = form.querySelector('#confirm-password').value;

        if (newPassword !== confirmPassword) {
            showErrorToast('As senhas não coincidem!');
            return;
        }

        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });

        if (error) {
            showErrorToast('Erro ao redefinir a senha: ' + error.message);
        } else {
            // CORREÇÃO: Usando a notificação de sucesso
            showSuccessToast('Senha redefinida com sucesso! Você já pode fazer o login.');
            window.location.href = '/login.html';
        }
    });
}

// Exporta uma única função que inicializa todas as outras
export function initAuth() {
    initSignUpForm();
    initLoginForm();
    initForgotPasswordForm();
    initResetPasswordForm();
}