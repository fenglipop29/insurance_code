import React from 'react';
import { UserCircle, Bell } from 'lucide-react';

type Props = {
  customerName?: string | null;
};

export default function Header({ customerName }: Props) {
  const hour = new Date().getHours();
  let greeting = '你好';
  if (hour < 12) greeting = '早上好';
  else if (hour < 18) greeting = '下午好';
  else greeting = '晚上好';
  const displayName = String(customerName || '').trim() || '您';

  return (
    <header className="px-4 pt-6 pb-2 flex justify-between items-center bg-white sticky top-0 z-10 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-500">
          <UserCircle size={32} />
        </div>
        <div>
          <h1 className="text-xl font-bold">{displayName}，{greeting}！</h1>
          <p className="text-slate-500 text-sm">今天也要记得领鸡蛋哦</p>
        </div>
      </div>
      <button className="relative w-10 h-10 flex items-center justify-center rounded-full bg-slate-100">
        <Bell size={20} className="text-slate-700" />
        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
      </button>
    </header>
  );
}
