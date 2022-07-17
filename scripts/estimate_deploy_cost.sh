#!/bin/bash

program_size=$(wc -c < target/deploy/drip.so)
#echo $program_size
program_size=$((program_size * 2))
#echo $program_size
rent=$(solana rent $program_size)
echo $rent
