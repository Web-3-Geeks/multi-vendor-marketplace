import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import DashboardRoute from "./components/dashboard/DashboardRoute";
import CustomerDashboard from "./pages/dashboard/CustomerDashboard";
import VendorDashboard from "./pages/dashboard/VendorDashboard";
import AdminDashboard from "./pages/dashboard/AdminDashboard";
import ProtectedRoute from "./components/routing/ProtectedRoute";
import GuestRoute from "./components/routing/GuestRoute";
import MarketplaceLayout from "./components/marketplace/MarketplaceLayout";
import ProductsPage from "./pages/marketplace/ProductsPage";
import ProductDetailPage from "./pages/marketplace/ProductDetailPage";
import VendorStorePage from "./pages/marketplace/VendorStorePage";
import { ROLES } from "./constants/roles";

function App() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route element={<MarketplaceLayout />}>
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />
        <Route path="/vendor/:id" element={<VendorStorePage />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={[ROLES.CUSTOMER]} />}>
        <Route path="/customer" element={<DashboardRoute page={CustomerDashboard} />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={[ROLES.VENDOR]} />}>
        <Route path="/vendor" element={<DashboardRoute page={VendorDashboard} />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
        <Route path="/admin" element={<DashboardRoute page={AdminDashboard} />} />
      </Route>

      <Route path="/" element={<Navigate to="/products" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
