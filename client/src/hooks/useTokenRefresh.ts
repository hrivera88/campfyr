import { useEffect, useRef } from 'react';
import { isTokenExpired, refreshAccessToken, getTokenExpirationTime } from '../utils/auth-tokens';

export const useTokenRefresh = () => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef<boolean>(false);

  useEffect(() => {
    const scheduleTokenRefresh = () => {
      // Clear any existing timeout
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }

      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const expirationTime = getTokenExpirationTime(token);
        if (!expirationTime) return;

        const now = Date.now();
        const timeUntilExpiry = expirationTime - now;
        
        // Refresh at 80% of token lifetime, but not less than 5 minutes before expiry
        const refreshTime = Math.max(
          timeUntilExpiry * 0.8,
          timeUntilExpiry - (5 * 60 * 1000) // 5 minutes before expiry
        );

        // Only schedule if we have more than 1 minute left
        if (refreshTime > 60 * 1000) {
          console.log(`Token refresh scheduled in ${Math.round(refreshTime / 1000 / 60)} minutes`);
          
          intervalRef.current = setTimeout(async () => {
            if (isRefreshingRef.current) return;
            
            isRefreshingRef.current = true;
            
            try {
              console.log('Proactively refreshing token...');
              await refreshAccessToken();
              console.log('Token refreshed successfully');
              
              // Schedule next refresh
              scheduleTokenRefresh();
            } catch (error) {
              console.error('Proactive token refresh failed:', error);
              // Don't schedule another refresh if this one failed
            } finally {
              isRefreshingRef.current = false;
            }
          }, refreshTime);
        } else if (isTokenExpired(token)) {
          // Token is expired or about to expire, refresh immediately
          refreshAccessToken()
            .then(() => {
              console.log('Expired token refreshed');
              scheduleTokenRefresh();
            })
            .catch((error) => {
              console.error('Failed to refresh expired token:', error);
            });
        }
      } catch (error) {
        console.error('Error scheduling token refresh:', error);
      }
    };

    // Initial schedule
    scheduleTokenRefresh();

    // Listen for new tokens (e.g., after login)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'token' && event.newValue) {
        console.log('Token updated, rescheduling refresh');
        scheduleTokenRefresh();
      }
    };

    // Listen for logout events
    const handleLogout = () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth:logout', handleLogout);

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth:logout', handleLogout);
    };
  }, []);

  return null; // This hook doesn't return anything, it just manages the refresh schedule
};