
install:
	podman compose build

dev:
	podman compose up -d --build
stop:
	podman compose down -v
clean:
	podman system prune -f
