import React, { useState, useEffect } from 'react';
import { auth } from '../services/firebase';
import { Button } from '../components/Button';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentDomain, setCurrentDomain] = useState('');
  const navigate = useNavigate();

  // Mude para false para esconder o aviso de configuração de domínio
  const SHOW_DOMAIN_WARNING = true;

  useEffect(() => {
    // Captura o domínio atual para ajudar na configuração do Firebase
    setCurrentDomain(window.location.hostname);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (isLogin) {
        await auth.signInWithEmailAndPassword(email, password);
        navigate('/dashboard');
      } else {
        await auth.createUserWithEmailAndPassword(email, password);
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/unauthorized-domain') {
        setError(`Domínio não autorizado. Adicione "${currentDomain}" no console do Firebase.`);
      } else {
        setError(err.message || 'Erro na autenticação');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Digite seu email para redefinir a senha.');
      return;
    }
    try {
      await auth.sendPasswordResetEmail(email);
      setMessage('Email de redefinição enviado!');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
          {isLogin ? 'Bem-vindo de volta' : 'Criar Conta'}
        </h2>
        
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm font-medium">{error}</div>}
        {message && <div className="bg-green-50 text-green-600 p-3 rounded-lg mb-4 text-sm">{message}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? 'Carregando...' : (isLogin ? 'Entrar' : 'Cadastrar')}
          </Button>
        </form>

        <div className="mt-6 flex flex-col space-y-2 text-center text-sm">
          <button 
            type="button" 
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-600 hover:underline"
          >
            {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já tem conta? Entre'}
          </button>
          
          {isLogin && (
            <button 
              type="button" 
              onClick={handleResetPassword}
              className="text-gray-500 hover:text-gray-700"
            >
              Esqueci minha senha
            </button>
          )}
        </div>
      </div>

      {/* Helper para configuração do Firebase */}
      {SHOW_DOMAIN_WARNING && (
        <div className="mt-8 max-w-md w-full bg-blue-50 border border-blue-200 p-4 rounded-lg text-xs text-blue-800">
          <p className="font-bold mb-2">⚠️ Configuração Necessária:</p>
          <p className="mb-2">Para o login funcionar, adicione este domínio no Firebase Console em <strong>Authentication &gt; Settings &gt; Authorized domains</strong>:</p>
          <code className="block bg-white p-2 rounded border border-blue-200 font-mono text-center select-all">
            {currentDomain}
          </code>
        </div>
      )}
    </div>
  );
};

export default Login;