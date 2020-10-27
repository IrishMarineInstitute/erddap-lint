FROM node
WORKDIR /usr/src/app
RUN mkdir /output && ln -s /output mochawesome-report
COPY package.json .
RUN npm install
COPY runtests.js .
COPY js/ js
COPY rules/ rules
COPY erddap-lint.sh /usr/local/bin/
ENTRYPOINT ["/usr/local/bin/erddap-lint.sh"]
