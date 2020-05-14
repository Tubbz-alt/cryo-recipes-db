FROM node:14-alpine

RUN apk update && apk upgrade && \
    apk add --no-cache bash git openssh

RUN mkdir /app
WORKDIR /app
COPY package.json /app/package.json

COPY . /usr/src/app

RUN npm install 
ENV PATH /app/node_modules/.bin:$PATH

RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD [ "node", "index.js" ]
