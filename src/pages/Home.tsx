import React from 'react';
import Header from '../components/Header';
import AdvisorCard from '../components/AdvisorCard';
import CoreFeatures from '../components/CoreFeatures';
import Activities from '../components/Activities';
import PointsBanner from '../components/PointsBanner';
import LatestNews from '../components/LatestNews';
import PopularGames from '../components/PopularGames';

interface Props {
  requireAuth: (action: () => void) => void;
  onOpenMall: () => void;
  onOpenAdvisor: () => void;
}

export default function Home({ requireAuth, onOpenMall, onOpenAdvisor }: Props) {
  return (
    <div className="flex-1 flex flex-col h-full">
      <Header />
      <div className="flex-1 overflow-y-auto px-4 space-y-6 pt-4 pb-24">
        <AdvisorCard onOpen={onOpenAdvisor} />
        <CoreFeatures requireAuth={requireAuth} />
        <Activities requireAuth={requireAuth} />
        <PointsBanner onOpenMall={onOpenMall} />
        <LatestNews />
        <PopularGames requireAuth={requireAuth} />
      </div>
    </div>
  );
}
