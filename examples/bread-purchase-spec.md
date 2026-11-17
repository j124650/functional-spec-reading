# Bread Purchase - Functional Spec (non-technical)

Mar 3, 2027 · @Ana

Version 0.2. Built from the counter rules (Ref v1.4), and the shop's own notes on the till replacement. Audience: Ana first, then the shop team. "Till" means the new point-of-sale terminal; "counter" means the old one.

Markers: **[Decided]** = the shop rules as Ana confirmed them (D-numbers are in Ref v1.4). **[Open Qn]** = still to settle (Sec. 8). **[Pending OQ-n]** = waiting on someone outside the shop (Sec. 9).

## 1. What Release 1 does

Replaces the paper receipt book. A buyer in the shop chooses bread, pays, and is handed the bread with a receipt. The seller holds the sale while it is being paid for, and the till records who bought what, when, and for how much.

Release 1 (go-live) [Decided D1]:

* The till runs one sale at a time per till. One seller, one buyer.
* Bread is chosen from a list of what the shop has baked that morning, not by weight.
* Cash and card are both accepted. A card payment that is declined does not end the sale.
* A receipt is printed every time, and emailed when the buyer leaves an address.
* A buyer can return bread the same day, and a seller can refund it.
* Stock counts come down after every sale and after every refund.

Later: a loyalty card, pre-order for collection, and bread by weight (W7, W8, W9).

## 2. Roles

| Role | Who | Sees |
| --- | --- | --- |
| Seller | The shop staff on the till; a manager covers shifts | Their own till, and every sale in it |
| Buyer | The customer at the counter | Their own sale, and the receipt |

One role per user (as built). A seller on a till is the only person who can change that sale.

## 3. Stages

| Stage (shown) | ID | Held by | Who can edit | How it gets there |
| --- | --- | --- | --- | --- |
| Basket | 10 | Seller | Seller | Created when the seller starts the sale |
| Awaiting Payment | 20 | Seller | Seller | The seller sends the basket to payment |
| Paid | 30 | Seller | Seller | Cash or card is accepted |
| Fulfilled | 40 | - | - | The seller hands the bread over |
| Refunded | 50 | - | - | The seller refunds the sale [Decided D3] |
| Cancelled | 0 | - | - | The seller or the buyer cancels before payment [Decided D4] |

* Every stage change accepts an optional note, e.g. "customer changed to rye". [Decided D2]
* Every stage change is recorded (from, to, who, when, note) and shown on the sale.
* The sale clock starts when the sale is created and never resets. It stops at Fulfilled, Refunded or Cancelled. [Decided D5]
* A sale that is still in Basket or Awaiting Payment when the till is closed is Cancelled automatically. [Decided D6]

## 4. Pass 1 - Choosing (Basket)

The seller starts a sale. The till lists what the shop has baked this morning: the house loaf, the seeded loaf, the sourdough, and the rolls. The house loaf is the default when nothing is chosen.

* The seller picks the bread and the quantity. The quantity is whole loaves or whole packs of rolls. [Decided D7]
* The price comes from the list set in the morning. The seller cannot change a price during a sale. [Decided D8]
* A buyer may ask for something that is not on the morning list. The seller adds it as a one-off line with a price they type in, and the till marks that line as a one-off. [Decided D9]
* The buyer can change the basket as long as the sale has not been sent to payment.
* The seller can remove a line. Removing the last line cancels the sale. [Decided D4]

## 5. Pass 2 - Payment (Awaiting Payment)

The seller sends the basket to payment. The till shows the total and the buyer pays.

* Cash: the seller types in the amount received. The till shows the change and the seller gives it. Cash is accepted when the amount received is at least the total. [Decided D10]
* Card: the seller puts the card in the terminal and the buyer enters the PIN. A card payment that is declined leaves the sale in Awaiting Payment, and the seller can ask for cash instead. [Decided D11]
* Only one payment is taken for a sale. A sale that is paid twice is rejected by the till and logged for the manager. [Decided D12]
* A buyer who walks away before paying leaves the sale in Awaiting Payment. The seller cancels it. [Decided D4]
* When the payment is accepted, the till takes the stock down for every line of the sale, including one-off lines. [Decided D13]

## 6. Pass 3 - Handover and receipt (Paid, Fulfilled)

The seller hands the bread over and the sale is fulfilled.

* The receipt is printed every time and shows the lines, the total, the payment method and the date. [Decided D14]
* If the buyer leaves an address, the receipt is also emailed to it. A receipt is not emailed to anyone else. [Decided D15]
* A buyer who returns bread the same day gets a refund from the seller, and the till returns the stock. The seller records which lines are returned. [Decided D3]
* A refund after the same day is not possible on the till, and the manager has to agree to it outside the till. [Decided D16]
* The seller cannot change the lines of a paid sale. A refund is the only way to change what was sold. [Decided D3]

## 7. Notifications

| Event | To | Copy |
| --- | --- | --- |
| Card declined | Buyer, Seller | - |
| Receipt emailed | Buyer | - |
| Refund issued | Buyer | Seller |
| One-off line added | Seller | - |

No message goes from the till to the buyer except the emailed receipt. [Decided D15]

## 8. Open questions and risks on v0.2

| # | Question | Recommendation | Decides |
| --- | --- | --- | --- |
| Q1 | The receipt is printed every time in Sec. 6, but Sec. 1 says a receipt is emailed when the buyer leaves an address. Is a paper receipt still printed when the receipt is emailed? | Keep printing both; the buyer may leave before the email arrives | Sec. 6 |
| Q2 | The house loaf is the default and is named in Sec. 4, but the spec never says what it weighs or what it costs. Is it a 800 g loaf at 3.20? | Ana to confirm from the morning list | Sec. 4 |
| R1 | Risk: a one-off line is typed in by the seller, so the price is whatever the seller types, and the till has no way to check it. A buyer could be charged a wrong price and there is no record of who set it. | Accept for Release 1; report one-off lines by value each week | Sec. 4 |

## 9. Outside items

| Item | Owner | Effect on Release 1 |
| --- | --- | --- |
| OQ-1 card terminal receipt roll stock | Priya | The printer may run out in the first week |
| OQ-2 the bakery's morning list by email | Tomas | The till's bread list comes from a spreadsheet until this is decided |

Closed since v0.1: the old counter till, the paper receipt book, the end-of-day cash count sheet.

## Changelog

### v0.1 → v0.2 (Ana 2/3)

* One sale at a time per till.
* One-off lines allowed and marked.
* Returns only on the day of sale.

### v0.1 (Ana 1/3)

* First pass at the sale stages.
* Cash and card.
