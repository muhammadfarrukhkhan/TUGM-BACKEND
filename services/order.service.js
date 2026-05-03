const { OrderModel } = require("../models/order.model");
const axios = require("axios");
const { uploadFile } = require("../utils/function");
const { Buffer } = require("buffer");
const fs = require("fs")
const path = require("path")
const createOrder = async (req, res) => {
    try {
        const { userId, product, customer_address, pickup_station, city, state, zip, country } = req.body;
        console.log(req.body, 'req.body');

        for (let index = 0; index < product.length; index++) {
            const element = product[index];
            console.log(element, 'element');
            const Order = new OrderModel({
                userId,
                productId: element?._id,
                sellerId: element?.userId,
                customer_address,
                pickup_station,
                quantity: element?.quantity,
                total: element?.quantity * element?.price,
                city, state, zip, country
            });

            await Order.save();
        }

        return res.status(200).json({ data: [], msg: "Order and shipment created successfully", status: 200 });
    } catch (error) {
        console.error("Error creating order/shipment:", error.response?.data || error.message);
        return res.status(500).json({ success: false, msg: "Failed to create order/shipment" });
    }
};

const getOrderForSeller = async (req, res) => {
    try {
        const Order = await OrderModel.find({ sellerId: req?.params?.id })
            .populate("userId")
            .populate("productId")
            .sort({ createdAt: -1 }); // 🕒 latest first
        console.log(Order, 'Order');
        return res.status(200).json({ data: Order, msg: "", status: 200 });
    } catch (error) {
        console.error("Error fetching orders for seller:", error);
        return res.status(500).json({ success: false, msg: "Failed to fetch orders for seller" });
    }
};

const getOrderForUser = async (req, res) => {
    try {
        const Order = await OrderModel.find({ userId: req?.params?.id })
            .populate("sellerId")
            .populate("productId")
            .sort({ createdAt: -1 }); // 🕒 latest first
        console.log(Order, 'User Order');
        return res.status(200).json({ data: Order, msg: "", status: 200 });
    } catch (error) {
        console.error("Error fetching orders for user:", error);
        return res.status(500).json({ success: false, msg: "Failed to fetch orders for user" });
    }
};

const getSingleOrder = async (req, res) => {
    try {
        const Order = await OrderModel.findById(req?.params?.id)
            .populate("userId")
            .populate("sellerId")
            .populate("productId");

        if (!Order) {
            return res.status(404).json({ msg: "Order not found", status: 404 });
        }

        return res.status(200).json({ data: Order, msg: "", status: 200 });
    } catch (error) {
        console.error("Error fetching order:", error);
        return res.status(500).json({ success: false, msg: "Failed to fetch order" });
    }
};

const markAsDelivered = async (req, res) => {
    try {
        const Order = await OrderModel.findByIdAndUpdate(req?.params?.id, { delivered: true, status: "delivered" }, { new: true })
        console.log(Order, 'Order');
        console.log(req?.params?.id, 'req?.params?.id');
        return res?.status(200).json({ data: Order })
    }
    catch (error) {
        console.log(error)
    }
}
const changeStatus = async (req, res) => {
    try {
        const Order = await OrderModel.findByIdAndUpdate(req?.params?.id, { status: req.body.status }, { new: true })
        console.log(req.body.status, 'req.body.status');
        return res?.status(200).json({ data: Order })
        console.log(Order, 'Order');
    }
    catch (error) {
        console.log(error)
    }
}

