import React from 'react';
import CalendarView from '../../components/calendar/CalendarView';

export const metadata = {
  title: 'Calendário Editorial - Glauber Ads',
};

export default function CalendarPage() {
  return (
    <div className="container mx-auto p-4 md:p-8 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Calendário</h1>
          <p className="text-gray-400 mt-2">Visão geral dos conteúdos agendados.</p>
        </div>
      </div>
      
      <CalendarView />
    </div>
  );
}
