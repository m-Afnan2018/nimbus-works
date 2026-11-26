import mongoose, { Schema, Document } from 'mongoose';

export interface IInvoiceBrand extends Document {
  companyName: string;
  tagline: string;
  address: string;
  gst: string;
  email: string;
  phone: string;
  accentColor: string;
  logoLetter: string;
  footerNote: string;
}

const InvoiceBrandSchema = new Schema<IInvoiceBrand>({
  companyName:  { type: String, default: 'Nimbus Works Pvt Ltd' },
  tagline:      { type: String, default: 'Digital Marketing Agency' },
  address:      { type: String, default: '221B Demo Street, Bengaluru — 560001' },
  gst:          { type: String, default: '29AAAAA0000A1Z5' },
  email:        { type: String, default: 'accounts@nimbusworks.example' },
  phone:        { type: String, default: '+91 90000 00000' },
  accentColor:  { type: String, default: '#6366f1' },
  logoLetter:   { type: String, default: 'N' },
  footerNote:   { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model<IInvoiceBrand>('InvoiceBrand', InvoiceBrandSchema);
