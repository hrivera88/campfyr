import { useSelector } from "react-redux";
import { Navigate, Outlet } from 'react-router-dom';
import type { RootState } from "../../store";

export const ProtectedRoute = () => { 
    const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

    return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}
