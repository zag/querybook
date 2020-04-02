SHELL := /bin/bash

bundled: dev_image
	docker-compose --file containers/docker-compose.bundled.yml up

bundled_off:
	docker-compose --file containers/docker-compose.bundled.yml down

web: dev_image remove_running_dev_image
	docker-compose -f containers/docker-compose.dev.yml run web

worker: dev_image
	docker-compose -f containers/docker-compose.dev.yml run worker

scheduler: dev_image
	docker-compose -f containers/docker-compose.dev.yml run scheduler

terminal: dev_image
	docker-compose -f containers/docker-compose.dev.yml run terminal


prod_web:
	docker-compose -f containers/docker-compose.prod.yml run web

prod_worker:
	docker-compose -f containers/docker-compose.prod.yml run worker

prod_scheduler:
	docker-compose -f containers/docker-compose.prod.yml run scheduler

prod_image:
	docker build --pull -t datahub -f containers/prod.Dockerfile .

dev_image:
	docker build --pull -t datahub-dev -f containers/dev.Dockerfile .

docs: docs_image
	docker-compose -f docs_website/docker-compose.yml --project-directory=. up

docs_image:
	docker build --file docs_website/Dockerfile -t docusaurus-doc .


install:
	make install_pip_runtime_dependencies
	make install_yarn_packages

install_pip_runtime_dependencies:
	pip install -r ./requirements.txt

install_yarn_packages:
	yarn install --ignore-scripts --frozen-lockfile --pure-lockfile --ignore-engines && npm rebuild node-sass

remove_running_dev_image:
	$(eval RUNNING_CONTAINERS=$(shell sh -c 'docker ps -q --filter name=datahub_devserver'))
	docker kill $(RUNNING_CONTAINERS) || true

unit_test: dev_image
	docker-compose --file containers/docker-compose.test.yml up --abort-on-container-exit

clean: clean_pyc clean_docker
clean_pyc:
	find . -name "*.pyc" -delete
	find . -type d -name __pycache__ -delete
clean_docker:
	docker system prune --volumes