import { Navigate } from 'react-router-dom';
import type { RootState } from '../../store';
import { useSelector } from 'react-redux';

export function RedirectRoute() { 
    const { isAuthenticated, status } = useSelector((state: RootState) => state.auth);

    if (status === 'idle' || status == 'loading') {
        return null;
    }

    return isAuthenticated ? <Navigate to={"/chat"} replace /> : <Navigate to={"/login"} replace />;
}