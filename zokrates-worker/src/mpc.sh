#!/bin/sh

rm response*
rm transcript
rm phase1radix*
rm tmp_*

set -e

SIZE=28
BATCH=256

yes | cargo run --release --bin compute_constrained challenge response1 $SIZE $BATCH
cargo run --release --bin verify_transform_constrained challenge response1 challenge2 $SIZE $BATCH

cargo run --release --bin beacon_constrained challenge2 response2 $SIZE $BATCH 0000000000000000000a558a61ddc8ee4e488d647a747fe4dcc362fe2026c620 10
cargo run --release --bin verify_transform_constrained challenge2 response2 challenge3 $SIZE $BATCH

cargo run --release --bin prepare_phase2 response2 $SIZE $BATCH
