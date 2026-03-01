import React from 'react';

interface Props {
  requireAuth: (action: () => void) => void;
  onSignIn: () => void;
}

export default function Activities({ requireAuth, onSignIn }: Props) {
  return (
    <section>
      <div className="flex justify-between items-end mb-3">
        <h2 className="text-lg font-bold">进行中活动</h2>
        <button className="text-xs text-blue-500 font-medium">查看全部</button>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
        <div className="min-w-[260px] h-32 rounded-2xl bg-gradient-to-r from-orange-400 to-amber-300 p-4 relative overflow-hidden flex flex-col justify-center text-white shadow-sm">
          <h3 className="text-lg font-bold z-10">签到领鸡蛋</h3>
          <p className="text-sm opacity-90 z-10 mt-1">连续签到7天可换新鲜鸡蛋</p>
          <button 
            onClick={() => requireAuth(onSignIn)}
            className="mt-3 bg-white/20 backdrop-blur-md w-fit px-4 py-1.5 rounded-full text-xs font-bold z-10 active:bg-white/30 transition-colors"
          >
            去签到
          </button>
          <div className="absolute -bottom-6 -right-4 text-8xl opacity-20 font-serif">🥚</div>
        </div>
        
        <div className="min-w-[260px] h-32 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-400 p-4 relative overflow-hidden flex flex-col justify-center text-white shadow-sm">
          <h3 className="text-lg font-bold z-10">家庭保障挑战赛</h3>
          <p className="text-sm opacity-90 z-10 mt-1">完善全家信息赢取话费</p>
          <button 
            onClick={() => requireAuth(() => alert('报名成功！'))}
            className="mt-3 bg-white/20 backdrop-blur-md w-fit px-4 py-1.5 rounded-full text-xs font-bold z-10 active:bg-white/30 transition-colors"
          >
            去参加
          </button>
          <div className="absolute -bottom-6 -right-4 text-8xl opacity-20 font-serif">👨‍👩‍👧</div>
        </div>
      </div>
    </section>
  );
}
