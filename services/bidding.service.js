const Bidding = require("../models/bidding.model");

const getAllBidding = async (req, res) => {
    try {
        const { id } = req.params;
        const bids = await Bidding.find({ $or: [{ streamId: id }, { auctionId: id }] })
            .populate("bidderId")
            .sort({ bidAmount: -1, createdAt: 1 });

        res.status(200).json({ data: bids, msg: "Biddings fetched" });
    } catch (error) {
        console.error("getAllBidding error", error);
        res.status(500).json({ error: error.message });
    }
};

const getBiddingsByAuctionAndStream = async (req, res) => {
    try {
        const { auctionId, streamId } = req.query;
        console.log(auctionId, streamId, 'auction and stream id')

        if (!auctionId || !streamId) {
            return res.status(400).json({ error: "Both auctionId and streamId are required" });
        }

        const bids = await Bidding.find({ auctionId, streamId })
            .populate("bidderId")
            .sort({ bidAmount: -1, createdAt: 1 });

        res.status(200).json({ data: bids, msg: "Biddings fetched" });
    } catch (error) {
        console.error("getBiddingsByAuctionAndStream error", error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = { getAllBidding, getBiddingsByAuctionAndStream }