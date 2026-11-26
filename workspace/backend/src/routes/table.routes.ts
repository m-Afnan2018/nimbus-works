import { Router } from 'express';
import {
  getTables,
  getTable,
  createTable,
  updateTable,
  toggleTableActive,
  deleteTable,
  addColumn,
  updateColumn,
  deleteColumn,
  reorderColumns,
} from '../controllers/table.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();

router.use(authenticate);

router.get('/', authorize('admin', 'manager'), getTables);
router.get('/:id', getTable);
router.post('/', authorize('admin', 'manager'), createTable);
router.put('/:id', authorize('admin', 'manager'), updateTable);
router.post('/:id/toggle-active', authorize('admin', 'manager'), toggleTableActive);
router.delete('/:id', authorize('admin', 'manager'), deleteTable);

router.post('/:id/columns', authorize('admin', 'manager'), addColumn);
router.put('/:id/columns/reorder', authorize('admin', 'manager'), reorderColumns);
router.put('/:id/columns/:columnId', authorize('admin', 'manager'), updateColumn);
router.delete('/:id/columns/:columnId', authorize('admin', 'manager'), deleteColumn);

export default router;
