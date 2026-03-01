import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Coins, CalendarDays, ShoppingBag, GraduationCap, Gift, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../../lib/api';

interface Props {
  onClose: () => void;
  onOpenMall: () => void;
}

type Row = {
  id: number;
  amount: number;
  type: 'earn' | 'consume';
  source?: string;
  description?: string;
  createdAt?: string;
};

function monthLabel(dateText: string) {
  if (!dateText) return '更早';
  const d = new Date(dateText);
  if (Number.isNaN(d.getTime())) return '更早';
  const now = new Date();
  const isThisMonth = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  if (isThisMonth) return '本月';
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const isPrevMonth = d.getFullYear() === prev.getFullYear() && d.getMonth() === prev.getMonth();
  return isPrevMonth ? '上个月' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function iconBySource(source = '', type: 'earn' | 'consume') {
  if (source.includes('sign')) return CalendarDays;
  if (source.includes('redeem')) return ShoppingBag;
  if (source.includes('course')) return GraduationCap;
  if (source.includes('activity')) return Gift;
  return type === 'earn' ? ArrowUpCircle : ArrowDownCircle;
}

export default function PointsTransactions({ onClose, onOpenMall }: Props) {
  const [balance, setBalance] = useState(0);
  const [list, setList] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.pointsSummary(), api.pointsTransactions()])
      .then(([summary, tx]) => {
        setBalance(summary.balance || 0);
        setList((tx.list || []) as Row[]);
      })
      .finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => {
    const m = new Map<string, Row[]>();
    list.forEach((row) => {
      const key = monthLabel(row.createdAt || '');
      const old = m.get(key) || [];
      old.push(row);
      m.set(key, old);
    });
    return [...m.entries()];
  }, [list]);

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-50 bg-slate-50 flex flex-col"
    >
      <header className="bg-white sticky top-0 z-10 border-b border-slate-100 px-4 py-4 flex items-center justify-between">
        <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-slate-100">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">积分明细</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        <section className="p-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-full bg-sky-50 text-sky-500 flex items-center justify-center">
                <Coins size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500">当前总积分</p>
                <p className="text-3xl font-bold text-slate-900">{balance}</p>
              </div>
            </div>
            <button onClick={onOpenMall} className="px-4 py-2 rounded-xl bg-sky-500 text-white text-sm font-bold">
              去使用
            </button>
          </div>
        </section>

        {loading && <p className="px-4 text-sm text-slate-500">加载中...</p>}

        {!loading && groups.length === 0 && <p className="px-4 text-sm text-slate-500">暂无积分记录</p>}

        {groups.map(([month, rows]) => (
          <section key={month} className="px-4 pb-6">
            <h3 className="text-sm font-bold text-slate-900 mb-3">{month}</h3>
            <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100">
              {rows.map((row) => {
                const Icon = iconBySource(row.source, row.type);
                const positive = row.type === 'earn';
                return (
                  <div key={row.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`size-10 rounded-lg flex items-center justify-center ${positive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{row.description || '积分变更'}</p>
                        <p className="text-xs text-slate-500">{(row.createdAt || '').replace('T', ' ').slice(0, 16)}</p>
                      </div>
                    </div>
                    <p className={`text-base font-bold ${positive ? 'text-emerald-600' : 'text-slate-700'}`}>
                      {positive ? '+' : '-'}{Math.abs(Number(row.amount || 0))}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>
    </motion.div>
  );
}
