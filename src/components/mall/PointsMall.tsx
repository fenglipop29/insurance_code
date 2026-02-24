import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Info, Search, ShieldPlus, ShoppingBasket, Ticket } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { api } from '../../lib/api';
import PointsDetailPage from './PointsDetailPage';
import MyExchanges from '../profile/MyExchanges';

interface Props {
  onClose: () => void;
  requireAuth: (action: () => void) => void;
  balance: number;
  onBalanceChange?: (balance: number) => void;
}

type MallItem = {
  id: number;
  name: string;
  pointsCost: number;
  stock: number;
};

const fallbackMallItems: MallItem[] = [
  { id: 1, name: '智能低糖电饭煲', pointsCost: 99, stock: 50 },
  { id: 2, name: '家庭体检套餐', pointsCost: 79, stock: 80 },
  { id: 3, name: '健康管理咨询券', pointsCost: 59, stock: 999 },
];

type RedeemSuccess = {
  orderNo: string;
  itemName: string;
  pointsCost: number;
  balance: number;
};

const hotActivities = [
  {
    id: 1,
    title: '五常有机新米',
    subtitle: '59积分起兑 | 产地直供',
    badge: '限时抢兑',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDi55AJc1kQ9sTFmD_9uylMmqyEXVHtRK_7X9WtKMFoKU6zlQiXCoRyH4IVUhU5boVqvk_9y9341zXzETrpg362JlbR9XhZYnL_j1gmyeFg-i8znciSvGUbN7kW80kH18UWpRBnYmkmAkzJMO3oJfd47O0Wsd9keBpRsppBBtJZwXQ4TWDdXrKkOSxcOlLUIjtTlUJZzIAsQbfkol6letog8ewMdd-D83SEMeb1we-ZQXhX92t5Mfri9QQJWCYVVoxe4JtKsjW4D9k',
  },
  {
    id: 2,
    title: '全身体检套装',
    subtitle: '专业机构 | 为长辈定制',
    badge: '健康守护',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAIMYHhS78O_mEBHvBoEZqX9ctcS3h-iXCDKZXSgQZfuv6ZCFjmSJIIRTXlHGk2HJ8QhFsHN_cqG74EyVvFqHMHbBxS1XyZorLdggu5yDq0ieLs4mBMSUAbwKQFIl6pOY5CUwC_9FuVZYvlgtHW8eKtONgIEHl2bHtuPZR541duH7oo3FuzneqIruSDUNvCA8xegafztcNumphnYSmIb5MWBU0SGNf85lMCMyY8eRH8LAUyK4aJv4uLX9C6ltLEmOMdLVMBg749N70',
  },
];

const categoryCards = [
  { id: 1, label: '生活百货', icon: ShoppingBasket, iconClass: 'text-sky-500 bg-sky-50' },
  { id: 2, label: '健康服务', icon: ShieldPlus, iconClass: 'text-green-600 bg-green-100' },
  { id: 3, label: '虚拟卡券', icon: Ticket, iconClass: 'text-orange-600 bg-orange-100' },
];

