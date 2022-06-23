
build:
	cd $(WORKSPACE)
	npm install

build-ping-pong:
	docker build -f $(WORKSPACE)/zokrates.Dockerfile .
	docker-compose build -f $(WORKSPACE)/test/ping-pong/docker-compose.yml

start-ganache:
	cd $(WORKSPACE)/test/ping-pong/ && ./ganache-standalone -s

start-nightfall:
	cd $(WORKSPACE)/test/ping-pong/ && ./pong-nightfall -d -s

run-ping-pong:
	cd $(WORKSPACE)/test/ping-pong/ && ./pong-apps

clean:
	cd $(WORKSPACE)/test/ping-pong/ && ./pong-down -v
	cd $(WORKSPACE)/test/ping-pong/ && ./ganache-standalone -d	