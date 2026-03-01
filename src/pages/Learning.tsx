import React, { useState } from 'react';
import { ChevronLeft, Search } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import InsuranceClass, { Course } from '../components/learning/InsuranceClass';
import FunGames from '../components/learning/FunGames';
import PracticalTools from '../components/learning/PracticalTools';
import CourseDetail from '../components/learning/CourseDetail';
import { trackCEvent } from '../lib/track';

export default function Learning() {
  const [activeTab, setActiveTab] = useState('class'); // class, games, tools
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  React.useEffect(() => {
    trackCEvent('c_learning_enter', { tab: 'class' });
  }, []);

  const switchTab = (next: string) => {
    setActiveTab(next);
    trackCEvent('c_learning_switch_tab', { tab: next });
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen pb-24">
      {/* Top Navigation Header */}
      <header className="bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex items-center p-4">
          <button className="p-1 -ml-1 text-slate-700">
            <ChevronLeft size={24} />
          </button>
          <h1 className="flex-1 text-center text-xl font-bold">知识学习</h1>
          <button className="p-1 -mr-1 text-slate-700">
            <Search size={24} />
          </button>
        </div>
        
        {/* Tab Bar */}
        <div className="flex border-b border-slate-100">
          <button 
            onClick={() => switchTab('class')}
            className={`flex-1 py-3 text-center font-bold text-base border-b-4 transition-colors ${activeTab === 'class' ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-500'}`}
          >
            保险课堂
          </button>
          <button 
            onClick={() => switchTab('games')}
            className={`flex-1 py-3 text-center font-bold text-base border-b-4 transition-colors ${activeTab === 'games' ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-500'}`}
          >
            趣味游戏
          </button>
          <button 
            onClick={() => switchTab('tools')}
            className={`flex-1 py-3 text-center font-bold text-base border-b-4 transition-colors ${activeTab === 'tools' ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-500'}`}
          >
            实用工具
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {activeTab === 'class' && <InsuranceClass onSelectCourse={setSelectedCourse} />}
        {activeTab === 'games' && <FunGames />}
        {activeTab === 'tools' && <PracticalTools />}
      </main>

      {/* Course Detail Overlay */}
      <AnimatePresence>
        {selectedCourse && (
          <CourseDetail 
            course={selectedCourse} 
            onBack={() => setSelectedCourse(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