const fallbackProductImages = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBD-QsyUioJEC4HgmRPBdlXUqF-oah87mUz1bo0eYKT0J9t81N9sHvTN2VolLsfAsNOSqHWf34IcjB08aofjOf7ro2gooZqJQjZ7Eo0KkMZgMUnhjGHsyAAzTMOHM3TNIDxhjt8qO32GpBlWHIDtr5fBw7F6OOI4zsC-qYVziSO9kZXKKiXT7wCvmqYH3i8jcpsMbDXTZAni9KRJXZRIb_ab0lxU1MiUkpWIAz0POVouGAFAi53XJrxgjT4-O2etRKSYBUTkNjz3Xs',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDCIZHDuI_vbQ-fRx2qpivaIXGUQfVmiVlj16v3HGZ0pXxnjkkAHW_Khmj2AmCaPwL_FAqwSs6DrUxM1_MXE5l7UZbI1-FlkZ-tLNzhtLzSS2OQ6FhpPHapTuF9L5zb8KUHinIqp8LOq_5ZXS_m0ap8YuEzoCoHHBMqcyLvKLx4z77S2tyTi2V2HNfrViQK41Ri_B0oyceDQwpTD7g0n2B-tP_w2NaBQWjeZWfhP3LduYq4G-u1zAsi4Ig-6vjpJQwlSgp9yInRoVo',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuA5TV9aBhIYqeqr697eDWKu-_6ehDi6ez7anwOZhdiFbYLWvc-i0q7yeDbf6v4hLMphz1uszYwzLtDI3urcQc6PMOSkWuTEK34xlJmHgNlgw_dhizYUf2xtQRRrAMDabTmkD8KOoEHlalq2WqQ5uXnpHy62S-5YVTWX2cdtiiayemfsHeAy8WcEM5FGaVXyBWYEnSGsKoc5RBQ-Li-5UqePtabot5Sk1QHecJsaL2E-nF_qEqnV3sk8QdWNZi2Frz84hssp8FCF3vc',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCbdRnzH0CwTDApiCUg006g_b4JXat9DSNMOEeXaCeZ6iGT8fkfWux15k6SDdOKbQmCtLn_VuXGHnkwRuP3eEnWNKwdrmWUWvNxHuok7ZUnY2sOPuksOOj0_4-Vu6kU3RCj0D0pi9et2zU7SZsu8RvhTHXLTKmWxD3HTMI1KEpgTtLo5Y0qItVVFMJq1eBRvbEK4RRFnI4JhpbV-3fwjePFGI0De3qOwESnkNFz45gBiOFBDgcVmyZIeKboLtCofyKE-7J-ClMetg0',
];

