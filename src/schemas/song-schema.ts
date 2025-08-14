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
// Define the song schema
const songSchema = new mongoose.Schema({
    _id: ReqString,
    songURL: ReqString,
    name: ReqString,
    channel: ReqString,
    thumbnailURL: String || null,
    durationRaw: ReqString,
    durationInSec: ReqNum
});

// Create the song model
export default mongoose.model('Songs', songSchema)
