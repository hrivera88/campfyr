import type { DirectConversationSchemaType } from "@/schemas/direct";
import {createSlice} from "@reduxjs/toolkit";
import type {PayloadAction} from "@reduxjs/toolkit";

interface ConversationState {
    activeConversation: DirectConversationSchemaType | null;
}

const initialState: ConversationState = {
    activeConversation: null,
}
const conversationSlice = createSlice({
    name: "conversation",
    initialState,
    reducers: {
        setActiveConversation(state, action: PayloadAction<DirectConversationSchemaType | null>) {
            state.activeConversation = action.payload;
            try {
                localStorage.setItem('activeConversation', JSON.stringify(action.payload));
            } catch (error) {
                // Handle localStorage errors gracefully (e.g., quota exceeded, not available)
                console.warn('Failed to save active conversation to localStorage:', error);
            }
        }
    }
});

export const {setActiveConversation} = conversationSlice.actions;
export default conversationSlice.reducer;