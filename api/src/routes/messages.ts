import express from 'express';
import { getRecentMessages } from '../message-cache';
import { normalizeTimestamps } from '../utils/normalizeTimestamps';

const router = express.Router();

/**
 * GET /api/messages
 * Returns the latest 50 chat messages
 */

router.get('/:roomId', async (req, res) => { 
    const { roomId } = req.params;

    if (!roomId) { 
        return res.status(400).json({success: false, error: 'roomId is required'});
    }
    try { 
        const messages = await getRecentMessages(roomId);
        res.status(200).json({success: true, data: normalizeTimestamps(messages.data)});
    } catch (error) { 
        console.error('Failed to fetch messages: ', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

export default router;