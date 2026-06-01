import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import PredictionsPage from './pages/PredictionsPage';
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
      <div className="nav-links">
        <Link to="/predictions">Predictions</Link>
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
      </Routes>
    </BrowserRouter>
  );
}
