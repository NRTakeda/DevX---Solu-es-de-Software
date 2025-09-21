import { supabase } from '../supabaseClient.js';

function initSignUpForm() {
    const signUpForm = document.getElementById('signup-form');
    if (!signUpForm) return;

    signUpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = signUpForm.querySelector('#full_name').value;
        const username = signUpForm.querySelector('#username').value;
        const email = signUpForm.querySelector('#email').value;
        const password = signUpForm.querySelector('#password').value;
        const passwordConfirm = signUpForm.querySelector('#password-confirm').value;

        if (password !== passwordConfirm) {
            alert('As senhas não coincidem. Por favor, tente novamente.');
            return;
        }
        
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: { data: { full_name: fullName, username: username } }
        });

        if (error) {
            alert('Erro ao criar a conta: ' + error.message);
        } else {
            alert('Conta criada com sucesso! Verifique seu email para confirmar.');
            window.location.href = '/login.html';
        }
    });
}

async function initLoginForm() {
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
            alert('Erro no login: ' + error.message);
        } else if (data.user) {
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', data.user.id)
                .single();

            if (profileError) {
                alert('Erro ao buscar perfil: ' + profileError.message);
            } else {
                alert('Login realizado com sucesso!');
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
            alert('Erro: ' + error.message);
        } else {
            alert('Se este email estiver cadastrado, um link de recuperação foi enviado.');
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
            alert('As senhas não coincidem!');
            return;
        }

        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });

        if (error) {
            alert('Erro ao redefinir a senha: ' + error.message);
        } else {
            alert('Senha redefinida com sucesso! Você já pode fazer o login.');
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