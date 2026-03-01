import React, { useState, useEffect } from 'react';
import { Share2 } from 'lucide-react';
import Home from './pages/Home';
import Learning from './pages/Learning';
import InsuranceManagement from './pages/InsuranceManagement';
import Activities from './pages/Activities';
import Profile from './pages/Profile';
import BottomNav from './components/BottomNav';
import MarketingPopup from './components/MarketingPopup';
import RealNameAuthModal from './components/RealNameAuthModal';
import PointsMall from './components/mall/PointsMall';
import AdvisorDetail from './components/advisor/AdvisorDetail';
import { AnimatePresence } from 'motion/react';
import { api, clearToken, getToken, setToken, User } from './lib/api';
import { trackCEvent } from './lib/track';

const USER_CACHE_KEY = 'insurance_user_cache';
const BALANCE_CACHE_KEY = 'insurance_balance_cache';

function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as User;
    if (!parsed || typeof parsed.id !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedUser(user: User | null) {
  if (!user) {
    localStorage.removeItem(USER_CACHE_KEY);
    return;
  }
  localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
}

function readCachedBalance(): number {
  const raw = localStorage.getItem(BALANCE_CACHE_KEY);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function writeCachedBalance(balance: number) {
  localStorage.setItem(BALANCE_CACHE_KEY, String(balance));
}

export default function App() {
  const [currentTab, setCurrentTab] = useState('home');
  const [showMarketingPopup, setShowMarketingPopup] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPointsMall, setShowPointsMall] = useState(false);
  const [user, setUser] = useState<User | null>(() => readCachedUser());
  const [pointsBalance, setPointsBalance] = useState(() => readCachedBalance());
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const track = trackCEvent;
  const applyBalance = (balance: number) => {
    setPointsBalance(balance);
    writeCachedBalance(balance);
  };
  const syncMe = () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      applyBalance(0);
      writeCachedUser(null);
      return;
    }
    api
      .me()
      .then((res) => {
        setUser(res.user);
        applyBalance(res.balance);
        writeCachedUser(res.user);
      })
      .catch((e: any) => {
        if (e?.code === 'UNAUTHORIZED') {
          clearToken();
          setUser(null);
          applyBalance(0);
          writeCachedUser(null);
          return;
        }
        // Keep current balance on transient network failure.
      });
  };

  useEffect(() => {
    if (currentTab !== 'home' || showAuthModal) return;
    const timer = setTimeout(() => {
      setShowMarketingPopup(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [currentTab, showAuthModal]);

  useEffect(() => {
    track('c_page_view', { tab: currentTab, authed: Boolean(user?.is_verified_basic) });
  }, [currentTab, user?.is_verified_basic]);

  useEffect(() => {
    syncMe();

    const timer = window.setInterval(() => {
      syncMe();
    }, 5000);
    const onFocus = () => syncMe();
    window.addEventListener('focus', onFocus);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const requireAuth = (action: () => void) => {
    if (user?.is_verified_basic) {
      action();
    } else {
      setShowMarketingPopup(false);
      setPendingAction(() => action);
      setShowAuthModal(true);
    }
  };

  const handleAuthSuccess = async ({ token, user: nextUser }: { token: string; user: User }) => {
    setToken(token);
    setUser(nextUser);
    writeCachedUser(nextUser);
    setShowAuthModal(false);
    track('c_auth_verified', { userId: nextUser.id });

    const action = pendingAction;
    setPendingAction(null);
    if (action) action();

    try {
      const me = await api.me();
      const resolvedUser = me.user || nextUser;
      const resolvedBalance = Number(me.balance || 0);
      setUser(resolvedUser);
      applyBalance(resolvedBalance);
      writeCachedUser(resolvedUser);
    } catch (e: any) {
      if (e?.code === 'UNAUTHORIZED') {
        clearToken();
        setUser(null);
        applyBalance(0);
        writeCachedUser(null);
      }
    }
  };

  const openPointsMall = () => {
    track('c_click_points_mall', { fromTab: currentTab });
    setShowPointsMall(true);
  };

  const openAdvisorDetail = () => {
    track('c_click_advisor_detail', { fromTab: currentTab });
    setCurrentTab('advisor');
  };

  const handleSignIn = async () => {
    try {
      const res = await api.signIn();
      applyBalance(Number(res.balance || 0));
      track('c_sign_in_success', { reward: Number(res.reward || 0), balance: Number(res.balance || 0) });
      alert(`签到成功，获得${res.reward}积分！`);
    } catch (e: any) {
      if (e?.code === 'ALREADY_SIGNED') {
        track('c_sign_in_repeat', {});
        alert('今日已签到');
        return;
      }
      track('c_sign_in_failed', { code: String(e?.code || 'UNKNOWN') });
      alert(e?.message || '签到失败');
    }
  };

  const handleLogout = () => {
    clearToken();
    setUser(null);
    applyBalance(0);
    writeCachedUser(null);
    setCurrentTab('home');
    setShowPointsMall(false);
    setShowAuthModal(false);
    alert('已退出登录');
  };

  const handleShare = async () => {
    const pageUrl = window.location.href;
    const shareTitleByTab: Record<string, string> = {
      home: '保险助手-首页',
      learning: '保险助手-知识学习',
      activities: '保险助手-活动中心',
      insurance: '保险助手-保障管理',
      profile: '保险助手-我的',
      advisor: '保险助手-专属顾问',
    };
    const title = shareTitleByTab[currentTab] || '保险助手';
    track('c_share_click', { tab: currentTab, url: pageUrl, hasWebShare: Boolean((navigator as any).share) });
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({
          title,
          text: '和我一起使用保险助手',
          url: pageUrl,
        });
        track('c_share_success', { tab: currentTab, method: 'web_share' });
        return;
      }
      await navigator.clipboard.writeText(pageUrl);
      track('c_share_success', { tab: currentTab, method: 'clipboard' });
      alert('链接已复制');
    } catch (err: any) {
      const isAbort = String(err?.name || '') === 'AbortError';
      if (isAbort) {
        track('c_share_cancel', { tab: currentTab });
        return;
      }
      track('c_share_failed', { tab: currentTab, message: String(err?.message || 'UNKNOWN') });
      alert('分享失败，请稍后重试');
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen flex flex-col font-sans text-slate-900">
      <button
        type="button"
        onClick={handleShare}
        className="fixed right-4 top-4 z-[10070] inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow"
        aria-label="分享当前页面"
      >
        <Share2 size={18} />
      </button>
      {user?.is_verified_basic && (
        <button
          type="button"
          onClick={handleLogout}
          className="fixed right-16 top-4 z-[10070] rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow border border-slate-200"
        >
          退出登录
        </button>
      )}
      {currentTab === 'home' && (
        <Home requireAuth={requireAuth} onOpenMall={openPointsMall} onOpenAdvisor={openAdvisorDetail} onSignIn={handleSignIn} user={user} />
      )}
      {currentTab === 'learning' && <Learning />}
      {currentTab === 'insurance' && <InsuranceManagement />}
      {currentTab === 'activities' && (
        <Activities
          requireAuth={requireAuth}
          onOpenMall={openPointsMall}
          pointsBalance={pointsBalance}
          onBalanceChange={applyBalance}
        />
      )}
      {currentTab === 'profile' && (
        <Profile
          requireAuth={requireAuth}
          isAuthenticated={Boolean(user?.is_verified_basic)}
          user={user}
          pointsBalance={pointsBalance}
          onOpenMall={openPointsMall}
          onGoInsurance={() => setCurrentTab('insurance')}
        />
      )}
      {currentTab === 'advisor' && <AdvisorDetail onClose={() => setCurrentTab('home')} />}

      <BottomNav currentTab={currentTab} onChange={setCurrentTab} />

      {showMarketingPopup && !showAuthModal && (
        <MarketingPopup
          onClose={() => setShowMarketingPopup(false)}
          onAction={() => {
            setShowMarketingPopup(false);
            requireAuth(handleSignIn);
          }}
        />
      )}

      {showAuthModal && (
        <RealNameAuthModal
          onClose={() => {
            setShowAuthModal(false);
            setPendingAction(null);
          }}
          onSuccess={handleAuthSuccess}
        />
      )}

      <AnimatePresence>
        {showPointsMall && (
          <PointsMall
            onClose={() => setShowPointsMall(false)}
            requireAuth={requireAuth}
            balance={pointsBalance}
            onBalanceChange={applyBalance}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
