'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '../../../lib/apiClient';

export default function NewContentRequestPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: '',
    briefing: '',
    objective: '',
    audience: '',
    tone: '',
    platform: 'INSTAGRAM_FEED',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await apiClient('/content-requests', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      router.push('/dashboard/content');
    } catch (err: any) {
      setError(err.message || 'Erro ao criar solicitação');
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Nova Solicitação de Conteúdo</h1>
      {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 shadow rounded">
        <div>
          <label className="block font-medium mb-1">Título</label>
          <input
            type="text"
            required
            className="w-full border p-2 rounded"
            value={form.title}
            onChange={e => setForm({...form, title: e.target.value})}
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Briefing</label>
          <textarea
            required
            rows={4}
            className="w-full border p-2 rounded"
            value={form.briefing}
            onChange={e => setForm({...form, briefing: e.target.value})}
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Objetivo (Opcional)</label>
          <input
            type="text"
            className="w-full border p-2 rounded"
            value={form.objective}
            onChange={e => setForm({...form, objective: e.target.value})}
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Público Alvo (Opcional)</label>
          <input
            type="text"
            className="w-full border p-2 rounded"
            value={form.audience}
            onChange={e => setForm({...form, audience: e.target.value})}
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Tom de Voz (Opcional)</label>
          <input
            type="text"
            className="w-full border p-2 rounded"
            value={form.tone}
            onChange={e => setForm({...form, tone: e.target.value})}
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Plataforma</label>
          <select
            className="w-full border p-2 rounded"
            value={form.platform}
            onChange={e => setForm({...form, platform: e.target.value})}
          >
            <option value="INSTAGRAM_FEED">Instagram Feed</option>
            <option value="INSTAGRAM_STORY">Instagram Story</option>
            <option value="INSTAGRAM_REEL">Instagram Reel</option>
          </select>
        </div>

        <div className="flex gap-4 pt-4">
          <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded">
            {loading ? 'Salvando...' : 'Criar Solicitação'}
          </button>
          <button type="button" onClick={() => router.back()} className="bg-gray-200 px-4 py-2 rounded">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
