import { Paper, useMediaQuery, useTheme } from "@mui/material";
import UserProfileForm from "@/components/forms/UserProfileForm";



const UserProfile = () => { 
      const theme = useTheme();
      const isCompact = useMediaQuery(theme.breakpoints.down("md"));
    return (<Paper
        elevation={3}
        sx={{
            display: "flex",
            mt: 4,
            flexDirection: "row",
            height: "fit-content",
            overflowY: "hidden",
            width: isCompact ? "90vw" : 600,
            mx: "auto",
            p: 3
        }}
    >
        <UserProfileForm />
    </Paper>);
};

export default UserProfile;