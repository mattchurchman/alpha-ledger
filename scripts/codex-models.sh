#!/usr/bin/env bash
# Print the Codex models this machine can actually select, newest generation first.
#
# Why this exists: a language model cannot know which models its own account offers - that list
# is server-side state that postdates any training data. Guessing produces confident, wrong
# names. On 2026-10-16 an agent wrote "GPT-6.1 Sol (gpt-6.1-sol)" and "GPT-6 Luna" into this
# repo's queue; neither exists. Read the menu instead.
set -euo pipefail
CACHE="${CODEX_HOME:-$HOME/.codex}/models_cache.json"
[ -f "$CACHE" ] || { echo "No model cache at $CACHE" >&2; exit 1; }
python3 - "$CACHE" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
print(f"Codex models available here (cache fetched {d.get('fetched_at','?')}):\n")
rows = [m for m in d.get("models", []) if m.get("visibility") == "list"]
rows.sort(key=lambda m: m.get("priority", 99))
for m in rows:
    efforts = ",".join(e["effort"] for e in (m.get("supported_reasoning_levels") or []))
    print(f"  {m['slug']:<16} {m.get('description','')}")
    print(f"  {'':16} efforts: {efforts}   default: {m.get('default_reasoning_level')}")
print("\nSelect one with /model. Never name a model that is not in this list.")
PY
