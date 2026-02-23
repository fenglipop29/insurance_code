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

  useEffect(() => {
    if (currentTab !== 'home' || showAuthModal) return;
    const timer = setTimeout(() => {
      setShowMarketingPopup(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [currentTab, showAuthModal]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    api
      .me()
      .then((res) => {
        setUser(res.user);
        setPointsBalance(res.balance);
        writeCachedUser(res.user);
        writeCachedBalance(res.balance);
      })
      .catch((e: any) => {
        if (e?.code === 'UNAUTHORIZED') {
          clearToken();
          setUser(null);
          setPointsBalance(0);
          writeCachedUser(null);
          writeCachedBalance(0);
        }
      });
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

    const action = pendingAction;
    setPendingAction(null);
    if (action) action();

    try {
      const me = await api.me();
      const resolvedUser = me.user || nextUser;
      const resolvedBalance = Number(me.balance || 0);
      setUser(resolvedUser);
      setPointsBalance(resolvedBalance);
      writeCachedUser(resolvedUser);
      writeCachedBalance(resolvedBalance);
    } catch (e: any) {
      if (e?.code === 'UNAUTHORIZED') {
        clearToken();
        setUser(null);
        setPointsBalance(0);
        writeCachedUser(null);
        writeCachedBalance(0);
      }
    }
  };

  const openPointsMall = () => {
    requireAuth(() => setShowPointsMall(true));
  };

  const openAdvisorDetail = () => {
    setCurrentTab('advisor');
  };

  return (
    <div className="bg-slate-50 min-h-screen flex flex-col font-sans text-slate-900">
      {currentTab === 'home' && <Home requireAuth={requireAuth} onOpenMall={openPointsMall} onOpenAdvisor={openAdvisorDetail} />}
      {currentTab === 'learning' && <Learning />}
      {currentTab === 'insurance' && <InsuranceManagement />}
      {currentTab === 'activities' && <Activities requireAuth={requireAuth} onOpenMall={openPointsMall} />}
      {currentTab === 'profile' && (
        <Profile
          requireAuth={requireAuth}
          isAuthenticated={Boolean(user?.is_verified_basic)}
          user={user}
          pointsBalance={pointsBalance}
          onOpenMall={openPointsMall}
        />
      )}
      {currentTab === 'advisor' && <AdvisorDetail onClose={() => setCurrentTab('home')} />}

      <BottomNav currentTab={currentTab} onChange={setCurrentTab} />

      {showMarketingPopup && !showAuthModal && (
        <MarketingPopup
          onClose={() => setShowMarketingPopup(false)}
          onAction={() => {
            setShowMarketingPopup(false);
            requireAuth(() => alert('签到成功，获得50积分！'));
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
        {showPointsMall && <PointsMall onClose={() => setShowPointsMall(false)} onBalanceChange={setPointsBalance} />}
      </AnimatePresence>
    </div>
  );
}
