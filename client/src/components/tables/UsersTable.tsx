import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import {
  Box,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  TablePagination,
  TextField,
  useTheme,
  useMediaQuery,
  Button,
} from "@mui/material";
import { Search } from "@mui/icons-material";
import { useState, useMemo } from "react";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import EmptyTableMessage from "./EmptyTableMessage";
import UserDetailsDialog from "../dialogs/UserDetailsDialog";

const columnHelper = createColumnHelper<any>();

const UsersTable = () => {
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [take, setTake] = useState(10);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down("md"));

  const { data, isLoading } = usePaginatedQuery<any>("users", "/api/users", {
    search,
    cursor,
    take,
  });

  const handleUserDetails = (user: any) => {
    setSelectedUser(user);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedUser(null);
  };

  const columns = useMemo(() => {
    if (isCompact) {
      return [
        columnHelper.accessor("username", { header: "Name" }),
        columnHelper.display({
          id: "actions",
          header: "Actions",
          cell: (info) => (
            <Button
              variant="contained"
              sx={{color: "white"}}
              size="small"
              onClick={() => handleUserDetails(info.row.original)}
            >
              Details
            </Button>
          ),
        }),
      ];
    }

    return [
      columnHelper.accessor("username", { header: "Username" }),
      columnHelper.accessor("email", { header: "Email" }),
      columnHelper.accessor("createdAt", {
        header: "Joined",
        cell: (info) => new Date(info.getValue()).toLocaleDateString(),
      }),
    ];
  }, [isCompact]);

  const table = useReactTable({
    data: data?.data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <Paper sx={{ overflowX: "auto" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", p: 2 }}>
        <TextField
          size="small"
          placeholder="Search by username"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          inputProps={{ endAdornment: <Search fontSize="small" /> }}
        />
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
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
        onPageChange={(e, nextPage) => {
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
      <UserDetailsDialog
        open={dialogOpen}
        user={selectedUser}
        onClose={handleCloseDialog}
      />
    </Paper>
  );
};

export default UsersTable;
