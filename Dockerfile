# Stage 1: Build the React frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Build the .NET API
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api-build
WORKDIR /app
COPY Directory.Build.props ./
COPY api/Api.csproj ./api/
RUN dotnet restore api/Api.csproj
COPY api/ ./api/
RUN dotnet publish api/Api.csproj -c Release -o publish --no-restore /p:OpenApiGenerateDocumentsOnBuild=false

# Stage 3: Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

COPY --from=api-build /app/publish ./
COPY --from=frontend-build /app/client/dist ./wwwroot

ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

# SQLite data volume
VOLUME ["/data"]

EXPOSE 8080
ENTRYPOINT ["dotnet", "Api.dll"]
