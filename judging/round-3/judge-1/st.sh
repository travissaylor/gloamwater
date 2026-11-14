#!/bin/bash
# usage: st.sh PORT "steps"
LA=$(cygpath -u "$LOCALAPPDATA"); export PATH="$LA/Microsoft/WinGet/Packages/jdx.mise_Microsoft.Winget.Source_8wekyb3d8bbwe/mise/bin:$LA/mise/shims:$PATH"
cd C:/Users/travi/.t3/worktrees/gloamwater/t3-201b6bf7-54dc20bc5d519c6e/judging/round-3/judge-1
P=$1; shift
timeout 110 node ../../../tools/phone/step.js --port $P --step "$*"
