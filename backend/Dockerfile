FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml ./pom.xml
COPY backend/pom.xml ./backend/pom.xml
COPY backend/src ./backend/src
RUN mvn -B package -DskipTests -pl backend

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /build/backend/target/quarkus-app ./
VOLUME /app/data
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "quarkus-run.jar"]
