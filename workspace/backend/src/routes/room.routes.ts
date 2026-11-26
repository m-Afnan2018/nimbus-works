import { Router } from 'express';
import { body } from 'express-validator';
import { getRooms, getRoomUsers, createRoom, deleteRoom } from '../controllers/room.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', getRooms);
router.get('/users', getRoomUsers);
router.post('/', [body('name').trim().notEmpty().withMessage('Name is required')], createRoom);
router.delete('/:id', deleteRoom);

export default router;