export default function PointsMall({ onClose, requireAuth, balance, onBalanceChange }: Props) {
  const [items, setItems] = useState<MallItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPointsDetail, setShowPointsDetail] = useState(false);
  const [showMyExchanges, setShowMyExchanges] = useState(false);
  const [redeemingItemId, setRedeemingItemId] = useState<number | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState<RedeemSuccess | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const mall = await api.mallItems();
      setItems(mall.items || []);

      try {
        const summary = await api.pointsSummary();
        onBalanceChange?.(summary.balance);
      } catch (e: any) {
        // Mall should be browsable without login; points summary is best-effort.
        if (e?.code !== 'UNAUTHORIZED') {
          throw e;
        }
      }
    } catch (e: any) {
      // Keep page usable when backend is temporarily unavailable.
      setItems(fallbackMallItems);
      setError('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const products = useMemo(
    () =>
      items.map((item, idx) => ({
        ...item,
        image: fallbackProductImages[idx % fallbackProductImages.length],
        redeemedText: idx === 0 ? '1.2w 人已兑换' : idx === 1 ? '856 人已兑换' : idx === 2 ? '3k+ 人已兑换' : '420 人已兑换',
      })),
    [items]
  );

  const handleRedeem = async (itemId: number) => {
    if (redeemingItemId) return;
    try {
      setRedeemingItemId(itemId);
      const res = await api.redeem(itemId);
      onBalanceChange?.(res.balance);
      await loadData();
      setRedeemSuccess({
        orderNo: res.redemption?.orderNo || `EX${res.redemption?.id || ''}`,
        itemName: res.redemption?.itemName || '兑换商品',
        pointsCost: res.redemption?.pointsCost || 0,
        balance: res.balance,
      });
    } catch (e: any) {
      if (e?.code === 'NEED_BASIC_VERIFY' || e?.code === 'UNAUTHORIZED') {
        requireAuth(() => {
          handleRedeem(itemId).catch(() => undefined);
        });
        return;
      }
      alert(e?.message || '兑换失败');
    } finally {
      setRedeemingItemId(null);
    }
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-50 bg-[#f6f7f8] flex flex-col"
    >
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-4 flex items-center justify-between">
        <button onClick={onClose} className="text-[#13a4ec] p-1">
          <ChevronLeft size={28} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">积分商城</h1>
        <button className="text-slate-500 p-1">
          <Search size={24} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <div className="p-4">
          <div className="bg-[#13a4ec] rounded-xl p-6 shadow-lg shadow-sky-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
            <div className="flex justify-between items-start relative z-10">
              <div>
                <p className="text-white/80 text-lg font-medium">我的可用积分</p>
                <h2 className="text-white text-5xl font-bold mt-2">{balance.toLocaleString()}</h2>
              </div>
              <button
                onClick={() => requireAuth(() => setShowPointsDetail(true))}
                className="bg-white/20 backdrop-blur-md border border-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-1"
              >
                <span className="text-base font-bold">积分明细</span>
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="mt-6 flex items-center gap-2 text-white/90 text-sm bg-black/10 w-fit px-3 py-1 rounded-full">
              <Info size={14} />
              <span>350 积分将于 2024-12-31 到期</span>
            </div>
          </div>
        </div>

        <section className="px-4 mb-6">
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
            <span className="w-1 h-5 bg-[#13a4ec] rounded-full" />
            热门活动
          </h3>
          <div className="flex overflow-x-auto gap-4 pb-2 snap-x no-scrollbar">
            {hotActivities.map((activity) => (
              <div key={activity.id} className="min-w-[85%] snap-center relative aspect-[21/9] rounded-xl overflow-hidden shadow-md">
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent z-10" />
                <img className="absolute inset-0 w-full h-full object-cover" src={activity.image} alt={activity.title} />
                <div className="absolute inset-0 z-20 p-5 flex flex-col justify-center">
                  <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded w-fit mb-2">{activity.badge}</span>
                  <h4 className="text-white text-xl font-bold">{activity.title}</h4>
                  <p className="text-white/90 text-sm mt-1">{activity.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="px-4 mb-8 grid grid-cols-3 gap-4">
          {categoryCards.map(({ id, label, icon: Icon, iconClass }) => (
            <div key={id} className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl shadow-sm border border-slate-100">
              <div className={`size-14 rounded-full flex items-center justify-center ${iconClass}`}>
                <Icon size={28} />
              </div>
              <span className="text-base font-bold">{label}</span>
            </div>
          ))}
        </section>

        <section className="px-4 mb-8">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-[#13a4ec] rounded-full" />
            猜你喜欢
          </h3>

          {loading && <p className="text-sm text-slate-500">加载中...</p>}
          {error && <p className="text-sm text-rose-500">{error}</p>}

          <div className="grid grid-cols-2 gap-4">
            {products.map((item) => {
              const disabled = item.stock <= 0 || balance < item.pointsCost || redeemingItemId === item.id;
              return (
                <article key={item.id} className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100">
                  <div className="aspect-square w-full relative">
                    <img className="w-full h-full object-cover" src={item.image} alt={item.name} />
                  </div>
                  <div className="p-3">
                    <h5 className="text-lg font-bold line-clamp-2 leading-tight h-10 mb-2">{item.name}</h5>
                    <div className="flex flex-col gap-1">
                      <p className="text-[#13a4ec] text-xl font-bold">
                        {item.pointsCost} <span className="text-sm">积分</span>
                      </p>
                      <p className="text-slate-500 text-sm">{item.redeemedText}</p>
                      <button
                        onClick={() => handleRedeem(item.id)}
                        disabled={disabled}
                        className="mt-2 w-full rounded-lg py-2 text-sm font-bold text-white bg-[#13a4ec] disabled:bg-sky-200"
                      >
                        {item.stock <= 0 ? '已兑完' : balance < item.pointsCost ? '积分不足' : redeemingItemId === item.id ? '兑换中...' : '立即兑换'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      <AnimatePresence>
        {showPointsDetail && <PointsDetailPage onClose={() => setShowPointsDetail(false)} initialBalance={balance} />}
      </AnimatePresence>

      <AnimatePresence>
        {redeemSuccess && (
          <div className="fixed inset-0 z-[65] bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-2xl p-6"
            >
              <div className="flex items-center gap-2 text-emerald-600 mb-4">
                <CheckCircle2 size={22} />
                <h3 className="text-lg font-bold">兑换成功</h3>
              </div>
              <div className="space-y-2 text-sm mb-6">
                <p className="text-slate-700">商品：{redeemSuccess.itemName}</p>
                <p className="text-slate-700">订单号：{redeemSuccess.orderNo}</p>
                <p className="text-slate-700">消耗积分：-{redeemSuccess.pointsCost}</p>
                <p className="text-slate-700">剩余积分：{redeemSuccess.balance}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setRedeemSuccess(null)}
                  className="py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold"
                >
                  继续逛
                </button>
                <button
                  onClick={() => {
                    setRedeemSuccess(null);
                    setShowMyExchanges(true);
                  }}
                  className="py-2.5 rounded-xl bg-[#13a4ec] text-white font-semibold"
                >
                  查看我的兑换
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMyExchanges && <MyExchanges onClose={() => setShowMyExchanges(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}
