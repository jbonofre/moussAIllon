FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY public ./public
COPY src ./src
RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /app/target/classes/META-INF/resources /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
