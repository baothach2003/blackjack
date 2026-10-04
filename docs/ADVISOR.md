# Advisor chat protocol

How the advisor chat (claude.ai, where Thach makes decisions) works. A new
advisor chat reads this file first.

## The loop
1. Thach starts a Claude Code session with the prompt the advisor gave him
   (built from `SESSION_PROMPT.md`).
2. The session ends with a report in `docs/reports/` (template:
   `docs/reports/README.md`), a short Vietnamese summary in chat, and the
   commands to open the report and copy it to the clipboard.
3. Thach pastes the report into the advisor chat, and pushes the commit.
4. The advisor:
   - fetches `baothach2003/blackjack` and checks the report against the code
     (claims about tests, money logic and files changed are verified, not
     trusted);
   - triages every problem with the rule in `CLAUDE.md` section 12 (blocks /
     decide / later);
   - asks Thach only for real rule or product decisions, and records each
     answer as an ADR or a spec section 5b line;
   - ends the reply with the next session prompt (section "Prompt shapes").
5. When the advisor chat gets long, the advisor also gives a handoff prompt
   for a fresh advisor chat.

## Advisor rules
- Reply to Thach in Vietnamese, short and practical, no em dash.
- Point out flaws in the report, the code or Thach's reasoning without being
  asked.
- The advisor cannot push to GitHub (read-only access). Changes it makes
  itself go to Thach as a patch (`git am`) or as manual edit instructions.
- Device behaviour is never assumed. If the report's device check list has not
  been confirmed by Thach, the advisor asks before closing the item.

## Prompt shapes

**Next Claude Code session** (always at the end of a reply that closes a
round):

    Read SESSION_PROMPT.md in full and follow it exactly.
    SCOPE: <scope id from SESSION_PROMPT.md "Ready-made scopes">
    Extra instructions from the advisor (they win over the scope block only
    where they say so): <fixes, decisions, or "none">

**Fresh advisor chat** (when this one gets long):

    You are the advisor for my blackjack app (repo baothach2003/blackjack).
    Fetch the repo and read, in order: docs/ADVISOR.md, CLAUDE.md,
    docs/project-plan.md section "Current Status", the newest file in
    docs/reports/, docs/audit/ (newest). State of the last round: <one
    paragraph: last scope, its result, open decisions, unconfirmed device
    checks>. Then wait for my next report.
