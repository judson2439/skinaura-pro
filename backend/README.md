# SkinAura Backend

Node.js Express API with TypeScript and TLS 1.2+ security.

## Project Structure

```
src/
├── config/         # Configuration files (env, TLS)
├── lib/            # Utility libraries (HTTP client)
├── middleware/     # Express middleware
├── routes/         # Route handlers
├── types/          # TypeScript type definitions
├── app.ts          # Express app setup
└── index.ts        # Entry point
```

## Quick Start

```bash
# Install dependencies
npm install

# Create .env file
# Configure environment variables (see below)

# Run development server (with hot reload)
npm run dev

# Build for production
npm run build

# Run production server
npm start
```

## Available Scripts

| Command         | Description                          |
| --------------- | ------------------------------------ |
| `npm run dev`   | Start dev server with hot reload    |
| `npm run build` | Compile TypeScript to JavaScript     |
| `npm start`     | Run compiled production server       |
| `npm run lint`  | Run ESLint                           |
| `npm run clean` | Remove dist folder                   |

## API Endpoints

| Method | Endpoint  | Description          |
| ------ | --------- | -------------------- |
| GET    | `/health` | Health check         |
| GET    | `/api`    | API welcome message  |

## Environment Variables

### Server Configuration

| Variable     | Description                        | Default       |
| ------------ | ---------------------------------- | ------------- |
| `PORT`       | HTTP server port                   | `3000`        |
| `HTTPS_PORT` | HTTPS server port                  | `3443`        |
| `NODE_ENV`   | Environment mode                   | `development` |

### TLS/SSL Configuration

| Variable        | Description                          | Default |
| --------------- | ------------------------------------ | ------- |
| `SSL_ENABLED`   | Enable HTTPS with TLS 1.2+           | `false` |
| `SSL_KEY_PATH`  | Path to SSL private key              | -       |
| `SSL_CERT_PATH` | Path to SSL certificate              | -       |
| `SSL_CA_PATH`   | Path to CA certificate (optional)    | -       |
| `MTLS_ENABLED`  | Enable mutual TLS (client certs)     | `false` |

### Security Settings

| Variable      | Description                          | Default |
| ------------- | ------------------------------------ | ------- |
| `FORCE_HTTPS` | Redirect HTTP to HTTPS               | `false` (auto in prod) |
| `TRUST_PROXY` | Trust X-Forwarded-* headers          | `false` |
| `CORS_ORIGIN` | Allowed CORS origin                  | `http://localhost:8080` |

## TLS 1.2+ Security

This backend enforces TLS 1.2 or higher for all connections:

### Inbound Connections (Server)
- Minimum TLS version: TLS 1.2
- Strong cipher suites with forward secrecy (ECDHE)
- HSTS headers enabled
- Optional mutual TLS (mTLS) support

### Outbound Connections (HTTP Client)
- All API requests use the secure HTTP client (`src/lib/httpClient.ts`)
- TLS 1.2+ enforced for all non-localhost requests
- Certificate verification enabled

### Generating SSL Certificates (Development)

```bash
# Create certs directory
mkdir -p certs

# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout certs/server.key \
  -out certs/server.crt \
  -subj "/CN=localhost"
```

### Production Deployment

For production, use certificates from a trusted CA (e.g., Let's Encrypt):

```bash
SSL_ENABLED=true
SSL_KEY_PATH=/path/to/privkey.pem
SSL_CERT_PATH=/path/to/fullchain.pem
FORCE_HTTPS=true
```

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **Security:** Helmet, CORS, TLS 1.2+
- **Logging:** Morgan
