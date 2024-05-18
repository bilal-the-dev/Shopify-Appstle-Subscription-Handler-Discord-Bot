const { Schema, model } = require("mongoose");

const reqStr = { type: String, required: true, unique: true };

const emailSchema = new Schema({
  userId: reqStr,
  email: reqStr,
});

module.exports = model("verifyEmail", emailSchema);
