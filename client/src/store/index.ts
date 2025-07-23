import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slice/authSlice';
import chatRoomReducer from './slice/chatRoomSlice';
import conversationReducer from './slice/conversationSlice';
import sidebarReducer from './slice/sidebarSlice';
import videoReducer from './slice/videoSlice';


export const store = configureStore({
    reducer: {
        auth: authReducer,
        room: chatRoomReducer,
        sidebar: sidebarReducer,
        conversation: conversationReducer,
        video: videoReducer,
    }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;