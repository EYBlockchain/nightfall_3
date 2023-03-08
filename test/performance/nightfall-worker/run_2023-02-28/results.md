
Configuration:
4 vCPUs
16GB memory

Total application instances: 1

--
Transfer:

Command: ab -n 100 -c 10 -p transfer.payload -T 'application/json' -s 300 http://performance-test-lb-1465946030.eu-west-2.elb.amazonaws.com/generate-proof

Server Hostname:        performance-test-lb-1465946030.eu-west-2.elb.amazonaws.com
Server Port:            80

Document Path:          /generate-proof
Document Length:        2077 bytes

Concurrency Level:      10
Time taken for tests:   685.579 seconds
Complete requests:      100
Total transferred:      235205 bytes
Total body sent:        491000
HTML transferred:       207705 bytes
Requests per second:    0.15 [#/sec] (mean)
Time per request:       68557.855 [ms] (mean)
Time per request:       6855.786 [ms] (mean, across all concurrent requests)
Transfer rate:          0.34 [Kbytes/sec] received
                        0.70 kb/s sent
                        1.03 kb/s total

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:       55   79  67.8     61     610
Processing: 38151 63618 4944.7  64657   75477
Waiting:    38146 63617 4945.0  64657   75477
Total:      38206 63696 4945.5  64721   75559

Percentage of the requests served within a certain time (ms)
  50%  64721
  66%  65875
  75%  66254
  80%  66461
  90%  67724
  95%  70633
  98%  72987
  99%  75559
 100%  75559 (longest request)
 
 ---
Deposit:
 
Command: ab -n 100 -c 10 -p deposit.payload -T 'application/json' -s 300 http://performance-test-lb-1465946030.eu-west-2.elb.amazonaws.com/generate-proof
 
Server Hostname:        performance-test-lb-1465946030.eu-west-2.elb.amazonaws.com
Server Port:            80

Document Path:          /generate-proof
Document Length:        1013 bytes

Concurrency Level:      10
Time taken for tests:   61.563 seconds
Complete requests:      100
Total transferred:      128910 bytes
Total body sent:        103200
HTML transferred:       101410 bytes
Requests per second:    1.62 [#/sec] (mean)
Time per request:       6156.263 [ms] (mean)
Time per request:       615.626 [ms] (mean, across all concurrent requests)
Transfer rate:          2.04 [Kbytes/sec] received
                        1.64 kb/s sent
                        3.68 kb/s total

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:       54   59   3.2     59      68
Processing:  1007 5935 1052.3   6083    8947
Waiting:     1007 5934 1052.5   6080    8946
Total:       1063 5994 1052.9   6139    9015

Percentage of the requests served within a certain time (ms)
  50%   6139
  66%   6246
  75%   6336
  80%   6364
  90%   6547
  95%   7624
  98%   8499
  99%   9015
 100%   9015 (longest request)
 
 --
 Withdaw
 
Command: ab -n 100 -c 10 -p withdraw.payload -T 'application/json' -s 300 http://performance-test-lb-1465946030.eu-west-2.elb.amazonaws.com/generate-proof
 
Server Hostname:        performance-test-lb-1465946030.eu-west-2.elb.amazonaws.com
Server Port:            80

Document Path:          /generate-proof
Document Length:        1577 bytes

Concurrency Level:      10
Time taken for tests:   607.355 seconds
Complete requests:      100
Total transferred:      185384 bytes
Total body sent:        350800
HTML transferred:       157884 bytes
Requests per second:    0.16 [#/sec] (mean)
Time per request:       60735.510 [ms] (mean)
Time per request:       6073.551 [ms] (mean, across all concurrent requests)
Transfer rate:          0.30 [Kbytes/sec] received
                        0.56 kb/s sent
                        0.86 kb/s total

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:       52   59   3.8     58      75
Processing:  6556 58771 6252.4  59826   69751
Waiting:     6555 58771 6252.4  59826   69750
Total:       6616 58830 6252.4  59882   69812

Percentage of the requests served within a certain time (ms)
  50%  59882
  66%  60817
  75%  61125
  80%  61307
  90%  61846
  95%  63589
  98%  67578
  99%  69812
 100%  69812 (longest request)


--
Tokenise

Command: ab -n 100 -c 10 -p tokenise.payload -T 'application/json' -s 300 http://performance-test-lb-1465946030.eu-west-2.elb.amazonaws.com/generate-proof

Server Hostname:        performance-test-lb-1465946030.eu-west-2.elb.amazonaws.com
Server Port:            80

Document Path:          /generate-proof
Document Length:        1221 bytes

Concurrency Level:      10
Time taken for tests:   342.336 seconds
Complete requests:      100
Total transferred:      149693 bytes
Total body sent:        229700
HTML transferred:       122193 bytes
Requests per second:    0.29 [#/sec] (mean)
Time per request:       34233.563 [ms] (mean)
Time per request:       3423.356 [ms] (mean, across all concurrent requests)
Transfer rate:          0.43 [Kbytes/sec] received
                        0.66 kb/s sent
                        1.08 kb/s total

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:       47   59   7.7     58     124
Processing:  3865 32986 3853.1  33679   40075
Waiting:     3864 32985 3853.1  33676   40075
Total:       3912 33045 3854.6  33737   40139

Percentage of the requests served within a certain time (ms)
  50%  33737
  66%  34405
  75%  34711
  80%  34897
  90%  35534
  95%  36349
  98%  38809
  99%  40139
 100%  40139 (longest request)

-- 
Burn

Command: ab -n 100 -c 10 -p burn.payload -T 'application/json' -s 300 http://performance-test-lb-1465946030.eu-west-2.elb.amazonaws.com/generate-proof

Server Hostname:        performance-test-lb-1465946030.eu-west-2.elb.amazonaws.com
Server Port:            80

Document Path:          /generate-proof
Document Length:        1381 bytes

Concurrency Level:      10
Time taken for tests:   419.372 seconds
Complete requests:      100
Total transferred:      165706 bytes
Total body sent:        282500
HTML transferred:       138206 bytes
Requests per second:    0.24 [#/sec] (mean)
Time per request:       41937.190 [ms] (mean)
Time per request:       4193.719 [ms] (mean, across all concurrent requests)
Transfer rate:          0.39 [Kbytes/sec] received
                        0.66 kb/s sent
                        1.04 kb/s total

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:       54   70  57.9     60     614
Processing:  4543 40425 4478.5  41460   48525
Waiting:     4543 40420 4477.0  41460   48525
Total:       4707 40494 4472.5  41572   48597

Percentage of the requests served within a certain time (ms)
  50%  41572
  66%  42090
  75%  42389
  80%  42561
  90%  43011
  95%  43802
  98%  46797
  99%  48597
 100%  48597 (longest request)
 