import React from 'react';
import { Gift } from 'lucide-react';

interface Props {
  onOpenMall: () => void;
}

export default function PointsBanner({ onOpenMall }: Props) {
  return (
    <section>
      <div 
        onClick={onOpenMall}
        className="bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl p-5 flex items-center justify-between shadow-md shadow-violet-200 overflow-hidden relative active:scale-[0.98] transition-transform cursor-pointer"
      >
        <div className="z-10">
          <div className="inline-block bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider mb-2">
            Hot Reward
          </div>
          <h3 className="text-white text-xl font-bold notranslate" translate="no">去兑换积分</h3>
          <p className="text-white/90 text-xs mt-1">超值好礼随心兑，鸡蛋、话费等你拿</p>
          <button className="mt-3 bg-white text-violet-600 px-4 py-1.5 rounded-full text-sm font-bold shadow-sm notranslate" translate="no">
            去积分商城
          </button>
        </div>
        <div className="relative z-10">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
            <Gift size={32} className="text-white" />
          </div>
        </div>
        <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-8 left-1/2 w-32 h-32 bg-fuchsia-400/20 rounded-full blur-3xl"></div>
      </div>
    </section>
  );
}
