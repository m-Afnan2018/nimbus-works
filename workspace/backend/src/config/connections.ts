import mongoose from 'mongoose';

const PRIVATE_URI = process.env.PRIVATE_MONGO_URI || 'mongodb://localhost:27017/demo_private';

export const privateConn = mongoose.createConnection(PRIVATE_URI);

privateConn.on('connected',    () => console.log('Private DB connected (chat)'));
privateConn.on('error',        (err) => console.error('Private DB error:', err));
privateConn.on('disconnected', () => console.warn('Private DB disconnected'));
