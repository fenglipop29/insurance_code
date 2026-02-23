import React, { useEffect, useState } from 'react';
import { ChevronLeft, MoreHorizontal, FileText, ShieldAlert, Gavel, History, Headset, Zap, Shield, HeartPulse, Stethoscope } from 'lucide-react';
import { motion } from 'motion/react';
import { api, type InsurancePolicy } from '../../lib/api';

interface Props {
  policy: InsurancePolicy;
  onClose: () => void;
}

const iconByType: Record<string, any> = {
  stethoscope: Stethoscope,
  'heart-pulse': HeartPulse,
  shield: Shield,
};

export default function PolicyDetail({ policy, onClose }: Props) {
  const [detail, setDetail] = useState<InsurancePolicy>(policy);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api
      .insurancePolicyDetail(policy.id)
      .then((resp) => {
        if (!mounted) return;
        setDetail(resp.policy);
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [policy.id]);

  const Icon = iconByType[detail.icon] || Shield;
  const color = detail.icon === 'stethoscope' ? 'text-blue-500' : detail.icon === 'heart-pulse' ? 'text-red-500' : 'text-orange-500';
  const bg = detail.icon === 'stethoscope' ? 'bg-blue-50' : detail.icon === 'heart-pulse' ? 'bg-red-50' : 'bg-orange-50';

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-50 bg-slate-50 flex flex-col"
    >
      <header className="bg-white sticky top-0 z-10 px-4 py-4 flex items-center justify-between border-b border-slate-100">
        <button onClick={onClose} className="p-2 -ml-2 text-slate-700 active:bg-slate-100 rounded-full">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">保单详情</h1>
        <button className="p-2 -mr-2 text-slate-700 active:bg-slate-100 rounded-full">
          <MoreHorizontal size={24} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {loading && <div className="text-sm text-slate-500">保单详情加载中...</div>}

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-start gap-4">
            <div className={`w-16 h-16 rounded-xl ${bg} flex items-center justify-center ${color}`}>
              <Icon size={32} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 bg-green-50 text-green-600 text-xs font-bold rounded">{detail.status}</span>
                <span className="text-slate-400 text-xs">#{detail.policyNo}</span>
              </div>
              <h2 className="text-xl font-extrabold text-slate-900">{detail.name}</h2>
              <p className="text-slate-500 text-sm mt-1">{detail.company}</p>
            </div>
          </div>
        </div>

        <section>
          <div className="flex items-center gap-2 mb-3 px-1">
            <FileText className="text-blue-500" size={20} />
            <h3 className="text-base font-bold">投保信息</h3>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="grid grid-cols-2 gap-y-4">
              <div>
                <p className="text-slate-400 text-xs mb-1">投保人</p>
                <p className="font-bold">{detail.applicant}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1">被保险人</p>
                <p className="font-bold">{detail.insured}</p>
              </div>
              <div className="col-span-2 border-t border-slate-50 pt-4">
                <p className="text-slate-400 text-xs mb-1">保险期间</p>
                <p className="font-bold">
                  {detail.periodStart} 至 {detail.periodEnd}
                </p>
              </div>
              <div className="border-t border-slate-50 pt-4">
                <p className="text-slate-400 text-xs mb-1">年度保费</p>
                <p className="font-extrabold text-blue-500">¥{Number(detail.annualPremium || 0).toLocaleString('zh-CN')}</p>
              </div>
              <div className="border-t border-slate-50 pt-4">
                <p className="text-slate-400 text-xs mb-1">保障额度</p>
                <p className="font-extrabold text-slate-900">{(detail.amount / 10000).toFixed(2)}万</p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3 px-1">
            <ShieldAlert className="text-blue-500" size={20} />
            <h3 className="text-base font-bold">保障责任</h3>
          </div>
          <div className="space-y-3">
            {(detail.responsibilities || []).map((item, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-4 flex items-center justify-between border border-slate-100 shadow-sm">
                <div>
                  <p className="font-bold text-sm">{item.name}</p>
                  <p className="text-slate-500 text-xs mt-1">{item.desc}</p>
                </div>
                <div className="text-right">
                  <p className="font-extrabold text-base">{(item.limit / 10000).toFixed(2)}万</p>
                  <p className="text-[10px] text-slate-400 uppercase">Limit</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Gavel className="text-blue-500" size={24} />
              <div>
                <p className="font-bold text-slate-900 text-sm">免责条款与投保告知</p>
                <p className="text-slate-500 text-xs mt-0.5">请务必阅读，了解不予赔付的情形</p>
              </div>
            </div>
            <ChevronLeft className="text-slate-400 rotate-180" size={20} />
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3 px-1">
            <History className="text-blue-500" size={20} />
            <h3 className="text-base font-bold">缴费记录</h3>
          </div>
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">缴费日期</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">金额</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(detail.paymentHistory || []).map((pay, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3">
                      <p className="font-bold text-sm">{pay.date}</p>
                      <p className="text-[10px] text-slate-400">{pay.note}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-bold text-sm">¥{Number(pay.amount || 0).toLocaleString('zh-CN')}</p>
                      <p className="text-[10px] text-green-500">{pay.status}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 pb-safe shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] flex gap-3">
        <button className="flex-1 h-12 rounded-xl border-2 border-blue-500 text-blue-500 font-bold text-sm flex items-center justify-center gap-2 active:bg-blue-50 transition-colors">
          <Headset size={18} />
          联系顾问
        </button>
        <button className="flex-[1.5] h-12 rounded-xl bg-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 active:scale-95 transition-transform">
          <Zap size={18} />
          在线理赔
        </button>
      </div>
    </motion.div>
  );
}
