import mongoose from 'mongoose';
import { mongoPath } from './config.json'

export default async function mongo(): Promise<mongoose.Mongoose> {
    await mongoose.connect(mongoPath)
    mongoose.set('strictQuery', true);
    return mongoose;
}