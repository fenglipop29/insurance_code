import React, { useState } from 'react';
import { Shield, Search, Bell, Plus } from 'lucide-react';
import OverviewTab from '../components/insurance/OverviewTab';
import PolicyListTab from '../components/insurance/PolicyListTab';
import UploadPolicy from '../components/insurance/UploadPolicy';
import PolicyDetail from '../components/insurance/PolicyDetail';
import type { InsurancePolicy } from '../lib/api';

export default function InsuranceManagement() {
  const [activeTab, setActiveTab] = useState('overview');
  const [showUpload, setShowUpload] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<InsurancePolicy | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen pb-24">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-4 py-4 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Shield className="text-blue-500" size={24} />
          <h1 className="text-xl font-bold tracking-tight">保障管理</h1>
        </div>
        <div className="flex gap-3">
          <button className="p-2 hover:bg-blue-50 rounded-full transition-colors">
            <Search size={20} />
          </button>
          <button className="p-2 hover:bg-blue-50 rounded-full transition-colors relative">
            <Bell size={20} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
        </div>
      </header>

      <div className="flex border-b border-slate-100 bg-white">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-3 text-center font-bold text-base border-b-4 transition-colors ${activeTab === 'overview' ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-500'}`}
        >
          总览
        </button>
        <button
          onClick={() => setActiveTab('policies')}
          className={`flex-1 py-3 text-center font-bold text-base border-b-4 transition-colors ${activeTab === 'policies' ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-500'}`}
        >
          保单列表
        </button>
      </div>

      <main className="flex-1 overflow-y-auto">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'policies' && <PolicyListTab onSelectPolicy={setSelectedPolicy} refreshKey={refreshKey} />}
      </main>

      <button
        onClick={() => setShowUpload(true)}
        className="fixed bottom-24 right-4 w-14 h-14 bg-blue-500 text-white rounded-full shadow-lg shadow-blue-500/30 flex items-center justify-center active:scale-95 transition-transform z-30"
      >
        <Plus size={32} />
      </button>

      {showUpload && (
        <UploadPolicy
          onClose={() => setShowUpload(false)}
          onSuccess={() => {
            setRefreshKey((v) => v + 1);
            setActiveTab('policies');
          }}
        />
      )}
      {selectedPolicy && <PolicyDetail policy={selectedPolicy} onClose={() => setSelectedPolicy(null)} />}
    </div>
  );
}
