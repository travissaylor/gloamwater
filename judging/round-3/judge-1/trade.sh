#!/bin/bash
# trade.sh MODE GOODID [QTY|max] : real touch taps: MARKET tab -> market row -> Buy/Sell -> Max or typed qty -> confirm.
# Prints the visible order summary (including the game's own warnings) before confirming.
# GOODID: kelp rain pearl saffron eels chips silk ink
MODE=$1; G=$2; Q=${3:-max}
if [ "$Q" = max ]; then QS="taptext Max"; else QS="tap #qin ;; key Control+a ;; type $Q ;; key Tab"; fi
B=$( [ "$MODE" = buy ] && echo b || echo s )
./st.sh 9451 "taptext MARKET ;; wait 700 ;; tap div.row[data-g=$G] ;; wait 1200 ;; tap button.$B ;; wait 400 ;; $QS ;; wait 500 ;; eval document.querySelector('#qsum')&&document.querySelector('#qsum').innerText.replace(/\n/g,' | ') ;; eval document.querySelector('#qgo')&&document.querySelector('#qgo').innerText ;; tap #qgo ;; wait 1300 ;; eval document.querySelector('#modal').hidden?'closed':document.querySelector('#modal').innerText.slice(0,300)" 2>&1 | grep '^"\|^!!\|COVERED'
