import { Router } from 'express';
import jwt from 'jsonwebtoken';
import {
  getFriends,
  getPendingFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  searchUsers,
  createRoomInvitation,
  acceptRoomInvitation,
  rejectRoomInvitation,
  getPendingRoomInvitations
} from './db';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    req.user = payload;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

router.get('/friends', authenticateToken, async (req: any, res) => {
  try {
    const friends = await getFriends(req.user.id);
    res.json({ friends });
  } catch (err: any) {
    console.error('Get friends error', err);
    res.status(500).json({ error: err.message || 'Failed to get friends' });
  }
});

router.get('/friends/requests', authenticateToken, async (req: any, res) => {
  try {
    const requests = await getPendingFriendRequests(req.user.id);
    res.json({ requests });
  } catch (err: any) {
    console.error('Get friend requests error', err);
    res.status(500).json({ error: err.message || 'Failed to get friend requests' });
  }
});

router.get('/users/search', authenticateToken, async (req: any, res) => {
  const { q } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const users = await searchUsers(q, req.user.id);
    res.json({ users });
  } catch (err: any) {
    console.error('Search users error', err);
    res.status(500).json({ error: err.message || 'Failed to search users' });
  }
});

router.post('/friends/request', authenticateToken, async (req: any, res) => {
  const { friendId } = req.body;

  if (!friendId) {
    return res.status(400).json({ error: 'friendId is required' });
  }

  if (friendId === req.user.id) {
    return res.status(400).json({ error: 'Cannot send friend request to yourself' });
  }

  try {
    const friendship = await sendFriendRequest(req.user.id, friendId);
    res.json({ ok: true, friendship });
  } catch (err: any) {
    console.error('Send friend request error', err);
    res.status(500).json({ error: err.message || 'Failed to send friend request' });
  }
});

router.post('/friends/accept', authenticateToken, async (req: any, res) => {
  const { friendId } = req.body;

  if (!friendId) {
    return res.status(400).json({ error: 'friendId is required' });
  }

  try {
    const friendship = await acceptFriendRequest(req.user.id, friendId);
    res.json({ ok: true, friendship });
  } catch (err: any) {
    console.error('Accept friend request error', err);
    res.status(500).json({ error: err.message || 'Failed to accept friend request' });
  }
});

router.post('/friends/reject', authenticateToken, async (req: any, res) => {
  const { friendId } = req.body;

  if (!friendId) {
    return res.status(400).json({ error: 'friendId is required' });
  }

  try {
    const friendship = await rejectFriendRequest(req.user.id, friendId);
    res.json({ ok: true, friendship });
  } catch (err: any) {
    console.error('Reject friend request error', err);
    res.status(500).json({ error: err.message || 'Failed to reject friend request' });
  }
});

router.delete('/friends/:friendId', authenticateToken, async (req: any, res) => {
  const { friendId } = req.params;

  if (!friendId) {
    return res.status(400).json({ error: 'friendId is required' });
  }

  try {
    await removeFriend(req.user.id, friendId);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('Remove friend error', err);
    res.status(500).json({ error: err.message || 'Failed to remove friend' });
  }
});

router.get('/invitations/rooms', authenticateToken, async (req: any, res) => {
  try {
    const invitations = await getPendingRoomInvitations(req.user.id);
    res.json({ invitations });
  } catch (err: any) {
    console.error('Get room invitations error', err);
    res.status(500).json({ error: err.message || 'Failed to get room invitations' });
  }
});

router.post('/invitations/rooms', authenticateToken, async (req: any, res) => {
  const { friendId, roomId, pin } = req.body;

  if (!friendId || !roomId || !pin) {
    return res.status(400).json({ error: 'friendId, roomId, and pin are required' });
  }

  try {
    const invitation = await createRoomInvitation(req.user.id, friendId, roomId, pin);
    res.json({ ok: true, invitation });
  } catch (err: any) {
    console.error('Send room invitation error', err);
    res.status(500).json({ error: err.message || 'Failed to send room invitation' });
  }
});

router.post('/invitations/rooms/:invitationId/accept', authenticateToken, async (req: any, res) => {
  const { invitationId } = req.params;

  if (!invitationId) {
    return res.status(400).json({ error: 'invitationId is required' });
  }

  try {
    const invitation = await acceptRoomInvitation(invitationId, req.user.id);
    res.json({ ok: true, invitation });
  } catch (err: any) {
    console.error('Accept room invitation error', err);
    res.status(500).json({ error: err.message || 'Failed to accept room invitation' });
  }
});

router.post('/invitations/rooms/:invitationId/reject', authenticateToken, async (req: any, res) => {
  const { invitationId } = req.params;

  if (!invitationId) {
    return res.status(400).json({ error: 'invitationId is required' });
  }

  try {
    const invitation = await rejectRoomInvitation(invitationId, req.user.id);
    res.json({ ok: true, invitation });
  } catch (err: any) {
    console.error('Reject room invitation error', err);
    res.status(500).json({ error: err.message || 'Failed to reject room invitation' });
  }
});

export default router;
