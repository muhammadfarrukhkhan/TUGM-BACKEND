const { ShipmentModel } = require("../models/shipment.models");
const { AccountModel } = require("../models/account.model");
const { ProductModel } = require("../models/product.model");
const LiveStream = require("../models/stream.model");

const createShipment = async (req, res) => {
    console.log("Create shipment request body:", req.body);
    try {
        const {
            streamId,
            bidderId,
            sellerId,
            productId,
            biddingId,
            bidAmount,
            quantity,
            customer_address,
            city,
            state,
            country,
            zip,
            total,
            status,
        } = req.body;

        // Validate required fields
        if (!bidderId || !sellerId || !productId) {
            return res.status(400).json({
                status: 400,
                message: "Missing required fields: bidderId, sellerId, productId",
            });
        }

        // Check if bidder and seller exist
        const bidder = await AccountModel.findById(bidderId);
        const seller = await AccountModel.findById(sellerId);
        const product = await ProductModel.findById(productId);

        if (!bidder) {
            return res.status(404).json({
                status: 404,
                message: "Bidder not found",
            });
        }

        if (!seller) {
            return res.status(404).json({
                status: 404,
                message: "Seller not found",
            });
        }

        if (!product) {
            return res.status(404).json({
                status: 404,
                message: "Product not found",
            });
        }

        // Check for duplicate shipment if streamId is provided
        if (streamId) {
            const existingShipment = await ShipmentModel.findOne({
                streamId,
                bidderId,
                sellerId,
            });
console.log("Existing shipment check:", existingShipment);
            if (existingShipment) {
                return res.status(400).json({
                    status: 400,
                    message: "Shipment already exists for this auction",
                });
            }
        }

        // Create shipment record
        const shipment = new ShipmentModel({
            streamId: streamId || null,
            bidderId,
            sellerId,
            productId,
            biddingId: biddingId || null,
            quantity: quantity || 1,
            total: total || bidAmount,
            customer_address: customer_address || "Address to be confirmed",
            city: city || "",
            state: state || "",
            country: country || "",
            zip: zip || "00000",
            status: status || "pending",
            trackingId: null,
        });

        const savedShipment = await shipment.save();
console.log("Shipment created:", savedShipment);
        // Populate references
        await savedShipment.populate([
            { path: "bidderId", select: "username email profile" },
            { path: "sellerId", select: "username email profile" },
            { path: "productId", select: "title images price description" },
            { path: "streamId", select: "startingBid status" },
        ]);

        // If this is an auction shipment, update the stream
        if (streamId) {
            await LiveStream.findByIdAndUpdate(
                streamId,
                {
                    status: "ended",
                    winnerId: bidderId,
                    shipmentId: savedShipment._id,
                },
                { new: true }
            );
        }

        res.status(201).json({
            status: 201,
            message: "Shipment created successfully",
            data: savedShipment,
        });
    } catch (error) {
        console.error("Shipment creation error:", error);
        res.status(500).json({
            status: 500,
            message: "Error creating shipment",
            error: error.message,
        });
    }
};

const getSellerShipments = async (req, res) => {
    try {
        const { sellerId } = req.params;

        // Validate seller exists
        const seller = await AccountModel.findById(sellerId);
        if (!seller) {
            return res.status(404).json({
                status: 404,
                message: "Seller not found",
            });
        }

        const shipments = await ShipmentModel.find({ sellerId })
            .populate("bidderId", "username email profile")
            .populate("productId", "title images price description")
            .populate("streamId", "startingBid status")
            .sort({ createdAt: -1 });

        res.status(200).json({
            status: 200,
            message: "Seller shipments retrieved",
            data: shipments,
        });
    } catch (error) {
        res.status(500).json({
            status: 500,
            message: "Error fetching shipments",
            error: error.message,
        });
    }
};

const getBuyerShipments = async (req, res) => {
    try {
        const { bidderId } = req.params;

        // Validate bidder exists
        const bidder = await AccountModel.findById(bidderId);
        if (!bidder) {
            return res.status(404).json({
                status: 404,
                message: "Bidder not found",
            });
        }

        const shipments = await ShipmentModel.find({ bidderId })
            .populate("sellerId", "username email profile")
            .populate("productId", "title images price")
            .populate("streamId", "startingBid")
            .sort({ createdAt: -1 });

        res.status(200).json({
            status: 200,
            message: "Buyer shipments retrieved",
            data: shipments,
        });
    } catch (error) {
        res.status(500).json({
            status: 500,
            message: "Error fetching shipments",
            error: error.message,
        });
    }
};

const getSingleShipment = async (req, res) => {
    try {
        const { shipmentId } = req.params;

        const shipment = await ShipmentModel.findById(shipmentId)
            .populate("bidderId", "username email profile address")
            .populate("sellerId", "username email profile")
            .populate("productId", "title images price description")
            .populate("streamId");

        if (!shipment) {
            return res.status(404).json({
                status: 404,
                message: "Shipment not found",
            });
        }

        res.status(200).json({
            status: 200,
            message: "Shipment retrieved",
            data: shipment,
        });
    } catch (error) {
        res.status(500).json({
            status: 500,
            message: "Error fetching shipment",
            error: error.message,
        });
    }
};

const updateShipmentStatus = async (req, res) => {
    try {
        const { shipmentId } = req.params;
        const { status, trackingId } = req.body;

        // Validate status is valid enum value
        const validStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                status: 400,
                message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
            });
        }

        const shipment = await ShipmentModel.findByIdAndUpdate(
            shipmentId,
            {
                status,
                trackingId: trackingId || null,
                updatedAt: new Date(),
            },
            { new: true }
        );

        if (!shipment) {
            return res.status(404).json({
                status: 404,
                message: "Shipment not found",
            });
        }

        res.status(200).json({
            status: 200,
            message: "Shipment status updated",
            data: shipment,
        });
    } catch (error) {
        res.status(500).json({
            status: 500,
            message: "Error updating shipment",
            error: error.message,
        });
    }
};

const cancelShipment = async (req, res) => {
    try {
        const { shipmentId } = req.params;

        const shipment = await ShipmentModel.findByIdAndUpdate(
            shipmentId,
            { status: "cancelled", updatedAt: new Date() },
            { new: true }
        );

        if (!shipment) {
            return res.status(404).json({
                status: 404,
                message: "Shipment not found",
            });
        }

        res.status(200).json({
            status: 200,
            message: "Shipment cancelled",
            data: shipment,
        });
    } catch (error) {
        res.status(500).json({
            status: 500,
            message: "Error cancelling shipment",
            error: error.message,
        });
    }
};

module.exports = {
    createShipment,
    getSellerShipments,
    getBuyerShipments,
    getSingleShipment,
    updateShipmentStatus,
    cancelShipment,
};