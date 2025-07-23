import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

export type SidebarMode = "chat" | "dm";

const initialState: {
    mode: SidebarMode;
    mobileNavigationVisibility: boolean;
} = {
    mode: localStorage.getItem("sidebarMode") as SidebarMode | 'chat',
    mobileNavigationVisibility: false,
};

const sidebarSlice = createSlice({
    name: 'sidebar',
    initialState,
    reducers: {
        setSidebarMode: (state, action: PayloadAction<SidebarMode>) => { 
            state.mode = action.payload;
            localStorage.setItem('sidebarMode', action.payload);
        },
        setMobileNavigationVisibility: (state, action: PayloadAction<boolean>) => { 
            state.mobileNavigationVisibility = action.payload;
        },
    },
});

export const { setSidebarMode, setMobileNavigationVisibility } = sidebarSlice.actions;
export default sidebarSlice.reducer;