import { Router } from 'express';
import {
  getTableInstance,
  renameTableInstance,
  deleteTableInstance,
  updateColumnWidth,
  addRow,
  updateRow,
  deleteRow,
} from '../controllers/tableInstance.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();

router.use(authenticate);

router.get('/:id', getTableInstance);
router.put('/:id', authorize('admin', 'manager'), renameTableInstance);
router.delete('/:id', authorize('admin', 'manager'), deleteTableInstance);
router.put('/:id/columns/:columnId', updateColumnWidth);
router.post('/:id/rows', addRow);
router.put('/:id/rows/:rowId', updateRow);
router.delete('/:id/rows/:rowId', deleteRow);

export default router;
