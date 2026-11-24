# Offbank

**Quiet money on Solana.** A sealed vault for your funds: hold, send and prove results while the public ledger sees static.

[![Live site](https://img.shields.io/badge/site-offbank.xyz-ff511f)](https://offbank.xyz)
![Chain](https://img.shields.io/badge/chain-Solana-ff511f)

**Contract address:** `CA pending: announced on X first`

## Overview

Offbank is a static landing site with a live Solana market board. The contract address slot sits at the very top of the page and stays inert until an address is stated in the register.

## Features

- Always-visible contract address bar with click-to-copy
- Live board of the ten most boosted Solana tokens, polled every minute, paused while the tab is hidden
- Row one reserved for the Offbank token, pinned above trending rows once its address is stated
- Ticker driven by the same live data
- Motion with a reduced-motion fallback for every animation

## Links

- Site: https://offbank.xyz
- X: https://x.com/useoffbank
- Whitepaper: [docs/whitepaper.md](docs/whitepaper.md)

## Develop

```
npm run build     # writes dist/
npm run verify    # static gates against dist/
npm run serve     # serves dist/ on 4173
```

Facts that can change (contract address, social links) live in `src/register.js`, one record each, with state `stated`, `absent` or `unconfirmed`.
