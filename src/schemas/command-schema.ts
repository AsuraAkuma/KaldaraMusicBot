const mongoose = require('mongoose')
const reqString = {
    type: String,
    required: true
}
const reqNum = {
    type: Number,
    required: true
}
const reqObj = {
    type: Object,
    required: true
}
const reqBoolean = {
    type: Boolean,
    required: true
}
const commandSchema = mongoose.Schema({
    _id: reqString,
    commands: [reqObj]
})
export default mongoose.model('commands', commandSchema)