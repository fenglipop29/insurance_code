import React from 'react';
import { Headset } from 'lucide-react';

interface Props {
  onOpen: () => void;
}

export default function AdvisorCard({ onOpen }: Props) {
  return (
    <button
      onClick={onOpen}
      className="w-full bg-white rounded-2xl p-4 shadow-sm border border-blue-50 flex items-center justify-between text-left active:scale-[0.99] transition-transform"
    >
      <div className="flex items-center gap-4">
        <img
          src="https://picsum.photos/seed/advisor/100/100"
          alt="Advisor"
          className="w-14 h-14 rounded-full border-2 border-blue-100 object-cover"
          referrerPolicy="no-referrer"
        />
        <div>
          <h3 className="font-bold text-lg">您的专属顾问：小王</h3>
          <p className="text-sm text-slate-500 mt-0.5">已为您服务 324 天</p>
        </div>
      </div>
      <span className="bg-blue-500 text-white px-4 py-2.5 rounded-full text-sm font-bold flex items-center gap-1.5 shadow-md shadow-blue-200">
        <Headset size={18} />
        联系顾问
      </span>
    </button>
  );
}
