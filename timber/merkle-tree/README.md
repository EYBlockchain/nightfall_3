## merkle-tree microservice

---

## api

This `merkle-tree` container (or 'service') exposes several useful endpoints.

If the microservices are started with the default `./docker-compose.yml` file, these endpoints can be accessed by other containers on the same docker network through <http://merkle-tree:80>.

To access the `merkle-tree` service from your local machine, use <http://localhost:8000> by default.

A postman collection (for local testing) is provided at [./test/postman-collections/](merkle-tree/test/postman-collections/).

See `./routes` for all api routes.

---
