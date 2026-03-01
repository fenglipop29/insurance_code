import React from 'react';
import { BadgeCheck, CircleUserRound, Phone, ShieldCheck, Star, ArrowLeft, MessageCircle } from 'lucide-react';

interface Props {
  onClose: () => void;
}

const expertise = ['家庭保障', '养老规划', '健康保险', '财富传承'];

export default function AdvisorDetail({ onClose }: Props) {
  return (
    <div className="flex-1 flex flex-col bg-[#f6f7f8] min-h-screen pb-24">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 py-4 flex items-center">
        <button onClick={onClose} className="p-2 -ml-2 rounded-full active:bg-slate-100">
          <ArrowLeft size={26} className="text-slate-900" />
        </button>
        <h1 className="ml-4 text-xl font-black text-slate-900">我的顾问</h1>
      </header>

      <main className="flex-1 overflow-y-auto pb-8">
        <section className="bg-white mt-4 mx-4 p-6 rounded-3xl shadow-sm border border-slate-100 text-center">
          <div className="relative inline-block">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDcA8kqifjwTAkMs4RxQM6MEa9UHBvo9OJLghJbqrV3_PBG6mXoBrrZrwCvmS2dUbtBvmzfgpvIUaDWsKORh6Nos-gGk3201TbQ4Xb4uqORRUR3BA0RsCAABvVkNic2v7eolIJnYr6MVn5hvtUNdIPIuNr7S7CXmf4Kk-u_yIdsitoZ4sNC-qhD5j2-wpbdpyKj1H7C6MvlrrlHGndSox0we474ep6aBdaLbXFm0Vc0YdXUEB0zpH9lSpakxy622GXl_on2bA_ykwg"
              alt="顾问头像"
              className="w-32 h-32 rounded-full border-4 border-[#13a4ec]/20 object-cover"
            />
            <span className="absolute bottom-0 right-0 bg-[#13a4ec] text-white p-1.5 rounded-full border-2 border-white">
              <BadgeCheck size={16} />
            </span>
          </div>

          <h2 className="mt-4 text-3xl font-black text-slate-900">小王</h2>
          <p className="text-[#13a4ec] font-bold text-xl mt-1">高级保险理财顾问</p>

          <div className="mt-4 inline-flex items-center px-4 py-2 rounded-full bg-[#13a4ec]/10 text-[#13a4ec] text-base font-bold">
            <ShieldCheck size={18} className="mr-2" />
            已为您提供保障服务 324 天
          </div>

          <div className="mt-4 flex justify-center items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={22} className="text-[#13a4ec] fill-[#13a4ec]" />
            ))}
            <span className="ml-2 text-xl font-bold text-slate-500">5.0</span>
          </div>
        </section>

        <section className="mt-6 px-4">
          <div className="bg-white rounded-3xl border border-slate-100 p-6">
            <h3 className="text-2xl font-black mb-4 flex items-center text-slate-900">
              <BadgeCheck size={22} className="text-[#13a4ec] mr-2" />
              服务擅长
            </h3>
            <div className="flex flex-wrap gap-3">
              {expertise.map((item) => (
                <span key={item} className="px-4 py-2 bg-slate-100 rounded-xl text-base text-slate-900">
                  {item}
                </span>
              ))}
            </div>

            <hr className="my-6 border-slate-100" />

            <h3 className="text-2xl font-black mb-3 flex items-center text-slate-900">
              <CircleUserRound size={22} className="text-[#13a4ec] mr-2" />
              个人简介
            </h3>
            <p className="text-slate-700 text-base leading-relaxed">
              您好，我是您的专属顾问小王。拥有8年保险从业经验，累计为超过500个家庭提供专业的风险管理建议。我致力于为您和您的家人提供最贴心、最专业的养老与健康保障方案。
            </p>
          </div>
        </section>

        <section className="mt-6 px-4 grid grid-cols-1 gap-4">
          <a
            href="tel:4008001234"
            className="flex items-center justify-center py-5 bg-[#13a4ec] text-white rounded-3xl shadow-lg shadow-[#13a4ec]/20"
          >
            <Phone size={20} className="mr-3" />
            <span className="text-xl font-black">电话咨询顾问</span>
          </a>

          <button
            onClick={() => alert('在线聊天将接入企业微信')}
            className="flex items-center justify-center py-5 bg-white border-2 border-[#13a4ec] text-[#13a4ec] rounded-3xl"
          >
            <MessageCircle size={20} className="mr-3" />
            <span className="text-xl font-black">在线聊天</span>
          </button>
        </section>

        <footer className="mt-10 mb-8 px-4 text-center text-slate-400 text-sm">顾问均经过平台实名认证，请放心交流</footer>
      </main>
    </div>
  );
}
