# Network Tabletop Server

Node.js server implementation that

* accepts resources from the editing client
* notifies the tabletop client of updates

## Technologies

* Node.js for the base server
* Express for request handling
* Multer for image upload
* ws for websocket communication (status updates to the tabletop client)

## Testing Upload

```
curl -v -X PUT http://localhost:3000/asset -F "layer=background" -F "image=@image.png"
curl -v -X PUT http://localhost:3000/asset -F "layer=background" -F "image=https://media.dndbeyond.com/compendium-images/lmop/M14LHJMMQhUuZ46S/map-1.1-Cragmaw-Hideout-player.jpg"
```

Where image is actually located at ./image.png