import { useState } from "react";
import { Avatar, IconButton, Menu, MenuItem, Tooltip } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { clearUser } from "../../store/slice/authSlice";
import type { RootState } from "../../store";
import api from "../../services/axios";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@mui/material";

const TopUserDropMenu = () => {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const navigate = useNavigate();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event?.currentTarget);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  const handleLogout = async () => {
    try {
      await api.post("/api/auth/logout", {}, { withCredentials: true });
    } catch (error) {
      console.warn("Logout request failed", error);
    }
    localStorage.removeItem("token");
    dispatch(clearUser());
    navigate("/login", { replace: true });
  };
  return (
    <>
      <Tooltip title="User Settings">
        <IconButton onClick={handleMenuOpen} size="small" sx={{ ml: 2 }}>
          <Avatar src={user?.avatarUrl}>
            {user?.username?.[0].toUpperCase()}
          </Avatar>
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={open} onClose={handleMenuClose}>
        <MenuItem sx={{ fontSize: ".85rem" }} disabled>
          {user?.email}
        </MenuItem>
        <MenuItem
          sx={{ fontSize: ".85rem", color: `${theme.palette.text.primary}` }}
          onClick={handleLogout}
        >
          Log Out
        </MenuItem>
        <MenuItem
          sx={{ fontSize: ".85rem" }}
          onClick={() => {
            navigate("/profile");
          }}
        >
          {"Profile"}
        </MenuItem>
        <MenuItem
          sx={{ fontSize: ".85rem" }}
          onClick={() => {
            navigate("/organization");
          }}
        >
          {"View Organization"}
        </MenuItem>
      </Menu>
    </>
  );
};
export default TopUserDropMenu;
