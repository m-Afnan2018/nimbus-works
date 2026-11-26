import { Router } from 'express';
import {
  updateProjectTab,
  deleteProjectTab,
  getProjectTabInstances,
  attachTableToTab,
} from '../controllers/projectTab.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();

router.use(authenticate);

router.put('/:id', authorize('admin', 'manager'), updateProjectTab);
router.delete('/:id', authorize('admin', 'manager'), deleteProjectTab);
router.get('/:id/instances', getProjectTabInstances);
router.post('/:id/tables', authorize('admin', 'manager'), attachTableToTab);

export default router;
