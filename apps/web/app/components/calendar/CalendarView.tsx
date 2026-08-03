'use client';

import React, { useEffect, useState } from 'react';

interface ContentSchedule {
  id: string;
  tenantId: string;
  contentRequestId: string;
  status: string;
  scheduledFor: string;
  timezone: string;
}

export default function CalendarView() {
  const [schedules, setSchedules] = useState<ContentSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Default to current month
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  useEffect(() => {
    async function fetchCalendar() {
      try {
        setLoading(true);
        const res = await fetch(`/api/calendar?startDate=${startOfMonth.toISOString()}&endDate=${endOfMonth.toISOString()}`);
        if (!res.ok) {
          throw new Error('Falha ao carregar calendário');
        }
        const data = await res.json();
        setSchedules(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchCalendar();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-gray-400 animate-pulse">Carregando calendário...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-6">
      <h2 className="text-xl font-bold text-white mb-6">Calendário Editorial</h2>
      
      {schedules.length === 0 ? (
        <div className="text-gray-400 py-10 text-center">Nenhum conteúdo agendado neste mês.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {schedules.map((schedule) => (
            <div key={schedule.id} className="bg-[#252525] p-4 rounded-lg border border-[#333]">
              <div className="text-sm text-gray-400 mb-2">
                {new Date(schedule.scheduledFor).toLocaleString()} ({schedule.timezone})
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  schedule.status === 'SCHEDULED' ? 'bg-blue-500/20 text-blue-400' : 
                  schedule.status === 'DUE' ? 'bg-green-500/20 text-green-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {schedule.status}
                </span>
                <a href={`/dashboard/content/${schedule.contentRequestId}`} className="text-sm text-[#00E5FF] hover:underline">
                  Ver Conteúdo &rarr;
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
