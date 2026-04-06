const { generateZegoStream, uploadFile, generateAgoraToken } = require("../utils/function");
const LiveStream = require("../models/stream.model");
const Auction = require("../models/auction.model");
const Bidding = require("../models/bidding.model");
const BattleMessage = require("../models/battleMessage.model");
const { emitToUser } = require("../config/socket.config");
const { AccountModel } = require("../models/account.model");
const { default: mongoose } = require("mongoose");


const createStream = async (req, res) => {
    try {
        const {
            creatorId,
            productId,
            mode,
            duration,
            suddenDeath,
            endTime
        } = req.body;

        if (!creatorId || !productId) {
            return res.status(400).json({
                error: "creatorId and productId are required"
            });
        }

        const existingLive = await LiveStream.findOne({ productId, status: "LIVE" });
        if (existingLive) {
            return res.status(400).json({ error: "Stream already live for this product" });
        }
        // if (mode === "AUCTION") {
        //     if (!startingBid || !duration || isNaN(Number(duration))) {
        //         return res.status(400).json({
        //             error: "startingBid and valid duration are required for auction"
        //         });
        //     }
        // }

        let coverImage = null;
        if (req.file) {
            coverImage = await uploadFile(req.file);
        }

        const { streamId, token } = await generateZegoStream(creatorId);

        // const startTime = new Date();
        // let endTime = null;
        // if (mode === "AUCTION") {
        //     const durationSeconds = Number(duration);
        //     if (isNaN(durationSeconds) || durationSeconds <= 0) {
        //         return res.status(400).json({ error: "duration must be a positive number" });
        //     }
        //     endTime = new Date(startTime.getTime() + durationSeconds * 1000 + 1000);

        //     if (endTime <= startTime) {
        //         return res.status(400).json({ error: "endTime must be greater than startTime" });
        //     }
        //     if (mode === "AUCTION") {
        //         endTime = new Date(startTime.getTime() + durationSeconds * 1000 + 1000);
        //     }

        // }
        const startTime = new Date();
        const finalEndTime = endTime ? new Date(endTime) : null;

        const newStream = new LiveStream({
            creatorId,
            productId,
            mode: mode || "AUCTION",
            startTime,
            endTime: finalEndTime,
            suddenDeath: Boolean(suddenDeath),
            status: "LIVE",
            streamId,
            token,
            coverImage,
        });

        await newStream.save();

        res.status(201).json({
            data: newStream,
            msg: "Stream Started"
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getActive = async (req, res) => {
    try {
        const activeStreams = await LiveStream.find({ status: "active" }).populate("creatorId");
        res.status(200).json({ data: activeStreams, msg: "" });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
const getLive = async (req, res) => {
    try {
        const activeStreams = await LiveStream.find({ status: "LIVE" }).populate("creatorId");
        res.status(200).json({ data: activeStreams, msg: "" });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
const getCreatorActiveStream = async (req, res) => {
    try {
        const activeStreams = await LiveStream.findOne({ streamId: req?.params?.id }).populate("creatorId").populate("productId")
        res.status(200).json({ data: activeStreams, msg: "" });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// const endStream = async (req, res) => {
//     try {
//         // Find the stream by its streamId
//         const stream = await LiveStream.findOne({ streamId: req.params.id });
//         console.log(stream, 'stream of end stream');

//         if (!stream) {
//             return res.status(404).json({ error: "Stream not found" });
//         }

//         // Set the winnerId to highestBidder and mark stream as completed
//         stream.status = "COMPLETED";
//         stream.winnerId = stream.highestBidder || null;

//         let winnerName = null;
//         let winnerImage = null;
//         if (stream.winnerId) {
//             // Fetch winner details from Account/User model
//             const winner = await AccountModel.findById(stream.winnerId);
//             winnerImage = winner?.profile || null;
//             winnerName = winner ? winner.username : null; // or use firstName + lastName if applicable
//         }

//         await stream.save();

//         // Emit the auction ended event to the user
//         emitToUser(stream.streamId.toString(), "auctionEnded", {
//             winnerId: stream.winnerId,
//             winnerName: winnerName,
//             finalPrice: stream.currentBid
//         });

//         return res.status(200).json({
//             data: stream,
//             msg: "Stream Ended",
//             winner: {
//                 id: stream.winnerId,
//                 name: winnerName,
//                 Image: winnerImage
//             }
//         });

//     } catch (error) {
//         console.error('Error ending stream:', error);
//         res.status(500).json({ error: error.message });
//     }
// };

const endStream = async (req, res) => {
    try {
        const { id: streamId } = req.params;

        // 1️⃣ Find the stream
        const stream = await LiveStream.findOne({ streamId });
        console.log(stream, 'stream of end stream');

        if (!stream) {
            return res.status(404).json({ error: "Stream not found" });
        }

        // 2️⃣ Update stream status and winner
        stream.status = "COMPLETED";
        stream.winnerId = stream.highestBidder || null;

        let winnerName = null;
        let winnerImage = null;

        if (stream.winnerId) {
            const winner = await AccountModel.findById(stream.winnerId);
            winnerImage = winner?.profile || null;
            winnerName = winner ? winner.username : null; // or firstName + lastName
        }

        await stream.save();

        // 3️⃣ Update all active auctions of this stream to COMPLETED
        const updatedAuctions = await Auction.updateMany(
            { streamId: stream._id, status: "ACTIVE" },
            { $set: { status: "COMPLETED" } }
        );

        console.log("Auctions updated:", updatedAuctions.modifiedCount);

        // 4️⃣ Emit auction ended event
        emitToUser(stream.streamId.toString(), "auctionEnded", {
            winnerId: stream.winnerId,
            winnerName,
            finalPrice: stream.currentBid
        });

        // 5️⃣ Respond to client
        return res.status(200).json({
            data: stream,
            msg: "Stream ended successfully",
            winner: {
                id: stream.winnerId,
                name: winnerName,
                image: winnerImage
            },
            auctionsUpdated: updatedAuctions.modifiedCount
        });

    } catch (error) {
        console.error('Error ending stream:', error);
        res.status(500).json({ error: error.message });
    }
};
const getSingle = async (req, res) => {
    try {
        const stream = await LiveStream.findById(req.params.id);
        return res.status(200).json({ data: stream, msg: "", status: 200 });
    }
    catch (error) {
        console.error("Error deleting note:", error);
        return { success: false, msg: "Failed to delete note" };
    }
};

const getToken = async (req, res) => {
    try {
        let id = req.params.id
        let role = req.params.role
        let token = await generateAgoraToken(id, role)
        return res.status(200).json({ data: token })
    }
    catch (error) {
        console.log(error)
    }
}

const createMessage = async (req, res) => {
    try {
        const { streamId, userId, message, auctionId } = req.body;
        if (!streamId || !userId || !message) {
            return res.status(400).json({ error: "streamId, userId and message are required" });
        }
        console.log(streamId, userId, message, auctionId, 'message details')
        const newMessage = new BattleMessage({ streamId, userId, message, auctionId });
        await newMessage.save();
        const populatedMessage = await BattleMessage.findById(newMessage._id).populate("userId");
        emitToUser(streamId.toString(), "newMessage", populatedMessage);
        res.status(200).json({ data: populatedMessage, msg: "Message sent" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
const getMessages = async (req, res) => {
    try {
        const { streamId } = req.params;
        const messages = await BattleMessage.find({ $or: [{ streamId }, { auctionId: streamId }] }).populate("userId").sort({ createdAt: 1 });
        res.status(200).json({ data: messages, msg: "Messages fetched" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};



const increaseBiddingTimer = async (req, res) => {
    try {
        const { streamId, biddingEndTime } = req.body;
        const stream = await LiveStream.findById(streamId);
        const activeAuctions = await Auction.find({
            streamId: stream._id,
            status: "ACTIVE",
            //             // $or: [
            //             //     { currentEndTime: { $gt: now } },
            //             //     { currentEndTime: null } // Include auctions without currentEndTime
            //             // ]
        })
        if (!stream) return res.status(404).json({ error: "Stream not found" });
        console.log('auction details:', activeAuctions);
        const now = Date.now();
        const nowTime = new Date(now).getTime()
        const currentEnd = new Date(stream.endTime).getTime();
        const currentaucEnd = new Date(activeAuctions[0]?.endTime).getTime();
        const currentDate = new Date(stream?.endTime)
        console.log("Now:", new Date());
        console.log("Current endTime:", stream.endTime);
        let isExceeded = currentaucEnd <= nowTime ? true : false
        console.log(isExceeded)
        if (currentEnd <= nowTime)
            return res.status(400).json({ error: "Auction already ended" });
        if (biddingEndTime <= 0) {
            return res.status(400).json({ error: "biddingEndTime must be positive" });
        }
        // Extend the current endTime
        stream.endTime = new Date(currentEnd + biddingEndTime * 1000);
        activeAuctions?.forEach(auction => {
            auction.currentEndTime = stream.endTime;
            auction.save();
        });
        await stream.save();

        emitToUser(stream.streamId.toString(), "biddingTimeUpdated", {
            endTime: stream.endTime
        });

        res.status(200).json({
            data: stream,
            msg: "Bidding time extended"
        });


    } catch (error) {
        console.log(error);
        res.status(500).json({ error: `Internal server error ${error}` });
    }
};


// const createBidding = async (req, res) => {
//     try {
//         const { streamId, bidderId, bidAmount, auctionId } = req.body;

//         if (!streamId || !bidderId || !bidAmount) {
//             return res.status(400).json({
//                 error: "streamId, bidderId and bidAmount are required"
//             });
//         }

//         const stream = await LiveStream.findById(streamId);

//         if (!stream) {
//             return res.status(404).json({ error: "Stream not found" });
//         }

//         // 1️⃣ Check mode
//         if (stream.mode !== "AUCTION") {
//             return res.status(400).json({
//                 error: "Bidding not allowed in Buy Now mode"
//             });
//         }

//         // 2️⃣ Check status
//         if (stream.status !== "LIVE") {
//             return res.status(400).json({
//                 error: "Auction is not active"
//             });
//         }

//         // 3️⃣ Check expiration
//         if (new Date() > stream.endTime) {
//             stream.status = "COMPLETED";
//             await stream.save();

//             return res.status(400).json({
//                 error: "Auction has ended"
//             });
//         }

//         // 4️⃣ Validate bid amount
//         if (Number(bidAmount) <= stream.currentBid) {
//             return res.status(400).json({
//                 error: "Bid must be higher than current bid"
//             });
//         }

//         // 5️⃣ Save bid
//         const newBidding = new Bidding({
//             streamId,
//             auctionId,
//             bidderId,
//             bidAmount: Number(bidAmount)
//         });
// console.log(newBidding, 'new bidding')
//         await newBidding.save();

//         // 6️⃣ Update stream
//         stream.currentBid = Number(bidAmount);
//         stream.highestBidder = bidderId;

//         // 7️⃣ Sudden death logic
//         if (stream.suddenDeath) {
//             const remaining =
//                 new Date(stream.endTime) - new Date();

//             if (remaining <= 10000) {
//                 // extend 10 seconds
//                 stream.endTime = new Date(
//                     new Date(stream.endTime).getTime() + 10000
//                 );
//             }
//         }

//         await stream.save();

//         const populatedBidding =
//             await newBidding.populate("bidderId");

//         // Emit real-time update
//         emitToUser(stream.streamId.toString(), "newBidding", {
//             bid: populatedBidding,
//             currentBid: stream.currentBid,
//             endTime: stream.endTime
//         });

//         return res.status(200).json({
//             data: populatedBidding,
//             msg: "Bid placed successfully"
//         });

//     } catch (error) {
//         console.log(error);
//         return res.status(500).json({
//             error: "Internal server error"
//         });
//     }
// };

// const increaseBiddingTimer = async (req, res) => {
//     try {
//         const { streamId, biddingEndTime } = req.body;

//         if (biddingEndTime <= 0) {
//             return res.status(400).json({ error: "biddingEndTime must be positive" });
//         }

//         // Find live stream
//         const stream = await LiveStream.findById(streamId);
//         if (!stream) return res.status(404).json({ error: "Stream not found" });

//         const now = Date.now();

//         // Find active auction(s) for this stream
//         const activeAuctions = await Auction.find({
//             streamId: stream._id,
//             status: "ACTIVE",
//             // $or: [
//             //     { currentEndTime: { $gt: now } },
//             //     { currentEndTime: null } // Include auctions without currentEndTime
//             // ]
//         })
//             .populate("productId")
//             .populate("winnerId")
//             .populate("highestBidder");

//         if (!activeAuctions.length) {
//             return res.status(400).json({ error: "No active auctions. Auction already ended." });
//         }

//         // Ensure all auctions have a valid currentEndTime
//         for (let auction of activeAuctions) {
//             if (!auction.endTime) {
//                 auction.endTime = stream.endTime || new Date(now);
//                 await auction.save();
//             }
//         }

//         // Compute the latest end time
//         const latestEndTime = Math.max(...activeAuctions.map(a => a.endTime.getTime()));
//         const newEndTime = new Date(latestEndTime + biddingEndTime * 1000);

//         // Update stream endTime if smaller than newEndTime
//         if (!stream.endTime || newEndTime > stream.endTime.getTime()) {
//             stream.endTime = newEndTime;
//             await stream.save();
//         }

//         // Update currentEndTime for all active auctions
//         await Auction.updateMany(
//             { _id: { $in: activeAuctions.map(a => a._id) } },
//             { $set: { currentEndTime: newEndTime } }
//         );

//         // Notify users about updated bidding time
//         emitToUser(stream.streamId.toString(), "biddingTimeUpdated", {
//             endTime: newEndTime
//         });

//         res.status(200).json({
//             data: { stream, activeAuctions },
//             msg: "Bidding time extended"
//         });

//     } catch (error) {
//         console.log(error);
//         res.status(500).json({ error: `Internal server error: ${error.message}` });
//     }
// };
const createBidding = async (req, res) => {
  try {
    const { streamId, bidderId, bidAmount, auctionId } = req.body;
    if (!streamId || !bidderId || !bidAmount || !auctionId)
      return res.status(400).json({ error: "All fields are required" });

    if (!mongoose.Types.ObjectId.isValid(streamId) ||
        !mongoose.Types.ObjectId.isValid(bidderId) ||
        !mongoose.Types.ObjectId.isValid(auctionId))
      return res.status(400).json({ error: "Invalid IDs" });

    const stream = await LiveStream.findById(streamId);
    if (!stream) return res.status(404).json({ error: "Stream not found" });
    if (stream.mode !== "AUCTION") return res.status(400).json({ error: "Bidding not allowed" });
    if (stream.status !== "LIVE") return res.status(400).json({ error: "Stream not live" });

    const auction = await Auction.findById(auctionId);
    if (!auction || auction.status !== "ACTIVE") return res.status(400).json({ error: "Auction inactive" });

    const numericBid = Number(bidAmount);
    if (isNaN(numericBid) || numericBid <= (auction.currentBid || auction.startingBid))
      return res.status(400).json({ error: "Bid too low" });

    // Atomic update to prevent race condition
    const updatedAuction = await Auction.findOneAndUpdate(
      { _id: auctionId, currentBid: { $lt: numericBid }, status: "ACTIVE" },
      { $set: { currentBid: numericBid, highestBidder: bidderId }, $push: { bidHistory: { userId: bidderId, bid: numericBid } } },
      { new: true }
    );

    if (!updatedAuction) return res.status(400).json({ error: "Bid must be higher than current bid" });

    // Sudden death
    if (auction.suddenDeath) {
      const remainingTime = new Date(auction.endTime) - new Date();
      if (remainingTime <= 10000) auction.endTime = new Date(new Date(auction.endTime).getTime() + 10000);
      await auction.save();
    }

    emitToUser(streamId.toString(), "newBidding", {
      bid: updatedAuction,
      currentBid: updatedAuction.currentBid,
      endTime: updatedAuction.endTime,
    });

    return res.status(200).json({ data: updatedAuction, msg: "Bid placed successfully" });
  } catch (error) {
    console.error("❌ createBidding error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// const createBidding = async (req, res) => {
//     try {
//         const { streamId, bidderId, bidAmount, auctionId } = req.body;
//         console.log(streamId, bidderId, bidAmount, auctionId, 'bidding details')
//         // ✅ 1. Required field validation
//         if (!streamId || !bidderId || !bidAmount || !auctionId) {
//             return res.status(400).json({
//                 error: "streamId, bidderId, bidAmount and auctionId are required"
//             });
//         }

//         // ✅ 2. Validate ObjectIds
//         if (
//             !mongoose.Types.ObjectId.isValid(streamId) ||
//             !mongoose.Types.ObjectId.isValid(bidderId) ||
//             !mongoose.Types.ObjectId.isValid(auctionId)
//         ) {
//             return res.status(400).json({
//                 error: "Invalid streamId, bidderId or auctionId"
//             });
//         }

//         // ✅ 3. Fetch stream
//         const stream = await LiveStream.findById(streamId);
//         const activeAuctions = await Auction.find({
//             streamId: stream._id,
//             status: "ACTIVE",
//         })
//         if (!stream) {
//             return res.status(404).json({ error: "Stream not found" });
//         }

//         // ✅ 4. Check auction mode
//         if (stream.mode !== "AUCTION") {
//             return res.status(400).json({
//                 error: "Bidding not allowed in Buy Now mode"
//             });
//         }

//         // ✅ 5. Check stream status
//         if (stream.status !== "LIVE") {
//             return res.status(400).json({
//                 error: "Auction is not active"
//             });
//         }

//         // ✅ 6. Check expiration
//         if (new Date() > new Date(stream.endTime)) {
//             stream.status = "COMPLETED";
//             await stream.save();

//             return res.status(400).json({
//                 error: "Auction has ended"
//             });
//         }

//         // ✅ 7. Validate bid amount
//         const numericBid = Number(bidAmount);

//         if (isNaN(numericBid)) {
//             return res.status(400).json({
//                 error: "Invalid bid amount"
//             });
//         }

//         if (numericBid <= stream.currentBid) {
//             return res.status(400).json({
//                 error: "Bid must be higher than current bid"
//             });
//         }

//         // ✅ 8. Create bidding
//         const newBidding = new Bidding({
//             streamId: streamId, // keeping as string if your schema expects string
//             auctionId: new mongoose.Types.ObjectId(auctionId),
//             bidderId: new mongoose.Types.ObjectId(bidderId),
//             bidAmount: numericBid
//         });

//         console.log("📦 New bidding:", newBidding);

//         const savedBidding = await newBidding.save();

//         // ✅ 9. Update stream
//         stream.currentBid = numericBid;
//         stream.highestBidder = bidderId;

//         // ✅ 10. Sudden death logic
//         if (stream.suddenDeath) {
//             const remainingTime = new Date(stream.endTime) - new Date();

//             if (remainingTime <= 10000) {
//                 stream.endTime = new Date(
//                     new Date(stream.endTime).getTime() + 10000
//                 );
//             }
//         }

//         await stream.save();

//         // ✅ 11. Populate bidder info
//         const populatedBidding = await Bidding.findById(savedBidding._id)
//             .populate("bidderId");

//         // ✅ 12. Emit real-time event
//         emitToUser(streamId.toString(), "newBidding", {
//             bid: populatedBidding,
//             currentBid: stream.currentBid,
//             endTime: stream.endTime
//         });

//         // ✅ 13. Success response
//         return res.status(200).json({
//             data: populatedBidding,
//             msg: "Bid placed successfully"
//         });

//     } catch (error) {
//         console.error("❌ Error in createBidding:", error);

//         return res.status(500).json({
//             error: "Internal server error"
//         });
//     }
// };
const getAllBidding = async (req, res) => {
    try {
        const { streamId } = req.params; // e.g., 'stream_6992ea5e8d040b1d00b77a25_1771526681674'
        // console.log(streamId, 'streamId of get all bidding')
        const biddings = await Bidding
            .find({ streamId }) // use the full key exactly as stored
            .populate("bidderId")
            .sort({ bidAmount: -1, createdAt: 1 }); // tie-break by earliest bid

        res.status(200).json({ data: biddings, msg: "Biddings fetched" });

    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
};
const getUserStreams = async (req, res) => {
    try {
        const activeStreams = await LiveStream.find({ creatorId: req?.params?.id }).populate("productId")
        res.status(200).json({ data: activeStreams, msg: "" });
    } catch (error) {
        console.log(error)
    }
}

module.exports = { increaseBiddingTimer, createBidding, getAllBidding, createStream, getActive, getLive, getSingle, endStream, getCreatorActiveStream, getToken, createMessage, getMessages, getUserStreams };
