import {
  Box,
  Typography,
  Tabs,
  Tab,
  Divider,
  Paper,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/services/axios";
import UsersTable from "@/components/tables/UsersTable";
import InvitationsTable from "@/components/tables/InvitationsTable";

const Organization = () => {
  const [tabIndex, setTabIndex] = useState(0);
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down("md"));

  const { data: org } = useQuery({
    queryKey: ["organization"],
    queryFn: async () => {
      const response = await api.get("/api/users/organization");
      return response.data;
    },
  });

  return (
    <Box sx={{ maxWidth: "100%", p: isCompact ?  1 : 4, height: isCompact ? "calc(100vh - 64px)" : "unset" }}>
      <Paper elevation={3} sx={{ p: 3, mb: isCompact ? 1 : 4 }}>
        <Typography variant="h5" fontWeight="bold">
          {org?.name || "Organization"}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Created on:{" "}
          {org?.createdAt ? new Date(org.createdAt).toLocaleDateString() : "—"}
        </Typography>
      </Paper>

      <Box sx={{ backgroundColor: `white` }}>
        <Tabs value={tabIndex} onChange={(_, val) => setTabIndex(val)}>
          <Tab label="Current Users" />
          <Tab label="Invitations" />
        </Tabs>
        <Divider />
        {tabIndex === 0 && <UsersTable />}
        {tabIndex === 1 && <InvitationsTable />}
      </Box>
    </Box>
  );
};

export default Organization;
