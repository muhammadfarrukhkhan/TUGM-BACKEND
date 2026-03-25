const Auction = require("../models/auction.model");
const LiveStream = require("../models/stream.model");
const Bidding = require("../models/bidding.model");
const { emitToUser } = require("../config/socket.config");
const { AccountModel } = require("../models/account.model");

const createAuction = async (req, res) => {
  try {
    const { streamId, productId, startingBid, duration, suddenDeath } = req.body;

    if (!streamId || !startingBid || !duration) {
      return res.status(400).json({ error: "streamId, startingBid and duration are required" });
    }

    const stream = await LiveStream.findById(streamId);
    if (!stream) {
      return res.status(404).json({ error: "Stream not found" });
    }

    if (stream.status !== "LIVE") {
      return res.status(400).json({ error: "Stream is not live" });
    }

    const startTime = new Date();
    const durationSeconds = Number(duration);
    if (isNaN(durationSeconds) || durationSeconds <= 0) {
      return res.status(400).json({ error: "duration must be a positive number (in seconds)" });
    }

    const endTime = new Date(startTime.getTime() + durationSeconds * 1000);

    const auction = new Auction({
      streamId,
      productId,
      startingBid: Number(startingBid),
      currentBid: Number(startingBid),
      bidIncrement: 1,
      startTime,
      endTime,
      suddenDeath: Boolean(suddenDeath),
      status: "ACTIVE",
    });

    await auction.save();

    stream.auctionIds = stream.auctionIds || [];
    stream.auctionIds.push(auction._id);
    await stream.save();

    emitToUser(stream.streamId.toString(), "auctionCreated", { auction });

    return res.status(201).json({ data: auction, msg: "Auction created" });
  } catch (error) {
    console.error("createAuction error", error);
    res.status(500).json({ error: error.message });
  }
};

const getAuctionsByStream = async (req, res) => {
  try {
    const { streamId } = req.params;
    const auctions = await Auction.find({ streamId }).populate("productId").populate("highestBidder");
    return res.status(200).json({ data: auctions, msg: "Auctions fetched" });
  } catch (error) {
    console.error("getAuctionsByStream error", error);
    res.status(500).json({ error: error.message });
  }
};

const getAuctionById = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id)
      .populate("productId")
      .populate("highestBidder")
      .populate("winnerId");
    if (!auction) return res.status(404).json({ error: "Auction not found" });
    return res.status(200).json({ data: auction, msg: "Auction fetched" });
  } catch (error) {
    console.error("getAuctionById error", error);
    res.status(500).json({ error: error.message });
  }
};

const endAuction = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ error: "Auction not found" });

    auction.status = "COMPLETED";
    auction.winnerId = auction.highestBidder || null;
    await auction.save();

    const stream = await LiveStream.findById(auction.streamId);
    if (stream) emitToUser(stream.streamId.toString(), "auctionEnded", { auction });

    let winner = null;
    if (auction.winnerId) winner = await AccountModel.findById(auction.winnerId);

    return res.status(200).json({ data: auction, msg: "Auction ended", winner });
  } catch (error) {
    console.error("endAuction error", error);
    res.status(500).json({ error: error.message });
  }
};

const placeBid = async (req, res) => {
  try {
    const { auctionId, bidderId, bidAmount } = req.body;

    if (!auctionId || !bidderId || !bidAmount) {
      return res.status(400).json({ error: "auctionId, bidderId and bidAmount are required" });
    }

    const auction = await Auction.findById(auctionId);
    if (!auction) return res.status(404).json({ error: "Auction not found" });

    if (auction.status !== "ACTIVE") {
      return res.status(400).json({ error: "Auction is not active" });
    }

    if (new Date() > auction.endTime) {
      auction.status = "COMPLETED";
      await auction.save();
      return res.status(400).json({ error: "Auction has ended" });
    }

    const currentBid = auction.currentBid || auction.startingBid;

    if (Number(bidAmount) <= currentBid) {
      return res.status(400).json({ error: "Bid must be higher than current bid" });
    }

    const newBidding = new Bidding({
      streamId: auction.streamId,
      auctionId,
      bidderId,
      bidAmount: Number(bidAmount),
    });

    await newBidding.save();

    auction.currentBid = Number(bidAmount);
    auction.highestBidder = bidderId;
    auction.bidHistory.push({ userId: bidderId, bid: Number(bidAmount), time: new Date() });

    if (auction.suddenDeath) {
      const remaining = auction.endTime - new Date();
      if (remaining <= 10000) {
        auction.endTime = new Date(auction.endTime.getTime() + 10000);
      }
    }

    await auction.save();

    const populatedBidding = await newBidding.populate("bidderId");
    emitToUser(auction.streamId.toString(), "newBidding", {
      auctionId: auction._id,
      bid: populatedBidding,
      currentBid: auction.currentBid,
      endTime: auction.endTime,
    });

    return res.status(200).json({ data: populatedBidding, msg: "Bid placed successfully" });
  } catch (error) {
    console.error("placeBid error", error);
    res.status(500).json({ error: error.message });
  }
};

const getAuctionBids = async (req, res) => {
  try {
    const { auctionId } = req.params;
    const bids = await Bidding.find({ auctionId }).populate("bidderId").sort({ bidAmount: -1, createdAt: 1 });
    return res.status(200).json({ data: bids, msg: "Auction bids fetched" });
  } catch (error) {
    console.error("getAuctionBids error", error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createAuction,
  getAuctionsByStream,
  getAuctionById,
  endAuction,
  placeBid,
  getAuctionBids,
};
