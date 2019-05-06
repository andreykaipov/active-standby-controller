repository := quay.io/qoqodev/active-standby-controller

default: slim

build:
	docker build --rm -t $(repository):latest .

slim: build
	echo | docker-slim build --tag $(repository):slim $(repository):latest

push:
	docker push $(repository):slim
