import { Palette, PaletteOptions } from "@mui/material/styles";

declare module "@mui/material/styles" {
    interface Palette {
        brandPurple: Palette["primary"],
        brandPurple: {
            main: string;
            light: string;
            dark: string;
            contrastText: string;
        },
        brandOrange: Palette["primary"],
        brandOrange: {
            main: string;
            light: string;
            dark: string;
            contrastText: string;
        },
        brandYellow: Palette["primary"],
        brandYellow: {
            main: string;
            light: string;
            dark: string;
            contrastText: string;
        },
    }
    interface PaletteOptions { 
        brandPurple: PaletteOptions['primary'],
        brandPurple?: {
            main: string;
            light: string;
            dark: string;
            contrastText: string;
        },
        brandOrange: PaletteOptions['primary'],
        brandOrange?: {
            main: string;
            light: string;
            dark: string;
            contrastText: string;
        },
        brandYellow: PaletteOptions['primary'],
        brandYellow?: {
            main: string;
            light: string;
            dark: string;
            contrastText: string;
        },
    }
}