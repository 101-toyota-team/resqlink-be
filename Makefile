# CI/CD orchestration with nektos/act

.PHONY: test deploy-staging setup

# Runs tests locally
test:
	act -j backend-ci

# Runs staging deployment simulation locally
deploy-staging:
	act -j deploy --secret-file .secrets.staging --var-file .vars.staging --container-architecture linux/amd64

# Helper to initialize local env files
setup:
	@# Root environment
	@[ -f .secrets ] || (cp .secrets.example .secrets && echo "Created .secrets")
	@[ -f .vars ] || (cp .vars.example .vars && echo "Created .vars")
	@# Staging environment
	@[ -f .secrets.staging ] || (cp .secrets.staging.example .secrets.staging && echo "Created .secrets.staging")
	@[ -f .vars.staging ] || (cp .vars.staging.example .vars.staging && echo "Created .vars.staging")
	@# Backend worker env
	@[ -f backend/.dev.vars ] || (cp backend/.dev.vars.example backend/.dev.vars && echo "Created backend/.dev.vars")
