import React, { useState, useEffect } from 'react';
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
  const track = (event: string, properties: Record<string, unknown> = {}) => {
    api.trackEvent({ event, properties }).catch(() => undefined);
  };
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

  return (
    <div className="bg-slate-50 min-h-screen flex flex-col font-sans text-slate-900">
      {currentTab === 'home' && (
        <Home requireAuth={requireAuth} onOpenMall={openPointsMall} onOpenAdvisor={openAdvisorDetail} onSignIn={handleSignIn} />
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
