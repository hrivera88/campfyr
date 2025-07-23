import {
  AppBar,
  Box,
  Button,
  Toolbar,
  useMediaQuery,
  IconButton,
  useTheme,
  Drawer,
} from "@mui/material";
import TopUserDropMenu from "./TopUserDropMenu";
import { ChatBubble, Menu } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { setMobileNavigationVisibility } from "@/store/slice/sidebarSlice";
import {useDispatch, useSelector } from "react-redux";
import type { RootState } from "@/store";
import MobileNavigation from "./MobileNavigation";


const drawerWidth = "80vw"

const TopBar = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down("md"));
  const dispatch = useDispatch();
  const isMobileNavVisible = useSelector((state: RootState) => state.sidebar.mobileNavigationVisibility);

  const handleDrawerToggle = () => {
    dispatch(setMobileNavigationVisibility(!isMobileNavVisible));
  };

  return (
    <>
      <AppBar position="static" sx={{ backgroundColor: "#fafafa", borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Toolbar>
          {isCompact && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <Menu />
            </IconButton>
          )}
          <Box
            component="img"
            src="/campfyr-logo.svg"
            alt="Campfyr logo"
            sx={{
              width: "fit-content",
              height: 24,
            }}
          />
          {!isCompact && (
            <Box sx={{ ml: 5 }}>
              <Button
                onClick={() => navigate("chat")}
                startIcon={<ChatBubble fontSize="small" />}
                color="primary"
                sx={{ fontSize: ".80rem", pt: 1 }}
              >
                Chat
              </Button>
            </Box>
          )}
          <Box sx={{ position: "relative", ml: "auto" }}>
            <TopUserDropMenu />
          </Box>
        </Toolbar>
      </AppBar>
      <Box component={"nav"}>
        <Drawer
          variant="temporary"
          open={isMobileNavVisible}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: {
              xs: "block",
              sm: "none",
              "& .MuiDrawer-paper": {
                boxSizing: "border-box",
                width: drawerWidth,
              },
            },
          }}
        >
          {<MobileNavigation />}
        </Drawer>
      </Box>
    </>
  );
};

export default TopBar;
