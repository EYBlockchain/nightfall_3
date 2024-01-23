FROM bitnami/java:17.0.4-8-debian-11-r24
WORKDIR /app

#   Download the executable
RUN curl -LJO https://github.com/whitesource/unified-agent-distribution/releases/latest/download/wss-unified-agent.jar

### Install Node.js (16)
RUN apt-get update && \
	curl -fsSL https://deb.nodesource.com/setup_18.x | bash && \
    apt-get install -y nodejs && \
    apt-get clean && \
	rm -rf /var/lib/apt/lists/* && \
	rm -rf /tmp/*

# Copy the source files
COPY package.json /app/src/
# COPY ./src ./src

#   Copy the configuration
COPY mend/wss-unified-agent.config .

#   java -jar wss-unified-agent.jar -c wss-unified-agent.config -d src
CMD ["java", "-jar","wss-unified-agent.jar","-c","wss-unified-agent.config","-d","src"]
# CMD ["tail","-f","/dev/null"]