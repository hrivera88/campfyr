import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
  Autocomplete,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/services/axios";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import type { UserSchemaType } from "@/schemas/user";

const StartConversationDialog = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const [recipientId, setRecipientId] = useState("");
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const [selectedUser, setSelectedUser] = useState<UserSchemaType | null>(null);
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery<UserSchemaType[]>({
    queryKey: ["all-users"],
    queryFn: async () => {
      const res = await api.get("/api/users");
      return res.data.data;
    },
    enabled: open,
  });

  const filteredUsers = useMemo(
    () => users.filter((u) => u.id !== currentUser?.id),
    [users, currentUser]
  );

  const mutation = useMutation({
    mutationFn: () => api.post("/api/direct/conversations", { recipientId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dms"] });
      onClose();
    },
  });

  useEffect(() => {
    setRecipientId(selectedUser?.id || "");
  }, [selectedUser]);

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle sx={{ fontSize: ".90rem", px: 2, py: 1.8 }}>
        Start New Conversation
      </DialogTitle>
      <DialogContent>
        <Autocomplete
          fullWidth
          loading={isLoading}
          options={filteredUsers}
          getOptionLabel={(option) => option.username || ""}
          value={selectedUser}
          onChange={(_, value) => setSelectedUser(value)}
          renderInput={(params) => (
            <TextField
              {...params}
                  label="Choose a user"
                  sx={{minWidth: 360, mt: 1}}
              variant="outlined"
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {isLoading ? (
                      <CircularProgress color="primary" size={20} />
                    ) : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
      </DialogContent>
      <DialogActions sx={{ pb: 2, px: 1.8 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          sx={{ color: "white" }}
          onClick={() => mutation.mutate()}
          variant="contained"
        >
          Start
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StartConversationDialog;
