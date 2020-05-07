# Running STAKE token supply calculator with Docker Compose

To run the [script](https://github.com/xdaichain/stake-token/tree/master/supply-calculator) on a live server, follow these steps:

1. Download `docker-compose.yml`:

    ```bash
    $ git clone -b docker-compose https://github.com/xdaichain/stake-token
    $ cd stake-token/supply-calculator
    ```

2. Edit `docker-compose.yml`: set `PORT` environment variable to an actual port.

3. Start:

    ```bash
    $ docker-compose up -d
    ```

This will automatically up and run the script. Docker Compose will
- download the required image from Docker Hub: [stake-token-supply-calculator](https://hub.docker.com/r/poanetwork/stake-token-supply-calculator);
- create container from it;
- start up the container.
  
## Troubleshooting

To view logs run `docker-compose logs`.
