import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

interface AuthState { 
    user: {
        id: string,
        email: string,
        username: string,
        avatarUrl: string,
    } | null;
    isAuthenticated: boolean;
    status: 'idle' | 'loading' | 'authenticated' | 'unathenticated';
}

const initialState: AuthState = {
    user: null,
    isAuthenticated: false,
    status: 'idle'
};

export const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setUser: (state, action: PayloadAction<AuthState['user']>) => { 
            state.user = action.payload;
            state.isAuthenticated = !!action.payload;
            state.status = action.payload ? 'authenticated' : 'unathenticated';
        },
        clearUser: (state) => {
            state.user = null;
            state.isAuthenticated = false;
            state.status = 'unathenticated';
        },
        setAuthStatus: (state, action: PayloadAction<AuthState['status']>) => { 
            state.status = action.payload;
        }
    },
});

export const { setUser, clearUser, setAuthStatus } = authSlice.actions;
export default authSlice.reducer;