import React, { useEffect, useState } from 'react';
import { Calculator, ShieldAlert, FileSearch, ArrowRight } from 'lucide-react';
import { api, type LearningTool } from '../../lib/api';

const iconById: Record<number, any> = {
  1: Calculator,
  2: ShieldAlert,
  3: FileSearch,
};

export default function PracticalTools() {
  const [tools, setTools] = useState<LearningTool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api
      .learningTools()
      .then((resp) => {
        if (!mounted) return;
        setTools(resp.tools || []);
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

  return (
    <div className="p-4 space-y-4">
      {loading && <div className="text-sm text-slate-500">工具加载中...</div>}
      {!loading && !tools.length && <div className="text-sm text-slate-500">暂无工具</div>}
      {tools.map((tool) => {
        const Icon = iconById[tool.id] || Calculator;
        return (
          <button
            key={tool.id}
            className="w-full bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4 active:scale-[0.98] transition-transform text-left"
          >
            <div className={`w-14 h-14 rounded-full ${tool.bg} flex items-center justify-center flex-shrink-0`}>
              <Icon size={28} className={tool.color} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-900 mb-1">{tool.title}</h3>
              <p className="text-sm text-slate-500">{tool.desc}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 flex-shrink-0">
              <ArrowRight size={18} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
