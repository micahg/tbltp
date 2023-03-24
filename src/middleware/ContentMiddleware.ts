import { Middleware, MiddlewareAPI } from 'redux';
import axios, { AxiosResponse } from 'axios';
import { AppReducerState } from '../reducers/AppReducer';
import { Rect } from '../utils/geometry';
import { json } from 'stream/consumers';

function isBlob(payload: URL | Blob): payload is File {
  return (payload as Blob).type !== undefined;
}

function sendFile(storeAPI: MiddlewareAPI, blob: File | URL, layer: string): Promise<AxiosResponse> {
  return new Promise((resolve, reject) => {

    let state: AppReducerState = storeAPI.getState();
    if (!state.environment.api) {
      // TODO MICAH display error
      return reject(`UNABLE TO GET API FROM STATE`);
    }
  
    let url: string = `${state.environment.api}/asset`;
    let formData = new FormData();
    let contentType: string = isBlob(blob) ? blob.type : 'multipart/form-data';
    let content: Blob | string = isBlob(blob) ? blob as Blob : blob.toString();
    formData.append('layer', layer);
    formData.append('image', content);
    axios.put(url, formData, { headers: { 'Content-Type': contentType }}).then(value => resolve(value))
      .catch(err => reject(err));
  });
}

function zoom(store: MiddlewareAPI, rect: Rect): Promise<Rect> {
  return new Promise((resolve, reject) => {

    let state: AppReducerState = store.getState();
    if (!state.environment.api) {
      // TODO MICAH display error
      return reject(`UNABLE TO GET API FROM STATE`);
    }

    let url: string = `${state.environment.api}/viewport`;
    axios.put(url,rect).then(value => resolve(value.data))
      .catch(err => reject(err));
  });
}

export const ContentMiddleware: Middleware = storeAPI => next => action=> {
  switch (action.type) {
    case 'content/push':
      let state: AppReducerState = storeAPI.getState();
      if (!state.environment.api) {
        // TODO MICAH display error
        console.error(`Unable to get API from state`);
        return;
      }

      let url: string = `${state.environment.api}/state`;

      axios.put(url).then(() => {
        action.payload = (new Date()).getTime();
        next(action);  
      }).catch(err => {
        // TODO MICAH DISPLAY ERROR
        console.error(`Unable to update state: ${JSON.stringify(err)}`);
        next(action);
      });
      break;
    case 'content/pull': {
      let state: AppReducerState = storeAPI.getState();
      if (!state.environment.api) {
        // TODO MICAH display error
        console.error(`Unable to get API from state`);
        return;
      }

      let url: string = `${state.environment.api}/state`;
      axios.get(url).then((value) => next({...action, payload: value.data}))
        .catch(err => {
          // TODO MICAH display error
          console.error(`Unable to get state: ${JSON.stringify(err)}`);
        });
    }
    break;
    case 'content/background':
      sendFile(storeAPI, action.payload, 'background').then((value) => {
        let ts: number = (new Date()).getTime();
        action.payload = `${value.data.path}?${ts}`;
        return next(action);
      }).catch(err => console.error(`Unable to update overlay: ${JSON.stringify(err)}`));
      break;
    case 'content/overlay':
      // undefined means we're wiping the canvas... probably a new background
      if (action.payload === undefined) return next(action);

      // if we have an overlay payload then send it
      sendFile(storeAPI, action.payload, 'overlay').then((value) => {
        return next(action);
      }).catch(err => console.error(`Unable to update overlay: ${JSON.stringify(err)}`));
      break;
    case 'content/zoom':
      if (action.payload === undefined) return;
      zoom(storeAPI, action.payload).then(value => {
        action.payload = value;
        next(action);
      }).catch(err => console.error(`Unable to update viewport: ${JSON.stringify(err)}`));
      break;
    default:
      next(action);
      break;
  }
}