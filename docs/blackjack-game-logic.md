# Blackjack Game Logic — Specification

This document describes how the blackjack game works, the rules, and the scoring logic, intended as a spec for building the game engine (fully decoupled from the UI).

## 1. Objective

The player competes against the dealer only, not against other players. Whoever gets a hand total closest to 21 without going over wins. If a hand total exceeds 21, it's called a "bust" and that hand loses immediately, regardless of what the dealer does afterward.

## 2. Deck and Card Values

Use one or more standard 52-card decks (the simplest version uses 1 deck; can be extended to 6-8 decks to mimic real casinos and make card counting harder).

Card values:
- Cards 2 through 10: face value as printed.
- J, Q, K (face cards): worth 10 points.
- Ace (A): worth 11 or 1 points, depending on the hand's current total, choosing whichever avoids a bust when possible.

Suits (hearts, diamonds, clubs, spades) don't affect value, they're purely visual.

## 3. Round Sequence

1. The player places a bet before cards are dealt.
2. The dealer deals 2 cards to each side. The player's cards may be shown face-up or face-down depending on display rules; the dealer typically has one card face-up and one face-down (the face-down card is called the "hole card").
3. If the dealer's face-up card is an Ace, an "insurance" mechanic may be offered (a side bet against the dealer having blackjack). This can be skipped in the base version.
4. Check for a natural blackjack: if either the player or the dealer has a 2-card total of exactly 21 (Ace + a 10-value card), it's a "natural blackjack" and the round ends immediately under special win rules (see section 6).
5. If neither has a natural blackjack, the player takes actions until they choose to stop or bust.
6. Once the player's turn ends, the dealer reveals the hole card and draws according to fixed rules (no discretion).
7. Compare totals, determine win/lose/push, and settle the bet.

## 4. Player Actions

- **Hit**: draw one more card. Can hit repeatedly until busting or choosing to stop.
- **Stand**: stop drawing, keep the current total.
- **Double down**: double the bet in exchange for exactly one more card, then mandatory stand. Usually only allowed when the hand still has exactly its original 2 cards.
- **Split**: if the first 2 cards have the same value (e.g. two 8s, or two face cards), the player can split them into 2 separate hands, each with a bet equal to the original, played independently. Splitting Aces is typically restricted to receiving exactly 1 additional card per hand with no further doubling/splitting allowed (configurable, depending on house rules).
- **Surrender** (optional, advanced): the player forfeits the round right after seeing their first 2 cards, losing half the bet and not playing further. Not required for the first version.

## 5. Dealer Rules (fixed, no discretion)

The dealer doesn't choose actions like the player does; it follows fixed rules:
- If the dealer's total is below 17: must hit.
- If the dealer's total is 17 or above: must stand.
- Common variant "dealer hits soft 17": if the dealer has 17 made with an Ace counted as 11 (called a "soft 17", e.g. Ace + 6), some casinos require the dealer to hit again. This should be a togglable config (`dealerHitsSoftSeventeen: boolean`) since it varies between houses.

## 6. Scoring Logic

### 6.1 Principle

Sum the values of all cards in the hand. Since an Ace can be 1 or 11, the rule is: default to counting each Ace as 11, and if the total exceeds 21, convert Aces from 11 to 1 one at a time until the total no longer exceeds 21 or there are no more Aces to convert.

### 6.2 Scoring Pseudocode

```
function calculateScore(hand: Card[]): { score: number, isSoft: boolean } {
  total = 0
  aceCount = 0

  for each card in hand:
    if card.rank == 'A':
      total += 11
      aceCount += 1
    else if card.rank in ['J','Q','K']:
      total += 10
    else:
      total += numericValue(card.rank)

  // Convert Aces from 11 down to 1 if busting
  while total > 21 and aceCount > 0:
    total -= 10   // convert one Ace from 11 to 1, i.e. subtract 10
    aceCount -= 1

  isSoft = (aceCount > 0)  // "soft hand": at least one Ace is still counted as 11
  return { score: total, isSoft: isSoft }
}
```

The concept of a "soft hand" matters because it determines whether the dealer must hit again (section 5) and affects any strategy-hint feature you might add later.

### 6.3 Determining a Bust

```
function isBust(hand): boolean {
  return calculateScore(hand).score > 21
}
```

### 6.4 Determining a Natural Blackjack

```
function isNaturalBlackjack(hand): boolean {
  return hand.length == 2 and calculateScore(hand).score == 21
}
```

## 7. Determining the Round Outcome

Once the player has stood (or doubled/busted) and the dealer has finished their turn, compare in the following priority order:

1. If the player busts: the player loses immediately, no need to check the dealer.
2. If the player has a natural blackjack and the dealer doesn't: the player wins, typically paid 3:2 (i.e. a bet of 10 wins 15) instead of the usual 1:1.
3. If both have a natural blackjack: it's a push, the bet is returned.
4. If the dealer busts and the player hasn't: the player wins, paid 1:1.
5. If neither busts: compare totals, the higher one wins; equal totals result in a push.

### 7.1 Outcome Resolution Pseudocode

```
function resolveOutcome(playerHand, dealerHand): 'win' | 'lose' | 'push' | 'blackjack' {
  if isBust(playerHand): return 'lose'

  playerBJ = isNaturalBlackjack(playerHand)
  dealerBJ = isNaturalBlackjack(dealerHand)

  if playerBJ and dealerBJ: return 'push'
  if playerBJ: return 'blackjack'   // pays 3:2
  if dealerBJ: return 'lose'

  if isBust(dealerHand): return 'win'

  playerScore = calculateScore(playerHand).score
  dealerScore = calculateScore(dealerHand).score

  if playerScore > dealerScore: return 'win'
  if playerScore < dealerScore: return 'lose'
  return 'push'
}
```

## 8. Handling Split into Multiple Hands

When splitting, the data structure should treat each post-split hand as an independent "hand" within a `hands: Hand[]` list, each with its own bet and its own state (in-play, stood, busted, doubled). The dealer only plays its own turn once, after all of the player's hands are finished, then settles against each hand individually following the rules in section 7.

## 9. State to Manage in the Game Engine

- `deck`: array of remaining undealt cards.
- `dealerHand`: array of the dealer's cards, with a flag marking which one is hidden.
- `playerHands`: array of the player's hands (normally just 1, more if split).
- `currentHandIndex`: which hand is currently being played (when split has occurred).
- `roundPhase`: one of `betting | dealing | playerTurn | dealerTurn | settlement`.
- `balance`: the player's current chip count.

## 10. Notes for Unit Testing

Write dedicated tests for each pure function (`calculateScore`, `isBust`, `isNaturalBlackjack`, `resolveOutcome`) covering these key edge cases:
- Hands with multiple Aces (e.g. Ace + Ace + 9 must resolve to 21, not 31 or an incorrect bust).
- Soft 17 vs. hard 17, to correctly test the dealer's hit/stand rule.
- Both sides having a natural blackjack simultaneously (a special push case that's easy to mistakenly code as a regular win/lose).
- Busting exactly on the 3rd card after a hit.

These are the edge cases most likely to get missed if the UI is coded first without separating out testable logic.
