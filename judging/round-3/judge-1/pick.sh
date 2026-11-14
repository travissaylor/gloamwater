#!/bin/bash
# pick.sh "choice text" TAG : real touch tap on a visible event choice, then wait for voyage end / next modal
E=C:/Users/travi/.t3/worktrees/gloamwater/t3-201b6bf7-54dc20bc5d519c6e/judging/round-3/judge-1/shots
./st.sh 9451 "taptext $1 ;; wait 900 ;; waitfor (!busy)||!document.querySelector('#modal').hidden 40000 ;; wait 1500 ;; shot $E/$2.png ;; text" 2>&1 | grep -v '^waited\|^saved\|^> wait\|^> shot'
