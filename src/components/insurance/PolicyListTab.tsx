import React, { useEffect, useState } from 'react';
import { Shield, HeartPulse, Stethoscope } from 'lucide-react';
import { api, type InsurancePolicy } from '../../lib/api';

interface Props {
  onSelectPolicy: (policy: InsurancePolicy) => void;
  refreshKey?: number;
}

const iconByType: Record<string, any> = {
  stethoscope: Stethoscope,
  'heart-pulse': HeartPulse,
  shield: Shield,
};

export default function PolicyListTab({ onSelectPolicy, refreshKey = 0 }: Props) {
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api
      .insurancePolicies()
      .then((resp) => {
        if (!mounted) return;
        setPolicies(resp.policies || []);
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
  }, [refreshKey]);

  if (loading) return <div className="p-4 text-sm text-slate-500">保单加载中...</div>;

  return (
    <div className="p-4 space-y-4">
      {!policies.length && <div className="text-sm text-slate-500">暂无保单</div>}
      {policies.map((policy) => {
        const Icon = iconByType[policy.icon] || Shield;
        const color = policy.icon === 'stethoscope' ? 'text-blue-500' : policy.icon === 'heart-pulse' ? 'text-red-500' : 'text-orange-500';
        const bg = policy.icon === 'stethoscope' ? 'bg-blue-50' : policy.icon === 'heart-pulse' ? 'bg-red-50' : 'bg-orange-50';

        return (
          <div
            key={policy.id}
            onClick={() => onSelectPolicy(policy)}
            className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 active:scale-[0.98] transition-transform cursor-pointer"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full ${bg} flex items-center justify-center ${color}`}>
                  <Icon size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">{policy.name}</h3>
                  <p className="text-xs text-slate-500">{policy.company}</p>
                </div>
              </div>
              <span className="px-2 py-1 bg-green-50 text-green-600 text-[10px] font-bold rounded">{policy.status}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
              <div>
                <p className="text-xs text-slate-400 mb-1">保障额度</p>
                <p className="font-bold text-slate-900">{(policy.amount / 10000).toFixed(2)}万</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">下次缴费日</p>
                <p className="font-bold text-slate-900">{policy.nextPayment}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
