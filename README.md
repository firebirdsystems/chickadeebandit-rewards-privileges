# Rewards

A [Chickadee Bandit](https://chickadeebandit.com/app-library/rewards-privileges) app.

A Chickadee Bandit family app that gives chores a motivating feedback loop.

Adults create redeemable rewards, kids see their chore-point progress, and approved redemptions publish recognition events back to the hub.

## What It Does

- Keeps a lasting points ledger, filled by the `credit_points` automation action. The hub runs "Award points when a chore is completed" on its own whenever Chores is installed, adding each completed chore's points; an admin can switch it off in **Settings → Automations**, and the app tells adults when points aren't being counted.
- Calculates each child’s available reward points.
- Lets adults create rewards such as movie choice, extra game time, dessert pick, or a parent-child outing.
- Lets kids request rewards once they have enough points.
- Lets adults approve or reject requests.
- Publishes `reward.available` and `reward.redeemed` events.

## Development

```bash
npm test
npm run build
```

`npm run build` writes `dist/bundle.json`, which can be uploaded as the Marketplace release asset.
