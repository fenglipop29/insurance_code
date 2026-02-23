import React, { useState } from 'react';
import { ChevronLeft, Camera, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../../lib/api';

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function UploadPolicy({ onClose, onSuccess }: Props) {
  const [formData, setFormData] = useState({
    company: '',
    name: '',
    applicant: '',
    insured: '',
    date: '',
    paymentPeriod: '20年交',
    coveragePeriod: '终身',
    amount: '',
    firstPremium: '',
  });
  const [loading, setLoading] = useState(false);

  const handleScan = async () => {
    try {
      const resp = await api.scanPolicy();
      setFormData(resp.data);
      alert('识别完成，已自动填充保单信息');
    } catch (e: any) {
      alert(e?.message || '识别失败，请手动填写');
    }
  };

  const handleSubmit = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await api.createPolicy({
        company: formData.company,
        name: formData.name,
        applicant: formData.applicant,
        insured: formData.insured,
        date: formData.date,
        paymentPeriod: formData.paymentPeriod,
        coveragePeriod: formData.coveragePeriod,
        amount: Number(formData.amount),
        firstPremium: Number(formData.firstPremium),
      });
      alert('保单提交成功！');
      onSuccess?.();
      onClose();
    } catch (e: any) {
      if (e?.code === 'UNAUTHORIZED') {
        alert('请先完成实名并登录后再上传保单');
      } else {
        alert(e?.message || '提交失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-50 bg-slate-50 flex flex-col"
    >
      <header className="bg-white sticky top-0 z-10 px-4 py-4 flex items-center justify-between border-b border-slate-100">
        <button onClick={onClose} className="p-2 -ml-2 text-slate-700 active:bg-slate-100 rounded-full">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">上传保单</h1>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        <section className="p-4">
          <div className="mb-3">
            <h2 className="text-lg font-bold">拍照自动识别</h2>
            <p className="text-slate-500 text-xs mt-1">系统将自动提取保单关键信息，省时省力</p>
          </div>
          <div
            onClick={handleScan}
            className="w-full aspect-[2/1] rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 flex flex-col items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer relative overflow-hidden"
          >
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center text-blue-500">
              <Camera size={28} />
            </div>
            <span className="text-base font-bold text-blue-600">点击拍照上传</span>
            <p className="text-xs text-blue-400">支持纸质保单拍照或相册图片</p>

            <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-blue-500 rounded-tl"></div>
            <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-blue-500 rounded-tr"></div>
            <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-blue-500 rounded-bl"></div>
            <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-blue-500 rounded-br"></div>
          </div>
        </section>

        <div className="flex items-center gap-4 px-4 py-2">
          <div className="h-px bg-slate-200 flex-1"></div>
          <span className="text-slate-400 text-xs font-medium">或 手动输入详情</span>
          <div className="h-px bg-slate-200 flex-1"></div>
        </div>

        <form className="p-4 space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">保险公司</label>
              <select
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">请选择保险公司</option>
                <option>中国平安保险</option>
                <option>中国人寿保险</option>
                <option>太平洋保险</option>
                <option>友邦保险</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">保险名称</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="输入保单上的险种全称"
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">投保人</label>
              <input
                type="text"
                value={formData.applicant}
                onChange={(e) => setFormData({ ...formData, applicant: e.target.value })}
                placeholder="姓名"
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">被保险人</label>
              <input
                type="text"
                value={formData.insured}
                onChange={(e) => setFormData({ ...formData, insured: e.target.value })}
                placeholder="姓名"
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">投保时间</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">缴费期间</label>
              <select
                value={formData.paymentPeriod}
                onChange={(e) => setFormData({ ...formData, paymentPeriod: e.target.value })}
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option>趸交</option>
                <option>5年交</option>
                <option>10年交</option>
                <option>20年交</option>
                <option>30年交</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">保障期间</label>
              <select
                value={formData.coveragePeriod}
                onChange={(e) => setFormData({ ...formData, coveragePeriod: e.target.value })}
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option>终身</option>
                <option>20年</option>
                <option>30年</option>
                <option>至70岁</option>
                <option>至80岁</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">保额 (元)</label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm font-semibold focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">首期保费 (元)</label>
              <input
                type="number"
                value={formData.firstPremium}
                onChange={(e) => setFormData({ ...formData, firstPremium: e.target.value })}
                placeholder="0.00"
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm font-semibold focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
        </form>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 pb-safe shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-blue-500 text-white font-bold text-lg py-3.5 rounded-xl shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <CheckCircle2 size={20} />
          {loading ? '提交中...' : '确认并提交'}
        </button>
      </div>
    </motion.div>
  );
}
