import { useSelector } from "react-redux";
import { useAuthInit } from "./hooks/useAuthInit"
import { useTokenRefresh } from "./hooks/useTokenRefresh"
import { AppRouter } from "./router"
import type { RootState } from "./store";
import { Box, LinearProgress } from "@mui/material";

export const App = () => { 
  useAuthInit();
  useTokenRefresh(); // Add proactive token refresh
  const status = useSelector((state: RootState) => state.auth.status);

  if (status === 'loading' || status === 'idle') { 
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100%', flexDirection: 'column' }} >
        <Box sx={{width: '200px', mt: 2}} >
          <LinearProgress color="primary" />
        </Box>
      </Box>
    );
  }
  return <AppRouter />;
}