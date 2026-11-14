#!/bin/bash
# go.sh DEST TAG : real touch taps: MAP tab -> district node -> "Sail here"; then waits until the voyage ends or a modal (event) opens.
# The waitfor only reads whether the UI is busy or a dialog is visible; it never reads hidden game data.
E=C:/Users/travi/.t3/worktrees/gloamwater/t3-201b6bf7-54dc20bc5d519c6e/judging/round-3/judge-1/shots
./st.sh 9451 "taptext MAP ;; wait 900 ;; tap g.node[data-d=$1] ;; wait 1200 ;; taptext Sail here ;; wait 800 ;; waitfor (!busy)||!document.querySelector('#modal').hidden 40000 ;; wait 1500 ;; shot $E/$2.png ;; text" 2>&1 | grep -v '^waited\|^saved\|^> wait\|^> shot'
