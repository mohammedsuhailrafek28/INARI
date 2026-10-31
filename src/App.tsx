import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { DashboardLayout } from './pages/dashboard/DashboardLayout';
import { OverviewPage } from './pages/dashboard/OverviewPage';
import { AdvisorPage } from './pages/dashboard/AdvisorPage';
import { TransactionsPage } from './pages/dashboard/TransactionsPage';
import { SubscriptionsPage } from './pages/dashboard/SubscriptionsPage';
import { ProfilePage } from './pages/dashboard/ProfilePage';
import { PlannerPage } from './pages/dashboard/PlannerPage';
import { NudgesPage } from './pages/dashboard/NudgesPage';
import { MonthlyReportPage } from './pages/dashboard/MonthlyReportPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page */}
        <Route path="/" element={<LandingPage />} />

        {/* Integrated Dashboard Shell */}
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="advisor" element={<AdvisorPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="subscriptions" element={<SubscriptionsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="planner" element={<PlannerPage />} />
          <Route path="nudges" element={<NudgesPage />} />
          <Route path="reports" element={<MonthlyReportPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
