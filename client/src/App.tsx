import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import PredictionsPage from './pages/PredictionsPage';
import BestThirdsPage from './pages/BestThirdsPage';
import KnockoutPage from './pages/KnockoutPage';
import HelpPage from './pages/HelpPage';
import SettingsPage from './pages/SettingsPage';
import ShoutsPage from './pages/ShoutsPage';
import TodayPage from './pages/TodayPage';
import RankingPage from './pages/RankingPage';
import avatarIcon from './assets/avatar.png';
import './App.css';

function isLoggedIn(): boolean {
  return !!localStorage.getItem('token');
}

function useTheme() {
  useEffect(() => {
    const loadTheme = async () => {
      const isLoggedIn = !!localStorage.getItem('token');

      if (isLoggedIn) {
        try {
          const response = await fetch('/api/settings', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          });
          if (response.ok) {
            const data = await response.json() as { theme: 'light' | 'dark' };
            localStorage.setItem('theme', data.theme);
            document.documentElement.setAttribute('data-theme', data.theme);
            return;
          }
        } catch {}
      }

      // Fallback to localStorage or default
      const theme = localStorage.getItem('theme') || 'light';
      document.documentElement.setAttribute('data-theme', theme);
    };

    loadTheme();
  }, []);
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Nav({ showShouts }: { showShouts: boolean }) {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const handlePredictionsClick = () => {
    localStorage.removeItem('selectedUserId');
  };

  return (
    <nav className="main-nav">
      <span className="nav-brand">SPF 2026</span>
      <div className="nav-center">
        <Link to="/predictions" onClick={handlePredictionsClick} style={{ fontWeight: isActive('/predictions') ? 'bold' : 'normal' }}>Predictions</Link>
        {showShouts && <Link to="/today" style={{ fontWeight: isActive('/today') ? 'bold' : 'normal' }}>Next</Link>}
        {showShouts && <Link to="/ranking" style={{ fontWeight: isActive('/ranking') ? 'bold' : 'normal' }}>Ranking</Link>}
        {showShouts && <Link to="/shouts" style={{ fontWeight: isActive('/shouts') ? 'bold' : 'normal' }}>Shouts</Link>}
        <Link to="/help" style={{ fontWeight: isActive('/help') ? 'bold' : 'normal' }}>Help</Link>
      </div>
      <div className="nav-right">
        <Link to="/settings" className="nav-avatar">
          <img src={avatarIcon} alt="Settings" title="Settings" />
        </Link>
      </div>
    </nav>
  );
}

function AppRoutes() {
  useTheme();
  const [showShouts, setShowShouts] = useState(false);

  useEffect(() => {
    const canViewOthers = localStorage.getItem('canViewOthers') === 'true';
    setShowShouts(canViewOthers);
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/predictions" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/predictions"
        element={
          <ProtectedRoute>
            <Nav showShouts={showShouts} />
            <PredictionsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/best-thirds"
        element={
          <ProtectedRoute>
            <Nav showShouts={showShouts} />
            <BestThirdsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/knockout"
        element={
          <ProtectedRoute>
            <Nav showShouts={showShouts} />
            <KnockoutPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/help"
        element={
          <ProtectedRoute>
            <Nav showShouts={showShouts} />
            <HelpPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Nav showShouts={showShouts} />
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/today"
        element={
          <ProtectedRoute>
            <Nav showShouts={showShouts} />
            {showShouts ? <TodayPage /> : <Navigate to="/predictions" replace />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/ranking"
        element={
          <ProtectedRoute>
            <Nav showShouts={showShouts} />
            {showShouts ? <RankingPage /> : <Navigate to="/predictions" replace />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/shouts"
        element={
          <ProtectedRoute>
            <Nav showShouts={showShouts} />
            {showShouts ? <ShoutsPage /> : <Navigate to="/predictions" replace />}
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/spf">
      <AppRoutes />
    </BrowserRouter>
  );
}
