import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ChevronRight, CalendarDays, ShoppingBag, PlayCircle, ShieldCheck, Coins } from 'lucide-react';
import { api, type PointDetailItem, type PointDetailGroup } from '../../lib/api';

interface Props {
  onClose: () => void;
  initialBalance?: number;
}

function iconByItem(item: PointDetailItem) {
  if (item.source.includes('sign')) {
    return { Icon: CalendarDays, tone: 'bg-emerald-100 text-emerald-600' };
  }
  if (item.source.includes('redeem')) {
    return { Icon: ShoppingBag, tone: 'bg-sky-100 text-sky-600' };
  }
  if (item.source.includes('course')) {
    return { Icon: PlayCircle, tone: 'bg-orange-100 text-orange-600' };
  }
  if (item.source.includes('activity')) {
    return { Icon: ShieldCheck, tone: 'bg-green-100 text-green-600' };
  }
  return { Icon: Coins, tone: 'bg-slate-100 text-slate-600' };
}

function formatTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

export default function PointsDetailPage({ onClose, initialBalance = 0 }: Props) {
  const [balance, setBalance] = useState(initialBalance);
  const [groups, setGroups] = useState<PointDetailGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .pointsDetail()
      .then((res) => {
        const nextGroups = res.groups || [];
        setGroups(nextGroups);
        setBalance(resolveBestBalance(res.balance, flattenGroupItems(nextGroups), initialBalance));
      })
      .catch(async (e: any) => {
        // Backward compatible fallback: if new endpoint is unavailable,
        // build the same page data from existing summary + transactions APIs.
        try {
          const [summary, tx] = await Promise.all([api.pointsSummary(), api.pointsTransactions()]);
          const nextGroups = buildGroupsFromLegacy((tx.list || []) as any[]);
          setGroups(nextGroups);
          setBalance(resolveBestBalance(summary.balance, flattenGroupItems(nextGroups), initialBalance));
          setError('');
        } catch (fallbackErr: any) {
          setError(fallbackErr?.message || e?.message || '加载失败');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 220 }}
      className="fixed inset-0 z-[70] bg-[#f6f7f8] flex flex-col"
    >
      <header className="h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between">
        <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-800">
          <ArrowLeft size={26} />
        </button>
        <h1 className="text-lg font-bold tracking-tight text-slate-900">积分明细</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 overflow-y-auto pb-10">
        <section className="p-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="size-14 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center">
                <Coins size={28} />
              </div>
              <div>
                <p className="text-sm text-slate-500">当前总积分</p>
                <p className="text-4xl font-extrabold text-slate-900 leading-tight">
                  {balance}
                  <span className="text-lg ml-2">积分</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="mt-5 w-full rounded-3xl bg-[#13a4ec] text-white text-base font-bold py-3.5 flex items-center justify-center gap-2"
            >
              去使用
              <ChevronRight size={20} />
            </button>
          </div>
        </section>

        <section className="px-4 mb-6">
          <div className="h-40 rounded-3xl bg-gradient-to-r from-[#13a4ec] to-blue-600 px-6 flex items-center relative overflow-hidden">
            <div className="z-10">
              <h2 className="text-white text-2xl font-bold">积分换好礼</h2>
              <p className="text-white/85 text-sm mt-2">更多优惠等你来兑换</p>
            </div>
            <div className="absolute right-0 top-0 w-64 h-full bg-white/10 rounded-full blur-xl" />
          </div>
        </section>

        {loading && <p className="px-6 text-slate-500">加载中...</p>}
        {!loading && error && <p className="px-6 text-rose-500">{error}</p>}
        {!loading && !error && groups.length === 0 && <p className="px-6 text-slate-500">暂无积分记录</p>}

        {!loading && !error && groups.length > 0 && (
          <section className="bg-white rounded-t-3xl min-h-[40vh]">
            {groups.map((group) => (
              <div key={group.key}>
                <div className="px-4 pt-6 pb-2">
                  <h3 className="text-xl font-bold text-slate-900 border-l-4 border-[#13a4ec] pl-3">{group.label}</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {group.items.map((item) => {
                    const { Icon, tone } = iconByItem(item);
                    const positive = item.direction === 'in';
                    return (
                      <div key={`${group.key}-${item.id}-${item.createdAt}`} className="px-4 py-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`size-11 rounded-xl flex items-center justify-center ${tone}`}>
                            <Icon size={20} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-lg font-bold text-slate-900 truncate">{item.title}</p>
                            <p className="text-sm text-slate-500">{formatTime(item.createdAt)}</p>
                          </div>
                        </div>
                        <p className={`text-xl font-bold ${positive ? 'text-emerald-600' : 'text-slate-900'}`}>
                          {positive ? '+' : '-'}{Math.abs(item.amount)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="p-6 text-center text-sm text-slate-400">已显示全部记录</div>
          </section>
        )}
      </main>
    </motion.div>
  );
}

function buildGroupsFromLegacy(rows: any[]): PointDetailGroup[] {
  const normalized: PointDetailItem[] = rows
    .map((row) => {
      const direction = row.type === 'consume' || row.direction === 'out' ? 'out' : 'in';
      const source = String(row.source || row.sourceType || '');
      return {
        id: Number(row.id) || 0,
        title: row.description || fallbackTitle(source, direction),
        amount: Math.abs(Number(row.amount) || 0),
        balance: Number(row.balance),
        direction,
        source,
        createdAt: row.createdAt || row.created_at || new Date().toISOString(),
      } as PointDetailItem;
    })
    .sort((a, b) => {
      const at = new Date(a.createdAt).getTime();
      const bt = new Date(b.createdAt).getTime();
      if (bt !== at) return bt - at;
      return Number(b.id || 0) - Number(a.id || 0);
    });

  const map = new Map<string, PointDetailGroup>();
  normalized.forEach((item) => {
    const key = monthKey(item.createdAt);
    if (!map.has(key)) {
      map.set(key, { key, label: monthLabel(item.createdAt), items: [] });
    }
    map.get(key)!.items.push(item);
  });
  return [...map.values()];
}

function flattenGroupItems(groups: PointDetailGroup[]) {
  return groups.flatMap((g) => g.items || []);
}

function resolveBestBalance(apiBalance: unknown, items: PointDetailItem[], initialBalance: number) {
  const balanceFromApi = Number(apiBalance);
  if (Number.isFinite(balanceFromApi) && balanceFromApi !== 0) return balanceFromApi;

  const txBalance = Number(items[0]?.balance);
  if (Number.isFinite(txBalance) && txBalance !== 0) return txBalance;

  const fallbackFromRow = Number((items[0] as any)?.amount);
  if (items.length > 0 && items[0].direction === 'in' && Number.isFinite(fallbackFromRow) && balanceFromApi === 0) {
    return Math.max(initialBalance, fallbackFromRow);
  }

  if (Number.isFinite(balanceFromApi)) return balanceFromApi;
  return initialBalance;
}

function fallbackTitle(source: string, direction: 'in' | 'out') {
  if (source.includes('daily_sign_in') || source.includes('sign')) return '每日签到奖励';
  if (source.includes('redeem')) return '商品兑换消耗';
  if (source.includes('course')) return '观看视频奖励';
  if (source.includes('activity')) return '完善保障资料';
  return direction === 'in' ? '积分收入' : '积分支出';
}

function monthKey(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'older';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '更早';
  const now = new Date();
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return '本月';
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  if (d.getFullYear() === prev.getFullYear() && d.getMonth() === prev.getMonth()) return '上个月';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
