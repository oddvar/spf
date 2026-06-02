import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import PredictionsPage from './pages/PredictionsPage';
import BestThirdsPage from './pages/BestThirdsPage';
import KnockoutPage from './pages/KnockoutPage';
import HelpPage from './pages/HelpPage';
import './App.css';

function isLoggedIn(): boolean {
  return !!localStorage.getItem('token');
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Nav() {
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('firstName');
    localStorage.removeItem('lastName');
    localStorage.removeItem('canEdit');
    navigate('/login');
  }

  return (
    <nav className="main-nav">
      <span className="nav-brand">SPF 2026</span>
      <div className="nav-center">
        <Link to="/predictions">Predictions</Link>
        <Link to="/help">Help</Link>
      </div>
      <div className="nav-right">
        <button className="nav-logout" onClick={logout}>Log out</button>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
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
      </Routes>
    </BrowserRouter>
  );
}