const cancelOrder = async (req, res) => {
    try {
        const order = await OrderModel.findById(req?.params?.id);
console.log(order, 'order');
        if (!order) {
            return res.status(404).json({ msg: "Order not found", status: 404 });
        }

        if (order.status === "delivered") {
            return res.status(400).json({ msg: "Cannot cancel a delivered order", status: 400 });
        }

        if (order.status === "cancelled") {
            return res.status(400).json({ msg: "Order is already cancelled", status: 400 });
        }

        order.status = "cancelled";
        await order.save();
console.log(order, 'cancelled order');
        return res.status(200).json({ data: order, msg: "Order cancelled successfully", status: 200 });
    
    } catch (error) {
        console.error("Error cancelling order:", error);
        return res.status(500).json({ success: false, msg: "Failed to cancel order" });
    }
}
const printLabel = async (req, res) => {
    try {
        let { id } = req.params;
        let order = await OrderModel.findById(id).populate("userId");
        console.log(id, 'id');
console.log(order, 'order');
        const shipmentBody = {
            "carrier": "USPS",
            "service_key": "USPS Priority Mail, United States",
            "from": {
                "name": "Harry",
                "company": "PixArts",
                "phone": "10098765432",
                "street1": "19555 Northeast 10th Avenue",
                "street2": "",
                "city": "Miami",
                "state": "FL",
                "country": "US",
                "zip": "33179"
            },
            "to": {
                "name": order.userId?.username || "Harry",
                "company": "TUGM",
                "phone": "10098765432",
                "street1": "19555 Northeast 10th Avenue",
                "street2": "",
                "city": "Miami",
                "state": "FL",
                "country": "US",
                "zip": "33179"
            },
            "return_to": {
                "name": "Harry",
                "company": "PixArts",
                "phone": "10098765432",
                "street1": "4 Federal Lane",
                "street2": "",
                "city": "Palm Coast",
                "state": "FL",
                "country": "US",
                "zip": "32137"
            },
            "misc": {
                "length": 1,
                "width": 2,
                "height": 2,
                "weight": 3
            },
            "options": {
                "is_insured": false,
                "cost_of_shipment": 0,
                "receiver_signature": false,
                "saturday_delivery": true,
                "address_validation": true
            }
        };

        const headers = {
            "api-key": "ps_key_7uV4eJLDRVfWtxiuuBucjt5tgzo1KV",
            "api-secret": "ps_secret_0zNpGz9eHMBPbyCiZh7bVAFK4DVokCT5Xi1",
            "Content-Type": "application/json"
        };
console.log("Shipment request body:", shipmentBody);
        const shipmentResponse = await axios.post(
            "https://ship.postmerica.com/apis/api/v1/create-shipment",
            shipmentBody,
            { headers, responseType: "arraybuffer", timeout: 120000 } // important for PDF
        );
        console.log(shipmentResponse.data, 'shipmentResponse.data');
        // Convert PDF data to buffer
        const pdfBuffer = Buffer.from(shipmentResponse.data, "binary");

        // Create a filename
        const fileName = `shipment_${order._id}.pdf`;
        const filePath = path.join(process.cwd(), fileName); // store in root directory

        // Save PDF to root directory
        fs.writeFileSync(filePath, pdfBuffer);
        console.log(`PDF saved at: ${filePath}`);
        const pdfUrl = await uploadFile({ originalname: fileName, buffer: pdfBuffer });
        console.log(pdfUrl, 'pdfUrl');
        order.shipmentPdfUrl = pdfUrl;
        await order.save();

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=${fileName}`,
            "Content-Length": pdfBuffer.length
        });

        return res.send(pdfBuffer);


    } catch (error) {
        console.log("ERROR:", error.message);

        if (error.response) {
            console.log("STATUS:", error.response.status);
            console.log("DATA:", error.response.data?.toString());
        } else if (error.request) {
            console.log("NO RESPONSE RECEIVED:", error.request);
        }

        return res.status(500).json({
            message: "Failed to generate shipment PDF",
            error: error.message,
        });
    }
};
// const printLabel = async (req, res) => {
//     try {
//         let { id } = req.params
//         let order = await OrderModel.findById(id).populate("userId")
//         // const shipmentBody = {
//         //     carrier: "USPS",
//         //     service_key: "USPS Priority Mail, United States",
//         //     from: {
//         //         name: "Harry",
//         //         company: "PixArts",
//         //         phone: "10098765432",
//         //         street1: "19555 Northeast 10th Avenue",
//         //         street2: "",
//         //         city: "Miami",
//         //         state: "Florida",
//         //         country: "US",
//         //         zip: "33179"
//         //     },
//         //     to: {
//         //         name: order.userId?.username || "Harry",
//         //         company: "TUGM",
//         //         phone: order.userId?.email,
//         //         street2: "",
//         //         street1: order?.customer_address,
//         //         city: order.city,
//         //         state: order.state,
//         //         country: order.country,
//         //         zip: order.zip
//         //     },
//         //     return_to: {
//         //         name: "Harry",
//         //         company: "PixArts",
//         //         phone: "10098765432",
//         //         street1: "4 Federal Lane",
//         //         street2: "",
//         //         city: "Palm Coast",
//         //         state: "Florida",
//         //         country: "US",
//         //         zip: "32137"
//         //     },
//         //     misc: {
//         //         length: "1",
//         //         width: "2",
//         //         height: "2",
//         //         weight: "3"
//         //     },
//         //     options: {
//         //         is_insured: false,
//         //         cost_of_shipment: 0,
//         //         receiver_signature: false,
//         //         saturday_delivery: true,
//         //         address_validation: true
//         //     }
//         // };

//         const shipmentBody = {
//             "carrier": "USPS",
//             "service_key": "USPS Priority Mail, United States",
//             "from": {
//                 "name": "Harry",
//                 "company": "PixArts",
//                 "phone": "10098765432",
//                 "street1": "19555 Northeast 10th Avenue",
//                 "street2": "",
//                 "city": "Miami",
//                 "state": "Florida",
//                 "country": "US",
//                 "zip": "33179"
//             },
//             "to": {
//                 "name": "Harry",
//                 "company": "PixArts",
//                 "phone": "10098765432",
//                 "street1": "19555 Northeast 10th Avenue",
//                 "street2": "",
//                 "city": "Miami",
//                 "state": "Florida",
//                 "country": "US",
//                 "zip": "33179"
//             },
//             "return_to": {
//                 "name": "Harry",
//                 "company": "PixArts",
//                 "phone": "10098765432",
//                 "street1": "4 Federal Lane",
//                 "street2": "",
//                 "city": "Palm Coast",
//                 "state": "Florida",
//                 "country": "US",
//                 "zip": "32137"
//             },
//             "misc": {
//                 "length": "1",
//                 "width": "2",
//                 "height": "2",
//                 "weight": "3"
//             },
//             "options": {
//                 "is_insured": false,
//                 "cost_of_shipment": 0,
//                 "receiver_signature": false,
//                 "saturday_delivery": true,
//                 "address_validation": true
//             }
//         }
//         const headers = {
//             "api-key": "ps_key_7uV4eJLDRVfWtxiuuBucjt5tgzo1KV",
//             "api-secret": "ps_secret_0zNpGz9eHMBPbyCiZh7bVAFK4DVokCT5Xi1",
//             "Content-Type": "application/json"
//         };

//         const shipmentResponse = await axios.post(
//             "https://ship.postmerica.com/apis/api/v1/create-shipment",
//             shipmentBody,
//             { headers, responseType: "arraybuffer" } // important for PDF
//         );

//         // 3️⃣ Convert PDF data to buffer and upload to Firebase
//         const pdfBuffer = Buffer.from(shipmentResponse.data, "binary");

//         const file = {
//             originalname: `shipment_${order?._id}.pdf`,
//             buffer: pdfBuffer
//         };

//         const pdfUrl = await uploadFile(file);

//         console.log(pdfUrl, 'pdfUrl');

//         // 4️⃣ Save PDF URL in Order
//         order.shipmentPdfUrl = pdfUrl;

//     } catch (error) {

//     }
// }

// const printLabel = async (req, res) => {
//     try {
//         let { id } = req.params;
//         let order = await OrderModel.findById(id).populate("userId");

//         const shipmentBody = {
//             "carrier": "USPS",
//             "service_key": "USPS Priority Mail, United States",
//             "from": {
//                 "name": "Harry",
//                 "company": "PixArts",
//                 "phone": "10098765432",
//                 "street1": "19555 Northeast 10th Avenue",
//                 "street2": "",
//                 "city": "Miami",
//                 "state": "Florida",
//                 "country": "US",
//                 "zip": "33179"
//             },
//             "to": {
//                 "name": order.userId?.username || "Harry",
//                 "company": "TUGM",
//                 "phone": "10098765432",
//                 "street1": "19555 Northeast 10th Avenue",
//                 "street2": "",
//                 "city": "Miami",
//                 "state": "Florida",
//                 "country": "US",
//                 "zip": "33179"
//             },
//             "return_to": {
//                 "name": "Harry",
//                 "company": "PixArts",
//                 "phone": "10098765432",
//                 "street1": "4 Federal Lane",
//                 "street2": "",
//                 "city": "Palm Coast",
//                 "state": "FL",
//                 "country": "US",
//                 "zip": "32137"
//             },
//             "misc": {
//                 "length": 1,
//                 "width": 2,
//                 "height": 2,
//                 "weight": 3
//             },
//             "options": {
//                 "is_insured": false,
//                 "cost_of_shipment": 0,
//                 "receiver_signature": false,
//                 "saturday_delivery": true,
//                 "address_validation": true
//             }
//         };

//         const headers = {
//             "api-key": "ps_key_7uV4eJLDRVfWtxiuuBucjt5tgzo1KV",
//             "api-secret": "ps_secret_0zNpGz9eHMBPbyCiZh7bVAFK4DVokCT5Xi1",
//             "Content-Type": "application/json"
//         };

//         const shipmentResponse = await axios.post(
//             "https://ship.postmerica.com/apis/api/v1/create-shipment",
//             shipmentBody,
//             { headers, responseType: "arraybuffer" } // important for PDF
//         );
// console.log(shipmentResponse.data, 'shipmentResponse.data');
//         // Convert PDF data to buffer
//         const pdfBuffer = Buffer.from(shipmentResponse.data, "binary");

//         // Create a filename
//         const fileName = `shipment_${order._id}.pdf`;
//         const filePath = path.join(process.cwd(), fileName); // store in root directory

//         // Save PDF to root directory
//         fs.writeFileSync(filePath, pdfBuffer);
//         console.log(`PDF saved at: ${filePath}`);
//         const pdfUrl = await uploadFile({ originalname: fileName, buffer: pdfBuffer });
//         console.log(pdfUrl, 'pdfUrl');
//         order.shipmentPdfUrl = pdfUrl;
//         await order.save();

//         res.set({
//             "Content-Type": "application/pdf",
//             "Content-Disposition": `attachment; filename=${fileName}`,
//             "Content-Length": pdfBuffer.length
//         });

//         return res.send(pdfBuffer);


//     } catch (error) {
//         console.error("Label print error:", JSON.stringify(error));
//         res.status(500).json({ message: "Failed to generate shipment PDF", error: error.message });
//     }
// };

// const printLabel = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const order = await OrderModel.findById(id).populate("userId");

//         if (!order) {
//             return res.status(404).json({ message: "Order not found" });
//         }

//         const shipmentBody = {
//             carrier: "USPS",
//             service_key: "USPS Priority Mail, United States",
//             from: {
//                 name: "Harry",
//                 company: "PixArts",
//                 phone: "10098765432",
//                 street1: "19555 Northeast 10th Avenue",
//                 city: "Miami",
//                 state: "Florida",
//                 country: "US",
//                 zip: "33179"
//             },
//             to: {
//                 name: order.userId?.username || "Harry",
//                 company: "TUGM",
//                 phone: "10098765432",
//                 street1: "19555 Northeast 10th Avenue",
//                 city: "Miami",
//                 state: "Florida",
//                 country: "US",
//                 zip: "33179"
//             },
//             return_to: {
//                 name: "Harry",
//                 company: "PixArts",
//                 phone: "10098765432",
//                 street1: "4 Federal Lane",
//                 city: "Palm Coast",
//                 state: "FL",
//                 country: "US",
//                 zip: "32137"
//             },
//             misc: {
//                 length: 1,
//                 width: 2,
//                 height: 2,
//                 weight: 3
//             },
//             options: {
//                 saturday_delivery: true,
//                 address_validation: true
//             }
//         };

//         const headers = {
//             "api-key": "ps_key_7uV4eJLDRVfWtxiuuBucjt5tgzo1KV",
//             "api-secret": "ps_secret_0zNpGz9eHMBPbyCiZh7bVAFK4DVokCT5Xi1",
//             "Content-Type": "application/json"
//         };

//         // 1️⃣ Create shipment (JSON response)
//         const shipmentResponse = await axios.post(
//             "https://ship.postmerica.com/apis/api/v1/create-shipment",
//             shipmentBody,
//             { headers }
//         );
//         console.log(shipmentResponse.data,'shipmentResponse.data')
//         const labelUrl = shipmentResponse.data?.label_url;

//         if (!labelUrl) {
//             throw new Error("Label URL not returned from shipment API");
//         }

//         // 2️⃣ Download actual PDF
//         const pdfResponse = await axios.get(labelUrl, {
//             responseType: "arraybuffer"
//         });

//         const pdfBuffer = Buffer.from(pdfResponse.data);

//         // Optional: upload to S3 / cloud
//         const fileName = `shipment_${order._id}.pdf`;
//         const pdfUrl = await uploadFile({
//             originalname: fileName,
//             buffer: pdfBuffer
//         });

//         order.shipmentPdfUrl = pdfUrl;
//         await order.save();

//         // 3️⃣ Send PDF to frontend
//         res.set({
//             "Content-Type": "application/pdf",
//             "Content-Disposition": `inline; filename="${fileName}"`,
//             "Content-Length": pdfBuffer.length
//         });

//         return res.end(pdfBuffer);

//     } catch (error) {
//         console.error("Label print error:", error.response?.data || error.message);
//         res.status(500).json({
//             message: "Failed to generate shipment PDF",
//             error: error.message
//         });
//     }
// };

module.exports = { createOrder, getOrderForSeller, getOrderForUser, getSingleOrder, markAsDelivered, changeStatus, cancelOrder, printLabel }