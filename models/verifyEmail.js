const { Schema, model } = require("mongoose");

const reqStr = { type: String, required: true, unique: true };

const emailSchema = new Schema({
  userId: reqStr,
  email: reqStr,
  variantId: String,
});

module.exports = model("giraffe_emails", emailSchema);
