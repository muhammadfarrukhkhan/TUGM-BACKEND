const router = require("express").Router()
const { getAllBidding, getBiddingsByAuctionAndStream } = require("../services/bidding.service")

router.get("/all/:id", getAllBidding)
router.get("/by-auction-stream", getBiddingsByAuctionAndStream)

module.exports = router