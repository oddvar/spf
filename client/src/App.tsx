import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import PredictionsPage from './pages/PredictionsPage';
import BestThirdsPage from './pages/BestThirdsPage';
import KnockoutPage from './pages/KnockoutPage';
import HelpPage from './pages/HelpPage';
import SettingsPage from './pages/SettingsPage';
import avatarIcon from './assets/avatar.png';
import './App.css';

function isLoggedIn(): boolean {
  return !!localStorage.getItem('token');
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Nav() {
  return (
    <nav className="main-nav">
      <span className="nav-brand">SPF 2026</span>
      <div className="nav-center">
        <Link to="/predictions">Predictions</Link>
        <Link to="/help">Help</Link>
      </div>
      <div className="nav-right">
        <Link to="/settings" className="nav-avatar">
          <img src={avatarIcon} alt="Settings" title="Settings" />
        </Link>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/spf">
      <Routes>
        <Route path="/" element={<Navigate to="/predictions" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/predictions"
          element={
            <ProtectedRoute>
              <Nav />
              <PredictionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/best-thirds"
          element={
            <ProtectedRoute>
              <Nav />
              <BestThirdsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/knockout"
          element={
            <ProtectedRoute>
              <Nav />
              <KnockoutPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/help"
          element={
            <ProtectedRoute>
              <Nav />
              <HelpPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Nav />
              <SettingsPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
