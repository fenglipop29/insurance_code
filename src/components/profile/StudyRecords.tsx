import React, { useMemo, useState } from 'react';
import { ChevronLeft, PlayCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import type { LearningCourse } from '../../lib/api';

interface Props {
  onClose: () => void;
  courses: LearningCourse[];
  onOpenCourse: (course: LearningCourse) => void;
}

export default function StudyRecords({ onClose, courses, onOpenCourse }: Props) {
  const [tab, setTab] = useState<'all' | 'done' | 'doing'>('all');

  const filtered = useMemo(() => {
    if (tab === 'done') return courses.filter((x) => x.progress >= 100);
    if (tab === 'doing') return courses.filter((x) => x.progress > 0 && x.progress < 100);
    return courses;
  }, [courses, tab]);

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-50 bg-slate-50 flex flex-col"
    >
      <header className="bg-white border-b border-slate-100 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center">
          <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-slate-100">
            <ChevronLeft size={24} />
          </button>
          <h1 className="flex-1 text-center text-lg font-bold pr-8">学习记录</h1>
        </div>
        <div className="mt-3 flex border-b border-slate-100">
          {[
            ['all', '全部'],
            ['done', '已学完'],
            ['doing', '学习中'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id as any)}
              className={`flex-1 py-3 text-sm font-bold border-b-2 ${tab === id ? 'border-sky-500 text-sky-500' : 'border-transparent text-slate-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {filtered.map((course) => {
          const done = course.progress >= 100;
          return (
            <article key={course.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex gap-3">
                <img src={course.image} alt={course.title} className="w-24 h-20 object-cover rounded-lg bg-slate-100" referrerPolicy="no-referrer" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold line-clamp-2">{course.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">学习可得 +{course.points} 积分</p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-slate-500">进度</span>
                    <span className={`font-bold ${done ? 'text-emerald-600' : 'text-sky-600'}`}>{course.progress}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full mt-1 overflow-hidden">
                    <div className={`h-full rounded-full ${done ? 'bg-emerald-500' : 'bg-sky-500'}`} style={{ width: `${Math.max(0, Math.min(100, course.progress))}%` }} />
                  </div>
                </div>
              </div>

              <button
                onClick={() => onOpenCourse(course)}
                className={`mt-3 w-full rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-2 ${done ? 'bg-slate-100 text-slate-700' : 'bg-sky-500 text-white'}`}
              >
                {done ? <CheckCircle2 size={16} /> : <PlayCircle size={16} />}
                {done ? '再次学习' : '继续学习'}
              </button>
            </article>
          );
        })}

        {filtered.length === 0 && <p className="text-sm text-slate-500">暂无记录</p>}
      </main>
    </motion.div>
  );
}
