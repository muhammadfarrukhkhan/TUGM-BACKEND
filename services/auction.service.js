const Auction = require("../models/auction.model");
const LiveStream = require("../models/stream.model");
const Bidding = require("../models/bidding.model");
const { emitToUser } = require("../config/socket.config");
const { AccountModel } = require("../models/account.model");

const mongoose = require("mongoose");


const createAuction = async (req, res) => {
  try {
    const { streamId, productId, startingBid, duration, suddenDeath } = req.body;

    console.log("CREATE AUCTION BODY:", req.body);

    // -----------------------------
    // 1️⃣ Validate Inputs
    // -----------------------------
    if (!streamId || !startingBid || !duration) {
      return res.status(400).json({
        success: false,
        error: "streamId, startingBid and duration are required"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(streamId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid streamId"
      });
    }

    const stream = await LiveStream.findById(streamId);
    if (!stream) {
      return res.status(404).json({ success: false, error: "Stream not found" });
    }

    if (stream.status !== "LIVE") {
      return res.status(400).json({
        success: false,
        error: `Stream is not live. Current status: ${stream.status}`
      });
    }

    const bid = Number(startingBid);
    const durationSeconds = Number(duration);

    if (isNaN(bid) || bid <= 0) {
      return res.status(400).json({ success: false, error: "startingBid must be positive" });
    }

    if (isNaN(durationSeconds) || durationSeconds <= 0) {
      return res.status(400).json({ success: false, error: "duration must be positive seconds" });
    }

    // -----------------------------
    // 2️⃣ Close Existing Active Auction
    // -----------------------------
    const existingAuction = await Auction.findOne({ streamId, status: "ACTIVE" });

    if (existingAuction) {
      console.log("Closing existing auction:", existingAuction._id);

      const highestBid = await Bidding.findOne({ auctionId: existingAuction._id })
        .sort({ bidAmount: -1 })
        .populate("bidderId");

      let winnerData = null;

      if (highestBid && highestBid.bidderId) {
        // ✅ Auction had a winner
        winnerData = {
          bidder: highestBid.bidderId,
          amount: highestBid.bidAmount
        };
        existingAuction.status = "COMPLETED";
        existingAuction.winner = highestBid.bidderId._id;
        existingAuction.finalBid = highestBid.bidAmount;
      } else {
        // ❌ No valid bids → cancelled
        existingAuction.status = "CANCELLED";
        existingAuction.winner = null;
        existingAuction.finalBid = existingAuction.currentBid;
      }

      await existingAuction.save();

      // Emit event to clients
      emitToUser(stream.streamId.toString(), "auctionEnded", {
        auctionId: existingAuction._id,
        status: existingAuction.status,
        winner: winnerData
      });
    }

    // -----------------------------
    // 3️⃣ Create New Auction
    // -----------------------------
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + durationSeconds * 1000);

    const auction = new Auction({
      streamId,
      productId,
      startingBid: bid,
      currentBid: bid,
      bidIncrement: 1,
      startTime,
      endTime,
      suddenDeath: Boolean(suddenDeath),
      status: "ACTIVE"
    });

    await auction.save();

    // Attach auction to stream
    stream.auctionIds = stream.auctionIds || [];
    stream.auctionIds.push(auction._id);
    await stream.save();

    // Emit event for new auction
    emitToUser(stream.streamId.toString(), "auctionCreated", { auction });

    // -----------------------------
    // 4️⃣ Response
    // -----------------------------
    return res.status(201).json({
      success: true,
      data: auction,
      msg: "Auction created successfully"
    });

  } catch (error) {
    console.error("CREATE AUCTION ERROR:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
// const getAuctionsByStream = async (req, res) => {
//   try {
//     const { streamId } = req.params;
//     console.log(streamId, 'stream id')

//     const auctions = await Auction.find({ streamId }).populate("productId").populate("highestBidder");
//     return res.status(200).json({ data: auctions, msg: "Auctions fetched" });
//   } catch (error) {
//     console.error("getAuctionsByStream error", error);
//     console.log(error)
//     res.status(500).json({ error: error.message });
//   }
// };
const getAuctionsByStream = async (req, res) => {
  try {
    const { streamId } = req.params;
    // console.log("Fetching auctions for streamId:", streamId);

    if (!streamId) {
      return res.status(400).json({ error: "streamId is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(streamId)) {
      return res.status(400).json({ error: "Invalid streamId" });
    }

    const activeAuctions = await Auction.find({
      streamId,
      status: "ACTIVE"
    })
      .populate("productId")
      .populate("highestBidder"); // make sure this field exists

    console.log("Active auctions fetched:", activeAuctions.length);

    return res.status(200).json({
      success: true,
      data: activeAuctions,
      msg: "Active auctions fetched"
    });
  } catch (error) {
    console.error("getAuctionsByStream error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Internal server error"
    });
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
