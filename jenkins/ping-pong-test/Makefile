
build:
	npm ci

## --- Local stuff

build-ping-pong-local:
	docker build -f $(WORKSPACE)/zokrates.Dockerfile .
	docker-compose build -f $(WORKSPACE)/test/ping-pong/docker-compose.yml

start-ganache-local:
	cd $(WORKSPACE)/test/ping-pong/
	./ganache-standalone -s &> ganache.log 

start-nightfall-local:
	cd $(WORKSPACE)/test/ping-pong/
	./pong-nightfall -d -s &> ping-pong-test.log &disown

run-ping-pong-local:
	cd $(WORKSPACE)/test/ping-pong/
	./pong-apps

clean-local:
	cd $(WORKSPACE)/test/ping-pong/
	./pong-down -v
	./ganache-standalone -d


## ---- AWS stuff
