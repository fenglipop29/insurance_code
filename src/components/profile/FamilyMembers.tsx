import React, { useMemo, useState } from 'react';
import { ChevronLeft, PlusCircle, ChevronRight, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import FamilyMemberDetail from './FamilyMemberDetail';
import type { InsurancePolicy } from '../../lib/api';

interface Member {
  id: number;
  name: string;
  avatar: string;
  score: number;
  coveredTypes: string[];
}

interface Props {
  onClose: () => void;
  members: Member[];
  policies: InsurancePolicy[];
}

export default function FamilyMembers({ onClose, members, policies }: Props) {
  const [selected, setSelected] = useState<Member | null>(null);

  const memberPolicyMap = useMemo(() => {
    const m = new Map<number, InsurancePolicy[]>();
    members.forEach((mem) => {
      const nameKey = mem.name.replace(/\*/g, '').slice(0, 1);
      const matched = policies.filter((p) => p.insured.includes(nameKey) || p.applicant.includes(nameKey));
      m.set(mem.id, matched);
    });
    return m;
  }, [members, policies]);

  return (
    <>
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
          <h1 className="text-lg font-bold">家庭成员管理</h1>
          <div className="w-10" />
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-24">
          <button className="w-full mb-5 rounded-2xl bg-sky-500 text-white py-3.5 font-bold inline-flex items-center justify-center gap-2 shadow-md shadow-sky-200">
            <PlusCircle size={18} />
            添加家庭成员
          </button>

          <div className="space-y-3">
            {members.map((member) => {
              const count = (memberPolicyMap.get(member.id) || []).length;
              return (
                <button
                  key={member.id}
                  onClick={() => setSelected(member)}
                  className="w-full text-left bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-3 active:scale-[0.99] transition-transform"
                >
                  <img src={member.avatar} alt={member.name} className="size-14 rounded-full object-cover border border-slate-100" referrerPolicy="no-referrer" />
                  <div className="flex-1">
                    <p className="text-sm font-bold">{member.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{count} 份有效保单</p>
                  </div>
                  <ChevronRight size={18} className="text-slate-300" />
                </button>
              );
            })}

            {members.length === 0 && <p className="text-sm text-slate-500">暂无家庭成员</p>}
          </div>

          <div className="mt-5 p-4 rounded-2xl bg-sky-50 border border-sky-100 flex items-start gap-2">
            <Lightbulb size={18} className="text-sky-600 mt-0.5" />
            <p className="text-xs text-slate-600">将父母加入家庭保障计划后，可统一查看保障缺口并接收续保提醒。</p>
          </div>
        </main>
      </motion.div>

      <AnimatePresence>
        {selected && (
          <FamilyMemberDetail
            member={selected}
            policies={(memberPolicyMap.get(selected.id) || []).map((p) => ({
              id: p.id,
              name: p.name,
              company: p.company,
              amount: p.amount,
              nextPayment: p.nextPayment,
              status: p.status,
            }))}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
