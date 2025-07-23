import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setUser, clearUser, setAuthStatus } from '../store/slice/authSlice';
import api from '../services/axios';

export const useAuthInit = () => {
    const dispatch = useDispatch();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            dispatch(setAuthStatus('unathenticated'));
            return;
        }

        dispatch(setAuthStatus('loading'));

        const fetchUser = async () => {
            try {
                const res = await api.get('/api/auth/me', {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                const user = res.data;
                dispatch(setUser({ id: user.id, email: user.email, username: user.username, avatarUrl: user.avatarUrl }));
            } catch (error) {
                console.warn('Auto-login failed, clearing token ', error);
                localStorage.removeItem('token');
                dispatch(clearUser());
            }
        };

        fetchUser();
    }, [dispatch]);
};