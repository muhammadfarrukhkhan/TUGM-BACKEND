const { AccountModel } = require("../models/account.model");
const { GiftModel } = require("../models/gift.model");
const mongoose = require("mongoose");
const { GiftsModel } = require("../models/gifts.model");

const createGift = async (req, res) => {
    try {
        // console.log(req.body, 'gift body')
        let { userId, streamId, image } = req.body;
        // let user = await AccountModel.findById(userId);
        const giftItem = await GiftsModel.findById(image);
        console.log(giftItem, 'gift item')
        if (!giftItem) {
            return res.status(400).json({ msg: "Invalid gift" });
        }
        const coins = giftItem.coin;
        const user = await AccountModel.findOneAndUpdate(
            { _id: userId, coins: { $gte: coins } },
            { $inc: { coins: -coins } },
            { new: true }
        );
        // console.log(user, 'gift user after deduction')
        if (!user) {
            return res.status(400).json({ msg: "Not enough coins" });
        }
        // console.log(user, 'gift user')

        let data = await GiftModel.create(req?.body)
        console.log(res, 'gift send')
        return res.status(200).json({ data, msg: "Gift Send", status: 200 });


    }
    catch (error) {
        console.log(error)
    }
}


// const createGift = async (req, res) => {
//   const session = await mongoose.startSession();

//   try {
//     const { userId, streamId, giftId, coins } = req.body;

//     // Validate
//     if (!mongoose.Types.ObjectId.isValid(userId)) {
//       return res.status(400).json({ msg: "Invalid userId" });
//     }

//     if (!coins || coins <= 0) {
//       return res.status(400).json({ msg: "Invalid coin amount" });
//     }

//     session.startTransaction();

//     // ✅ Atomic coin deduction
//     const user = await AccountModel.findOneAndUpdate(
//       {
//         _id: userId,
//         coins: { $gte: coins } // only update if enough balance
//       },
//       {
//         $inc: { coins: -coins }
//       },
//       { new: true, session }
//     );
// console.log(user,'gift user after deduction')
//     if (!user) {
//       await session.abortTransaction();
//       return res.status(400).json({ msg: "Not enough coins" });
//     }

//     // ✅ Create gift
//     const gift = await GiftModel.create(
//       [
//         {
//           userId,
//           streamId,
//           giftId,
//           coins
//         }
//       ],
//       { session }
//     );
// console.log(gift,'gift created')
//     await session.commitTransaction();

//     return res.status(200).json({
//       data: gift[0],
//       remainingCoins: user.coins,
//       msg: "Gift sent successfully"
//     });
// console.log(res, 'gift transaction completed')
//   } catch (error) {
//     await session.abortTransaction();
//     console.error(error);

//     return res.status(500).json({
//       msg: "Internal server error"
//     });
//   } finally {
//     session.endSession();
//   }
// };
const getGift = async (req, res) => {
    try {
        let { userId, streamId } = req.params;
        let gift = await GiftModel.findOne({ streamId, viewers: { $ne: userId } }).populate("userId").sort({ createdAt: -1 });
        console.log(gift, 'gift')

        if (!gift) {
            return res.status(200).json({ msg: "No available gifts", status: 404 });
        }
        gift.viewers.push(userId);
        await gift.save();
        return res.status(200).json({ data: gift, msg: "Gift retrieved", status: 200 });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ msg: "Internal Server Error", status: 500 });
    }
};
const getAll = async (req, res) => {
    try {
        let gift = await GiftModel.find({}).populate("userId").sort({ createdAt: -1 });
        return res.status(200).json({ data: gift, msg: "Gift retrieved", status: 200 });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ msg: "Internal Server Error", status: 500 });
    }
};
const getGiftHost = async (req, res) => {
    try {
        let { userId, streamId } = req.params;
        console.log(userId, streamId)
        let gift = await GiftModel.findOne({ streamId, viewers: { $ne: userId } }).populate("userId").sort({ createdAt: -1 });
        console.log(gift, 'gift')

        if (!gift) {
            return res.status(200).json({ msg: "No available gifts", status: 404 });
        }
        gift.viewers.push(userId);
        await gift.save();
        return res.status(200).json({ data: gift, msg: "Gift retrieved", status: 200 });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ msg: "Internal Server Error", status: 500 });
    }
};

module.exports = { createGift, getGift, getGiftHost, getAll }