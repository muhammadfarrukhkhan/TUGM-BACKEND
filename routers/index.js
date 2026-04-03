const combineRouter = require("express").Router()


combineRouter.use("/account",require("./account.router"))
combineRouter.use("/product",require("./product.router"))
combineRouter.use("/category",require("./category.router"))
combineRouter.use("/order",require("./order.router"))
combineRouter.use("/payment",require("./payment.router"))
combineRouter.use("/stream",require("./stream.router"))
combineRouter.use("/auction",require("./auction.router"))
combineRouter.use("/bidding",require("./bidding.router"))
combineRouter.use("/shipment", require("./shipment.router"));
combineRouter.use("/story",require("./story.router"))
combineRouter.use("/gift",require("./gift.router"))
combineRouter.use("/gifts",require("./gifts.router"))
combineRouter.use("/notification",require("./notification.router"))
combineRouter.use("/price",require("./price.router"))
combineRouter.use("/ticket",require("./ticket.router"))
combineRouter.use("/term",require("./terms.router"))
combineRouter.use("/transaction/history",require("./transactionHistory.router"))
combineRouter.use("/battle",require("./battle.router"))
combineRouter.use("/chat",require("./chat.router"))
combineRouter.use("/post",require("./post.router"))
combineRouter.use("/auction",require("./auction.router"))




module.exports = combineRouter