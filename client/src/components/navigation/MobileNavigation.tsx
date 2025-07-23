import {
  Box,
  Collapse,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import {
  setMobileNavigationVisibility,
  setSidebarMode,
  type SidebarMode,
} from "@/store/slice/sidebarSlice";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ExpandLess from "@mui/icons-material/ExpandLess";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "@/store";
import { useNavigate } from "react-router";
import type React from "react";
import RoomListItem from "../chat/RoomListItem";
import DirectConversationListItem from "../chat/DirectConversationListItem";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ChatRoomSchemaType } from "@/schemas/chat";
import type { DirectConversationSchemaType } from "@/schemas/direct";
import api from "@/services/axios";
import { setActiveConversation } from "@/store/slice/conversationSlice";

interface NavItem {
  label: string;
  type: "collapsible" | "link";
  path?: string;
  component?: React.ComponentType<any>;
  maxHeight?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: "Communications",
    items: [
      {
        label: "Chat Rooms",
        type: "collapsible",
        component: RoomListItem,
        maxHeight: 250,
      },
      {
        label: "Direct Message",
        type: "collapsible",
        component: DirectConversationListItem,
        maxHeight: 250,
      },
    ],
  },
  {
    title: "Settings",
    items: [{ label: "Profile", type: "link", path: "/profile" }],
  },
];

const MobileNavigation = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const activeConversation = useSelector((state: RootState) => state.conversation.activeConversation);
  const user = useSelector(
    (state: RootState) => state.auth.user
  );
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const isMobileNavVisible = useSelector(
    (state: RootState) => state.sidebar.mobileNavigationVisibility
  );
  const mode = useSelector((state: RootState) => state.sidebar.mode);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const { data: rooms = [] } = useQuery<ChatRoomSchemaType[]>({
    queryKey: ["rooms"],
    queryFn: async () => {
      const response = await api.get("/api/rooms");
      return response.data.data;
    },
  });
  const { data: dms = [] } = useQuery<DirectConversationSchemaType[]>({
    queryKey: ["dms"],
    queryFn: async () => {
      const response = await api.get("/api/direct/conversations");
      return response.data.data;
    },
  });

  const toggleExpanded = (itemLabel: string) => {
    if (itemLabel === "Chat Rooms") {
      setSidebarMode("chat");
    } else if (itemLabel === "Direct Message") { 
      setSidebarMode("dm");
    }
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemLabel)) {
        newSet.delete(itemLabel);
      } else {
        newSet.add(itemLabel);
      }
      return newSet;
    });
  };

  const toggleRoom = (roomId: string) => {
    const nextRoomId = expandedRoomId === roomId ? null : roomId;
    setExpandedRoomId(nextRoomId);
    localStorage.setItem("expandedRoomId", JSON.stringify(nextRoomId));
  };

  const isExpanded = (itemLabel: string) => expandedItems.has(itemLabel);

  const scrollableSection = ({
    maxHeight = 300,
    children,
  }: {
    maxHeight: number;
    children: any;
  }) => (
    <Box
      sx={{
        maxHeight,
        overflow: "auto",
        "&:::-webkit-scrollbar": { width: 4 },
        "&::-webkit-scrollbar-thumb": { backgroundColor: "rgba(0,0,0,0.3)" },
      }}
    >
      {children}
    </Box>
  );

  const handleDrawerToggle = () => {
    dispatch(setMobileNavigationVisibility(!isMobileNavVisible));
  };

  const handleDrawerNavItemClick = ({
    label,
    path,
  }: {
    label: string;
    path: string;
  }) => {
    dispatch(setSidebarMode(path as SidebarMode));
    navigate(path);
  };
  return (
    <Box onClick={handleDrawerToggle} sx={{ textAlign: "center" }}>
      <List>
        {sections.map((section: NavSection) => (
          <Box key={section.title}>
            <ListItem>
              <ListItemText
                primary={
                  <Typography
                    variant="h6"
                    sx={{ fontSize: "1rem", fontWeight: "bold" }}
                  >
                    {section.title}
                  </Typography>
                }
              />
            </ListItem>
            {section.items.map((item: NavItem) => (
              <Box key={item.label}>
                {item.type === "collapsible" ? (
                  <>
                    <div onClick={(e) => e.stopPropagation()}>
                      <ListItem disablePadding>
                        <ListItemButton
                          onClick={() => toggleExpanded(item.label)}
                        >
                          <ListItemText primary={item.label} />
                          {isExpanded(item.label) ? (
                            <ExpandLess />
                          ) : (
                            <ExpandMore />
                          )}
                        </ListItemButton>
                      </ListItem>
                    </div>
                    <Collapse
                      in={isExpanded(item.label)}
                      timeout="auto"
                      unmountOnExit
                    >
                      <div onClick={(e) => e.stopPropagation()}>
                        {scrollableSection({
                          maxHeight: item.maxHeight || 300,
                          children: (
                            <List component={"div"} disablePadding>
                              {item.label === "Chat Rooms" &&
                                rooms.map((room) => (
                                  <Box key={room.id} sx={{px: 2}}>
                                    <RoomListItem
                                      room={room}
                                      isExpanded={expandedRoomId === room.id}
                                      onToggle={() => toggleRoom(room.id)}
                                      onUserSelect={handleDrawerToggle}
                                    />
                                  </Box>
                                ))}
                              {item.label === "Direct Message" && dms.map((dm) => (
                                <Box key={dm.id} sx={{px: 2}}>
                                  <DirectConversationListItem 
                                    conversation={dm} 
                                    selected={activeConversation?.id === dm.id} 
                                    onSelect={() => {
                                      dispatch(setActiveConversation(dm));
                                      handleDrawerToggle();
                                    }} 
                                    currentUserId={user?.id} 
                                  />
                                </Box>
                              ))}
                            </List>
                          ),
                        })}
                      </div>
                    </Collapse>
                  </>
                ) : (
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={() =>
                        handleDrawerNavItemClick({
                          label: item.label,
                          path: item.path!,
                        })
                      }
                    >
                      <ListItemText primary={item.label} />
                    </ListItemButton>
                  </ListItem>
                )}
              </Box>
            ))}
          </Box>
        ))}
      </List>
    </Box>
  );
};
export default MobileNavigation;
