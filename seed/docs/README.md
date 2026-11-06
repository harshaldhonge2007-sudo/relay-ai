# ShopLedger

ShopLedger is a payments and authentication service for small e-commerce platforms.

## Architecture

The service consists of three main modules:

1. **Auth Service** - Handles user authentication and JWT token management
2. **Payments Service** - Processes payments and manages transaction records
3. **Reporting Module** - Generates nightly financial reports

## Getting Started

### Prerequisites

- Python 3.10+
- PostgreSQL 14+
- Docker and Docker Compose

### Installation

```bash
git clone https://github.com/shopledger/shopledger.git
cd shopledger
pip install -r requirements.txt
```

### Running Locally

```bash
docker-compose up
python manage.py migrate
python manage.py runserver
```

### Environment Variables

The following environment variables are required:

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET_KEY` - Secret key for JWT token signing
- `STRIPE_API_KEY` - Stripe API key for payment processing

## Testing

```bash
pytest tests/
```

## Deployment

Deploy to production using the deployment script:

```bash
./scripts/deploy.sh production
```

## Contributing

Please read CONTRIBUTING.md for details on our code of conduct and the process for submitting pull requests.
