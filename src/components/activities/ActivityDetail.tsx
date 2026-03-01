import React, { useEffect } from 'react';
import { ChevronLeft, Share2, Star, HelpCircle, Gift, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { trackCEvent } from '../../lib/track';
import { api } from '../../lib/api';

interface Props {
  activity: any;
  onClose: () => void;
  requireAuth: (action: () => void) => void;
  onCompleted?: (nextBalance: number) => void;
}

export default function ActivityDetail({ activity, onClose, requireAuth, onCompleted }: Props) {
  const rewardPoints = Number(activity?.rewardPoints || 0);
  const participants = Number(activity?.participants || 0);
  const statusLabel = String(activity?.status || '进行中');
  const description = String(activity?.description || activity?.content || '').trim();
  useEffect(() => {
    trackCEvent('c_activity_detail_view', { activityId: Number(activity?.id || 0), category: String(activity?.category || '') });
  }, [activity?.id, activity?.category]);
  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-[10050] bg-slate-50 flex flex-col"
    >
      {/* Top Navigation Bar */}
      <div className="fixed top-0 left-0 right-0 z-[10060] bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="flex items-center h-14 px-4">
          <button onClick={onClose} className="flex items-center justify-center w-10 h-10 -ml-2 text-slate-700 active:bg-slate-100 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h2 className="flex-1 text-center text-lg font-bold tracking-tight">活动详情</h2>
          <button className="w-10 h-10 -mr-2 flex items-center justify-center text-slate-700 active:bg-slate-100 rounded-full transition-colors">
            <Share2 size={24} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-14 pb-24">
        {/* Hero Section */}
        <div className="p-4">
          <div className="aspect-video w-full rounded-2xl overflow-hidden bg-slate-200 relative">
            <img 
              src={activity.image || "https://picsum.photos/seed/family/800/450"} 
              alt={activity.title} 
              className="absolute inset-0 w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
              <span className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">{statusLabel}</span>
            </div>
          </div>
        </div>

        {/* Activity Header */}
        <section className="px-4 py-2">
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600">
              热门活动
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600">
              保险知识
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-600">
              高额奖励
            </span>
          </div>
          <h1 className="text-2xl font-bold leading-tight mb-4">{activity.title}</h1>
          
          {/* Points Requirement Card */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                <Star size={20} className="fill-current" />
              </div>
              <div>
                <p className="text-xs text-slate-500">报名所需积分</p>
                <p className="text-lg font-bold text-blue-500">{rewardPoints} <span className="text-sm font-medium">积分</span></p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">当前剩余名额</p>
              <p className="text-sm font-bold text-slate-900">{participants || 0} 位</p>
            </div>
          </div>
        </section>

        <div className="h-2 bg-slate-100 my-4"></div>

        {/* Activity Description */}
        <section className="px-4 py-2 space-y-6">
          <div>
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <span className="w-1.5 h-5 bg-blue-500 rounded-full"></span>
              活动简介
            </h3>
            <div className="text-slate-600 leading-relaxed space-y-4 text-sm">
              <p>{description || `欢迎来到“${activity.title}”！这是为你准备的专属活动内容。`}</p>
              <p>
                我们将带您模拟不同的家庭场景，学习如何评估风险、选择最适合家人的保障方案。无论您是理财达人还是保险小白，都能在这里收获实用的保障干货，为家庭构筑坚实的防护墙。
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                <HelpCircle size={18} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 mb-1">趣味答题</h4>
                <p className="text-xs text-slate-500 leading-relaxed">完成每日保险知识闯关，解锁高级保险技能点。</p>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 shrink-0">
                <Gift size={18} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 mb-1">丰厚奖励</h4>
                <p className="text-xs text-slate-500 leading-relaxed">通过挑战即可赢取高达 500 积分奖励及电子荣誉证书。</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <span className="w-1.5 h-5 bg-blue-500 rounded-full"></span>
              活动规则
            </h3>
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0 mt-0.5">1</span>
                <span className="leading-relaxed">活动有效期：2024年1月1日至2024年12月31日。</span>
              </li>
              <li className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0 mt-0.5">2</span>
                <span className="leading-relaxed">报名成功后，需在7个工作日内开启首项任务，否则名额将自动失效。</span>
              </li>
              <li className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0 mt-0.5">3</span>
                <span className="leading-relaxed">每个账号仅限参与一次，积分奖励将在挑战完成后即时到账。</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Footer Decoration */}
        <div className="px-4 py-8 text-center opacity-40">
          <p className="text-xs font-medium tracking-widest">—— 保险让生活更美好 ——</p>
        </div>
      </main>

      {/* Fixed Bottom Action Button */}
      <div className="fixed bottom-0 left-0 right-0 z-[10060] bg-white border-t border-slate-100 p-4 pb-safe shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
        <div className="flex gap-4 items-center">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-medium">合计</span>
            <span className="text-xl font-bold text-blue-500">{rewardPoints} <span className="text-[10px]">积分</span></span>
          </div>
          <button 
            onClick={() =>
              requireAuth(async () => {
                try {
                  trackCEvent('c_activity_join_click', { activityId: Number(activity?.id || 0), reward: rewardPoints });
                  const res = await api.completeActivity(Number(activity?.id || 0));
                  onCompleted?.(Number(res.balance || 0));
                  alert(`兑换成功，获得${Number(res.reward || 0)}积分`);
                  onClose();
                } catch (e: any) {
                  alert(e?.message || '兑换失败');
                }
              })
            }
            disabled={Boolean(activity?.completed)}
            className="flex-1 bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <span>{activity?.completed ? '已兑换' : '立即兑换活动'}</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
