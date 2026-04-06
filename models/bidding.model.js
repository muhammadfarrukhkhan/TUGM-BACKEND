const { default: mongoose } = require("mongoose");

const biddingSchema = new mongoose.Schema({
    streamId: { type: String, required: true },
    auctionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Auction",
        required: true
    },
    bidderId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    bidAmount: { type: Number, required: true },
});
module.exports = mongoose.model("Bidding", biddingSchema, 'Bidding');