import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Recover from "./pages/Recover";
import QR from "./pages/QR";
import ProtectedRoute from "./components/ProtectedRoute";
import LayoutProtegido from "./components/LayoutProtegido";

export default function App() {
  return (
    <Routes>
      {/* Redireciona / para /login */}
      <Route path="/" element={<Navigate to="/login" />} />

      {/* Rotas públicas */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/recover" element={<Recover />} />

      {/* Rotas protegidas com limpeza de sessão automática */}
      <Route
        path="/qr"
        element={
          <ProtectedRoute>
            <LayoutProtegido>
              <QR />
            </LayoutProtegido>
          </ProtectedRoute>
        }
      />
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <LayoutProtegido>
              <Home />
            </LayoutProtegido>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
