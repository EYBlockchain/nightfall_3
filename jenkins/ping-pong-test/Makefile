
build:
	cd $(WORKSPACE)
	npm install

## --- Local stuff

build-ping-pong-local:
	docker build -f $(WORKSPACE)/zokrates.Dockerfile .
	docker-compose build -f $(WORKSPACE)/test/ping-pong/docker-compose.yml

start-ganache-local:
	cd $(WORKSPACE)/test/ping-pong/ && ./ganache-standalone -s

start-nightfall-local:
	cd $(WORKSPACE)/test/ping-pong/ && ./pong-nightfall -d -s

run-ping-pong-local:
	cd $(WORKSPACE)/test/ping-pong/ && ./pong-apps
	cd $(WORKSPACE)/test/ping-pong/ && ./pong-down -v
	cd $(WORKSPACE)/test/ping-pong/ && ./ganache-standalone -d

clean-local:
	
## ---- AWS stuff
