import { Router } from 'express';
import {
  getSOPs,
  getSOP,
  createSOP,
  updateSOP,
  deleteSOP,
  generateTasksFromSOPHandler,
  deleteSOPRunHandler,
} from '../controllers/sop.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();

router.use(authenticate);

router.get('/', getSOPs);
router.delete('/runs/:runId', deleteSOPRunHandler);
router.get('/:id', getSOP);
router.post('/', authorize('admin', 'manager'), createSOP);
router.put('/:id', authorize('admin', 'manager'), updateSOP);
router.delete('/:id', authorize('admin'), deleteSOP);
router.post('/:id/generate', generateTasksFromSOPHandler);

export default router;
