FROM ubuntu
USER root

ENV BUNDLE_SILENCE_ROOT_WARNING=1

RUN apt-get update && apt-get -y install curl gnupg unzip wget vim xvfb x11vnc fluxbox wmctrl sudo tmux
RUN adduser --disabled-password --gecos '' apps
RUN adduser apps sudo
RUN echo '%sudo ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers
RUN mkdir -p /home/apps && chown apps:apps /home/apps


# Set the Chrome repo.
#RUN wget -qO - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    #&& echo "deb http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list

# Install Chrome.
#RUN apt-get update && apt-get -y install google-chrome-stable

# Keep CHROME version fixed
ARG CHROME_VERSION="96.0.4664.45-1"
RUN wget --no-verbose -O /tmp/chrome.deb https://dl.google.com/linux/chrome/deb/pool/main/g/google-chrome-stable/google-chrome-stable_${CHROME_VERSION}_amd64.deb \
  && apt-get update && apt-get install -y /tmp/chrome.deb \
  && rm /tmp/chrome.deb   

# Install nodejs
RUN wget -qO - https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get -y install nodejs

# Instal wscat
RUN npm install -g wscat

# Build SDK
WORKDIR /cli
ADD ./cli /cli
RUN npm i
RUN npm run build

WORKDIR /src
ADD . /src

# Build react app
RUN npm install --save

# Install python3
RUN apt-get update
RUN apt-get install -y  python3 python3-dev python3-distutils
RUN curl -sL https://bootstrap.pypa.io/get-pip.py |  python3
RUN pip -V

# Chrome Driver
RUN BROWSER_MAJOR=$(google-chrome --version | sed 's/Google Chrome \([0-9]*\).*/\1/g') && \
    mkdir -p /opt/selenium && \
    wget https://chromedriver.storage.googleapis.com/LATEST_RELEASE_${BROWSER_MAJOR} -O chrome_version && \
    cat chrome_version && \
    wget https://chromedriver.storage.googleapis.com/`cat chrome_version`/chromedriver_linux64.zip -O /opt/selenium/chromedriver_linux64.zip && \
    cd /opt/selenium; unzip /opt/selenium/chromedriver_linux64.zip; rm -rf chromedriver_linux64.zip; ln -fs /opt/selenium/chromedriver /src/test/drivers/chromedriver; cd - && \
    DRIVER_MAJOR=$(/opt/selenium/chromedriver --version | sed 's/ChromeDriver \([0-9]*\).*/\1/g') && \
    echo "chrome version: $BROWSER_MAJOR" && \
    echo "chromedriver version: $DRIVER_MAJOR"  && \
    if [ $BROWSER_MAJOR != $DRIVER_MAJOR ]; then echo "VERSION MISMATCH"; exit 1; fi

# Metamask plugin
#RUN   ID=nkbihfbeogaeaoehlefnkodbefgpgknn && CHROME_VERSION=$(cat chrome_version) && \
      #URL="https://clients2.google.com/service/update2/crx?response=redirect&prodversion=$CHROME_VERSION&acceptformat=crx2,crx3&x=id%3D$ID%26uc" && \
      #curl -L "$URL" > /src/test/extensions/metamask.crx
COPY test/extensions/metamask.crx   /src/test/extensions/metamask.crx

# Install python dependencies
RUN pip install setuptools pip --upgrade --force-reinstall
RUN cd test && pip install -r requirements.txt

CMD [ "sh", "-c", "/bin/bash ./docker-entry.sh" ]
