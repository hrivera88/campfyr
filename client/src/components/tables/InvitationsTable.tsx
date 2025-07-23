import { useReactTable, getCoreRowModel, getPaginationRowModel, flexRender, createColumnHelper } from "@tanstack/react-table";
import { Box, Table, TableHead, TableRow, TableCell, TableBody, Paper, TablePagination, TextField, Button, useTheme, useMediaQuery, Alert, Snackbar } from "@mui/material";
import { useState, useMemo } from "react";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import EmptyTableMessage from "./EmptyTableMessage";
import SendInvitationDialog from "../dialogs/SendInvitationDialog";
import InvitationDetailsDialog from "../dialogs/InvitationDetailsDialog";
import api from "@/services/axios";
import type { APIError } from "@/schemas/api.error";

const columnHelper = createColumnHelper<any>();

const InvitationsTable = () => { 
    const [search, setSearch] = useState("");
    const [cursor, setCursor] = useState<string | undefined>(undefined);
    const [take, setTake] = useState(10);
    const [isSendInviteOpen, setIsInviteOpen] = useState<boolean>(false);
    const [selectedInvitation, setSelectedInvitation] = useState<any>(null);
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState("");
    const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error">("success");
    const theme = useTheme();
    const isCompact = useMediaQuery(theme.breakpoints.down("md"));
    const queryClient = useQueryClient();

    const { data } = usePaginatedQuery<any>("invitations", "/api/users/invitations", { search, cursor, take });
    
    const resendInvitationMutation = useMutation({
        mutationFn: (invitationId: string) => 
            api.post(`/api/users/invitations/${invitationId}/resend`).then(res => res.data),
        onSuccess: () => {
            setSnackbarMessage("Invitation resent successfully!");
            setSnackbarSeverity("success");
            setSnackbarOpen(true);
            // Invalidate and refetch invitations
            queryClient.invalidateQueries({ queryKey: ["invitations"] });
        },
        onError: (error) => {
            const errorMessage = (error as APIError)?.response?.data?.error || "Failed to resend invitation";
            setSnackbarMessage(errorMessage);
            setSnackbarSeverity("error");
            setSnackbarOpen(true);
        }
    });
    
    const handleInvitationDetails = (invitation: any) => {
        setSelectedInvitation(invitation);
        setDetailsDialogOpen(true);
    };
    
    const handleCloseDetailsDialog = () => {
        setDetailsDialogOpen(false);
        setSelectedInvitation(null);
    };
    
    const handleResendInvitation = (invitation: any) => {
        resendInvitationMutation.mutate(invitation.id);
        handleCloseDetailsDialog();
    };
    
    const columns = useMemo(() => {
        if (isCompact) {
            return [
                columnHelper.accessor("email", { header: "Email" }),
                columnHelper.display({
                    id: "actions",
                    header: "Actions",
                    cell: (info) => (
                        <Button
                            variant="contained"
                            sx={{ color: "white" }}
                            size="small"
                            onClick={() => handleInvitationDetails(info.row.original)}
                        >
                            Details
                        </Button>
                    ),
                }),
            ];
        }
        
        return [
            columnHelper.accessor("status", { header: "Status" }),
            columnHelper.accessor("email", { header: "Email" }),
            columnHelper.accessor("expiresAt", { header: "Expires", cell: (info) => new Date(info.getValue()).toLocaleDateString() }),
            columnHelper.display({
                id: "actions",
                header: "Actions",
                cell: (info) => {
                    const invitation = info.row.original;
                    const isAccepted = invitation.status === "accepted";
                    const isDisabled = resendInvitationMutation.isPending || isAccepted;
                    
                    return (
                        <Button 
                            size="small" 
                            variant="outlined" 
                            onClick={() => handleResendInvitation(invitation)}
                            disabled={isDisabled}
                        >
                            {resendInvitationMutation.isPending ? "Sending..." : "Resend"}
                        </Button>
                    );
                },
            }),
        ];
    }, [isCompact, handleResendInvitation, resendInvitationMutation.isPending]);
    
    const table = useReactTable({
        data: data?.data || [],
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
    });

    return (
      <Paper sx={{ overflowX: "auto" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 2 }}>
          <TextField
            size="small"
            placeholder="Search by email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
                />
                <Button onClick={() => setIsInviteOpen(true)} variant="contained" sx={{color: "white", py: 1}} size="small" color="primary">Invite Someone</Button>
        </Box>
        <Table>
          <TableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableCell key={header.id}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableHead>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <EmptyTableMessage modelName="invitations" />
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          component={"div"}
          count={-1}
          rowsPerPage={take}
          rowsPerPageOptions={[10, 20, 50]}
          page={0}
          onPageChange={() => {
            if (data?.meta?.hasNextPage)
              setCursor(data.meta.nextCursor || undefined);
          }}
          onRowsPerPageChange={(e) => {
            setTake(Number(e.target.value));
            setCursor(undefined);
          }}
          labelDisplayedRows={() => `${data?.meta?.count || 0} rows`}
          nextIconButtonProps={{ disabled: !data?.meta?.hasNextPage }}
          backIconButtonProps={{ disabled: !cursor }}
            />
            <SendInvitationDialog open={isSendInviteOpen} onClose={() => setIsInviteOpen(false)} />
            <InvitationDetailsDialog
                open={detailsDialogOpen}
                invitation={selectedInvitation}
                onClose={handleCloseDetailsDialog}
                onResend={handleResendInvitation}
                isResending={resendInvitationMutation.isPending}
            />
            <Snackbar
                open={snackbarOpen}
                autoHideDuration={4000}
                onClose={() => setSnackbarOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbarOpen(false)}
                    severity={snackbarSeverity}
                    sx={{ width: '100%' }}
                >
                    {snackbarMessage}
                </Alert>
            </Snackbar>
      </Paper>
    );
};

export default InvitationsTable;