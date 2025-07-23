import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { ChatRoomSchemaType } from "../../schemas/chat";

interface ChatRoomState { 
    activeRoom: ChatRoomSchemaType | null;
    isMember: boolean | undefined;
}

const initialState: ChatRoomState = { 
    activeRoom: null,
    isMember: undefined as boolean | undefined,
}

const chatRoomSlice = createSlice({
    name: 'chatRoom',
    initialState,
    reducers: {
        setActiveRoom(state, action: PayloadAction<ChatRoomSchemaType | null>) { 
            state.activeRoom = action.payload;
            localStorage.setItem('activeRoom', JSON.stringify(action.payload));
        },
        clearActiveRoom(state) { 
            state.activeRoom = null;
            localStorage.removeItem('activeRoom');
        },
        setRoomMembership(state, action: PayloadAction<boolean>) { 
            state.isMember = action.payload;
        },
        resetRoomMembership(state) {
            state.isMember = undefined;
          }
    },
});

export const { setActiveRoom, clearActiveRoom, setRoomMembership, resetRoomMembership } = chatRoomSlice.actions;
export default chatRoomSlice.reducer;