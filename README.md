# tbltp monorepo

Monorepo for open source network table-top, which aims to be:

* An alternative to printing maps
* Free for you to run on your own hardware
* Easy to use on any display
  * Right now this is just done using a full-screen browser

## Running With Docker

Download https://raw.githubusercontent.com/micahg/tbltp/main/compose.yaml, and run `docker compose up`.

For example:

```
curl "https://raw.githubusercontent.com/micahg/tbltp/main/compose.yaml" -o compose.yaml
docker compose up
```

And then everything should be available on http://localhost:8080/.

## Instructional Videos

| Installation | Using the Editor |
| ------------ | ---------------- |
|[![Installing tbltp](https://img.youtube.com/vi/_ADo3CKNORU/default.jpg)](https://youtu.be/_ADo3CKNORU)|[![tbltp editor](https://img.youtube.com/vi/-1dxslmHktc/default.jpg)](https://youtu.be/-1dxslmHktc)|

## Development

See [Contributing](CONTRIBUTING.md)