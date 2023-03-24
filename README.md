# Network Tabletop Server

Node.js server implementation that

* accepts resources from the editing client
* notifies the tabletop client of updates

## Technologies

* Node.js for the base server
* Express for request handling
* Multer for image upload
* ws for websocket communication (status updates to the tabletop client)

## Future Work

* Firebase Auth
* Stateful game (multiple maps and overlays saved)
* DM content vs Table content (eg: DM versions of images with annotations)
* Notes
  * To track NPCs, prior events, etc and tie them to a place
* Beyond Integration?

## Testing

```
curl -v -X PUT http://localhost:3000/asset -F "layer=background" -F "image=@image.png"
curl -v -X PUT http://localhost:3000/asset -F "layer=background" -F "image=https://media.dndbeyond.com/compendium-images/lmop/M14LHJMMQhUuZ46S/map-1.1-Cragmaw-Hideout-player.jpg"
curl -v -X PUT http://localhost:3000/state
curl -v -X PUT http://localhost:3000/viewport -H 'Content-Type: application/json' -d '{"x":0,"y": 0, "width": 1, "height": 1}'
```

Where image is actually located at ./image.png