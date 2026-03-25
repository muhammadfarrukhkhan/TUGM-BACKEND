const mongoose = require("mongoose");

const AuctionSchema = new mongoose.Schema({
  streamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LiveStream",
    required: true,
  },

  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
  },

  // 🔵 Pricing
  startingBid: {
    type: Number,
    required: true,
  },

  currentBid: {
    type: Number,
    default: null,
  },

  bidIncrement: {
    type: Number,
    default: 1,
  },

  highestBidder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Account",
    default: null,
  },

  // 🔵 Timing
  startTime: {
    type: Date,
    default: null,
  },

  endTime: {
    type: Date,
    default: null,
  },

  suddenDeath: {
    type: Boolean,
    default: false,
  },

  // 🔵 Lifecycle
  status: {
    type: String,
    enum: ["PENDING", "ACTIVE", "COMPLETED", "CANCELLED"],
    default: "PENDING",
  },

  // 🔵 Result
  winnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Account",
    default: null,
  },

  // 🔵 Optional history (VERY useful)
  bidHistory: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
      bid: Number,
      time: { type: Date, default: Date.now },
    },
  ],

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Auction", AuctionSchema);