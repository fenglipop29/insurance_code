import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Gift } from 'lucide-react';

interface Props {
  onClose: () => void;
  onAction: () => void;
}

export default function MarketingPopup({ onClose, onAction }: Props) {
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-sm bg-gradient-to-b from-red-500 to-red-600 rounded-3xl p-1 shadow-2xl"
        >
          <button 
            onClick={onClose}
            className="absolute -top-12 right-0 w-8 h-8 rounded-full border-2 border-white/50 text-white flex items-center justify-center"
          >
            <X size={18} />
          </button>
          
          <div className="bg-white rounded-[22px] p-6 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-32 bg-red-50 rounded-b-[50%] -mt-10"></div>
            
            <div className="relative z-10">
              <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                <Gift size={40} className="text-red-500" />
              </div>
              
              <h2 className="text-2xl font-bold text-slate-900 mb-2">每日签到好礼</h2>
              <p className="text-slate-500 text-sm mb-6">今天签到可获得 <span className="text-red-500 font-bold">10</span> 积分<br/>连续签到奖励更丰富哦！</p>
              
              <button 
                onClick={onAction}
                className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold text-lg py-3.5 rounded-full shadow-lg shadow-red-500/30 active:scale-95 transition-transform"
              >
                立即签到领积分
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
