import React, { useEffect, useMemo, useState } from 'react';
import { HelpCircle, ShoppingBag, CheckCircle2, Share2, Shield, Users } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import ActivityDetail from '../components/activities/ActivityDetail';
import { api, type Activity } from '../lib/api';

interface Props {
  requireAuth: (action: () => void) => void;
  onOpenMall: () => void;
  pointsBalance: number;
  onBalanceChange: (balance: number) => void;
}

const categoryBadge: Record<string, { label: string; className: string }> = {
  sign: { label: '签到任务', className: 'text-emerald-600 bg-emerald-50' },
  competition: { label: '智力竞赛', className: 'text-blue-500 bg-blue-50' },
  task: { label: '资料完善', className: 'text-orange-500 bg-orange-50' },
  invite: { label: '有奖推荐', className: 'text-green-600 bg-green-50' },
};

function iconByCategory(category: string) {
  if (category === 'sign') return CheckCircle2;
  if (category === 'task') return Shield;
  if (category === 'invite') return Share2;
  return Users;
}

export default function Activities({ requireAuth, onOpenMall, pointsBalance, onBalanceChange }: Props) {
  const [tasksCompleted, setTasksCompleted] = useState(0);
  const [tasksTotal, setTasksTotal] = useState(0);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [activities, setActivities] = useState<Activity[]>([]);

  const loadActivities = async () => {
    try {
      const res = await api.activities();
      setActivities(res.activities || []);
      if (typeof res.balance === 'number' && Number.isFinite(res.balance)) {
        onBalanceChange(res.balance);
      }
      setTasksCompleted(res.taskProgress?.completed || 0);
      setTasksTotal(res.taskProgress?.total || 0);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadActivities().catch(() => undefined);
  }, []);

  const progressPercent = useMemo(() => {
    if (!tasksTotal) return 0;
    return Math.round((tasksCompleted / tasksTotal) * 100);
  }, [tasksCompleted, tasksTotal]);

  const signActivity = activities.find((x) => x.category === 'sign');
  const hotActivities = activities.filter((x) => x.category !== 'sign');

  const completeTask = (activity: Activity) => {
    requireAuth(async () => {
      try {
        if (activity.category === 'sign') {
          const res = await api.signIn();
          onBalanceChange(res.balance);
          alert(`签到成功，获得${res.reward}积分！`);
        } else {
          const res = await api.completeActivity(activity.id);
          onBalanceChange(res.balance);
          alert(`任务完成，获得${res.reward}积分！`);
        }
        await loadActivities();
      } catch (e: any) {
        alert(e?.message || '操作失败');
      }
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen pb-24">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-4 py-4 flex items-center justify-between border-b border-slate-100">
        <div className="w-10"></div>
        <h1 className="text-xl font-bold tracking-tight">活动中心</h1>
        <button className="w-10 h-10 flex items-center justify-center text-slate-700">
          <HelpCircle size={24} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto">
        <section className="p-4">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 p-6 text-white shadow-lg">
            <div className="relative z-10">
              <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-bold uppercase tracking-wider mb-2">限时福利</span>
              <h2 className="text-2xl font-bold leading-tight mb-2">连续签到7天\n领30枚新鲜鸡蛋</h2>
              <p className="text-white/90 text-sm mb-4 font-medium italic">健康生活，好礼相送</p>

              <button
                onClick={() => signActivity && completeTask(signActivity)}
                disabled={Boolean(signActivity?.completed)}
                className="w-full bg-white text-red-500 py-3.5 rounded-xl font-bold text-lg shadow-md active:scale-95 transition-transform disabled:opacity-70"
              >
                {signActivity?.completed ? '今日已签到' : '立即签到领奖'}
              </button>
            </div>
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute top-4 right-4 text-8xl opacity-20 font-serif">🥚</div>
          </div>
        </section>

        <section className="px-4 py-2">
          <div
            onClick={onOpenMall}
            className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 cursor-pointer active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-slate-500 text-sm font-medium mb-1">我的积分</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-blue-500">{pointsBalance}</span>
                  <span className="text-xs text-slate-400 font-bold">分</span>
                </div>
              </div>
              <button
                onClick={onOpenMall}
                className="flex items-center gap-2 bg-blue-500 text-white px-5 py-2.5 rounded-full font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all"
              >
                <ShoppingBag size={18} />
                <span>积分商城</span>
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-bold">今日任务进度</span>
                <span className="text-sm font-bold text-blue-500">{tasksCompleted}/{tasksTotal || 0} 已完成</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {activities
                .filter((a) => a.canComplete)
                .map((a) => {
                  const Icon = iconByCategory(a.category);
                  return (
                    <div key={a.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                          <Icon size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-sm">{a.title}</p>
                          <p className="text-[10px] text-slate-500">+{a.rewardPoints} 积分</p>
                        </div>
                      </div>
                      {a.completed ? (
                        <span className="text-slate-400 text-xs font-medium">已完成</span>
                      ) : (
                        <button
                          onClick={() => completeTask(a)}
                          className="bg-blue-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition-transform"
                        >
                          去完成
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </section>

        <section className="px-4 py-6">
          <h3 className="text-lg font-bold mb-4">热门活动</h3>
          <div className="grid grid-cols-1 gap-4">
            {hotActivities.map((activity) => {
              const badge = categoryBadge[activity.category] || categoryBadge.competition;
              return (
                <div
                  key={activity.id}
                  onClick={() =>
                    setSelectedActivity({
                      title: activity.title,
                      image: `https://picsum.photos/seed/activity${activity.id}/800/450`,
                    })
                  }
                  className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 flex h-32 cursor-pointer active:scale-[0.98] transition-transform"
                >
                  <div className="w-32 bg-slate-800 relative flex items-center justify-center">
                    <img
                      src={`https://picsum.photos/seed/activity${activity.id}/200/200`}
                      alt={activity.title}
                      className="absolute inset-0 w-full h-full object-cover opacity-50"
                      referrerPolicy="no-referrer"
                    />
                    <span className="relative z-10 text-4xl">🎯</span>
                  </div>
                  <div className="flex-1 p-4 flex flex-col justify-between">
                    <div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${badge.className}`}>{badge.label}</span>
                      <h4 className="font-bold text-sm mt-1">{activity.title}</h4>
                      <p className="text-[10px] text-slate-500 mt-1">{activity.participants || 0}人正在参与中</p>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex -space-x-2">
                        <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-200"></div>
                        <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-300"></div>
                        <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-400"></div>
                      </div>
                      <button className="text-blue-500 text-xs font-bold">查看详情 &gt;</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <AnimatePresence>
        {selectedActivity && (
          <ActivityDetail activity={selectedActivity} onClose={() => setSelectedActivity(null)} requireAuth={requireAuth} />
        )}
      </AnimatePresence>
    </div>
  );
}
