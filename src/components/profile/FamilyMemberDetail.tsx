import React from 'react';
import { ChevronLeft, Shield, PlusCircle, Edit3 } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  onClose: () => void;
  member: {
    id: number;
    name: string;
    avatar: string;
    score: number;
    coveredTypes: string[];
  };
  policies: Array<{
    id: number;
    name: string;
    company: string;
    amount: number;
    nextPayment: string;
    status: string;
  }>;
}

export default function FamilyMemberDetail({ onClose, member, policies }: Props) {
  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-50 bg-slate-50 flex flex-col"
    >
      <header className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-4 flex items-center justify-between">
        <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-slate-100">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">家庭成员详情</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-28 space-y-4">
        <section className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm text-center">
          <img src={member.avatar} alt={member.name} className="size-20 rounded-full mx-auto object-cover border-4 border-sky-50" referrerPolicy="no-referrer" />
          <h2 className="mt-3 text-xl font-bold">{member.name}</h2>
          <p className="text-xs text-slate-500 mt-1">覆盖类型：{member.coveredTypes.join(' / ') || '暂无'}</p>
          <div className="mt-4 bg-sky-50 rounded-xl p-3">
            <p className="text-xs text-slate-500">综合保障得分</p>
            <p className="text-3xl font-bold text-sky-600">{member.score}</p>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-bold text-slate-900">已办保单</h3>
          {policies.map((p) => (
            <article key={p.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold">{p.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{p.company}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-600">{p.status}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-slate-400">保障额度</p>
                  <p className="font-bold text-slate-900">¥{(p.amount / 10000).toFixed(2)}万</p>
                </div>
                <div>
                  <p className="text-slate-400">下次缴费</p>
                  <p className="font-bold text-sky-600">{p.nextPayment}</p>
                </div>
              </div>
            </article>
          ))}

          {policies.length === 0 && <p className="text-sm text-slate-500">暂无保单数据</p>}
        </section>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4 pb-safe grid grid-cols-2 gap-3">
        <button className="py-3 rounded-xl border border-sky-500 text-sky-600 text-sm font-bold inline-flex items-center justify-center gap-2">
          <Edit3 size={16} />
          修改信息
        </button>
        <button className="py-3 rounded-xl bg-sky-500 text-white text-sm font-bold inline-flex items-center justify-center gap-2">
          <PlusCircle size={16} />
          添加保单
        </button>
      </div>
    </motion.div>
  );
}
