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
const settingsSchema = new mongoose.Schema({
    _id: ReqString,
    channelId: String || null,
    djRoleId: String || null,
    skipEnabled: ReqBool,
    volumeEnabled: ReqBool,
    volume: ReqNum
});

// Create the queue model
export default mongoose.model('Settings', settingsSchema)
