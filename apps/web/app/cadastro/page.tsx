'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function CadastroPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('Processando...');
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) {
      setMsg(`Erro: ${error.message}`);
    } else {
      setMsg('Cadastro realizado com sucesso! Pode ir para o /login');
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Cadastro</h1>
      <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', width: '300px', gap: '1rem' }}>
        <input 
          type="email" 
          placeholder="E-mail" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          required 
        />
        <input 
          type="password" 
          placeholder="Senha" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required 
        />
        <button type="submit">Cadastrar</button>
      </form>
      {msg && <p>{msg}</p>}
      <a href="/login">Ir para Login</a>
    </div>
  );
}
