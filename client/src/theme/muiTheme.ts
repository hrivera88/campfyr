import { createTheme } from "@mui/material";

const theme = createTheme({
    palette: {
        primary: {
            light: '#b3e5fc',
            main: '#03a9f4',
            contrastText: '#C9B8FC'
        },
        secondary: {
            light: '#cfd8dc',
            main: '#607d8b'
        },
        background: {
            default: '#eceff1',
            paper: '#fafafa'
        },
        divider: '#cfd8dc',
        text: {
            primary: '#455a64',
        },
        success: {
            main: "#00bc7d",
            light: "#5ee9b5",
            dark: "#213620"
        },
        error: {
            main: "#fb2c36",
            light: "#ffa2a2",
            dark: "#460809",
        },
        brandPurple: {
            main: "#A78EF7",
            dark: "#8768EA",
            light: "#C9B8FC",
            contrastText: "#F1ECFF",
        },
        brandOrange: {
            main: "#FFC685",
            dark: "#FFB55F",
            light: "#FFDBB1",
            contrastText: "#FFF5EA"
        },
        brandYellow: {
            main: "#FFEA85",
            dark: "#FFE45F",
            light: "#FFF2B1",
            contrastText: "#FFFBEA",
        }
    }
});

export default theme;