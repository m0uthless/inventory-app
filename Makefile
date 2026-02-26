SHELL := /bin/bash
.DEFAULT_GOAL := help

# Inventory-app local dev helpers (Docker-only)
# Usage: make up | make rebuild | make migrate | make test-core | make logs

COMPOSE ?= docker compose

.PHONY: help
help: ## Show available commands
	@awk 'BEGIN {FS = ":.*##"; printf "\nAvailable targets:\n"} /^[a-zA-Z0-9_.-]+:.*##/ {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: up
up: ## Start all services (detached)
	$(COMPOSE) up -d

.PHONY: down
down: ## Stop and remove containers (keeps volumes)
	$(COMPOSE) down

.PHONY: restart
restart: ## Restart services
	$(COMPOSE) restart

.PHONY: rebuild
rebuild: ## Rebuild images and recreate containers
	$(COMPOSE) up -d --build --force-recreate

.PHONY: ps
ps: ## Show service status
	$(COMPOSE) ps

.PHONY: logs
logs: ## Tail logs for all services
	$(COMPOSE) logs -f --tail=200

.PHONY: logs-backend
logs-backend: ## Tail backend logs
	$(COMPOSE) logs -f --tail=200 backend

.PHONY: logs-nginx
logs-nginx: ## Tail backend nginx logs
	$(COMPOSE) logs -f --tail=200 backend_nginx

.PHONY: logs-frontend
logs-frontend: ## Tail frontend logs
	$(COMPOSE) logs -f --tail=200 frontend

.PHONY: shell
shell: ## Open a Django shell in the backend container
	$(COMPOSE) exec backend python manage.py shell

.PHONY: bash-backend
bash-backend: ## Open a bash shell in the backend container
	$(COMPOSE) exec backend sh

.PHONY: migrate
migrate: ## Apply Django migrations
	$(COMPOSE) exec backend python manage.py migrate

.PHONY: makemigrations
makemigrations: ## Create Django migrations (all apps)
	$(COMPOSE) exec backend python manage.py makemigrations

.PHONY: makemigrations-%
makemigrations-%: ## Create Django migrations for a single app: make makemigrations-inventory
	$(COMPOSE) exec backend python manage.py makemigrations $*

.PHONY: test-core
test-core: ## Run core smoke tests
	$(COMPOSE) exec backend python manage.py test core

.PHONY: test
test: ## Run all backend tests
	$(COMPOSE) exec backend python manage.py test

.PHONY: check
check: ## Run Django system checks
	$(COMPOSE) exec backend python manage.py check

.PHONY: check-migrations
check-migrations: ## Fail if there are model changes without migrations
	$(COMPOSE) exec backend python manage.py makemigrations --check --dry-run

.PHONY: migrate-plan
migrate-plan: ## Show planned migrations without applying them
	$(COMPOSE) exec backend python manage.py migrate --plan

.PHONY: ci
ci: ## Practical CI: check + migrations check + migration plan
	@$(MAKE) check
	@$(MAKE) check-migrations
	@$(MAKE) migrate-plan

.PHONY: collectstatic
collectstatic: ## Collect static files
	$(COMPOSE) exec backend python manage.py collectstatic --noinput

.PHONY: createsuperuser
createsuperuser: ## Create a Django superuser
	$(COMPOSE) exec backend python manage.py createsuperuser

.PHONY: encrypt-secrets-dry
encrypt-secrets-dry: ## Dry-run encryption of inventory secrets
	$(COMPOSE) exec backend python manage.py encrypt_inventory_secrets --dry-run

.PHONY: encrypt-secrets
encrypt-secrets: ## Encrypt inventory secrets in DB
	$(COMPOSE) exec backend python manage.py encrypt_inventory_secrets

.PHONY: reset-db
reset-db: ## DANGER: wipe DB volume (pgdata)
	@read -p "This will DELETE the Postgres volume 'pgdata'. Continue? [y/N] " ans; \
	if [[ $$ans == "y" || $$ans == "Y" ]]; then \
	  $(COMPOSE) down -v; \
	  echo "DB volume removed."; \
	else \
	  echo "Aborted."; \
	fi
