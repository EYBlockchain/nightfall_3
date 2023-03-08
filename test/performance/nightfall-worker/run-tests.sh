
if [[ -z "$TEST_RESULTS_FILE" || -z "$WORKER_HOST" || -z "$NUMBER_OF_REQUESTS" || -z "$CONCURRENCY" ]]; then
  echo "Set TEST_RESULTS_FILE / WORKER_HOST / NUMBER_OF_REQUESTS / CONCURRENCY"
  exit 1
fi

touch $TEST_RESULTS_FILE

echo "Starting tests..."

echo -e "$(date) - Running Deposit test...\n"
echo -e "\nDeposit" >> $TEST_RESULTS_FILE
ab -n $NUMBER_OF_REQUESTS -c $CONCURRENCY -p payloads/deposit.payload -T 'application/json' -s 300 "http://$WORKER_HOST/generate-proof" >> $TEST_RESULTS_FILE

echo -e "$(date) - Running Transfer test...\n"
echo -e "\nTransfer" >> $TEST_RESULTS_FILE
ab -n $NUMBER_OF_REQUESTS -c $CONCURRENCY -p payloads/transfer.payload -T 'application/json' -s 300 "http://$WORKER_HOST/generate-proof" >> $TEST_RESULTS_FILE

echo -e "$(date) - Running Withdraw test...\n"
echo -e "\nWithdraw" >> $TEST_RESULTS_FILE
ab -n $NUMBER_OF_REQUESTS -c $CONCURRENCY -p payloads/withdraw.payload -T 'application/json' -s 300 "http://$WORKER_HOST/generate-proof" >> $TEST_RESULTS_FILE

echo -e "$(date) - Running Burn test...\n"
echo -e "\nBurn" >> $TEST_RESULTS_FILE
ab -n $NUMBER_OF_REQUESTS -c $CONCURRENCY -p payloads/burn.payload -T 'application/json' -s 300 "http://$WORKER_HOST/generate-proof" >> $TEST_RESULTS_FILE

echo -e "$(date) - Running Tonenise test...\n"
echo -e "\nTonenise" >> $TEST_RESULTS_FILE
ab -n $NUMBER_OF_REQUESTS -c $CONCURRENCY -p payloads/tokenise.payload -T 'application/json' -s 300 "http://$WORKER_HOST/generate-proof" >> $TEST_RESULTS_FILE

echo -e "$(date) - Running Transform test...\n"
echo -e "\nTransform" >> $TEST_RESULTS_FILE
ab -n $NUMBER_OF_REQUESTS -c $CONCURRENCY -p payloads/transform.payload -T 'application/json' -s 300 "http://$WORKER_HOST/generate-proof" >> $TEST_RESULTS_FILE

echo "$(date) - Tests finished!"
