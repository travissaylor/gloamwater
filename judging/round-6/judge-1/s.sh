#!/bin/bash
# usage: s.sh "<steps>"  -- runs frozen phone/step.js against my port 9461, logs to play/steps.log
R=C:/Users/travi/.t3/worktrees/gloamwater/t3-201b6bf7-54dc20bc5d519c6e/judging/round-6
LA=$(cygpath -u "$LOCALAPPDATA"); export PATH="$LA/Microsoft/WinGet/Packages/jdx.mise_Microsoft.Winget.Source_8wekyb3d8bbwe/mise/bin:$LA/mise/shims:$PATH"
PORT=${PORT:-9461}
echo "=== $(date -Is) [$PORT] $1" >> $R/judge-1/play/steps.log
node $R/packet/tools/phone/step.js --port $PORT --step "$1" 2>&1 | tee -a $R/judge-1/play/steps.log
