import { Box, Typography } from "@mui/material";

const EmptyTableMessage = ({ modelName }: { modelName: string }) => { 
    return (
        <Box sx={{ py: 6, textAlign: "center" }}>
            <Typography variant="body1" color="text.secondary">There are currently no { modelName}.</Typography>
        </Box>
    );
};

export default EmptyTableMessage;