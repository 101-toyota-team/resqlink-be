# CI/CD orchestration with nektos/act

.PHONY: test deploy-staging setup

# Runs tests locally
test:
	act -j backend-ci

# Runs staging deployment simulation locally
deploy-staging:
	act -j deploy --container-architecture linux/amd64

# Helper to initialize local env files
setup:
	@if [ ! -f .secrets ]; then cp .secrets.example .secrets && echo "Created .secrets. Please fill it."; fi
	@if [ ! -f .vars ]; then cp .vars.example .vars && echo "Created .vars. Please fill it."; fi
