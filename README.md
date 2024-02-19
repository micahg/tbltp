# tbltp monorepo

Monorepo for open source network table-top, which aims to be:

* An alternative to printing maps
* Free for you to run on your own hardware

## Running With Docker

Download https://raw.githubusercontent.com/micahg/tbltp/main/compose.yaml, and run `docker compose up`.

For example:

```
curl "https://raw.githubusercontent.com/micahg/tbltp/main/compose.yaml" -o compose.yaml
docker compose up
```

And then everything should be available on http://localhost:8080/.