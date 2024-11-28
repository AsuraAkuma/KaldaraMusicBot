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
const playlistSchema = new mongoose.Schema({
  _id: ReqString,
  owner: ReqString,
  name: ReqString,
  description: String || null,
  thumbnail: String || null,
  songs: [{ songId: ReqString, index: ReqNum }]
});

// Create the queue model
export default mongoose.model('Custom-Playlists', playlistSchema)
