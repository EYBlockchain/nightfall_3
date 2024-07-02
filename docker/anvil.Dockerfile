FROM rust:1.76.0 AS runtime

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        libclang-dev

RUN git clone https://github.com/foundry-rs/foundry \
    && cd foundry \
    && git checkout 60ec002 \
    && cargo install --path ./crates/anvil --bins --locked --force

CMD ["anvil", "--host", "0.0.0.0", "--silent", "--port", "8546", "--block-time", "1", "--chain-id", "1337"]
 