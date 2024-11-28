import mongoose from "mongoose";
const ReqString = {
    type: String,
    required: true
}
const ReqNum = {
    type: Number,
    required: true
}
const ReqObj = {
    type: Object,
    required: true
}
const ReqBool = {
    type: Boolean,
    required: true
}

// Define the queue schema
const queueSchema = new mongoose.Schema({
    _id: ReqString,
    songs: [ReqString]
});

// Create the queue model
export default mongoose.model('Queues', queueSchema)
