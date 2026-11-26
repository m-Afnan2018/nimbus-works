import mongoose from 'mongoose';

const SHARED_URI = process.env.SHARED_MONGO_URI || 'mongodb://localhost:27017/demo_pm';

export const sharedConn = mongoose.createConnection(SHARED_URI);

sharedConn.on('connected',    () => console.log('Shared DB connected (bridge models)'));
sharedConn.on('error',        (err) => console.error('Shared DB error:', err));
sharedConn.on('disconnected', () => console.warn('Shared DB disconnected'));
