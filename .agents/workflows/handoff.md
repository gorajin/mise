---
description: How to hand off work to the next agent at the end of a session
---

# Agent Handoff Workflow

At the end of every session, you MUST follow these steps:

## 1. Read the existing HANDOFF.md
Read `HANDOFF.md` in the project root to understand prior work.

## 2. Update HANDOFF.md — DO NOT create new files
- Add a new entry under **Section 2: Development Timeline** with the current date, time, and a summary of what you did
- Update the **Feature Matrix** (Section 3) if you added or changed features
- Update **Known Issues** (Section 4) if you found or fixed bugs
- Update **Remaining Work** (Section 5) if tasks were completed or new ones identified
- Add any new bugs to **Section 10: All Bugs Fixed** if you fixed bugs
- **DO NOT** create `AGENT_HANDOVER.md`, `SESSION_NOTES.md`, or any other handoff files. Everything goes in the single `HANDOFF.md`.

## 3. Commit and push
```bash
git add -A
git commit -m "docs: update HANDOFF.md with session summary"
git push origin main
```

## 4. Deploy if code changed
If you modified any code (not just docs), redeploy:
```bash
// turbo
gcloud run deploy mise --source . --region us-central1 --allow-unauthenticated \
  --set-env-vars GOOGLE_API_KEY=$(grep GOOGLE_API_KEY .env | cut -d= -f2) \
  --port 8080 --memory 512Mi --quiet
```

## Rules
- There is exactly ONE handoff file: `HANDOFF.md`
- Never create additional markdown files for handoff/session notes
- Always append to the timeline, never overwrite previous entries
- Include commit hashes in your timeline entry
