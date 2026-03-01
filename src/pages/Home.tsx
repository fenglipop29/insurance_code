import React from 'react';
import Header from '../components/Header';
import AdvisorCard from '../components/AdvisorCard';
import CoreFeatures from '../components/CoreFeatures';
import Activities from '../components/Activities';
import PointsBanner from '../components/PointsBanner';
import LatestNews from '../components/LatestNews';
import PopularGames from '../components/PopularGames';
import { User } from '../lib/api';

interface Props {
  requireAuth: (action: () => void) => void;
  onOpenMall: () => void;
  onOpenAdvisor: () => void;
  onSignIn: () => void;
  user: User | null;
}

export default function Home({ requireAuth, onOpenMall, onOpenAdvisor, onSignIn, user }: Props) {
  return (
    <div className="flex-1 flex flex-col h-full">
      <Header customerName={user?.name} />
      <div className="flex-1 overflow-y-auto px-4 space-y-6 pt-4 pb-24">
        <AdvisorCard onOpen={onOpenAdvisor} />
        <CoreFeatures requireAuth={requireAuth} onSignIn={onSignIn} />
        <Activities requireAuth={requireAuth} onSignIn={onSignIn} />
        <PointsBanner onOpenMall={onOpenMall} />
        <LatestNews />
        <PopularGames requireAuth={requireAuth} />
      </div>
    </div>
  );
}
