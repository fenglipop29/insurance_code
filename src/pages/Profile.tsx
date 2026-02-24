import React, { useEffect, useMemo, useState } from 'react';
import { Settings, Camera, ShieldCheck, Edit3, Coins, ShoppingBag, ChevronRight, BookOpen, Heart, Users, FileText, Calendar, Phone } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import MyExchanges from '../components/profile/MyExchanges';
import StudyRecords from '../components/profile/StudyRecords';
import MyFavorites from '../components/profile/MyFavorites';
import FamilyMembers from '../components/profile/FamilyMembers';
import CourseDetail from '../components/learning/CourseDetail';
import PointsDetailPage from '../components/mall/PointsDetailPage';
import { User, api, LearningCourse, InsurancePolicy } from '../lib/api';

const POLICY_COUNT_CACHE_KEY = 'insurance_profile_policy_count';

function readCachedPolicyCount() {
  const raw = localStorage.getItem(POLICY_COUNT_CACHE_KEY);
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

interface Props {
  requireAuth: (action: () => void) => void;
  isAuthenticated: boolean;
  user: User | null;
  pointsBalance: number;
  onOpenMall: () => void;
  onGoInsurance: () => void;
}

export default function Profile({ requireAuth, isAuthenticated, user, pointsBalance, onOpenMall, onGoInsurance }: Props) {
  const [showMyExchanges, setShowMyExchanges] = useState(false);
  const [showPointsDetail, setShowPointsDetail] = useState(false);
  const [showStudyRecords, setShowStudyRecords] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showFamilyMembers, setShowFamilyMembers] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<LearningCourse | null>(null);
  const [latestPendingExchange, setLatestPendingExchange] = useState<any>(null);
  const [familyCount, setFamilyCount] = useState(0);
  const [policyCount, setPolicyCount] = useState(() => readCachedPolicyCount());
  const [todayTaskDone, setTodayTaskDone] = useState(0);
  const [courses, setCourses] = useState<LearningCourse[]>([]);
  const [familyMembers, setFamilyMembers] = useState<Array<{ id: number; name: string; avatar: string; score: number; coveredTypes: string[] }>>([]);
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      setLatestPendingExchange(null);
      setTodayTaskDone(0);
    }

    Promise.allSettled([
      api.redemptions(),
      api.activities(),
      api.learningCourses(),
    ]).then((all) => {
      const [r1, r4, r5] = all;

      if (r1.status === 'fulfilled') {
        const pending = r1.value.list
          .filter((x: any) => x.status !== 'written_off' && new Date(x.expiresAt).getTime() >= Date.now())
          .sort((a: any, b: any) => b.id - a.id)[0];
        setLatestPendingExchange(pending || null);
      }

      if (r4.status === 'fulfilled') {
        setTodayTaskDone(r4.value.taskProgress?.completed || 0);
      }

      if (r5.status === 'fulfilled') {
        setCourses(r5.value.courses || []);
      }
    });
  }, [isAuthenticated]);

  useEffect(() => {
    Promise.allSettled([api.insuranceOverview(), api.insurancePolicies()]).then((all) => {
      const [rOverview, rPolicies] = all;
      let nextPolicyCount: number | null = null;
      if (rOverview.status === 'fulfilled') {
        const members = rOverview.value.familyMembers || [];
        setFamilyMembers(members);
        setFamilyCount(members.length);
        const activePolicies = Number(rOverview.value.summary?.activePolicies ?? 0);
        if (Number.isFinite(activePolicies)) nextPolicyCount = activePolicies;
      }
      if (rPolicies.status === 'fulfilled') {
        const list = rPolicies.value.policies || [];
        setPolicies(list);
        nextPolicyCount = Math.max(nextPolicyCount ?? 0, list.length);
      }
      if (nextPolicyCount !== null) {
        // Keep count stable within a session: avoid late async empty responses overriding valid data.
        setPolicyCount((prev) => Math.max(prev, nextPolicyCount));
      }
    });
  }, [isAuthenticated]);

  useEffect(() => {
    localStorage.setItem(POLICY_COUNT_CACHE_KEY, String(policyCount));
  }, [policyCount]);

  const exchangeDate = useMemo(() => {
    if (!latestPendingExchange?.createdAt) return '';
    return String(latestPendingExchange.createdAt).slice(0, 10);
  }, [latestPendingExchange]);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen pb-24">
      <header className="bg-white px-6 pt-10 pb-8 rounded-b-3xl shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold tracking-tight">个人中心</h1>
          <button className="p-2 rounded-full bg-slate-100 text-slate-600 active:bg-slate-200 transition-colors">
            <Settings size={24} />
          </button>
        </div>

        <div className="flex items-center gap-5">
          <div className="relative">
            <img
              src="https://picsum.photos/seed/avatar/200/200"
              alt="User Profile"
              className="w-24 h-24 rounded-full border-4 border-blue-50 object-cover shadow-md"
              referrerPolicy="no-referrer"
            />
            <button className="absolute bottom-0 right-0 bg-blue-500 p-2 rounded-full border-2 border-white shadow-sm text-white active:scale-95 transition-transform">
              <Camera size={14} />
            </button>
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2">{user?.name || '微信昵称'}</h2>
            {!isAuthenticated ? (
              <button
                onClick={() => requireAuth(() => {})}
                className="flex items-center gap-1 px-4 py-2 bg-rose-500 text-white rounded-xl text-sm font-bold shadow-md mb-2 active:scale-95 transition-transform"
              >
                <ShieldCheck size={18} />
                去实名
                <ChevronRight size={16} />
              </button>
            ) : (
              <div className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-600 rounded-lg text-xs font-bold mb-2 w-fit">
                <ShieldCheck size={14} />
                已实名
              </div>
            )}
            <button className="flex items-center gap-1 px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-bold border border-blue-100 active:bg-blue-100 transition-colors">
              <Edit3 size={14} />
              编辑资料
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <section className="px-4 mt-6">
          <div
            onClick={onOpenMall}
            className="bg-white p-5 rounded-2xl shadow-sm flex items-center justify-between border border-slate-100 cursor-pointer active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center shrink-0 text-orange-500">
                <Coins size={32} />
              </div>
              <div>
                <p className="text-slate-500 text-sm mb-0.5 font-medium">我的积分</p>
                <p className="text-3xl font-bold text-slate-900">{pointsBalance}</p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                requireAuth(() => setShowPointsDetail(true));
              }}
              className="bg-gradient-to-r from-orange-400 to-orange-500 text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-orange-200 active:scale-95 transition-transform"
            >
              查看积分
            </button>
          </div>
        </section>

        <section className="px-4 mt-6">
          <div className="bg-white rounded-2xl shadow-sm p-5 border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3
                onClick={() => setShowMyExchanges(true)}
                className="text-lg font-bold flex items-center gap-2 cursor-pointer active:opacity-70"
              >
                <ShoppingBag className="text-blue-500" size={20} />
                我的兑换
              </h3>
              <button onClick={onOpenMall} className="text-blue-500 font-bold flex items-center text-sm active:opacity-70">
                积分商城
                <ChevronRight size={16} />
              </button>
            </div>

            {latestPendingExchange ? (
              <div
                onClick={() => setShowMyExchanges(true)}
                className="bg-blue-50/50 rounded-xl p-4 flex items-center gap-4 border border-blue-100/50 cursor-pointer active:scale-[0.98] transition-transform"
              >
                <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center shrink-0 border border-slate-100 overflow-hidden">
                  <img
                    src={`https://picsum.photos/seed/redeem${latestPendingExchange.id}/200/200`}
                    alt={latestPendingExchange.itemName}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-base leading-tight mb-1">{latestPendingExchange.itemName}</h4>
                  <p className="text-xs text-slate-500">兑换日期: {exchangeDate}</p>
                </div>
                <button className="bg-gradient-to-r from-orange-400 to-orange-500 text-white px-5 py-2.5 rounded-full font-bold text-sm shadow-md shadow-orange-200 pointer-events-none">
                  去核销
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowMyExchanges(true)}
                className="w-full text-left bg-slate-50 rounded-xl p-4 border border-slate-100 text-sm text-slate-500"
              >
                暂无待核销兑换，点击查看历史兑换记录
              </button>
            )}
          </div>
        </section>

        <section className="px-4 mt-6 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
            <button
              onClick={() => setShowStudyRecords(true)}
              className="w-full flex items-center px-5 py-4 border-b border-slate-50 active:bg-slate-50 transition-colors"
            >
              <BookOpen className="text-blue-500 mr-4" size={24} />
              <span className="text-base font-medium flex-1 text-left">学习记录</span>
              <ChevronRight className="text-slate-300" size={20} />
            </button>

            <button
              onClick={() => setShowFavorites(true)}
              className="w-full flex items-center px-5 py-4 border-b border-slate-50 active:bg-slate-50 transition-colors"
            >
              <Heart className="text-rose-500 mr-4" size={24} />
              <span className="text-base font-medium flex-1 text-left">我的收藏</span>
              <ChevronRight className="text-slate-300" size={20} />
            </button>

            <button
              onClick={() => setShowFamilyMembers(true)}
              className="w-full flex items-center px-5 py-4 border-b border-slate-50 active:bg-slate-50 transition-colors"
            >
              <Users className="text-green-500 mr-4" size={24} />
              <div className="flex-1 text-left">
                <span className="text-base font-medium block">家庭成员管理</span>
                <span className="text-[10px] text-slate-400">已添加 {familyCount} 位成员</span>
              </div>
              <ChevronRight className="text-slate-300" size={20} />
            </button>

            <button onClick={onGoInsurance} className="w-full flex items-center px-5 py-4 border-b border-slate-50 active:bg-slate-50 transition-colors">
              <FileText className="text-amber-500 mr-4" size={24} />
              <span className="text-base font-medium flex-1 text-left">我的保单</span>
              <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mr-2">在保 {policyCount}</span>
              <ChevronRight className="text-slate-300" size={20} />
            </button>

            <button className="w-full flex items-center px-5 py-4 border-b border-slate-50 active:bg-slate-50 transition-colors">
              <Calendar className="text-orange-400 mr-4" size={24} />
              <div className="flex-1 text-left">
                <span className="text-base font-medium block">我的活动</span>
                <span className="text-[10px] text-slate-400">今日已完成 {todayTaskDone} 项</span>
              </div>
              <ChevronRight className="text-slate-300" size={20} />
            </button>

            <button className="w-full flex items-center px-5 py-4 active:bg-slate-50 transition-colors">
              <Settings className="text-slate-500 mr-4" size={24} />
              <span className="text-base font-medium flex-1 text-left">设置</span>
              <ChevronRight className="text-slate-300" size={20} />
            </button>
          </div>
        </section>

        <section className="px-4 mt-6 mb-8">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex items-center justify-between">
            <div>
              <h4 className="text-blue-600 font-bold text-lg mb-1">需要帮助吗？</h4>
              <p className="text-slate-500 text-sm">点击拨打 24小时客服热线</p>
            </div>
            <button className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30 active:scale-90 transition-transform">
              <Phone size={24} />
            </button>
          </div>
        </section>
      </main>

      <AnimatePresence>
        {selectedCourse && <CourseDetail course={selectedCourse as any} onBack={() => setSelectedCourse(null)} />}
        {showMyExchanges && <MyExchanges onClose={() => setShowMyExchanges(false)} />}
        {showPointsDetail && <PointsDetailPage onClose={() => setShowPointsDetail(false)} initialBalance={pointsBalance} />}
        {showStudyRecords && (
          <StudyRecords
            onClose={() => setShowStudyRecords(false)}
            courses={courses}
            onOpenCourse={(c) => setSelectedCourse(c)}
          />
        )}
        {showFavorites && (
          <MyFavorites
            onClose={() => setShowFavorites(false)}
            courses={courses}
            onOpenCourse={(c) => setSelectedCourse(c)}
          />
        )}
        {showFamilyMembers && (
          <FamilyMembers
            onClose={() => setShowFamilyMembers(false)}
            members={familyMembers}
            policies={policies}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
