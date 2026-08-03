'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/apiClient';

interface ScheduleModalProps {
  contentRequestId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingSchedule?: any;
}

export function ScheduleModal({ contentRequestId, isOpen, onClose, onSuccess, existingSchedule }: ScheduleModalProps) {
  const [localDateTime, setLocalDateTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-detect timezone or fallback to America/Sao_Paulo
  const [timezone, setTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'America/Sao_Paulo';
    }
  });

  useEffect(() => {
    if (isOpen) {
      setError('');
      if (existingSchedule) {
        // Formata a data UTC para local "YYYY-MM-DDThh:mm"
        const date = new Date(existingSchedule.scheduledFor);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        setLocalDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
        setTimezone(existingSchedule.timezone || timezone);
      } else {
        setLocalDateTime('');
      }
    }
  }, [isOpen, existingSchedule]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // The backend expects an absolute UTC ISO string inside localDateTime
      // We take the input value (which is local time to the user) and convert it
      const dateObj = new Date(localDateTime);
      if (isNaN(dateObj.getTime())) {
        throw new Error('Data ou hora inválida.');
      }
      
      const payload = {
        localDateTime: dateObj.toISOString(),
        timezone
      };

      const method = existingSchedule ? 'PATCH' : 'POST';
      await apiClient(`/content-requests/${contentRequestId}/schedule`, {
        method,
        body: JSON.stringify(payload)
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Falha ao agendar conteúdo.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSchedule = async () => {
    if (!existingSchedule || !window.confirm('Tem certeza que deseja cancelar o agendamento?')) return;
    setLoading(true);
    try {
      await apiClient(`/content-requests/${contentRequestId}/schedule/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Cancelamento manual' })
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Falha ao cancelar agendamento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#1e1e1e] p-6 rounded-xl border border-[#333] max-w-md w-full shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-4">
          {existingSchedule ? 'Reagendar Conteúdo' : 'Agendar Conteúdo'}
        </h2>
        
        {error && (
          <div className="bg-red-500/20 text-red-400 p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Data e Hora (Local)
            </label>
            <input
              type="datetime-local"
              className="w-full bg-[#2a2a2a] border border-[#444] text-white rounded px-3 py-2 outline-none focus:border-blue-500"
              value={localDateTime}
              onChange={(e) => setLocalDateTime(e.target.value)}
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Fuso Horário (Timezone)
            </label>
            <input
              type="text"
              className="w-full bg-[#2a2a2a] border border-[#444] text-white rounded px-3 py-2 outline-none focus:border-blue-500"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              required
              placeholder="America/Sao_Paulo"
            />
            <p className="text-xs text-gray-500 mt-1">Ex: America/Sao_Paulo, America/New_York</p>
          </div>

          <div className="flex justify-end gap-3">
            {existingSchedule && (
              <button
                type="button"
                onClick={handleCancelSchedule}
                disabled={loading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium disabled:opacity-50"
              >
                Cancelar Agendamento
              </button>
            )}
            
            <div className="flex-1"></div>
            
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-400 hover:text-white"
            >
              Voltar
            </button>
            <button
              type="submit"
              disabled={loading || !localDateTime}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
