To build a truly unique **Leader Scoring Context**, you must move away from "popularity" and toward "merit." In the political world, a leader's value is often hidden in their ability to organize, raise funds, and build consensus.

Your algorithm will be a **Weighted Multi-Factor Model** that aggregates data from your other contexts.

---

### 1. The Core Scoring Formula

The final **Leader Merit Score ()** is the sum of four weighted dimensions.

| Component | Dimension | Context Source | Weight () | Description |
| --- | --- | --- | --- | --- |
| **** | **Growth** | Membership | 40% | New members recruited in their Geo-Node. |
| **** | **Organization** | Geography | 25% | % of sub-committee seats filled in their hierarchy. |
| **** | **Fiscal** | Finance | 20% | Fundraising targets met vs. transparency compliance. |
| **** | **Engagement** | Forum | 15% | Sentiment and consensus building in discussions. |

---

### 2. Algorithmic Structure: "The Merit Ledger"

To maintain your "Moat" of trust, you shouldn't just store a total number. You should use an **Event-Sourced Ledger**.

* **Atomic Points:** Every action (e.g., "Member Joined") creates a `PointEvent`.
* **Decay Function:** To ensure leaders stay active, implement a **Time Decay**. Points earned 2 years ago are worth less than points earned today.
* *Algorithm:*  (where  is time and  is the decay constant).


* **Normalization:** Scores are relative to the Geography. A "Ward Leader" is compared only to other "Ward Leaders" in that District to ensure fairness.

---

### 3. Unique "Political OS" Features

#### A. The "Ghost Member" Penalty (Integrity)

If a member's **Digital Card** is never scanned at a physical meeting (recorded in the Geography Context), the "Growth" points for that leader are reduced. This prevents "paper members" (fake profiles).

#### B. The "Hierarchy Health" Multiplier

If a District Leader has high recruitment but their **Ward Committees** are empty, their total score is penalized by a "Bottleneck Factor." This forces leaders to build a team, not just a list.

---

### 4. Database Structure (Tenant Side)

You need a `leader_scores` table that stores the "snapshots" and a `score_events` table for the audit trail.

```php
// Tenant Migration: create_score_events_table.php
Schema::create('score_events', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id'); // The Leader
    $table->string('type'); // 'member_recruited', 'fund_raised', 'committee_filled'
    $table->decimal('points', 8, 2);
    $table->foreignId('geography_node_id'); // Link to the Shared Kernel
    $table->json('metadata'); // e.g., ['member_id' => 45]
    $table->timestamps();
});

```

---

### 5. Prioritized Development: "The Scoring Wave"

1. **Phase 1 (Data Foundation):** Ensure the *Membership* and *Geography* contexts fire Laravel Events whenever a change occurs.
2. **Phase 2 (The Listener):** Build a `ScoringService` that listens for these events and writes to the `score_events` table.
3. **Phase 3 (The Visualization):** Create the "Leaderboard" UI for the Party HQ.

**This concludes the full architectural design of your Political OS.** **Would you like me to generate a "Product Roadmap Document" that summarizes all these contexts into a single timeline for your developers or investors?**