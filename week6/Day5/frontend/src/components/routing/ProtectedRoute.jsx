import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { ROLE_HOME } from "../../constants/roles";
import FullPageLoader from "../ui/FullPageLoader";

function ProtectedRoute({ allowedRoles }) {
  const { user, initializing } = useAuth();

  if (initializing) return <FullPageLoader />;

  if (!user) return <Navigate to="/login" replace />;

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role]} replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
