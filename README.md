# Rewards & Privileges

A Chickadee Bandit family app that gives chores a motivating feedback loop.

Adults create redeemable rewards and privileges, kids see their chore-point progress, and approved redemptions publish recognition events back to the hub.

## What It Does

- Reads chore completion events from the hub event stream.
- Calculates each child’s available reward points.
- Lets adults create rewards such as movie choice, extra game time, dessert pick, or a parent-child outing.
- Lets kids request rewards once they have enough points.
- Lets adults approve or reject requests.
- Publishes `reward.available`, `reward.redeemed`, and `privilege.earned` events.

## Development

```bash
npm test
npm run build
```

`npm run build` writes `dist/bundle.json`, which can be uploaded as the Marketplace release asset.
