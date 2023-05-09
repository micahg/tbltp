import { Middleware } from 'redux';
import axios from 'axios';

export const EnvironmentMiddleware: Middleware = storeAPI => next => action => {
  if (action.type === 'environment/config') {
    console.log(`Requesting config`);
    axios.get('/env.json').then(data => {
      action.payload = data;

      // small hack here for when we're running in combined docker.
      // saas images will have non localhost values returned by through a
      // k8s config map. Otherwise, if we're running on some non-localhost
      // value with our API_URL configured to localhost, just use combined
      // protocol/host/port as the base (for the combined docker image)
      const infApiUrl = `${window.location.protocol}//${window.location.hostname}:${window.location.port}`;
      if (action.payload.data.API_URL === "http://localhost:3000" && window.location.hostname !== 'localhost') {
        action.payload.data.API_URL = infApiUrl;
      }

      // same goes for webservices - as above so below
      const infWSUrl = `ws://${window.location.hostname}:${window.location.port}`
      if (action.payload.data.WS_URL === "ws://localhost:3000/" && window.location.hostname !== 'localhost') {
        action.payload.data.WS_URL = infWSUrl;
      }

      return next(action);
    }).catch(reason => {
      // TODO trigger an error
      console.error(`FAILED TO FETCH ${JSON.stringify(reason)}`)
    });
  } else {
    return next(action);
  }
}