'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '../../lib/apiClient';

export default function ContentListPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await apiClient('/content-requests');
        setRequests(data);
      } catch (e: any) {
        setError(e.message || 'Erro ao carregar solicitações');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="p-8">Carregando...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Solicitações de Conteúdo</h1>
        <Link href="/dashboard/content/new" className="bg-blue-600 text-white px-4 py-2 rounded">
          Nova Solicitação
        </Link>
      </div>

      {requests.length === 0 ? (
        <p className="text-gray-500">Nenhuma solicitação encontrada.</p>
      ) : (
        <table className="w-full text-left bg-white shadow rounded">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-4">Título</th>
              <th className="p-4">Plataforma</th>
              <th className="p-4">Status</th>
              <th className="p-4">Data</th>
              <th className="p-4">Ações</th>
            </tr>
          </thead>
          <tbody>
            {requests.map(req => (
              <tr key={req.id} className="border-t">
                <td className="p-4">{req.title}</td>
                <td className="p-4">{req.platform}</td>
                <td className="p-4">
                  <span className="px-2 py-1 text-xs rounded-full bg-gray-200">
                    {req.status}
                  </span>
                </td>
                <td className="p-4">{new Date(req.createdAt).toLocaleDateString()}</td>
                <td className="p-4">
                  <Link href={`/dashboard/content/${req.id}`} className="text-blue-600 underline">
                    Detalhes
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
