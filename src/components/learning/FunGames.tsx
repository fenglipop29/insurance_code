import React, { useEffect, useState } from 'react';
import { Gamepad2, HelpCircle, Trophy, Star } from 'lucide-react';
import { api, type LearningGame } from '../../lib/api';

const iconById: Record<number, any> = {
  1: Gamepad2,
  2: HelpCircle,
};

export default function FunGames() {
  const [games, setGames] = useState<LearningGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api
      .learningGames()
      .then((resp) => {
        if (!mounted) return;
        setGames(resp.games || []);
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
    <div className="p-4 space-y-6">
      {loading && <div className="text-sm text-slate-500">游戏加载中...</div>}
      {!loading && !games.length && <div className="text-sm text-slate-500">暂无游戏</div>}
      <div className="grid gap-4">
        {games.map((game) => {
          const Icon = iconById[game.id] || Gamepad2;
          return (
            <div key={game.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col">
              <div className="flex gap-4 mb-4">
                <div className={`w-16 h-16 rounded-2xl ${game.color} flex items-center justify-center text-white shadow-md flex-shrink-0`}>
                  <Icon size={32} />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-bold text-slate-900">{game.title}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded text-white font-bold ${game.color}`}>{game.category}</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{game.desc}</p>
                </div>
              </div>

              <div className={`flex justify-between items-center p-3 rounded-xl ${game.lightColor} mb-4`}>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-500 mr-1">难度:</span>
                  {[...Array(3)].map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      className={i < game.difficulty ? game.textColor : 'text-slate-300'}
                      fill={i < game.difficulty ? 'currentColor' : 'none'}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <Trophy size={14} className={game.textColor} />
                  <span className={`text-xs font-bold ${game.textColor}`}>最佳: {game.bestScore}</span>
                </div>
              </div>

              <button className={`w-full py-3 rounded-xl font-bold text-sm text-white shadow-sm active:scale-[0.98] transition-transform ${game.color}`}>
                开始游戏
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
