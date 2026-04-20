const { AccountModel } = require("../models/account.model");
const bcrypt = require("bcryptjs")
const { uploadFile } = require("../utils/function");
const { TransactionHistoryModel } = require("../models/transactionHistory.model");
const { PriceModel } = require("../models/pricing.model");







const createAccount = async (req, res) => {
    try {
        let { username, email, password } = req.body
        console.log(email, 'email')
        let findUser = await AccountModel.findOne({ email })
        if (findUser) {
            return res.status(400).json({ data: null, msg: "Account already exits", code: 200 })
        }
        else {
            let hash = await bcrypt.hash(password, 10)
            let result = await AccountModel.create({ username, email, password: hash, registrationType: "normal" })
            return res.status(200).json({ data: result, msg: "Account Created Please Complete Your Profile", status: 200 })

        }
    }
    catch (error) {
        console.log(error)
    }
}
const createGoogleAccount = async (req, res) => {
    try {
        let { email, username } = req.body
        let findUser = await AccountModel.findOne({ email })
        if (findUser) {
            return res.status(400).json({ data: null, msg: "Account already exits", code: 400 })
        }
        else {
            let result = await AccountModel.create({ username, email, registrationType: "google" })
            return res.status(200).json({ data: result, msg: "Account Created Please Complete Your Profile", status: 200 })

        }
    }
    catch (error) {
        console.log(error)
    }
}
const loginAccount = async (req, res) => {
    try {
        let { email, password, } = req.body
        let findUser = await AccountModel.findOne({ email, registrationType: "normal" })
        if (!findUser) {
            return res.status(400).json({ data: null, msg: "Account not exits", code: 400 })
        }
        else {
            let compare = await bcrypt.compare(password, findUser.password)
            if (compare) {
                return res.status(200).json({ data: findUser, msg: "Login Sucessful", code: 200 })
            }
            else {
                return res.status(403).json({ data: null, msg: "Invalid credentails", code: 403 })
            }
        }
    }
    catch (error) {
        console.log(error)
    }
}
const loginGoogleAccount = async (req, res) => {
    try {
        let { email } = req.body
        let findUser = await AccountModel.findOne({ email, registrationType: "google" })
        if (!findUser) {
            return res.status(400).json({ data: null, msg: "Account not exits", code: 400 })
        }
        else {
            return res.status(200).json({ data: findUser, msg: "Login Sucessful", code: 200 })
        }
    }
    catch (error) {
        console.log(error)
    }
}

const switchProfileMode = async (req, res) => {
    try {
        let { id } = req.params
        let { sellerMode } = req.body
        let findUser = await AccountModel.findById(id)
        if (!findUser) {
            return res.status(400).json({ data: null, msg: "Account not exits invalid account id pass", code: 400 })
        }
        else {
            let result = await AccountModel.findByIdAndUpdate(id, { sellerMode: sellerMode }, { new: true })
            return res.status(200).json({ data: result, msg: "Profile Info Added", status: 200 })
        }
    }
    catch (error) {
        console.log(error)
    }
}

const getAccountById = async (req, res) => {
    try {
        let findUser = await AccountModel.findById(req.params.id)
        return res.status(200).json({ data: findUser, code: 200 })

    }
    catch (error) {
        console.log(error)
    }
}
const getAllAccount = async (req, res) => {
    try {
        let findUser = await AccountModel.find()
        return res.status(200).json({ data: findUser, code: 200 })

    }
    catch (error) {
        console.log(error)
    }
}

const uploadPicture = async (req, res) => {
    try {
        let { id } = req.params;
        let image = req.file
        let url = await uploadFile(image);
        let updateProfile = await AccountModel.findByIdAndUpdate(id, { profile: url }, { new: true })
        return res.status(200).json({ data: updateProfile, msg: "Profile Picture Updated" })
    }
    catch (error) {
        console.log(error)
    }
}

const assignBadge = async (req, res) => {
    try {
        let { id } = req.params;
        let image = req.file
        let url = await uploadFile(image);
        let updateBadge = await AccountModel.findByIdAndUpdate(id, { badge: url }, { new: true })
        return res.status(200).json({ data: updateBadge, msg: "Badge Updated" })
    }
    catch (error) {
        console.log(error)
    }
}

const followCreator = async (req, res) => {
    try {
        let { cid, uid } = req.params;
        let findCreator = await AccountModel.findById(cid);
        if (!findCreator) {
            return res.status(404).json({ msg: "Creator not found" });
        }

        let updateProfile = await AccountModel.findByIdAndUpdate(cid, { $addToSet: { followedBy: uid }, $inc: { followers: 1 } }, { new: true });
        return res.status(200).json({ data: updateProfile, msg: "Follow Successful" });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ msg: "Internal Server Error" });
    }
};

const buyCoins = async (req, res) => {
    try {
        let { id } = req.params;
        let { dollars } = req.body
        let findUser = await AccountModel.findById(id)
        // let addCoins = await AccountModel.findByIdAndUpdate(id, { coins: findUser?.coins + dollars * 10 }, { new: true })
          let addCoins = await AccountModel.findByIdAndUpdate(id, { coins: findUser?.coins + dollars  }, { new: true })
        await TransactionHistoryModel.create({ userId: id, amount: dollars })
        return res.status(200).json({ data: addCoins, msg: "Coins Buy Successfully" })
    }
    catch (error) {

    }
}

const subscribeUser = async (req, res) => {
    try {
        let { id } = req.params;
        const price = await PriceModel.findOne();
        let data = await AccountModel.findByIdAndUpdate(id, { isSubscribed: true }, { new: true })
        await TransactionHistoryModel.create({ userId: id, amount: price.subscriptionPrice, type: "Subscription" })
        return res.status(200).json({ data, msg: "Subscribed Successfully" })
    }
    catch (error) {

    }
}

const toggleBlockAccount = async (req, res) => {
    try {
        let { id } = req.params;
        let findUser = await AccountModel.findById(id);
        if (!findUser) return res.status(404).json({ msg: "User not found" });

        const updatedUser = await AccountModel.findByIdAndUpdate(
            id,
            { isBlocked: !findUser.isBlocked },
            { new: true }
        );
        return res.status(200).json({ data: updatedUser, msg: "Block status updated" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ msg: "Server error" });
    }
};


module.exports = { assignBadge, toggleBlockAccount, followCreator, uploadPicture, createAccount, loginAccount, getAccountById, getAllAccount, switchProfileMode, createGoogleAccount, loginGoogleAccount, buyCoins, subscribeUser }