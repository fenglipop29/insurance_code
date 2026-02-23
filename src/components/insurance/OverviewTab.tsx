import React, { useEffect, useState } from 'react';
import {
  PlusCircle,
  Stethoscope,
  ShieldAlert,
  Car,
  Baby,
  GraduationCap,
  CalendarClock,
  Gift,
  FileCheck,
} from 'lucide-react';
import { api } from '../../lib/api';

const memberIconByType: Record<string, any> = {
  医疗: Stethoscope,
  重疾: ShieldAlert,
  意外: Car,
  少儿: Baby,
  教育: GraduationCap,
};

const reminderMeta: Record<string, { icon: any; wrapClass: string; actionClass: string; tagClass: string }> = {
  renewal: {
    icon: CalendarClock,
    wrapClass: 'bg-orange-50 text-orange-500',
    actionClass: 'bg-blue-500 text-white',
    tagClass: 'text-orange-500 bg-orange-50',
  },
  birthday: {
    icon: Gift,
    wrapClass: 'bg-pink-50 text-pink-500',
    actionClass: 'bg-blue-50 text-blue-500',
    tagClass: 'text-slate-400',
  },
  report: {
    icon: FileCheck,
    wrapClass: 'bg-blue-50 text-blue-500',
    actionClass: 'text-slate-400 border border-slate-200',
    tagClass: 'text-slate-400',
  },
};

export default function OverviewTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api
      .insuranceOverview()
      .then((resp) => {
        if (!mounted) return;
        setData(resp);
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
  }, []);

  if (loading) return <div className="p-4 text-sm text-slate-500">保障数据加载中...</div>;
  if (!data) return <div className="p-4 text-sm text-slate-500">暂无保障数据</div>;

  const { summary, familyMembers, reminders } = data;

  return (
    <div className="p-4 space-y-6">
      <div className="bg-blue-500 rounded-2xl p-6 text-white shadow-lg shadow-blue-500/20 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full"></div>
        <div className="flex justify-between items-start relative z-10">
          <div>
            <p className="text-white/80 text-sm font-medium">总保障额度 (元)</p>
            <h2 className="text-3xl font-extrabold mt-1 tracking-tight">{Number(summary.totalCoverage || 0).toLocaleString('zh-CN')}</h2>
          </div>
          <div className="relative flex items-center justify-center w-16 h-16">
            <svg className="w-full h-full transform -rotate-90">
              <circle className="text-white/20" cx="32" cy="32" fill="transparent" r="28" stroke="currentColor" strokeWidth="4"></circle>
              <circle
                className="text-white"
                cx="32"
                cy="32"
                fill="transparent"
                r="28"
                stroke="currentColor"
                strokeDasharray="175"
                strokeDashoffset={175 - (Math.min(summary.healthScore || 0, 100) / 100) * 175}
                strokeLinecap="round"
                strokeWidth="4"
              ></circle>
            </svg>
            <span className="absolute text-xs font-bold">{summary.healthScore || 0}%</span>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/20 pt-4 relative z-10">
          <div>
            <p className="text-white/70 text-xs">有效保单</p>
            <p className="text-lg font-bold">{summary.activePolicies}份</p>
          </div>
          <div>
            <p className="text-white/70 text-xs">年度总保费</p>
            <p className="text-lg font-bold">¥{Number(summary.annualPremium || 0).toLocaleString('zh-CN')}</p>
          </div>
        </div>
      </div>

      <section>
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-lg font-bold">家庭成员保障</h3>
          <button className="text-blue-500 text-sm font-medium flex items-center gap-1">
            添加成员 <PlusCircle size={16} />
          </button>
        </div>
        <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-hide -mx-4 px-4">
          {(familyMembers || []).map((member: any) => (
            <div key={member.id} className="min-w-[140px] bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
              <div className="relative">
                <img src={member.avatar} alt={member.name} className="w-14 h-14 rounded-full bg-blue-50 object-cover" referrerPolicy="no-referrer" />
                <div className="absolute -bottom-1 -right-2 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full border-2 border-white">{member.score}分</div>
              </div>
              <p className="mt-3 font-bold text-sm">{member.name}</p>
              <div className="flex gap-2 mt-2">
                {(member.coveredTypes || []).slice(0, 3).map((type: string) => {
                  const Icon = memberIconByType[type] || ShieldAlert;
                  return <Icon key={type} size={16} className="text-blue-500" />;
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-bold mb-3">近期提醒</h3>
        <div className="space-y-3">
          {(reminders || []).map((item: any) => {
            const meta = reminderMeta[item.kind] || reminderMeta.report;
            const Icon = meta.icon;
            const lowEmphasis = item.kind === 'report';
            return (
              <div
                key={item.id}
                className={`bg-white p-4 rounded-2xl flex items-center gap-4 border border-slate-100 shadow-sm ${lowEmphasis ? 'opacity-70' : ''}`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${meta.wrapClass}`}>
                  <Icon size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-sm truncate">{item.title}</h4>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${meta.tagClass}`}>{item.tag}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
                </div>
                <button className={`text-xs font-bold px-3 py-2 rounded-lg shrink-0 ${meta.actionClass}`}>{item.actionText}</button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
