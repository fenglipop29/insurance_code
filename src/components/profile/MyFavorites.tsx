import React, { useMemo, useState } from 'react';
import { ChevronLeft, HeartOff } from 'lucide-react';
import { motion } from 'motion/react';
import type { LearningCourse } from '../../lib/api';

interface Props {
  onClose: () => void;
  courses: LearningCourse[];
  onOpenCourse: (course: LearningCourse) => void;
}

export default function MyFavorites({ onClose, courses, onOpenCourse }: Props) {
  const [tab, setTab] = useState('全部');
  const [hidden, setHidden] = useState<Record<number, true>>({});

  const tabs = ['全部', ...Array.from(new Set(courses.map((x) => x.category)))] as string[];

  const list = useMemo(() => {
    const base = tab === '全部' ? courses : courses.filter((x) => x.category === tab);
    return base.filter((x) => !hidden[x.id]);
  }, [courses, hidden, tab]);

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-50 bg-slate-50 flex flex-col"
    >
      <header className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-4 flex items-center">
        <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-slate-100">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold ml-2">我的收藏</h1>
      </header>

      <div className="px-4 bg-white border-b border-slate-100 overflow-x-auto no-scrollbar">
        <div className="flex gap-5">
          {tabs.map((x) => (
            <button
              key={x}
              onClick={() => setTab(x)}
              className={`py-3 text-sm font-bold border-b-2 whitespace-nowrap ${tab === x ? 'border-sky-500 text-sky-500' : 'border-transparent text-slate-500'}`}
            >
              {x}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {list.map((course) => (
          <article key={course.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
            <div className="flex gap-3">
              <img src={course.image} alt={course.title} className="w-24 h-20 rounded-lg object-cover bg-slate-100" referrerPolicy="no-referrer" />
              <div className="flex-1 min-w-0">
                <p className="inline-flex text-[10px] font-bold px-2 py-0.5 rounded bg-sky-50 text-sky-600">{course.typeLabel}</p>
                <h3 className="mt-1 text-sm font-bold line-clamp-2">{course.title}</h3>
                <p className="text-xs text-slate-500 mt-1">{course.category} · {course.timeLeft}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
              <button onClick={() => onOpenCourse(course)} className="text-xs font-bold text-sky-600">查看内容</button>
              <button
                onClick={() => setHidden((prev) => ({ ...prev, [course.id]: true }))}
                className="text-xs font-semibold text-slate-500 inline-flex items-center gap-1 bg-slate-100 px-3 py-1.5 rounded-lg"
              >
                <HeartOff size={14} />
                取消收藏
              </button>
            </div>
          </article>
        ))}

        {list.length === 0 && <p className="text-sm text-slate-500">当前分类暂无收藏</p>}
      </main>
    </motion.div>
  );
}
