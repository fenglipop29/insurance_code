import React from 'react';
import { Home, BookOpen, Calendar, ShieldCheck, User } from 'lucide-react';

interface Props {
  currentTab: string;
  onChange: (tabId: string) => void;
}

export default function BottomNav({ currentTab, onChange }: Props) {
  const navItems = [
    { id: 'home', name: '首页', icon: Home },
    { id: 'learning', name: '知识学习', icon: BookOpen },
    { id: 'activities', name: '活动中心', icon: Calendar },
    { id: 'insurance', name: '保障管理', icon: ShieldCheck },
    { id: 'profile', name: '我的', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[9999] bg-white border-t border-slate-200 shadow-[0_-6px_20px_rgba(15,23,42,0.08)] flex items-center justify-around pb-safe pt-2 px-2">
      {navItems.map((item) => {
        const isActive = currentTab === item.id || (currentTab === 'advisor' && item.id === 'home');
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={`flex flex-col items-center gap-1 p-2 ${isActive ? 'text-blue-500' : 'text-slate-500'}`}
          >
            <item.icon size={24} className={isActive ? 'fill-blue-50' : ''} />
            <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{item.name}</span>
          </button>
        );
      })}
    </nav>
  );
}
