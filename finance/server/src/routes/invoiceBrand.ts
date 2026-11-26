import { Router, Request, Response } from 'express';
import InvoiceBrand from '../models/InvoiceBrand';

const router = Router();

const DEFAULT = {
  companyName: 'Nimbus Works Pvt Ltd',
  tagline:     'Digital Marketing Agency',
  address:     '221B Demo Street, Bengaluru — 560001',
  gst:         '29AAAAA0000A1Z5',
  email:       'accounts@nimbusworks.example',
  phone:       '+91 90000 00000',
  accentColor: '#6366f1',
  logoLetter: 'N',
  footerNote:  '',
};

router.get('/', async (_req: Request, res: Response) => {
  try {
    const brand = await InvoiceBrand.findOne();
    res.json(brand || DEFAULT);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/', async (req: Request, res: Response) => {
  try {
    const brand = await InvoiceBrand.findOneAndUpdate(
      {},
      { $set: req.body },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json(brand);
  } catch {
    res.status(400).json({ error: 'Invalid data' });
  }
});

export default router;
