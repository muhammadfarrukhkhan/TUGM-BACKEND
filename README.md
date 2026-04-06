# Livestream Auction Flow

This backend implements a livestream system with multiple concurrent auctions, each handling bids and timers separately.

## Models

### LiveStream
- `creatorId`: Account ID of streamer
- `productId`: Array of Product IDs for auction
- `auctionIds`: Array of Auction IDs
- `mode`: "AUCTION" or "BUY_NOW"
- `startTime`: When stream started
- `endTime`: When stream ends (optional)
- `status`: "LIVE", "COMPLETED", "CANCELLED"
- `streamId`: Unique stream identifier
- `token`: Stream token

### Auction
- `streamId`: Reference to LiveStream
- `productId`: Product being auctioned
- `startingBid`: Initial bid amount
- `currentBid`: Current highest bid
- `highestBidder`: Current highest bidder
- `startTime`: Auction start time
- `endTime`: Auction end time
- `suddenDeath`: Boolean for sudden death mode
- `status`: "PENDING", "ACTIVE", "COMPLETED", "CANCELLED"
- `winnerId`: Final winner
- `bidHistory`: Array of bid records

### Bidding
- `streamId`: Stream identifier (string)
- `auctionId`: Reference to Auction
- `bidderId`: Bidder Account ID
- `bidAmount`: Bid amount

## API Endpoints

### Stream Management
- `POST /stream/create` - Start livestream
- `PUT /stream/end/:id` - End livestream (ends all active auctions)
- `GET /stream/live` - Get live streams

### Auction Management
- `POST /auction/create` - Create new auction (closes existing active auction)
- `GET /auction/stream/:streamId` - Get active auctions for stream
- `POST /auction/bid` - Place bid on auction
- `PUT /auction/end/:id` - Manually end auction

## Flow

### 1. Start Livestream
```
POST /stream/create
{
  "creatorId": "user_id",
  "productId": ["product1", "product2"],
  "mode": "AUCTION",
  "endTime": "2024-12-31T23:59:59Z" // optional
}
```
- Creates LiveStream with status "LIVE"
- Returns stream data with streamId and token

### 2. Create Auctions
During livestream, create multiple auctions:
```
POST /auction/create
{
  "streamId": "stream_id",
  "productId": "product_id",
  "startingBid": 100,
  "duration": 300, // seconds
  "suddenDeath": true
}
```
- If another auction is active, closes it first
- Sets auction status to "ACTIVE"
- Schedules automatic end timer
- Emits "auctionCreated" socket event

### 3. Handle Bids
Users place bids on specific auctions:
```
POST /auction/bid
{
  "auctionId": "auction_id",
  "bidderId": "user_id",
  "bidAmount": 150
}
```
- Validates bid > current bid
- Updates auction currentBid and highestBidder
- If suddenDeath enabled and bid in last 10s, extends timer by 10s
- Emits "newBidding" socket event

### 4. Automatic Auction End
- Timer expires → automatically ends auction
- Finds highest bid, sets winner
- Emits "auctionEnded" socket event

### 5. End Livestream
```
PUT /stream/end/:streamId
```
- Ends all active auctions, clears timers
- Sets stream status to "COMPLETED"
- Emits "streamEnded" socket event

## Socket Events

### Client → Server
- `join`: Join stream room
- `sendBid`: Send bid (handled in socket.config.js)
- `sendMessage`: Send chat message
- `sendGift`: Send gift

### Server → Client
- `auctionCreated`: New auction started
- `newBidding`: New bid placed
- `auctionEnded`: Auction ended
- `streamEnded`: Stream ended
- `newMessage`: New chat message
- `newGift`: New gift received

## Timer Management

- Each auction has its own timer managed by `setTimeout`
- Timers stored in memory Map (auctionId → timeoutId)
- Sudden death: If bid placed in last 10s, timer extended by 10s
- On server restart, timers are lost (no persistence implemented)
- When stream ends, all auction timers cleared

## Key Features

- **Multiple Auctions**: Stream can have multiple auctions running concurrently
- **Separate Timers**: Each auction manages its own countdown independently
- **Sudden Death**: Optional mode extends timer on late bids
- **Real-time Updates**: Socket.io events for live bidding
- **Automatic End**: Auctions end automatically when timer expires
- **Graceful Shutdown**: Ending stream properly closes all auctions</content>
<parameter name="filePath">D:\TUGM-BACKEND\README.md