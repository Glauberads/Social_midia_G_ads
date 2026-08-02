'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '../../../lib/apiClient';

export default function ContentDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ title: '', briefing: '', platform: '' });

  useEffect(() => {
    async function load() {
      try {
        const reqData = await apiClient(`/content-requests/${id}`);
        setData(reqData);
        setForm({ title: reqData.title, briefing: reqData.briefing, platform: reqData.platform });
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar detalhes');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient(`/content-requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(form)
      });
      setData(res);
      setEditMode(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar');
    }
  };

  const handleArchive = async () => {
    if (!confirm('Deseja realmente arquivar esta solicitação?')) return;
    try {
      await apiClient(`/content-requests/${id}/archive`, { method: 'POST' });
      router.push('/dashboard/content');
    } catch (err: any) {
      alert(err.message || 'Erro ao arquivar');
    }
  };

  if (loading) return <div className="p-8">Carregando...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;
  if (!data) return <div className="p-8">Não encontrado</div>;

  const canEdit = data.status === 'DRAFT' || data.status === 'REJECTED';

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Detalhes da Solicitação</h1>
        <button onClick={() => router.push('/dashboard/content')} className="text-blue-600 underline">
          Voltar
        </button>
      </div>

      <div className="bg-white p-6 shadow rounded space-y-4">
        {editMode ? (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block font-medium">Título</label>
              <input
                className="w-full border p-2 rounded"
                value={form.title}
                onChange={e => setForm({...form, title: e.target.value})}
              />
            </div>
            <div>
              <label className="block font-medium">Briefing</label>
              <textarea
                className="w-full border p-2 rounded"
                rows={4}
                value={form.briefing}
                onChange={e => setForm({...form, briefing: e.target.value})}
              />
            </div>
            <div>
              <label className="block font-medium">Plataforma</label>
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
            <div className="flex gap-2">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Salvar</button>
              <button type="button" onClick={() => setEditMode(false)} className="bg-gray-200 px-4 py-2 rounded">Cancelar</button>
            </div>
          </form>
        ) : (
          <div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-semibold">{data.title}</h2>
                <p className="text-sm text-gray-500">Status: {data.status} | Plataforma: {data.platform}</p>
              </div>
              <div className="flex gap-2">
                {canEdit && <button onClick={() => setEditMode(true)} className="bg-gray-100 px-3 py-1 rounded">Editar</button>}
                <button onClick={handleArchive} className="bg-red-100 text-red-600 px-3 py-1 rounded">Arquivar</button>
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded whitespace-pre-wrap">
              <strong>Briefing:</strong><br />{data.briefing}
            </div>
            {(data.objective || data.audience || data.tone) && (
              <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                {data.objective && <div><strong>Objetivo:</strong> {data.objective}</div>}
                {data.audience && <div><strong>Público:</strong> {data.audience}</div>}
                {data.tone && <div><strong>Tom:</strong> {data.tone}</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
