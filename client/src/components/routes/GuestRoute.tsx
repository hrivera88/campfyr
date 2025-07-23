import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import type { RootState } from '../../store';
import type { JSX } from 'react';

export const GuestRoute = ({ children }: { children: JSX.Element }) => { 
    const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
    return isAuthenticated ? <Navigate to={'/chat'} replace /> : children;
}