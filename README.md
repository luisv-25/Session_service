# session-service

Salas de video (Daily.co), tokens de acceso y muestras de calidad (QoS).

Parte de **EduConecta** (plataforma de tutorías, arquitectura de microservicios). Stack: NestJS · TypeORM · PostgreSQL · RabbitMQ.

## Requisitos
- Node.js 20+
- PostgreSQL 14+ (local o Neon)
- RabbitMQ (CloudAMQP o local)

## Puesta en marcha
```bash
cd session-service
cp .env.example .env   # completar valores
npm install
npm run start:dev      # desarrollo
npm run build && npm start   # producción
```
El servicio escucha en `PORT` (por defecto 5436). Salud: `GET /health` y `GET /ready`; métricas: `GET /metrics`.

## Variables de entorno
Ver `.env.example`. Todos los servicios que validan JWT deben usar el **mismo** `JWT_SECRET` (y el gateway también).

## Endpoints
| Método | Ruta |
|---|---|
| GET | `/api/v1/sessions/booking/:bookingId` |
| GET | `/api/v1/sessions/:id` |
| GET | `/api/v1/sessions/:id/token` |
| PATCH | `/api/v1/sessions/:id/end` |
| GET | `/api/v1/sessions/:id/logs` |
| POST | `/api/v1/sessions/:id/qos-samples` |
| GET | `/api/v1/sessions/:id/qos-samples` |

## Mensajería (RabbitMQ)
- Colas: `booking_events_queue`, `session_analytics_queue`, `session_events_queue`
- Consume: `booking.confirmed`
- Publica: `session.completed`, `session.qos.degraded`, `session.room.ready`


## Pruebas
```bash
npm run test:unit
npm run test:integration   # requiere PostgreSQL (TEST_DB_PASSWORD)
```
CI/CD: GitHub Actions (`.github/workflows/ci.yml` y `deploy.yml`, despliegue a Render por Deploy Hook).
