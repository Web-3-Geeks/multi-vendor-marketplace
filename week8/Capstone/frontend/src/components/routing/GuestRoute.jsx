import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { ROLE_HOME } from "../../constants/roles";
import FullPageLoader from "../ui/FullPageLoader";

function GuestRoute() {
  const { user, initializing } = useAuth();

  if (initializing) return <FullPageLoader />;

  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />;

  return <Outlet />;
}

export default GuestRoute;
